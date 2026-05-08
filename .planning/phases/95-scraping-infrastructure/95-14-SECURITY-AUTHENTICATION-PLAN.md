# Plan 95-14: Security & Authentication

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 14 - Security & Authentication  
**Status:** Ready  
**Priority:** P0 (Critical - Production Blocker)  
**Estimated Effort:** 8 hours  
**Dependencies:** None

---

## Objective

Secure all admin and operational endpoints with proper authentication and implement comprehensive audit logging for all administrative actions. This is a **production blocker** - the current system allows anyone to trigger emergency stops, drain queues, or manipulate migration state.

---

## Current State Analysis

### Security Gaps Identified

**1. Unprotected Admin Endpoints** (`routes/admin.ts`)
```
POST /admin/migration/:feature/advance     # Can advance migration state
POST /admin/migration/:feature/rollback    # Can rollback migrations
POST /admin/emergency-stop                 # Can stop entire system
POST /admin/resume                         # Can resume system
POST /admin/cache/warm                     # Can trigger cache warming
POST /admin/cache/invalidate               # Can invalidate caches
POST /admin/queue/drain                    # Can drain job queues
POST /admin/domain/:domain/reset           # Can reset domain learning
```

**2. Unprotected Health Endpoints** (`routes/health.ts`)
```
POST /circuits/:tier/close                 # Can manipulate circuit breakers
POST /circuits/:tier/open                  # Can force circuits open
```

**3. No Audit Trail**
- No logging of who performed admin actions
- No logging of when actions occurred
- No logging of what parameters were used
- Cannot investigate incidents or track changes

### Risk Assessment

| Endpoint | Risk | Impact |
|----------|------|--------|
| `/admin/emergency-stop` | CRITICAL | Complete service outage |
| `/admin/queue/drain` | HIGH | Data loss, job failures |
| `/admin/migration/*/rollback` | HIGH | Feature regression |
| `/circuits/*/open` | MEDIUM | Degraded performance |
| `/admin/cache/invalidate` | MEDIUM | Increased costs |

---

## Task Breakdown

### Task 1: Create Authentication Middleware

**File:** `open-seo-main/src/server/features/scraping/middleware/adminAuth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

// Environment variables:
// SCRAPING_ADMIN_API_KEY - Required API key for admin endpoints
// SCRAPING_ADMIN_ALLOWED_IPS - Optional comma-separated IP allowlist

interface AdminAuthConfig {
  apiKeyHeader: string;
  allowedIps?: string[];
  requireApiKey: boolean;
}

const defaultConfig: AdminAuthConfig = {
  apiKeyHeader: 'x-scraping-admin-key',
  requireApiKey: true,
};

export function createAdminAuthMiddleware(config: Partial<AdminAuthConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  const adminApiKey = process.env.SCRAPING_ADMIN_API_KEY;
  const allowedIps = process.env.SCRAPING_ADMIN_ALLOWED_IPS?.split(',').map(ip => ip.trim());

  if (finalConfig.requireApiKey && !adminApiKey) {
    console.warn('[SECURITY] SCRAPING_ADMIN_API_KEY not set - admin endpoints will reject all requests');
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // IP allowlist check (if configured)
    if (allowedIps && allowedIps.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress;
      if (!allowedIps.includes(clientIp!)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'IP not in allowlist',
        });
      }
    }

    // API key validation
    if (finalConfig.requireApiKey) {
      const providedKey = req.headers[finalConfig.apiKeyHeader] as string;
      
      if (!providedKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing admin API key',
        });
      }

      if (!adminApiKey) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Admin authentication not configured',
        });
      }

      // Timing-safe comparison to prevent timing attacks
      const providedBuffer = Buffer.from(providedKey);
      const expectedBuffer = Buffer.from(adminApiKey);
      
      if (providedBuffer.length !== expectedBuffer.length || 
          !timingSafeEqual(providedBuffer, expectedBuffer)) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid admin API key',
        });
      }
    }

    // Attach admin context to request
    (req as any).adminContext = {
      authenticatedAt: new Date().toISOString(),
      clientIp: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    next();
  };
}

export const requireAdminAuth = createAdminAuthMiddleware();
```

**Acceptance Criteria:**
- [ ] API key validation with timing-safe comparison
- [ ] Optional IP allowlist support
- [ ] Clear error messages for auth failures
- [ ] Admin context attached to request for audit logging

---

### Task 2: Create Audit Logger

**File:** `open-seo-main/src/server/features/scraping/monitoring/AuditLogger.ts`

```typescript
import { db } from '@/db';
import { scrapingAuditLogs } from '@/db/scraping-audit-schema';
import { getRedisClient } from '../cache/redis';

export type AuditAction = 
  | 'emergency_stop'
  | 'resume'
  | 'circuit_force_open'
  | 'circuit_force_close'
  | 'migration_advance'
  | 'migration_rollback'
  | 'cache_warm'
  | 'cache_invalidate'
  | 'queue_drain'
  | 'domain_reset'
  | 'config_change';

export type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditEntry {
  action: AuditAction;
  severity: AuditSeverity;
  actor: {
    ip: string;
    userAgent?: string;
    apiKeyPrefix?: string; // First 8 chars for identification
  };
  target?: {
    type: string;
    id: string;
  };
  parameters?: Record<string, unknown>;
  result: 'success' | 'failure';
  errorMessage?: string;
  duration_ms?: number;
}

const SEVERITY_MAP: Record<AuditAction, AuditSeverity> = {
  emergency_stop: 'critical',
  resume: 'warning',
  circuit_force_open: 'warning',
  circuit_force_close: 'warning',
  migration_advance: 'warning',
  migration_rollback: 'critical',
  cache_warm: 'info',
  cache_invalidate: 'warning',
  queue_drain: 'critical',
  domain_reset: 'info',
  config_change: 'warning',
};

class AuditLogger {
  private buffer: AuditEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.startFlushInterval();
  }

  async log(entry: Omit<AuditEntry, 'severity'>): Promise<void> {
    const fullEntry: AuditEntry = {
      ...entry,
      severity: SEVERITY_MAP[entry.action],
    };

    // Always log critical actions immediately
    if (fullEntry.severity === 'critical') {
      await this.persistEntry(fullEntry);
      await this.alertOnCritical(fullEntry);
    } else {
      this.buffer.push(fullEntry);
      if (this.buffer.length >= this.BUFFER_SIZE) {
        await this.flush();
      }
    }

    // Also publish to Redis for real-time monitoring
    await this.publishToRedis(fullEntry);
  }

  private async persistEntry(entry: AuditEntry): Promise<void> {
    try {
      await db.insert(scrapingAuditLogs).values({
        action: entry.action,
        severity: entry.severity,
        actorIp: entry.actor.ip,
        actorUserAgent: entry.actor.userAgent,
        actorApiKeyPrefix: entry.actor.apiKeyPrefix,
        targetType: entry.target?.type,
        targetId: entry.target?.id,
        parameters: entry.parameters,
        result: entry.result,
        errorMessage: entry.errorMessage,
        durationMs: entry.duration_ms,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('[AuditLogger] Failed to persist entry:', error);
    }
  }

  private async publishToRedis(entry: AuditEntry): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.publish('scraping:audit', JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      // Redis publish failure is non-critical
    }
  }

  private async alertOnCritical(entry: AuditEntry): Promise<void> {
    // Import AlertManager and fire alert for critical admin actions
    const { getAlertManager } = await import('./AlertManager');
    const alertManager = getAlertManager();
    
    await alertManager.fireAlert({
      name: `admin-action-${entry.action}`,
      severity: 'warning',
      message: `Critical admin action: ${entry.action} by ${entry.actor.ip}`,
      context: {
        action: entry.action,
        actor: entry.actor,
        target: entry.target,
        result: entry.result,
      },
    });
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const entries = [...this.buffer];
    this.buffer = [];
    
    for (const entry of entries) {
      await this.persistEntry(entry);
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, this.FLUSH_INTERVAL_MS);
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

// Singleton instance
let auditLogger: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    auditLogger = new AuditLogger();
  }
  return auditLogger;
}

// Helper for route handlers
export function createAuditContext(req: any): AuditEntry['actor'] {
  const apiKey = req.headers['x-scraping-admin-key'] as string;
  return {
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'],
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) : undefined,
  };
}
```

**Acceptance Criteria:**
- [ ] Buffered writes for non-critical actions
- [ ] Immediate persistence for critical actions
- [ ] Redis pub/sub for real-time monitoring
- [ ] Alert integration for critical actions
- [ ] Graceful shutdown with buffer flush

---

### Task 3: Create Audit Schema

**File:** `open-seo-main/src/db/scraping-audit-schema.ts`

```typescript
import { pgTable, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';

export const scrapingAuditLogs = pgTable('scraping_audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  
  // Action details
  action: text('action').notNull(),
  severity: text('severity').notNull(), // 'info' | 'warning' | 'critical'
  
  // Actor information
  actorIp: text('actor_ip').notNull(),
  actorUserAgent: text('actor_user_agent'),
  actorApiKeyPrefix: text('actor_api_key_prefix'), // First 8 chars for identification
  
  // Target information
  targetType: text('target_type'), // 'circuit', 'migration', 'cache', 'queue', 'domain'
  targetId: text('target_id'),
  
  // Action details
  parameters: jsonb('parameters'),
  result: text('result').notNull(), // 'success' | 'failure'
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Query patterns:
  // 1. Recent actions by severity
  severityCreatedIdx: index('scraping_audit_severity_created_idx')
    .on(table.severity, table.createdAt),
  
  // 2. Actions by actor IP
  actorIpIdx: index('scraping_audit_actor_ip_idx')
    .on(table.actorIp, table.createdAt),
  
  // 3. Actions by type
  actionIdx: index('scraping_audit_action_idx')
    .on(table.action, table.createdAt),
  
  // 4. Failed actions
  failuresIdx: index('scraping_audit_failures_idx')
    .on(table.result, table.createdAt),
  
  // 5. Cleanup old logs
  createdAtIdx: index('scraping_audit_created_at_idx')
    .on(table.createdAt),
}));

export type ScrapingAuditLog = typeof scrapingAuditLogs.$inferSelect;
export type NewScrapingAuditLog = typeof scrapingAuditLogs.$inferInsert;
```

**Acceptance Criteria:**
- [ ] All required columns defined
- [ ] Proper indexes for query patterns
- [ ] JSONB for flexible parameters storage

---

### Task 4: Apply Authentication to Admin Routes

**File:** `open-seo-main/src/server/features/scraping/routes/admin.ts` (modify)

```typescript
import { Router } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import { getAuditLogger, createAuditContext } from '../monitoring/AuditLogger';

const router = Router();
const auditLogger = getAuditLogger();

// Apply authentication to ALL admin routes
router.use(requireAdminAuth);

// Wrap existing handlers with audit logging
router.post('/emergency-stop', async (req, res) => {
  const startTime = Date.now();
  const actor = createAuditContext(req);
  
  try {
    // Existing emergency stop logic...
    const result = await scrapingService.emergencyStop();
    
    await auditLogger.log({
      action: 'emergency_stop',
      actor,
      result: 'success',
      duration_ms: Date.now() - startTime,
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    await auditLogger.log({
      action: 'emergency_stop',
      actor,
      result: 'failure',
      errorMessage: error.message,
      duration_ms: Date.now() - startTime,
    });
    
    res.status(500).json({ error: error.message });
  }
});

// Similar pattern for all other endpoints...
router.post('/migration/:feature/advance', async (req, res) => {
  const startTime = Date.now();
  const actor = createAuditContext(req);
  const { feature } = req.params;
  
  try {
    const result = await migrationRollout.advanceFeature(feature);
    
    await auditLogger.log({
      action: 'migration_advance',
      actor,
      target: { type: 'migration', id: feature },
      parameters: { fromState: result.previousState, toState: result.newState },
      result: 'success',
      duration_ms: Date.now() - startTime,
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    await auditLogger.log({
      action: 'migration_advance',
      actor,
      target: { type: 'migration', id: feature },
      result: 'failure',
      errorMessage: error.message,
      duration_ms: Date.now() - startTime,
    });
    
    res.status(500).json({ error: error.message });
  }
});

// ... continue for all admin endpoints
```

**Acceptance Criteria:**
- [ ] All admin endpoints require authentication
- [ ] All admin actions are audit logged
- [ ] Consistent error handling and response format
- [ ] Duration tracking for performance monitoring

---

### Task 5: Apply Authentication to Health Route Mutations

**File:** `open-seo-main/src/server/features/scraping/routes/health.ts` (modify)

```typescript
import { requireAdminAuth } from '../middleware/adminAuth';
import { getAuditLogger, createAuditContext } from '../monitoring/AuditLogger';

// Read-only health endpoints remain public
router.get('/health', healthHandler);
router.get('/health/live', liveHandler);
router.get('/health/ready', readyHandler);
router.get('/health/detailed', detailedHandler);
router.get('/health/circuits', circuitsHandler);
router.get('/health/queues', queuesHandler);
router.get('/metrics', metricsHandler);
router.get('/status', statusHandler);

// Mutation endpoints require admin auth
router.post('/circuits/:tier/close', requireAdminAuth, async (req, res) => {
  const startTime = Date.now();
  const actor = createAuditContext(req);
  const { tier } = req.params;
  
  try {
    tieredFetcher.forceCircuitClose(tier);
    
    await auditLogger.log({
      action: 'circuit_force_close',
      actor,
      target: { type: 'circuit', id: tier },
      result: 'success',
      duration_ms: Date.now() - startTime,
    });
    
    res.json({ success: true, tier, state: 'closed' });
  } catch (error) {
    await auditLogger.log({
      action: 'circuit_force_close',
      actor,
      target: { type: 'circuit', id: tier },
      result: 'failure',
      errorMessage: error.message,
      duration_ms: Date.now() - startTime,
    });
    
    res.status(500).json({ error: error.message });
  }
});

router.post('/circuits/:tier/open', requireAdminAuth, async (req, res) => {
  // Similar pattern...
});
```

**Acceptance Criteria:**
- [ ] GET endpoints remain public (monitoring access)
- [ ] POST endpoints require authentication
- [ ] Circuit manipulation is audit logged

---

### Task 6: Add Audit Log Query Endpoints

**File:** `open-seo-main/src/server/features/scraping/routes/admin.ts` (add)

```typescript
// Audit log query endpoints (also require admin auth)
router.get('/audit/logs', async (req, res) => {
  const { 
    severity,
    action,
    actorIp,
    since,
    until,
    limit = 100,
    offset = 0,
  } = req.query;

  const query = db.select().from(scrapingAuditLogs);
  
  // Apply filters...
  if (severity) query.where(eq(scrapingAuditLogs.severity, severity));
  if (action) query.where(eq(scrapingAuditLogs.action, action));
  if (actorIp) query.where(eq(scrapingAuditLogs.actorIp, actorIp));
  if (since) query.where(gte(scrapingAuditLogs.createdAt, new Date(since)));
  if (until) query.where(lte(scrapingAuditLogs.createdAt, new Date(until)));
  
  const logs = await query
    .orderBy(desc(scrapingAuditLogs.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));
    
  res.json({ logs, count: logs.length });
});

router.get('/audit/summary', async (req, res) => {
  const { since = '24h' } = req.query;
  const sinceDate = parseDuration(since);
  
  const summary = await db
    .select({
      action: scrapingAuditLogs.action,
      severity: scrapingAuditLogs.severity,
      successCount: sql<number>`count(*) filter (where result = 'success')`,
      failureCount: sql<number>`count(*) filter (where result = 'failure')`,
    })
    .from(scrapingAuditLogs)
    .where(gte(scrapingAuditLogs.createdAt, sinceDate))
    .groupBy(scrapingAuditLogs.action, scrapingAuditLogs.severity);
    
  res.json({ summary, period: since });
});
```

**Acceptance Criteria:**
- [ ] Query logs with filters (severity, action, actor, time range)
- [ ] Summary endpoint for dashboard integration
- [ ] Proper pagination support

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCRAPING_ADMIN_API_KEY` | YES (prod) | - | API key for admin authentication |
| `SCRAPING_ADMIN_ALLOWED_IPS` | NO | - | Comma-separated IP allowlist |

---

## Testing Requirements

### Unit Tests

```typescript
describe('AdminAuth Middleware', () => {
  it('should reject requests without API key');
  it('should reject requests with invalid API key');
  it('should accept requests with valid API key');
  it('should reject requests from non-allowed IPs');
  it('should use timing-safe comparison');
});

describe('AuditLogger', () => {
  it('should persist critical actions immediately');
  it('should buffer non-critical actions');
  it('should flush buffer on interval');
  it('should publish to Redis');
  it('should alert on critical actions');
});
```

### Integration Tests

```typescript
describe('Admin Endpoints Authentication', () => {
  it('should return 401 for unauthenticated emergency-stop');
  it('should return 200 for authenticated emergency-stop');
  it('should create audit log on successful action');
  it('should create audit log on failed action');
});
```

---

## Acceptance Criteria

- [ ] All admin endpoints require valid API key
- [ ] All admin actions create audit log entries
- [ ] Critical actions trigger alerts
- [ ] Audit logs queryable via API
- [ ] No authentication required for read-only health endpoints
- [ ] TypeScript compiles without errors
- [ ] All tests pass
