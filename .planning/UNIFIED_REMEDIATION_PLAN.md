# Unified Remediation Plan

> **Generated:** 2026-05-03
> **Status:** Multi-phase remediation plan consolidated from 20-agent code review

This document consolidates remediation tasks across all domains into a unified, phased execution plan.

---

## Related Plans

| Plan | Focus | Priority | Duration |
|------|-------|----------|----------|
| [DB-CONSOLIDATION-PLAN.md](./phases/DB-CONSOLIDATION-PLAN.md) | Database consolidation (open_seo + alwrity -> tevero) | CRITICAL | 3 weeks |

---

## Phase 2: Integration Hardening (Week 3-4)

**Focus**: Fix cross-service authentication, client context security, API contract alignment, and state management issues.

**Prerequisites**: Phase 1 (Deployment Blockers) complete.

**Source Issues**:
- AUTH-HIGH-01, AUTH-HIGH-02: Inconsistent auth patterns
- CRITICAL-01: Empty X-Client-ID bypass
- HIGH-01: Race condition during client switching
- HIGH-02: Ownership cache TTL mismatch
- HIGH-03: apps/web missing defense-in-depth
- API-02, API-05, API-09, API-01: API contract issues
- HIGH-STATE-01, HIGH-STATE-02, HIGH-STATE-03: State management issues

---

### 2.1 Authentication Flow Fixes

#### 2.1.1 Standardize JWT Verification Across Services

**Issue**: `X-User-Id` header trusted without backend JWT verification.

**Files to Modify**:
- `open-seo-main/src/server/lib/client-context.ts` (line 84-117)
- `open-seo-main/src/server/lib/clerk-verify.ts` (NEW FILE)

**Implementation**:

```typescript
// open-seo-main/src/server/lib/clerk-verify.ts - NEW FILE
import { verifyToken } from '@clerk/backend';
import { AppError } from '@/server/lib/errors';

export async function verifyClerkToken(token: string): Promise<{ userId: string; orgId?: string }> {
  try {
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    return { userId: claims.sub, orgId: claims.org_id };
  } catch (error) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token');
  }
}
```

```typescript
// open-seo-main/src/server/lib/client-context.ts - MODIFY resolveClientId()
import { verifyClerkToken } from '@/server/lib/clerk-verify';

export async function resolveClientId(headers: Headers, url?: string): Promise<string | null> {
  // ... existing client ID extraction ...
  
  // SECURITY FIX: Validate user from JWT, not trusted header
  const authHeader = headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    const internalToken = headers.get('x-internal-service-token');
    if (internalToken && process.env.INTERNAL_SERVICE_TOKEN) {
      // ... existing internal token validation ...
      return clientId;
    }
    throw new AppError('UNAUTHORIZED', 'Missing authentication');
  }
  
  const token = authHeader.slice(7);
  const { userId } = await verifyClerkToken(token);
  
  await validateClientOwnership(userId, clientId);
  return clientId;
}
```

**Acceptance Criteria**:
- [ ] All API routes use JWT from `Authorization: Bearer` header
- [ ] open-seo-main validates Clerk JWT tokens directly
- [ ] Integration test: Forged X-User-Id without valid JWT is rejected

---

### 2.2 Client Context Security

#### 2.2.1 Fix Empty X-Client-ID Bypass (CRITICAL-01)

**Issue**: Empty `X-Client-ID` header can bypass authorization when `context.clientId` is null.

**Location**: `open-seo-main/src/serverFunctions/briefs.ts` (8 occurrences)

**Fix**: Add `requireClientContext` middleware:

```typescript
// open-seo-main/src/serverFunctions/middleware.ts - ADD
export const requireClientContext = [
  createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const authenticatedContext = getAuthenticatedContext(context);
    await requireManagedServiceAccess(authenticatedContext);

    const { headers, url } = getRequest();
    const clientId = await resolveClientId(headers, url);

    if (!clientId) {
      throw new AppError("BAD_REQUEST", "Client context required. Set X-Client-ID header.");
    }

    return next({ context: { ...authenticatedContext, clientId } });
  }),
] as const;
```

**Files to Update**: Change middleware to `requireClientContext`:
- `open-seo-main/src/serverFunctions/briefs.ts`
- `open-seo-main/src/serverFunctions/voice.ts`
- `open-seo-main/src/serverFunctions/proposals.ts`
- `open-seo-main/src/serverFunctions/goals.ts`

**Acceptance Criteria**:
- [ ] Empty X-Client-ID returns 400 Bad Request
- [ ] Integration test: Request without X-Client-ID to /api/content/briefs returns 400

---

#### 2.2.2 Add AbortController for Client Switching (HIGH-01)

**Issue**: Race condition during rapid client switching.

**Implementation**:

```typescript
// apps/web/src/lib/client-context/abort-manager.ts - NEW FILE
const clientAbortControllers = new Map<string, AbortController>();

export function getClientScopedSignal(clientId: string): AbortSignal {
  let controller = clientAbortControllers.get(clientId);
  if (!controller || controller.signal.aborted) {
    controller = new AbortController();
    clientAbortControllers.set(clientId, controller);
  }
  return controller.signal;
}

export function abortClientRequests(excludeClientId: string): void {
  for (const [clientId, controller] of clientAbortControllers.entries()) {
    if (clientId !== excludeClientId && !controller.signal.aborted) {
      controller.abort(new Error('Client switched'));
    }
  }
}
```

```typescript
// apps/web/src/stores/clientStore.ts - MODIFY setActiveClient
import { abortClientRequests } from '@/lib/client-context/abort-manager';

setActiveClient: (id: string) => {
  const { clients, activeClientId } = get();
  const activeClient = clients.find((c) => c.id === id) ?? null;
  if (!activeClient) return;

  if (activeClientId && activeClientId !== id) {
    abortClientRequests(id);  // Abort in-flight requests for previous client
  }

  set({ activeClientId: id, activeClient, lastValidatedAt: Date.now() });
},
```

**Acceptance Criteria**:
- [ ] Client switch aborts in-flight requests for previous client
- [ ] E2E test: Rapid client switching does not show stale data

---

#### 2.2.3 Implement Redis Pub/Sub Cache Invalidation (HIGH-02)

**Issue**: 30-second ownership cache TTL allows stale access after revocation.

**Implementation**:

```typescript
// open-seo-main/src/server/lib/ownership-subscriber.ts - NEW FILE
import { redis } from '@/server/lib/redis';
import { invalidateOwnershipCache } from '@/lib/auth/client-ownership';

const OWNERSHIP_CHANNEL = 'tevero:ownership:changes';

export async function subscribeToOwnershipChanges(): Promise<void> {
  const subscriber = redis.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(OWNERSHIP_CHANNEL, async (message) => {
    const event = JSON.parse(message);
    if (event.type === 'access_revoked' && event.userId) {
      await invalidateOwnershipCache(event.userId, event.clientId);
    }
  });
}
```

```python
# AI-Writer - Publish on access revocation
async def revoke_client_access(user_id: str, client_id: str) -> None:
    # ... existing revocation logic ...
    redis_client.publish('tevero:ownership:changes', json.dumps({
        'type': 'access_revoked',
        'userId': user_id,
        'clientId': client_id,
        'timestamp': datetime.utcnow().isoformat(),
    }))
```

**Acceptance Criteria**:
- [ ] Cache invalidation within 100ms of revocation event
- [ ] Integration test: Revoke access -> immediate rejection

---

#### 2.2.4 Add Defense-in-Depth in apps/web (HIGH-03)

**Implementation**:

```typescript
// apps/web/src/lib/auth/api-auth.ts - ADD
export async function validateClientAccessMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const clientId = req.headers.get('x-client-id');
  if (!clientId) return null;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: 'Invalid client ID format' }, { status: 400 });
  }

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const result = await checkClientOwnership(userId, clientId);
  if (!result.hasAccess) {
    return NextResponse.json({ error: 'Access denied to this client' }, { status: 403 });
  }

  return null;
}
```

**Acceptance Criteria**:
- [ ] Invalid client ID returns 400 before reaching backend
- [ ] Access denied returns 403 before reaching backend

---

### 2.3 API Contract Alignment

#### 2.3.1 Add Zod Schemas to Webhook Endpoints (API-02)

**Location**: `open-seo-main/src/routes/api/webhooks.ts`

```typescript
const createWebhookSchema = z.object({
  scope: z.enum(['global', 'workspace', 'client']),
  scopeId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  url: z.string().url().refine((url) => url.startsWith('https://'), 'Must use HTTPS'),
  events: z.array(z.string().min(1).max(100)).min(1).max(50),
  headers: z.record(z.string().max(100), z.string().max(1000)).optional(),
  enabled: z.boolean().optional().default(true),
});
```

**Acceptance Criteria**:
- [ ] All POST/PATCH endpoints use Zod validation
- [ ] Validation errors return 400 with field-level details

---

#### 2.3.2 Implement Optimistic Locking (API-05)

**Database Migration**:
```sql
ALTER TABLE webhooks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER webhook_version_trigger BEFORE UPDATE ON webhooks
FOR EACH ROW EXECUTE FUNCTION increment_webhook_version();
```

**Backend**: Validate `expectedVersion` in WHERE clause, return 409 on mismatch.

**Acceptance Criteria**:
- [ ] PATCH with stale `expectedVersion` returns 409 Conflict
- [ ] Frontend handles 409 with refresh prompt

---

#### 2.3.3 Unify Event Schema Format (API-09)

```typescript
// packages/types/src/events/client-events.ts
export const ClientEventSchema = z.object({
  event_type: z.enum(['client.created', 'client.updated', 'client.deleted']),
  client_id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().optional(),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()).optional(),
  api_version: z.string().default('2024-04-01'),
  source: z.enum(['ai-writer', 'open-seo-main', 'apps-web']),
});
```

**Acceptance Criteria**:
- [ ] AI-Writer events match schema (snake_case keys)
- [ ] open-seo-main validates events with Zod

---

#### 2.3.4 Standardize Error Envelope (API-01)

```typescript
// open-seo-main/src/server/lib/response.ts
export function errorResponse(code: string, message: string, status = 400, details?: unknown): Response {
  return Response.json({ success: false, error: { code, message, ...(details && { details }) } }, { status });
}
```

**Acceptance Criteria**:
- [ ] All endpoints return `{ success, data/error }` envelope

---

### 2.4 State Management Migration

#### 2.4.1 Zustand to TanStack Query Migration

```typescript
// apps/web/src/hooks/use-clients.ts
export function useClients() {
  return useQuery({
    queryKey: ['clients', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/clients', { credentials: 'include' });
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveClient() {
  const { data: clients } = useClients();
  const activeClientId = useClientStore((s) => s.activeClientId);
  return clients?.find((c) => c.id === activeClientId) ?? null;
}
```

**Acceptance Criteria**:
- [ ] `useClients()` provides client list with caching
- [ ] Old `fetchClients()` calls migrated

---

#### 2.4.2 BroadcastChannel for Multi-Tab Sync (HIGH-STATE-02)

```typescript
// apps/web/src/lib/state/broadcast-sync.ts
const channel = new BroadcastChannel('tevero-state-sync');

channel.onmessage = (event) => {
  if (event.data.type === 'CLIENT_CHANGED') {
    setActiveClient(event.data.payload.activeClientId);
  }
};

export function broadcastClientChanged(activeClientId: string): void {
  channel.postMessage({ type: 'CLIENT_CHANGED', payload: { activeClientId } });
}
```

**Acceptance Criteria**:
- [ ] Client switch syncs across tabs
- [ ] Logout in one tab logs out all tabs

---

### 2.5 Testing Strategy

```typescript
// e2e/integration-hardening.spec.ts
describe('Integration Hardening', () => {
  test('empty X-Client-ID returns 400', async () => {
    const res = await fetch('/api/content/briefs', { headers: { 'X-Client-ID': '' } });
    expect(res.status).toBe(400);
  });

  test('access revocation is immediate', async () => {
    await revokeAccess('user-123', 'client-123');
    const res = await fetch('/api/clients/client-123/data');
    expect(res.status).toBe(403);
  });

  test('rapid client switching shows correct data', async ({ page }) => {
    for (const c of ['a', 'b', 'c', 'd']) {
      await page.click(`[data-testid="client-${c}"]`);
    }
    await expect(page.locator('[data-testid="client-name"]')).toHaveText('Client D');
  });
});
```

---

### 2.6 Phase 2 Summary

| Section | Issues Fixed | Priority | Est. Days |
|---------|--------------|----------|-----------|
| 2.1 Auth Fixes | AUTH-HIGH-01, AUTH-HIGH-02 | Critical | 2 |
| 2.2 Client Context | CRITICAL-01, HIGH-01, HIGH-02, HIGH-03 | Critical | 3 |
| 2.3 API Contracts | API-02, API-05, API-09, API-01 | High | 3 |
| 2.4 State Management | HIGH-STATE-01, HIGH-STATE-02 | High | 4 |
| 2.5 Testing | Verification | Required | 2 |
| **Total** | | | **14 days** |

---

## Phase 3: Data Integrity & Performance (Week 4-5)

**Focus**: Transaction safety, constraint enforcement, query optimization, background job reliability, and idempotency patterns.

**Prerequisites**: Phase 2 (Integration Hardening) complete.

**Source Issues**:
- CRIT-TRANS-01: Missing transaction wrappers
- CRIT-JOB-01, CRIT-JOB-02: Optimistic locking, atomic state transitions
- HIGH-CASCADE-01: APIKey missing CASCADE
- HIGH-QUERY-01 through HIGH-QUERY-05: N+1, unbounded queries, missing indexes
- HIGH-JOB-01 through HIGH-JOB-05: Job deduplication, DLQ, circuit breaker

---

### 3.1 Transaction Wrappers

#### 3.1.1 Implement withTransaction() Helper (Drizzle)

**Purpose**: Standardize transaction handling across open-seo-main.

**File to Create**: `open-seo-main/src/server/lib/db-transaction.ts`

```typescript
import { db } from '@/db';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppError } from '@/server/lib/errors';

type TransactionCallback<T> = (tx: PostgresJsDatabase) => Promise<T>;

export async function withTransaction<T>(
  callback: TransactionCallback<T>,
  options?: { isolationLevel?: 'read committed' | 'repeatable read' | 'serializable' }
): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      return await callback(tx);
    }, options);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('DATABASE_ERROR', 'Transaction failed', { cause: error });
  }
}
```

**Usage Pattern**:
```typescript
import { withTransaction } from '@/server/lib/db-transaction';

export async function convertProspectToClient(prospectId: string, clientData: ClientCreateData) {
  return withTransaction(async (tx) => {
    // 1. Create client
    const [client] = await tx.insert(clients).values(clientData).returning();
    
    // 2. Update prospect status
    await tx.update(prospects)
      .set({ status: 'converted', convertedClientId: client.id })
      .where(eq(prospects.id, prospectId));
    
    // 3. Migrate related records
    await tx.update(analysisResults)
      .set({ clientId: client.id })
      .where(eq(analysisResults.prospectId, prospectId));
    
    return client;
  });
}
```

**Acceptance Criteria**:
- [ ] All multi-table operations use withTransaction()
- [ ] Transaction failures roll back all changes
- [ ] Integration test: Partial failure leaves no orphaned records

---

#### 3.1.2 Fix convertProspectToClient Transaction Safety

**Location**: `open-seo-main/src/server/features/prospects/services/ProspectService.ts`

**Current Issue**: Client creation, prospect update, and record migration may partially succeed.

**Implementation**:

```typescript
// open-seo-main/src/server/features/prospects/services/ProspectService.ts
import { withTransaction } from '@/server/lib/db-transaction';

async convertToClient(prospectId: string, options: ConvertOptions): Promise<Client> {
  return withTransaction(async (tx) => {
    // Verify prospect exists and is convertible
    const prospect = await tx.query.prospects.findFirst({
      where: eq(prospects.id, prospectId),
    });
    
    if (!prospect) throw new AppError('NOT_FOUND', 'Prospect not found');
    if (prospect.status === 'converted') {
      throw new AppError('CONFLICT', 'Prospect already converted');
    }
    
    // Create client within transaction
    const [client] = await tx.insert(clients).values({
      name: prospect.businessName,
      domain: prospect.website,
      workspaceId: prospect.workspaceId,
      createdFromProspectId: prospectId,
    }).returning();
    
    // Update prospect status
    await tx.update(prospects)
      .set({ status: 'converted', convertedClientId: client.id, convertedAt: new Date() })
      .where(eq(prospects.id, prospectId));
    
    // Migrate analysis results
    await tx.update(analysisResults)
      .set({ clientId: client.id })
      .where(eq(analysisResults.prospectId, prospectId));
    
    return client;
  });
}
```

---

#### 3.1.3 Implement Saga Pattern for Cross-Database Operations

**Purpose**: Handle operations spanning open-seo-main (PostgreSQL) and AI-Writer (PostgreSQL).

**File to Create**: `open-seo-main/src/server/lib/saga.ts`

```typescript
type SagaStep<T> = {
  name: string;
  execute: () => Promise<T>;
  compensate: (result: T) => Promise<void>;
};

export async function executeSaga<T extends unknown[]>(
  steps: { [K in keyof T]: SagaStep<T[K]> }
): Promise<T> {
  const results: unknown[] = [];
  const completedSteps: Array<{ step: SagaStep<unknown>; result: unknown }> = [];
  
  try {
    for (const step of steps) {
      const result = await step.execute();
      results.push(result);
      completedSteps.push({ step: step as SagaStep<unknown>, result });
    }
    return results as T;
  } catch (error) {
    // Compensate in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const { step, result } = completedSteps[i];
      try {
        await step.compensate(result);
      } catch (compensateError) {
        console.error(`Saga compensation failed for ${step.name}:`, compensateError);
        // Log to dead letter queue for manual resolution
        await logSagaCompensationFailure(step.name, result, compensateError);
      }
    }
    throw error;
  }
}
```

**Usage for Cross-Service Operations**:

```typescript
// Create voice profile in AI-Writer, then link in open-seo-main
const [voiceProfile, linkRecord] = await executeSaga([
  {
    name: 'createVoiceProfile',
    execute: async () => {
      const res = await fetch(`${AI_WRITER_URL}/api/voice-profiles`, {
        method: 'POST',
        body: JSON.stringify(profileData),
      });
      return res.json();
    },
    compensate: async (profile) => {
      await fetch(`${AI_WRITER_URL}/api/voice-profiles/${profile.id}`, {
        method: 'DELETE',
      });
    },
  },
  {
    name: 'linkProfileToClient',
    execute: async () => {
      return db.insert(clientVoiceProfiles).values({
        clientId,
        voiceProfileId: voiceProfile.id,
      }).returning();
    },
    compensate: async (link) => {
      await db.delete(clientVoiceProfiles).where(eq(clientVoiceProfiles.id, link.id));
    },
  },
]);
```

---

#### 3.1.4 Fix Webhook Job Enqueue in Transaction

**Issue**: `convertProspectToClient` enqueues webhook jobs outside transaction boundary.

**Location**: `open-seo-main/src/server/features/prospects/services/ProspectService.ts`

**Fix**: Use BullMQ's `addBulk()` after transaction commits.

```typescript
import { webhookQueue } from '@/server/lib/queues';

async convertToClient(prospectId: string, options: ConvertOptions): Promise<Client> {
  const jobsToEnqueue: Array<{ name: string; data: unknown }> = [];
  
  const client = await withTransaction(async (tx) => {
    // ... transaction operations ...
    
    // Collect jobs to enqueue (don't enqueue inside transaction)
    jobsToEnqueue.push({
      name: 'client.created',
      data: { clientId: client.id, prospectId, workspaceId: prospect.workspaceId },
    });
    
    return client;
  });
  
  // Enqueue after transaction commits successfully
  if (jobsToEnqueue.length > 0) {
    await webhookQueue.addBulk(jobsToEnqueue.map(job => ({
      name: job.name,
      data: job.data,
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    })));
  }
  
  return client;
}
```

**Acceptance Criteria**:
- [ ] Transaction rollback does not leave orphaned webhook jobs
- [ ] Integration test: Failed conversion has zero webhook jobs enqueued

---

### 3.2 Cascade & Constraint Fixes

#### 3.2.1 Add CASCADE to APIKey.session_id (CRITICAL)

**Location**: `AI-Writer/backend/models/onboarding.py`

**Issue**: Deleting OnboardingSession orphans APIKey records.

**Fix**:

```python
# AI-Writer/backend/models/onboarding.py
class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("onboarding_sessions.id", ondelete="CASCADE"),  # ADD ondelete
        nullable=False,
    )
    # ... rest of model
```

**Migration**:

```sql
-- AI-Writer/alembic/versions/xxxx_add_apikey_cascade.py
"""Add CASCADE to api_keys.session_id"""
from alembic import op

def upgrade():
    op.drop_constraint('api_keys_session_id_fkey', 'api_keys', type_='foreignkey')
    op.create_foreign_key(
        'api_keys_session_id_fkey',
        'api_keys', 'onboarding_sessions',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )

def downgrade():
    op.drop_constraint('api_keys_session_id_fkey', 'api_keys', type_='foreignkey')
    op.create_foreign_key(
        'api_keys_session_id_fkey',
        'api_keys', 'onboarding_sessions',
        ['session_id'], ['id']
    )
```

---

#### 3.2.2 Implement Soft Delete Cascades

**Purpose**: When a client is soft-deleted, cascade to related records.

**File to Modify**: `open-seo-main/src/server/features/clients/services/ClientService.ts`

```typescript
async softDeleteClient(clientId: string): Promise<void> {
  const now = new Date();
  
  await withTransaction(async (tx) => {
    // Soft delete client
    await tx.update(clients)
      .set({ deletedAt: now })
      .where(eq(clients.id, clientId));
    
    // Cascade soft delete to related entities
    await tx.update(projects)
      .set({ deletedAt: now })
      .where(eq(projects.clientId, clientId));
    
    await tx.update(audits)
      .set({ deletedAt: now })
      .where(eq(audits.clientId, clientId));
    
    await tx.update(contentBriefs)
      .set({ deletedAt: now })
      .where(eq(contentBriefs.clientId, clientId));
    
    // Revoke access cache
    await invalidateClientAccessCache(clientId);
  });
}
```

---

#### 3.2.3 Add CHECK Constraints for Status Fields

**Migration**: `open-seo-main/drizzle/migrations/xxxx_add_status_constraints.sql`

```sql
-- Prospect status constraint
ALTER TABLE prospects 
  ADD CONSTRAINT prospects_status_check 
  CHECK (status IN ('new', 'contacted', 'qualified', 'proposal_sent', 'converted', 'lost'));

-- Audit status constraint
ALTER TABLE audits 
  ADD CONSTRAINT audits_status_check 
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));

-- Content brief status constraint
ALTER TABLE content_briefs 
  ADD CONSTRAINT content_briefs_status_check 
  CHECK (status IN ('draft', 'pending_review', 'approved', 'in_progress', 'completed', 'archived'));

-- Job status constraint (if not using BullMQ's built-in status)
ALTER TABLE background_jobs 
  ADD CONSTRAINT background_jobs_status_check 
  CHECK (status IN ('pending', 'active', 'completed', 'failed', 'delayed', 'paused'));
```

**Drizzle Schema Update**:

```typescript
// open-seo-main/src/db/schema.ts
export const prospectStatusEnum = pgEnum('prospect_status', [
  'new', 'contacted', 'qualified', 'proposal_sent', 'converted', 'lost'
]);

export const prospects = pgTable('prospects', {
  // ...
  status: prospectStatusEnum('status').notNull().default('new'),
});
```

---

### 3.3 Query Optimization

#### 3.3.1 Fix N+1 in bulkQueueAnalysis (HIGH-QUERY-01)

**Location**: `open-seo-main/src/server/features/prospects/services/AnalysisService.ts`

**Current Issue**: Loop calls `this.triggerAnalysis()` per prospect.

**Fix**:

```typescript
async bulkQueueAnalysis(prospectIds: string[]): Promise<{ queued: number; skipped: string[] }> {
  // Batch fetch all prospects
  const prospects = await db.query.prospects.findMany({
    where: inArray(prospectsTable.id, prospectIds),
    columns: { id: true, website: true, status: true },
  });
  
  const toQueue: Array<{ id: string; website: string }> = [];
  const skipped: string[] = [];
  
  for (const prospect of prospects) {
    if (prospect.status === 'converted' || !prospect.website) {
      skipped.push(prospect.id);
    } else {
      toQueue.push({ id: prospect.id, website: prospect.website });
    }
  }
  
  if (toQueue.length === 0) return { queued: 0, skipped };
  
  // Batch insert analysis jobs
  const jobs = toQueue.map((p) => ({
    prospectId: p.id,
    url: p.website,
    status: 'pending' as const,
    createdAt: new Date(),
  }));
  
  await db.insert(analysisJobs).values(jobs);
  
  // Batch enqueue to BullMQ
  await analysisQueue.addBulk(
    toQueue.map((p) => ({
      name: 'prospect-analysis',
      data: { prospectId: p.id, url: p.website },
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    }))
  );
  
  return { queued: toQueue.length, skipped };
}
```

**Performance Target**: 100 prospects in < 500ms (down from ~10s with N+1).

---

#### 3.3.2 Add LIMIT to Unbounded Queries (HIGH-QUERY-02)

**Location**: `AI-Writer/backend/services/auto_publish_executor.py`

**Current Issue**: Query at line ~170-180 fetches all pending articles without LIMIT.

**Fix**:

```python
# AI-Writer/backend/services/auto_publish_executor.py

BATCH_SIZE = 50  # Process in manageable batches

async def get_pending_articles(self, session: AsyncSession) -> list[Article]:
    """Fetch pending articles in batches with pagination."""
    result = await session.execute(
        select(Article)
        .where(Article.status == 'pending_publish')
        .where(Article.scheduled_at <= datetime.utcnow())
        .order_by(Article.scheduled_at.asc())
        .limit(BATCH_SIZE)  # ADD LIMIT
    )
    return result.scalars().all()
```

**Additional Files to Fix**:
- `open-seo-main/src/server/features/audits/services/AuditService.ts` - getAuditHistory()
- `open-seo-main/src/server/features/briefs/services/BriefService.ts` - listBriefs()
- `AI-Writer/backend/services/content_generator.py` - get_generation_queue()

**Pattern**:

```typescript
// Always include pagination
export async function listWithPagination<T>(
  query: SQL,
  options: { limit?: number; offset?: number; cursor?: string }
): Promise<{ data: T[]; hasMore: boolean; nextCursor?: string }> {
  const limit = Math.min(options.limit ?? 50, 100); // Max 100
  const results = await db.execute(
    sql`${query} LIMIT ${limit + 1} OFFSET ${options.offset ?? 0}`
  );
  
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  
  return { data, hasMore, nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : undefined };
}
```

---

#### 3.3.3 Add Composite Indexes (HIGH-QUERY-03)

**Migration**: `open-seo-main/drizzle/migrations/xxxx_add_composite_indexes.sql`

```sql
-- Most impactful indexes based on query patterns

-- Audit queries by client + status
CREATE INDEX CONCURRENTLY idx_audits_client_status 
  ON audits (client_id, status) 
  WHERE deleted_at IS NULL;

-- Content briefs by client + status + created
CREATE INDEX CONCURRENTLY idx_briefs_client_status_created 
  ON content_briefs (client_id, status, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Analysis results by prospect + created
CREATE INDEX CONCURRENTLY idx_analysis_results_prospect_created 
  ON analysis_results (prospect_id, created_at DESC);

-- Webhook deliveries by status + created (for retry queue)
CREATE INDEX CONCURRENTLY idx_webhook_deliveries_status_created 
  ON webhook_deliveries (status, created_at) 
  WHERE status IN ('pending', 'failed');

-- SEO checks by audit + severity
CREATE INDEX CONCURRENTLY idx_seo_checks_audit_severity 
  ON seo_check_results (audit_id, severity) 
  WHERE severity IN ('critical', 'high');
```

**AI-Writer Indexes**:

```sql
-- Articles by client + status + scheduled
CREATE INDEX CONCURRENTLY idx_articles_client_status_scheduled 
  ON articles (client_id, status, scheduled_at) 
  WHERE status = 'pending_publish';

-- Generation jobs by status + priority
CREATE INDEX CONCURRENTLY idx_generation_jobs_status_priority 
  ON generation_jobs (status, priority DESC, created_at ASC) 
  WHERE status = 'pending';
```

---

#### 3.3.4 Replace SELECT * with Explicit Columns (HIGH-QUERY-04)

**Pattern**: Use Drizzle's `columns` option or create projection types.

```typescript
// Instead of:
const clients = await db.query.clients.findMany();

// Use:
const clients = await db.query.clients.findMany({
  columns: {
    id: true,
    name: true,
    domain: true,
    status: true,
  },
});

// Or define projections:
export const clientListProjection = {
  id: true,
  name: true,
  domain: true,
  status: true,
  createdAt: true,
} as const;

const clients = await db.query.clients.findMany({
  columns: clientListProjection,
});
```

**Files to Update** (high-traffic endpoints):
- `open-seo-main/src/server/features/clients/services/ClientService.ts`
- `open-seo-main/src/server/features/audits/services/AuditService.ts`
- `open-seo-main/src/server/features/briefs/services/BriefService.ts`

---

#### 3.3.5 Implement Cursor-Based Pagination (HIGH-QUERY-05)

**Leverage Existing**: `packages/utils/src/pagination.ts` has `encodeCursor()` and `decodeCursor()`.

**Implementation**:

```typescript
// open-seo-main/src/server/lib/pagination.ts
import { encodeCursor, decodeCursor } from '@tevero/utils/pagination';
import { gt, lt, SQL, and } from 'drizzle-orm';

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

export function buildCursorCondition(
  cursor: string | undefined,
  column: SQL,
  direction: 'forward' | 'backward' = 'forward'
): SQL | undefined {
  if (!cursor) return undefined;
  
  const decoded = decodeCursor(cursor);
  if (!decoded) return undefined;
  
  return direction === 'forward' 
    ? gt(column, decoded.value)
    : lt(column, decoded.value);
}

// Usage in service:
export async function listAudits(
  clientId: string,
  options: CursorPaginationOptions
): Promise<CursorPaginationResult<Audit>> {
  const limit = Math.min(options.limit ?? 20, 100);
  
  const conditions: SQL[] = [eq(audits.clientId, clientId)];
  const cursorCondition = buildCursorCondition(options.cursor, audits.createdAt);
  if (cursorCondition) conditions.push(cursorCondition);
  
  const results = await db.query.audits.findMany({
    where: and(...conditions),
    orderBy: [desc(audits.createdAt)],
    limit: limit + 1,
  });
  
  const hasNextPage = results.length > limit;
  const data = hasNextPage ? results.slice(0, limit) : results;
  
  return {
    data,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!options.cursor,
      startCursor: data[0] ? encodeCursor({ value: data[0].createdAt }) : undefined,
      endCursor: data[data.length - 1] 
        ? encodeCursor({ value: data[data.length - 1].createdAt }) 
        : undefined,
    },
  };
}
```

---

### 3.4 Background Job Reliability

#### 3.4.1 Add Version Check for Optimistic Locking (CRIT-JOB-01)

**Location**: `AI-Writer/backend/services/auto_publish_executor.py`

**Current Issue**: Version increment without checking current value (line ~260-264).

**Fix**:

```python
# AI-Writer/backend/services/auto_publish_executor.py

async def claim_article_for_publish(
    self, 
    session: AsyncSession, 
    article_id: UUID,
    expected_version: int
) -> Article | None:
    """
    Atomically claim an article for publishing using optimistic locking.
    Returns None if article was already claimed (version mismatch).
    """
    result = await session.execute(
        update(Article)
        .where(
            and_(
                Article.id == article_id,
                Article.version == expected_version,  # Optimistic lock check
                Article.status == 'pending_publish',
            )
        )
        .values(
            status='publishing',
            version=Article.version + 1,
            claimed_at=datetime.utcnow(),
            claimed_by=self.worker_id,
        )
        .returning(Article)
    )
    
    article = result.scalar_one_or_none()
    if article is None:
        logger.info(f"Article {article_id} already claimed (version mismatch)")
    
    await session.commit()
    return article
```

---

#### 3.4.2 Implement Atomic State Transitions (CRIT-JOB-02)

**Purpose**: Prevent race conditions in job status updates.

```python
# AI-Writer/backend/services/job_state_machine.py

from enum import Enum
from typing import Optional

class JobStatus(Enum):
    PENDING = 'pending'
    CLAIMED = 'claimed'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'
    RETRYING = 'retrying'

VALID_TRANSITIONS = {
    JobStatus.PENDING: {JobStatus.CLAIMED, JobStatus.FAILED},
    JobStatus.CLAIMED: {JobStatus.RUNNING, JobStatus.FAILED, JobStatus.PENDING},
    JobStatus.RUNNING: {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.RETRYING},
    JobStatus.RETRYING: {JobStatus.RUNNING, JobStatus.FAILED},
    JobStatus.COMPLETED: set(),  # Terminal state
    JobStatus.FAILED: {JobStatus.RETRYING, JobStatus.PENDING},  # Can retry
}

async def transition_job_status(
    session: AsyncSession,
    job_id: UUID,
    from_status: JobStatus,
    to_status: JobStatus,
    metadata: Optional[dict] = None,
) -> bool:
    """
    Atomically transition job status, ensuring valid state machine transitions.
    Returns False if transition failed (job not in expected state).
    """
    if to_status not in VALID_TRANSITIONS.get(from_status, set()):
        raise ValueError(f"Invalid transition: {from_status} -> {to_status}")
    
    result = await session.execute(
        update(Job)
        .where(
            and_(
                Job.id == job_id,
                Job.status == from_status.value,
            )
        )
        .values(
            status=to_status.value,
            updated_at=datetime.utcnow(),
            metadata=Job.metadata.concat(metadata) if metadata else Job.metadata,
        )
        .returning(Job.id)
    )
    
    success = result.scalar_one_or_none() is not None
    await session.commit()
    return success
```

---

#### 3.4.3 Implement Job Deduplication (HIGH-JOB-01)

**Purpose**: Prevent duplicate job execution for the same entity.

```typescript
// open-seo-main/src/server/lib/job-deduplication.ts
import { redis } from '@/server/lib/redis';

const DEDUP_PREFIX = 'job:dedup:';
const DEFAULT_TTL = 3600; // 1 hour

export async function acquireJobLock(
  jobType: string,
  entityId: string,
  ttlSeconds = DEFAULT_TTL
): Promise<boolean> {
  const key = `${DEDUP_PREFIX}${jobType}:${entityId}`;
  const result = await redis.set(key, Date.now().toString(), 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

export async function releaseJobLock(jobType: string, entityId: string): Promise<void> {
  const key = `${DEDUP_PREFIX}${jobType}:${entityId}`;
  await redis.del(key);
}

// Usage in worker:
analysisQueue.process('prospect-analysis', async (job) => {
  const { prospectId } = job.data;
  
  const acquired = await acquireJobLock('prospect-analysis', prospectId);
  if (!acquired) {
    console.log(`Skipping duplicate job for prospect ${prospectId}`);
    return { skipped: true, reason: 'duplicate' };
  }
  
  try {
    return await processProspectAnalysis(prospectId);
  } finally {
    await releaseJobLock('prospect-analysis', prospectId);
  }
});
```

---

#### 3.4.4 Implement Dead Letter Queue (HIGH-JOB-02)

**Purpose**: Capture permanently failed jobs for manual review.

```typescript
// open-seo-main/src/server/lib/dead-letter-queue.ts
import { Queue } from 'bullmq';
import { db } from '@/db';
import { deadLetterJobs } from '@/db/schema';

const dlq = new Queue('dead-letter', { connection: redis });

export async function moveToDeadLetter(
  job: Job,
  error: Error,
  reason: 'max_retries' | 'fatal_error' | 'manual'
): Promise<void> {
  await db.insert(deadLetterJobs).values({
    originalQueue: job.queueName,
    originalJobId: job.id,
    jobName: job.name,
    jobData: job.data,
    error: error.message,
    stackTrace: error.stack,
    reason,
    attemptsMade: job.attemptsMade,
    createdAt: new Date(),
  });
  
  // Optional: Add to DLQ queue for alerting
  await dlq.add('failed-job', {
    queue: job.queueName,
    jobId: job.id,
    error: error.message,
    reason,
  });
}

// Configure in worker:
const worker = new Worker('analysis', processJob, {
  connection: redis,
  settings: {
    backoffStrategy: (attemptsMade) => {
      if (attemptsMade >= 5) return -1; // Stop retrying
      return Math.min(1000 * Math.pow(2, attemptsMade), 30000);
    },
  },
});

worker.on('failed', async (job, error) => {
  if (job && job.attemptsMade >= 5) {
    await moveToDeadLetter(job, error, 'max_retries');
  }
});
```

**Schema for Dead Letter Jobs**:

```typescript
// open-seo-main/src/db/schema.ts
export const deadLetterJobs = pgTable('dead_letter_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  originalQueue: varchar('original_queue', { length: 100 }).notNull(),
  originalJobId: varchar('original_job_id', { length: 100 }),
  jobName: varchar('job_name', { length: 100 }).notNull(),
  jobData: jsonb('job_data').notNull(),
  error: text('error').notNull(),
  stackTrace: text('stack_trace'),
  reason: varchar('reason', { length: 50 }).notNull(),
  attemptsMade: integer('attempts_made').notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 100 }),
  resolution: text('resolution'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

#### 3.4.5 Implement Redis-Backed Circuit Breaker (HIGH-JOB-03)

**Purpose**: Share circuit breaker state across worker processes.

```typescript
// open-seo-main/src/server/lib/circuit-breaker.ts
import { redis } from '@/server/lib/redis';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const CIRCUIT_PREFIX = 'circuit:';

export class RedisCircuitBreaker {
  constructor(
    private name: string,
    private options: {
      failureThreshold: number;
      resetTimeout: number;
      halfOpenRequests: number;
    }
  ) {}

  private get key(): string {
    return `${CIRCUIT_PREFIX}${this.name}`;
  }

  async getState(): Promise<CircuitBreakerState> {
    const data = await redis.get(this.key);
    if (!data) {
      return { failures: 0, lastFailure: 0, state: 'closed' };
    }
    return JSON.parse(data);
  }

  async canExecute(): Promise<boolean> {
    const state = await this.getState();
    
    if (state.state === 'closed') return true;
    
    if (state.state === 'open') {
      const elapsed = Date.now() - state.lastFailure;
      if (elapsed >= this.options.resetTimeout) {
        await this.transitionTo('half-open');
        return true;
      }
      return false;
    }
    
    // half-open: allow limited requests
    return state.failures < this.options.halfOpenRequests;
  }

  async recordSuccess(): Promise<void> {
    const state = await this.getState();
    if (state.state === 'half-open') {
      await this.transitionTo('closed');
    }
  }

  async recordFailure(): Promise<void> {
    const state = await this.getState();
    const newFailures = state.failures + 1;
    
    if (newFailures >= this.options.failureThreshold) {
      await this.transitionTo('open', newFailures);
    } else {
      await redis.set(this.key, JSON.stringify({
        ...state,
        failures: newFailures,
        lastFailure: Date.now(),
      }), 'EX', 3600);
    }
  }

  private async transitionTo(
    newState: 'closed' | 'open' | 'half-open',
    failures = 0
  ): Promise<void> {
    await redis.set(this.key, JSON.stringify({
      failures,
      lastFailure: Date.now(),
      state: newState,
    }), 'EX', 3600);
  }
}

// Usage:
const dataforseoCircuit = new RedisCircuitBreaker('dataforseo', {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRequests: 2,
});

async function callDataForSEO(params: unknown): Promise<unknown> {
  if (!await dataforseoCircuit.canExecute()) {
    throw new Error('DataForSEO circuit breaker is open');
  }
  
  try {
    const result = await dataforseoClient.request(params);
    await dataforseoCircuit.recordSuccess();
    return result;
  } catch (error) {
    await dataforseoCircuit.recordFailure();
    throw error;
  }
}
```

---

### 3.5 Idempotency Patterns

#### 3.5.1 Standard Idempotency Key Implementation

**Leverage Existing**: `open-seo-main/src/db/idempotency-schema.ts`

```typescript
// open-seo-main/src/server/lib/idempotency.ts
import { db } from '@/db';
import { idempotencyKeys } from '@/db/idempotency-schema';
import { eq, and, gt } from 'drizzle-orm';

const DEFAULT_TTL_HOURS = 24;

export interface IdempotencyResult<T> {
  isNew: boolean;
  result?: T;
}

export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  options?: { ttlHours?: number }
): Promise<T> {
  const ttlHours = options?.ttlHours ?? DEFAULT_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  
  // Check for existing result
  const existing = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(idempotencyKeys.key, key),
      gt(idempotencyKeys.expiresAt, new Date()),
    ),
  });
  
  if (existing?.response) {
    return existing.response as T;
  }
  
  // Lock the key
  try {
    await db.insert(idempotencyKeys).values({
      key,
      status: 'processing',
      expiresAt,
    }).onConflictDoNothing();
  } catch {
    // Key already exists, wait and retry
    await new Promise((r) => setTimeout(r, 100));
    return withIdempotency(key, operation, options);
  }
  
  try {
    const result = await operation();
    
    await db.update(idempotencyKeys)
      .set({ status: 'completed', response: result })
      .where(eq(idempotencyKeys.key, key));
    
    return result;
  } catch (error) {
    await db.update(idempotencyKeys)
      .set({ status: 'failed', error: String(error) })
      .where(eq(idempotencyKeys.key, key));
    throw error;
  }
}

// Usage in API handler:
export async function createBrief(data: BriefCreateData) {
  const idempotencyKey = `brief:create:${data.clientId}:${hash(data)}`;
  
  return withIdempotency(idempotencyKey, async () => {
    return db.insert(contentBriefs).values(data).returning();
  });
}
```

---

#### 3.5.2 Request Deduplication Middleware

```typescript
// open-seo-main/src/server/middleware/idempotency.ts
import { createMiddleware } from '@tanstack/start';
import { withIdempotency } from '@/server/lib/idempotency';

export const idempotencyMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next, context }) => {
    const request = getRequest();
    const idempotencyKey = request.headers.get('Idempotency-Key');
    
    if (!idempotencyKey) {
      return next({ context });
    }
    
    // Validate key format
    if (!/^[a-zA-Z0-9-_]{1,64}$/.test(idempotencyKey)) {
      throw new AppError('BAD_REQUEST', 'Invalid Idempotency-Key format');
    }
    
    return withIdempotency(
      `api:${idempotencyKey}`,
      () => next({ context }),
      { ttlHours: 24 }
    );
  });
```

---

#### 3.5.3 Retry-Safe External API Calls

```typescript
// open-seo-main/src/server/lib/external-api.ts

export async function callExternalAPIWithIdempotency<T>(
  provider: string,
  operationId: string,
  call: () => Promise<T>
): Promise<T> {
  const key = `external:${provider}:${operationId}`;
  
  return withIdempotency(key, call, { ttlHours: 48 });
}

// Usage for DataForSEO:
async function submitCrawlTask(url: string, taskId: string): Promise<CrawlResult> {
  return callExternalAPIWithIdempotency(
    'dataforseo',
    `crawl:${taskId}`,
    async () => {
      const response = await dataforseoClient.post('/on_page/task_post', {
        data: [{ url, tag: taskId }],
      });
      return response.data;
    }
  );
}
```

---

### 3.6 Testing Strategy

```typescript
// e2e/data-integrity.spec.ts
describe('Data Integrity', () => {
  test('transaction rollback on partial failure', async () => {
    const prospectId = await createTestProspect();
    
    // Mock failure in record migration step
    mockMigrationFailure();
    
    await expect(convertProspectToClient(prospectId, {}))
      .rejects.toThrow('Migration failed');
    
    // Verify no orphaned records
    const prospect = await getProspect(prospectId);
    expect(prospect.status).toBe('qualified'); // Not 'converted'
    expect(prospect.convertedClientId).toBeNull();
  });

  test('optimistic locking prevents concurrent updates', async () => {
    const article = await createTestArticle();
    
    // Simulate concurrent claims
    const results = await Promise.allSettled([
      claimArticle(article.id, article.version),
      claimArticle(article.id, article.version),
    ]);
    
    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length).toBe(1);
  });

  test('idempotency key prevents duplicate creation', async () => {
    const key = 'test-key-123';
    const data = { name: 'Test Brief', clientId: 'client-1' };
    
    const [result1, result2] = await Promise.all([
      createBriefWithKey(key, data),
      createBriefWithKey(key, data),
    ]);
    
    expect(result1.id).toBe(result2.id);
    
    const count = await countBriefsByName('Test Brief');
    expect(count).toBe(1);
  });
});
```

---

### 3.7 Performance Targets

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| bulkQueueAnalysis (100 items) | ~10s | < 500ms | Load test |
| Unbounded query response | Variable | < 100ms | P95 latency |
| Transaction failure recovery | Partial state | Full rollback | Integration test |
| Job deduplication | 0% | 100% | Duplicate job count |
| Circuit breaker shared state | Per-process | Cross-process | Redis check |

---

### 3.8 Phase 3 Summary

| Section | Issues Fixed | Priority | Est. Days |
|---------|--------------|----------|-----------|
| 3.1 Transaction Wrappers | CRIT-TRANS-01 | Critical | 3 |
| 3.2 Cascade Fixes | HIGH-CASCADE-01 | High | 2 |
| 3.3 Query Optimization | HIGH-QUERY-01 through HIGH-QUERY-05 | High | 4 |
| 3.4 Job Reliability | CRIT-JOB-01, CRIT-JOB-02, HIGH-JOB-01 through HIGH-JOB-03 | Critical | 4 |
| 3.5 Idempotency | HIGH-IDEMP-01 | High | 2 |
| 3.6 Testing | Verification | Required | 2 |
| **Total** | | | **17 days** |

---

## Phase 5: Security & Configuration (Week 6-7)

### Overview

| Category | Critical | High | Medium | Status |
|----------|----------|------|--------|--------|
| Secret Remediation | 0 | 0 | 2 | Verified - .env files NOT tracked |
| Configuration Consolidation | 0 | 4 | 3 | Pending |
| Security Hardening | 0 | 1 | 5 | Partially Complete |
| Migration Safety | 1 | 1 | 2 | Pending |
| Security Monitoring | 0 | 2 | 2 | Pending |

---

### 5.1 Secret Remediation (VERIFIED - Day 1)

**Current Status:** RESOLVED

Investigation confirms that `.env` files with secrets are NOT tracked in git:

```bash
# Verified via git check-ignore
.gitignore:6:AI-Writer/    AI-Writer/.env
apps/web/.gitignore:3:.env*.local    apps/web/.env.local
```

**Currently Tracked (Safe):**
- `.env.vps.example` - Placeholder template only
- `apps/web/.env.example` - Placeholder template only  
- `open-seo-main/.env.example` - Placeholder template only

**Action Items:**

| Task | Priority | Owner | Status |
|------|----------|-------|--------|
| Verify .gitignore patterns are comprehensive | Low | DevOps | Complete |
| Add pre-commit hook for secret detection | Medium | DevOps | Pending |
| Set up Gitleaks or similar in CI | Medium | DevOps | Pending |

**Recommended Pre-commit Hook:**

```bash
#!/bin/sh
# .husky/pre-commit (add to existing or create)
# Detect potential secrets before commit
if git diff --cached --name-only | grep -E '\.env$|\.env\.local$|\.env\.production$'; then
  echo "ERROR: Attempting to commit .env file with potential secrets"
  echo "If this file contains only placeholders, rename to .env.example"
  exit 1
fi

# Optional: Run gitleaks if installed
if command -v gitleaks &> /dev/null; then
  gitleaks protect --staged --verbose
fi
```

**CI Secret Scanning (GitHub Actions):**

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### 5.2 Configuration Consolidation (Days 2-3)

#### 5.2.1 Environment Variable Naming Convention

**Issue:** Inconsistent naming (BACKEND_URL vs OPEN_SEO_URL vs AI_WRITER_URL)

**Standard Convention:**

| Pattern | Example | Usage |
|---------|---------|-------|
| `{SERVICE}_URL` | `OPEN_SEO_URL`, `AI_WRITER_URL` | Service endpoint URLs |
| `{SERVICE}_API_KEY` | `DATAFORSEO_API_KEY` | External API keys |
| `{SERVICE}_SECRET` | `CLERK_SECRET_KEY` | Auth secrets |
| `{DB}_DATABASE_URL` | `DATABASE_URL` | Database connections |
| `{FEATURE}_ENABLED` | `DISABLE_AUTH` | Feature flags |

**Migration Table:**

| Current | Standard | Files Affected |
|---------|----------|----------------|
| `BACKEND_URL` (deprecated) | `AI_WRITER_URL` | apps/web/*.ts |
| `AIWRITER_INTERNAL_URL` | `AI_WRITER_URL` | docker-compose.vps.yml |
| `AI_WRITER_API_URL` | `AI_WRITER_URL` | docker-compose.vps.yml (alias) |

#### 5.2.2 Complete docker-compose.vps.yml Environment Variables

**Missing Variables to Add:**

```yaml
# In ai-writer-backend service, add:
environment:
  # MISSING: Add these
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}  # For Claude-based content generation
  
# In tevero-web service, add:
environment:
  # MISSING: Add these (if using Stripe)
  STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
  STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
  # Email sending
  RESEND_API_KEY: ${RESEND_API_KEY}
```

**WS_PORT Consistency:**

```yaml
# open-seo service: WS_PORT: "3003" - CORRECT (differs from tevero-web:3002)
# Verified: No mismatch - design is intentional
```

#### 5.2.3 Startup Validation

**AI-Writer Backend (Python):** Add required validation in `AI-Writer/backend/app/core/config.py`

**Next.js (apps/web):** Verify `apps/web/src/lib/env.ts` has Zod validation for all required vars including `INTERNAL_API_KEY` with 32-char minimum.

#### 5.2.4 Environment Variable Documentation

**Add to `.env.vps.example`:**

```bash
# STRIPE INTEGRATION (Required for Payment Processing)
STRIPE_SECRET_KEY=sk_live_change_me
STRIPE_WEBHOOK_SECRET=whsec_change_me
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_change_me

# EMAIL SERVICE (Required for Notifications)
RESEND_API_KEY=re_change_me

# AI PROVIDERS (if using Claude)
ANTHROPIC_API_KEY=sk-ant-change_me

# ASSET SECURITY (Required for Signed URLs)
ASSET_SIGNING_KEY=change_me_64_hex_chars
```

---

### 5.3 Security Hardening (Days 4-6)

#### 5.3.1 ToBeMigrated/ Pickle Code

**Issue:** Legacy Python code may use pickle for deserialization (RCE risk)

**Result:** No pickle usage found in active codebase. ToBeMigrated/ folder is archived legacy code.

**Action Items:**

| Task | Priority | Status |
|------|----------|--------|
| Verify ToBeMigrated/ is not imported anywhere | High | Pending |
| Delete ToBeMigrated/ folder or move to separate archive repo | High | Pending |
| Add to .dockerignore if not already | Medium | Complete |

```bash
# Verify no imports
grep -rn "from ToBeMigrated\|import ToBeMigrated" AI-Writer/ --include="*.py"

# If safe, delete:
rm -rf AI-Writer/ToBeMigrated/
```

#### 5.3.2 CORS Wildcard on Pixel Endpoints

**Current Status:** DOCUMENTED AND INTENTIONAL

The file `open-seo-main/src/routes/api/pixel/collect.ts` already contains proper documentation explaining why wildcard CORS is correct for tracking pixels (embeddable on any customer website, no credentials, anonymous rate-limited data only).

**Action Items:** NONE - This is correct architecture for analytics pixels.

#### 5.3.3 Query Token Auth Deprecation

**Issue:** Legacy `?token=` query parameter authentication on media endpoints

**Finding:** OAuth token handling (access_token for Google API) is CORRECT usage. No deprecated query token auth patterns found in active routes.

**Action Items:** 

| Task | Priority | Status |
|------|----------|--------|
| Audit all `/api/media/*` routes for query param auth | Medium | Pending |
| If found, migrate to signed URLs with ASSET_SIGNING_KEY | Medium | Pending |

#### 5.3.4 CSP Nonces

**Current Status:** IMPLEMENTED in `open-seo-main/src/server/middleware/security-headers.ts`

**Action Items:**

| Task | Priority | Status |
|------|----------|--------|
| Ensure nonce is generated and passed on every request | Medium | Verify |
| Update inline scripts in HTML to include nonce attribute | Medium | Pending |
| Add CSP nonces to apps/web Next.js middleware | Medium | Pending |

#### 5.3.5 Pin Security-Critical Dependencies

**DOMPurify Version:** Currently `^3.4.1` (caret) - should pin to exact version.

```bash
cd apps/web && npm install --save-exact dompurify@3.4.1
```

**Other Security-Critical Dependencies to Pin:**

| Package | Current | Pin Version | Reason |
|---------|---------|-------------|--------|
| `dompurify` | ^3.4.1 | 3.4.1 | XSS sanitization |
| `@clerk/nextjs` | ^6.x | 6.x.x (exact) | Auth provider |
| `jose` | ^5.x | 5.x.x (exact) | JWT handling |

#### 5.3.6 Webhook URL Allowlist Configuration

**Current Status:** Hardcoded in `open-seo-main/src/server/features/command-center/services/WorkflowExecutor.ts`

**Action Items:**

| Task | Priority | Status |
|------|----------|--------|
| Move allowlist to environment variable or database | Medium | Pending |
| Add admin UI for managing allowed domains | Low | Backlog |
| Document process for adding new domains | Medium | Pending |

**Recommended Pattern:**

```typescript
const ALLOWED_WEBHOOK_DOMAINS = (
  process.env.WEBHOOK_ALLOWED_DOMAINS || 
  "api.slack.com,hooks.slack.com,hooks.zapier.com,discord.com,maker.ifttt.com,api.telegram.org"
).split(",").map(d => d.trim());
```

---

### 5.4 Migration Safety (Days 7-8)

#### 5.4.1 Rollback Scripts Audit

**Current State:**

| System | Migration Files | With Rollback | Gap |
|--------|----------------|---------------|-----|
| open-seo-main (Drizzle) | 40+ | 0 (Drizzle doesn't use down migrations) | N/A |
| AI-Writer (Alembic) | 27 | ~9 | 18 |
| AI-Writer (raw SQL) | 6 | 0 | 6 |

**Drizzle ORM Note:** Drizzle uses a different migration strategy - it generates SQL from schema diffs. Rollbacks are manual or via backup restoration.

**Action Items:**

| Task | Priority | Owner | Status |
|------|----------|-------|--------|
| Document Drizzle rollback procedure | High | Backend | Pending |
| Add `downgrade()` to all AI-Writer Alembic migrations | High | Backend | Pending |
| Create rollback scripts for raw SQL migrations | Medium | Backend | Pending |
| Add pre-migration backup step to deployment | High | DevOps | Pending |

#### 5.4.2 UUID Conversion Migration Transaction Wrapper

**Issue:** `0034_client_id_to_uuid.sql` lacks explicit transaction wrapper

**Action:** Add BEGIN/COMMIT wrapper to ensure atomic migration.

```sql
-- Add at the beginning of the file:
BEGIN;

-- ... existing migration content ...

-- Add at the end:
COMMIT;
```

#### 5.4.3 Migration Testing Framework

**Create:** `open-seo-main/drizzle/test/migration-test.sh`

Script to test migrations against a fresh database, verify schema matches expected, and cleanup.

#### 5.4.4 Migration Runbook

**Create:** `docs/runbooks/database-migrations.md`

Document pre-migration checklist, execution steps, rollback procedure, and emergency contacts.

---

### 5.5 Security Monitoring (Days 9-10)

#### 5.5.1 Dependabot/Snyk Setup

**GitHub Dependabot:** Create `.github/dependabot.yml` for npm (apps/web, open-seo-main), pip (AI-Writer), and Docker.

#### 5.5.2 Secret Scanning

Enable GitHub secret scanning in repository settings. Create custom patterns for internal API keys and connection strings.

#### 5.5.3 Rate Limiting Audit

**Current Coverage:**

| Endpoint Type | Has Rate Limiting | Implementation |
|---------------|-------------------|----------------|
| AI Generation | Yes | AI-Writer custom |
| WebSocket | Yes | Redis sliding window |
| Public API | Partial | Per-route |
| Pixel/Analytics | Yes | Request-based |
| Admin endpoints | No | Needs implementation |

**Action:** Add rate limiting to all `/api/admin/*` routes.

#### 5.5.4 Audit Logging

Create audit logging infrastructure in `open-seo-main/src/server/services/audit-log.ts` with schema for tracking user actions on sensitive resources.

---

### 5.6 Security Checklist

**Pre-Deployment Security Checklist:**

- [ ] **Secrets:** No secrets in git history (verified)
- [ ] **Secrets:** Pre-commit hook detects secret commits
- [ ] **Secrets:** CI secret scanning enabled (Gitleaks/GitHub)
- [ ] **Config:** All required env vars validated at startup
- [ ] **Config:** Env var naming follows convention
- [ ] **Config:** docker-compose.vps.yml has all required vars
- [ ] **CORS:** Pixel wildcard CORS documented and intentional
- [ ] **CSP:** Nonce-based CSP in production
- [ ] **Deps:** Security-critical dependencies pinned
- [ ] **Auth:** No deprecated query token auth
- [ ] **Webhooks:** URL allowlist configurable
- [ ] **DB:** All migrations have rollback procedure
- [ ] **DB:** Critical migrations wrapped in transactions
- [ ] **DB:** Pre-migration backups automated
- [ ] **Monitoring:** Dependabot/Snyk configured
- [ ] **Monitoring:** Rate limiting on all public endpoints
- [ ] **Monitoring:** Audit logging for sensitive operations

---

### 5.7 Implementation Priority

| Priority | Task | Effort | Risk if Skipped |
|----------|------|--------|-----------------|
| P0 | Add pre-commit secret detection | 2h | High - accidental secret commit |
| P0 | Transaction wrapper for 0034 migration | 1h | Critical - partial migration state |
| P0 | Pre-migration backup automation | 4h | Critical - data loss |
| P1 | CI secret scanning | 2h | High - secret in PR |
| P1 | Pin security dependencies | 1h | High - vulnerable version |
| P1 | Rate limit admin endpoints | 4h | High - brute force attacks |
| P2 | Delete ToBeMigrated/ folder | 1h | Medium - code confusion |
| P2 | Env var naming standardization | 4h | Low - maintenance overhead |
| P2 | Audit logging | 8h | Medium - no forensics |
| P3 | Webhook allowlist to env | 2h | Low - deployment friction |
| P3 | Migration testing framework | 8h | Medium - migration bugs |

---

### 5.8 Timeline

```
Week 6:
  Mon: 5.1 Secret remediation verification (0.5d)
  Mon: 5.2 Configuration consolidation (1.5d)
  Tue-Wed: 5.3 Security hardening (2d)
  
Week 7:
  Thu-Fri: 5.4 Migration safety (2d)
  Mon-Tue: 5.5 Security monitoring (2d)
  Wed: Testing & verification (1d)
```

---

### 5.9 Git Commands for Secret Removal (Reference)

**Note:** Investigation confirmed .env files are NOT in git history. These commands are for reference only if secrets were ever committed.

```bash
# Check if any secrets exist in git history
git log --all --full-history -- "*.env" "*secret*" "*password*"

# If secrets found, use BFG Repo Cleaner (safer than filter-branch)
# Install: brew install bfg
bfg --delete-files .env
bfg --replace-text secrets.txt  # File containing patterns to redact

# Or use git filter-repo (modern alternative)
pip install git-filter-repo
git filter-repo --path-glob '*.env' --invert-paths

# Force push after cleanup (DESTRUCTIVE)
git push --force --all
git push --force --tags

# All collaborators must re-clone after history rewrite
```

---

*Last Updated: 2026-05-03*
*Source: 20-agent comprehensive code review*

---

## Phase 4: Frontend Quality (Week 5-6)

### Overview

This phase addresses React component issues, Next.js pattern gaps, user journey problems, error handling standardization, and accessibility improvements across the `apps/web` codebase.

**Severity Distribution**:
- CRITICAL: 2 (Memory leak, Infinite loop)
- HIGH: 13 (Index keys, ARIA, stale closures, loading states, error coverage, UX issues)
- MEDIUM: 8 (Various component quality issues)

**Estimated Effort**: 45-55 hours

---

### 4.1 React Component Fixes

#### 4.1.1 [CRITICAL] Memory Leak: Missing Timeout Cleanup in success-screen.tsx

**Location**: `apps/web/src/components/connect/success-screen.tsx:109-125`

**Problem**: `setTimeout` calls for confetti animations are not cleaned up when component unmounts.

**Fixed Code**:
```typescript
useEffect(() => {
  if (!showConfetti) return;

  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

  const timer1 = setTimeout(() => {
    confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
  }, 250);

  const timer2 = setTimeout(() => {
    confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
  }, 400);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
  };
}, [showConfetti]);
```

---

#### 4.1.2 [CRITICAL] Infinite Re-render Prevention in GlobalSettingsPage

**Location**: `apps/web/src/app/(shell)/settings/page.tsx`

**Audit Required**:
- `apps/web/src/app/(shell)/settings/components/api-integrations-tab.tsx`
- `apps/web/src/app/(shell)/settings/components/voice-templates-tab.tsx`
- `apps/web/src/app/(shell)/settings/components/model-defaults-tab.tsx`

**Fix Pattern**:
```typescript
// Use stable dependencies
const filterKey = JSON.stringify(filters);
useEffect(() => {
  fetchData(JSON.parse(filterKey));
}, [filterKey]);
```

---

#### 4.1.3 [HIGH] Replace Index Keys in Reorderable Lists

**Files** (10 total):
1. `apps/web/src/components/proposals/ServiceLineItems.tsx:89-97`
2. `apps/web/src/components/dashboard/PatternsPanel.tsx:280-289`
3. `apps/web/src/components/dashboard/PredictiveAlertsPanel.tsx`
4. `apps/web/src/components/dashboard/PortfolioHealthSummary.tsx`
5. `apps/web/src/components/dashboard/OpportunitiesPanel.tsx`
6. `apps/web/src/components/shell/AppShellNavItem.tsx`
7. `apps/web/src/components/shell/AppShellSidebar.tsx`
8. `apps/web/src/components/connect/error-screen.tsx`
9. `apps/web/src/components/connect/oauth-enhancement.tsx`
10. `apps/web/src/components/proposals/ProposalPreview.tsx`

**Fix**: Use stable IDs (e.g., `key={item.id}` or `key={item.href}`)

---

#### 4.1.4 [HIGH] Add ARIA Attributes to Form Components

**Files to Update**:
1. `apps/web/src/app/(shell)/clients/new/page.tsx`
2. `apps/web/src/app/(shell)/prospects/new/page.tsx`
3. `apps/web/src/components/proposals/ProposalForm.tsx`
4. `apps/web/src/components/keywords/KeywordImportForm.tsx`
5. `apps/web/src/components/voice/VoiceProfileForm.tsx`

**Pattern**:
```typescript
<Input
  aria-invalid={!!error}
  aria-describedby={error ? "field-error" : undefined}
/>
{error && <p id="field-error" role="alert">{error}</p>}
```

---

#### 4.1.5 [HIGH] Fix Object Dependency in ArticlePage Fetch

**Location**: `apps/web/src/app/(shell)/clients/[clientId]/articles/new/page.tsx:162-190`

**Fix**: Extract primitive dependencies from objects to avoid reference changes.

---

### 4.2 Next.js Pattern Improvements

#### 4.2.1 [HIGH] Add error.tsx to All Route Segments

**Missing** (18 routes):
```
apps/web/src/app/connect/error.tsx
apps/web/src/app/c/[token]/error.tsx
apps/web/src/app/(dashboard)/command-center/error.tsx
apps/web/src/app/install/[token]/error.tsx
apps/web/src/app/invoices/[id]/pay/error.tsx
apps/web/src/app/invoices/[id]/success/error.tsx
apps/web/src/app/[locale]/c/[token]/error.tsx
apps/web/src/app/proposals/[token]/error.tsx
apps/web/src/app/p/[token]/error.tsx
apps/web/src/app/(shell)/clients/[clientId]/agreements/[agreementId]/pre-sign/error.tsx
apps/web/src/app/(shell)/clients/[clientId]/onboarding/complete/error.tsx
apps/web/src/app/(shell)/clients/[clientId]/reports/new/error.tsx
```

**Template**:
```typescript
"use client";
import { PageErrorBoundary } from "@/components/page-error-boundary";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <PageErrorBoundary error={error} reset={reset} />;
}
```

---

#### 4.2.2 [HIGH] Add loading.tsx to Missing Routes

**Current State**: 14 loading.tsx for 73 pages (19% coverage)

**Tier 1 - Add First** (9 files):
```
apps/web/src/app/(shell)/clients/[clientId]/audits/loading.tsx
apps/web/src/app/(shell)/clients/[clientId]/articles/loading.tsx
apps/web/src/app/(shell)/clients/[clientId]/intelligence/loading.tsx
apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/loading.tsx
apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/keywords/loading.tsx
apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/backlinks/loading.tsx
apps/web/src/app/(shell)/prospects/[prospectId]/loading.tsx
apps/web/src/app/(shell)/dashboard/revenue/loading.tsx
apps/web/src/app/(shell)/dashboard/tasks/loading.tsx
```

---

#### 4.2.3 [MEDIUM] Standardize Server Action Validation

**Files with Inconsistent Patterns**:
- `apps/web/src/actions/seo/briefs.ts`
- `apps/web/src/actions/seo/keywords.ts`

**Use ActionResult<T> pattern consistently**.

---

### 4.3 User Journey Fixes

#### 4.3.1 [HIGH] Add Coordinated Loading During Client Switch

**File**: `apps/web/src/app/(shell)/layout.tsx`

Add loading overlay during client context switch to prevent visual jitter.

---

#### 4.3.2 [HIGH] Fix Broken Help/Support Links

**Problem**: `/help/seo-setup` and `/support` return 404.

**Fix**: Add middleware redirect to external docs.

---

#### 4.3.3 [HIGH] Add Error Recovery UI for Client Creation

**Location**: `apps/web/src/app/(shell)/clients/new/page.tsx`

Add Try Again, Save as Draft, and Get Help options when creation fails.

---

#### 4.3.4 [HIGH] Implement Breadcrumb Component

**Create**: `apps/web/src/components/ui/breadcrumb.tsx`

Provide navigation context for deep routes like `/clients/[id]/seo/[projectId]/audit/issues/[resultId]`.

---

### 4.4 Error Handling Standardization

#### 4.4.1 [HIGH] Fix Empty Catch Blocks

**Pattern Found**: `.catch(() => ({}))` in 20+ locations.

**Files**:
- `apps/web/src/app/proposals/[token]/actions.ts` (4)
- `apps/web/src/app/(shell)/clients/[clientId]/agreements/[agreementId]/pre-sign/actions.ts` (6)
- `apps/web/src/lib/api/connect.ts` (3)
- Plus 7 more files

**Fix**: Use `safeParseJson` from `apps/web/src/lib/error-utils.ts`

---

#### 4.4.2 [HIGH] Replace Generic Exception (AI-Writer)

**Files** (10):
- `AI-Writer/backend/app.py`
- `AI-Writer/backend/main.py`
- `AI-Writer/backend/start_alwrity_backend.py`
- Plus 7 more

**Fix**: Use specific exception types (SQLAlchemyError, HTTPError, ValueError).

---

### 4.5 Accessibility Audit

#### 4.5.1 [MEDIUM] Keyboard Navigation Verification

**Audit**: tabs, select, dropdown-menu, dialog components.

#### 4.5.2 [MEDIUM] Screen Reader Compatibility

**Add**: `aria-live` regions for dynamic content.

#### 4.5.3 [LOW] Color Contrast Checks

**Tool**: axe DevTools browser extension.

---

### 4.6 Implementation Checklist

#### Sprint 1 (Days 1-5): Critical
- [ ] 4.1.1 Fix timeout cleanup in success-screen.tsx
- [ ] 4.1.2 Audit GlobalSettings tab components
- [ ] 4.3.2 Create help/support redirects
- [ ] 4.4.1 Replace 10 empty catch blocks

#### Sprint 2 (Days 6-10): High
- [ ] 4.1.3 Fix index keys (6 components)
- [ ] 4.1.4 Add ARIA to 5 forms
- [ ] 4.2.1 Add error.tsx (18 routes)
- [ ] 4.3.3 Error recovery UI

#### Sprint 3 (Days 11-15): Loading
- [ ] 4.2.2 Add loading.tsx Tier 1 (9 files)
- [ ] 4.3.4 Implement Breadcrumb
- [ ] 4.3.1 Coordinated client switching

#### Sprint 4 (Days 16-20): Polish
- [ ] 4.2.2 Remaining loading.tsx
- [ ] 4.2.3 Standardize Server Actions
- [ ] 4.5.1-3 Accessibility audit

---

### 4.7 Success Metrics

| Metric | Target |
|--------|--------|
| Console errors (memory leaks) | 0 |
| aXe violations | < 5 (none critical) |
| Routes with loading.tsx | 100% |
| Routes with error.tsx | 100% |
| Lighthouse Accessibility | > 90 |

---

*Phase 4 Last Updated: 2026-05-03*
*Author: Frontend Quality Engineer Agent*
