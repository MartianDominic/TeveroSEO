# Plan 95-09: Operational Excellence

**Phase:** 95 - Scraping Infrastructure Optimization  
**Priority:** P1 (Important - Required for Production Readiness)  
**Estimated Effort:** 2 days  
**Dependencies:** 95-01 through 95-08 (core infrastructure + tests)

---

## Problem Statement

The Phase 95 integration review identified gaps in operational readiness:

1. **No alerting system** - Cost overruns and failures go unnoticed
2. **No operations runbook** - Unclear how to diagnose/resolve issues
3. **No data retention policies** - Cache and logs grow unbounded
4. **Cost tracking unverified** - No confidence in 96-98% savings claim
5. **No health endpoints** - Unable to monitor system health externally

Without operational excellence, the system cannot be safely run in production or handed off to operations teams.

---

## Success Criteria

- [ ] Alert system with configurable thresholds
- [ ] Comprehensive operations runbook
- [ ] Data retention policies implemented
- [ ] Cost tracking accuracy verified against real usage
- [ ] Health check endpoints exposed
- [ ] Grafana dashboard templates
- [ ] PagerDuty/Slack integration for critical alerts

---

## Task Breakdown

### Task 95-09-01: Alert System Implementation

**File:** `open-seo-main/src/server/features/scraping/monitoring/AlertManager.ts`

```typescript
type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertChannel = 'slack' | 'pagerduty' | 'email' | 'webhook';

interface AlertConfig {
  name: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldown: number;  // Seconds between repeated alerts
  runbook?: string;  // Link to runbook section
}

interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==';
  threshold: number;
  window?: number;  // Evaluation window in seconds
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: Date;
}

class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private channels: Map<AlertChannel, AlertChannelHandler>;

  constructor(config: AlertManagerConfig) {
    this.channels = this.initChannels(config);
    this.registerDefaultAlerts();
  }

  private registerDefaultAlerts(): void {
    // Cost alerts
    this.registerAlert({
      name: 'daily-cost-warning',
      condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600,
      runbook: '#cost-overrun',
    });

    this.registerAlert({
      name: 'daily-cost-critical',
      condition: { metric: 'cost.daily', operator: '>', threshold: 100 },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 1800,
      runbook: '#cost-overrun',
    });

    // Error rate alerts
    this.registerAlert({
      name: 'error-rate-warning',
      condition: { 
        metric: 'scraping.error_rate', 
        operator: '>', 
        threshold: 0.05,
        window: 300,
        aggregation: 'avg',
      },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 600,
      runbook: '#high-error-rate',
    });

    this.registerAlert({
      name: 'error-rate-critical',
      condition: { 
        metric: 'scraping.error_rate', 
        operator: '>', 
        threshold: 0.15,
        window: 300,
        aggregation: 'avg',
      },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 300,
      runbook: '#high-error-rate',
    });

    // Circuit breaker alerts
    this.registerAlert({
      name: 'circuit-open',
      condition: { metric: 'circuit.open_count', operator: '>', threshold: 0 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 300,
      runbook: '#circuit-breaker-open',
    });

    // Cache health alerts
    this.registerAlert({
      name: 'cache-hit-rate-low',
      condition: { 
        metric: 'cache.hit_rate', 
        operator: '<', 
        threshold: 0.5,
        window: 3600,
        aggregation: 'avg',
      },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600,
      runbook: '#low-cache-hit-rate',
    });

    // Queue health alerts
    this.registerAlert({
      name: 'queue-backlog-warning',
      condition: { metric: 'queue.waiting', operator: '>', threshold: 1000 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 600,
      runbook: '#queue-backlog',
    });

    this.registerAlert({
      name: 'queue-backlog-critical',
      condition: { metric: 'queue.waiting', operator: '>', threshold: 5000 },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 300,
      runbook: '#queue-backlog',
    });

    // DataForSEO budget alerts
    this.registerAlert({
      name: 'dfs-budget-warning',
      condition: { metric: 'dfs.budget_used_percent', operator: '>', threshold: 75 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600,
      runbook: '#dfs-budget',
    });

    this.registerAlert({
      name: 'dfs-budget-critical',
      condition: { metric: 'dfs.budget_used_percent', operator: '>', threshold: 90 },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 1800,
      runbook: '#dfs-budget',
    });
  }

  async evaluate(metrics: MetricsSnapshot): Promise<void> {
    for (const [name, config] of this.alertConfigs) {
      const value = this.extractMetricValue(metrics, config.condition);
      const triggered = this.evaluateCondition(value, config.condition);

      if (triggered && this.canFire(name)) {
        await this.fire({
          id: `${name}-${Date.now()}`,
          name,
          severity: config.severity,
          message: this.formatMessage(config, value),
          metric: config.condition.metric,
          value,
          threshold: config.condition.threshold,
          timestamp: new Date(),
        });
      }
    }
  }

  private async fire(alert: Alert): Promise<void> {
    const config = this.alertConfigs.get(alert.name)!;
    
    for (const channel of config.channels) {
      await this.channels.get(channel)?.send(alert);
    }

    this.alerts.set(alert.id, alert);
    this.cooldowns.set(alert.name, Date.now());
    
    this.emit('alert:fired', alert);
  }
}
```

**Alert Channels:**

```typescript
// SlackAlertChannel.ts
class SlackAlertChannel implements AlertChannelHandler {
  async send(alert: Alert): Promise<void> {
    const color = {
      critical: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',
    }[alert.severity];

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `[${alert.severity.toUpperCase()}] ${alert.name}`,
          text: alert.message,
          fields: [
            { title: 'Metric', value: alert.metric, short: true },
            { title: 'Value', value: String(alert.value), short: true },
            { title: 'Threshold', value: String(alert.threshold), short: true },
            { title: 'Time', value: alert.timestamp.toISOString(), short: true },
          ],
          footer: alert.runbook ? `Runbook: ${alert.runbook}` : undefined,
        }],
      }),
    });
  }
}

// PagerDutyAlertChannel.ts
class PagerDutyAlertChannel implements AlertChannelHandler {
  async send(alert: Alert): Promise<void> {
    const severity = {
      critical: 'critical',
      warning: 'warning',
      info: 'info',
    }[alert.severity];

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: this.routingKey,
        event_action: 'trigger',
        dedup_key: alert.name,
        payload: {
          summary: `[Scraping] ${alert.name}: ${alert.message}`,
          severity,
          source: 'scraping-service',
          timestamp: alert.timestamp.toISOString(),
          custom_details: {
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
          },
        },
        links: alert.runbook ? [{
          href: `${this.runbookBaseUrl}${alert.runbook}`,
          text: 'Runbook',
        }] : undefined,
      }),
    });
  }
}
```

---

### Task 95-09-02: Operations Runbook

**File:** `open-seo-main/docs/runbooks/SCRAPING-OPERATIONS.md`

```markdown
# Scraping Infrastructure Operations Runbook

## Table of Contents

1. [System Overview](#system-overview)
2. [Health Checks](#health-checks)
3. [Common Issues](#common-issues)
4. [Alert Response Procedures](#alert-response-procedures)
5. [Maintenance Tasks](#maintenance-tasks)
6. [Emergency Procedures](#emergency-procedures)

---

## System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ScrapingService                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ TieredFetcher │  │ QueueManager  │  │ CostTracker   │       │
│  └───────┬───────┘  └───────┬───────┘  └───────────────┘       │
│          │                  │                                    │
│  ┌───────▼───────┐  ┌───────▼───────┐                           │
│  │ 7 Proxy Tiers │  │ BullMQ Queue  │                           │
│  └───────────────┘  └───────────────┘                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Multi-Level Cache                         ││
│  │  L1 Memory → L2 Redis → L3 PostgreSQL → L4 Cloudflare R2   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Critical? |
|-----------|---------|-----------|
| TieredFetcher | 7-tier proxy escalation | Yes |
| QueueManager | Rate-limited job processing | Yes |
| MultiLevelCache | 4-tier caching | Yes |
| CostTracker | Budget enforcement | Yes |
| AlertManager | Monitoring and alerting | No |
| DomainLearning | Tier optimization | No |

### Dependencies

- **Redis**: Queue storage, L2 cache, rate limiting
- **PostgreSQL**: L3 cache, domain learning persistence
- **Cloudflare R2**: L4 long-term archive (optional)
- **DataForSEO**: Premium proxy tier (API)

---

## Health Checks

### Endpoints

```bash
# Overall health
curl http://localhost:3001/api/scraping/health

# Detailed status
curl http://localhost:3001/api/scraping/status

# Metrics (Prometheus format)
curl http://localhost:3001/api/scraping/metrics
```

### Health Response

```json
{
  "status": "healthy",
  "components": {
    "redis": { "status": "up", "latency_ms": 2 },
    "postgresql": { "status": "up", "latency_ms": 5 },
    "queue": { "status": "up", "waiting": 45, "active": 10 },
    "cache": { "status": "up", "hitRate": 0.85 }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Key Metrics to Monitor

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Error rate | < 5% | 5-15% | > 15% |
| Cache hit rate | > 70% | 50-70% | < 50% |
| Queue waiting | < 1000 | 1000-5000 | > 5000 |
| Daily cost | < $50 | $50-100 | > $100 |
| P95 latency | < 5s | 5-15s | > 15s |

---

## Common Issues

### Issue: High Error Rate

**Symptoms:**
- `scraping.error_rate` > 5%
- Alert: `error-rate-warning` or `error-rate-critical`

**Diagnosis:**
```bash
# Check error breakdown by tier
curl http://localhost:3001/api/scraping/metrics | grep error

# Check circuit breaker states
curl http://localhost:3001/api/scraping/status | jq '.circuits'

# Recent errors in logs
journalctl -u scraping-service -n 100 | grep ERROR
```

**Common Causes:**
1. **Proxy provider outage** - Check provider status pages
2. **Target site blocking** - Domain learning should escalate
3. **Network issues** - Check connectivity to proxy endpoints
4. **Rate limiting** - Reduce concurrency

**Resolution:**
1. Check if specific tier is failing (circuit open)
2. If DataForSEO failing, check API status and credentials
3. If all tiers failing, check network/firewall
4. Consider temporarily reducing scraping volume

---

### Issue: Cost Overrun

**Symptoms:**
- `cost.daily` > $50 (warning) or > $100 (critical)
- Alert: `daily-cost-warning` or `daily-cost-critical`

**Diagnosis:**
```bash
# Check cost breakdown by tier
curl http://localhost:3001/api/scraping/cost-report

# Check which consumers are driving costs
curl http://localhost:3001/api/scraping/cost-report | jq '.byConsumer'
```

**Common Causes:**
1. **Spike in scraping requests** - Check job queue source
2. **Domain learning reset** - Starting from expensive tiers
3. **Cache invalidation** - Massive cache miss
4. **New protected sites** - Escalating to expensive tiers

**Resolution:**
1. Identify high-cost consumer and rate limit
2. Check if domain learning DB was reset
3. Review recent cache invalidation operations
4. Consider adding budget caps per consumer

---

### Issue: Circuit Breaker Open

**Symptoms:**
- Alert: `circuit-open`
- Tier being skipped in escalation

**Diagnosis:**
```bash
# Check which circuits are open
curl http://localhost:3001/api/scraping/circuits

# Check failure history
curl http://localhost:3001/api/scraping/circuits/direct/history
```

**Resolution:**
1. Wait for automatic recovery (circuit half-open after timeout)
2. If underlying issue resolved, force close:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/circuits/direct/close
   ```
3. If issue persists, investigate tier provider

---

### Issue: Queue Backlog

**Symptoms:**
- `queue.waiting` > 1000 (warning) or > 5000 (critical)
- Alert: `queue-backlog-warning` or `queue-backlog-critical`

**Diagnosis:**
```bash
# Check queue stats
curl http://localhost:3001/api/scraping/queue/stats

# Check worker count
curl http://localhost:3001/api/scraping/queue/workers
```

**Common Causes:**
1. **Burst of jobs** - Normal during audits
2. **Worker failures** - Check worker health
3. **Rate limiting** - Per-domain limits backing up
4. **Slow tiers** - High latency causing backlog

**Resolution:**
1. If temporary burst, wait for processing
2. Scale workers: `pnpm queue:workers --scale 5`
3. If rate limited, review limit settings
4. Clear stale jobs if necessary:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/queue/drain?older_than=3600
   ```

---

### Issue: Low Cache Hit Rate

**Symptoms:**
- `cache.hit_rate` < 50%
- Higher than expected costs

**Diagnosis:**
```bash
# Check cache stats by level
curl http://localhost:3001/api/scraping/cache/stats

# Check memory cache size
curl http://localhost:3001/api/scraping/cache/l1/stats
```

**Common Causes:**
1. **New domains** - No cache built yet
2. **Cache eviction** - Memory pressure
3. **TTL expired** - Mass expiration
4. **Cache corruption** - Redis issues

**Resolution:**
1. Pre-warm cache for known domains:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/cache/warm \
     -d '{"domains": ["example.com", "other.com"]}'
   ```
2. Increase L1 cache size in config
3. Check Redis memory usage
4. If corrupted, invalidate and rebuild:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/cache/rebuild
   ```

---

## Alert Response Procedures

### Critical Alerts (PagerDuty)

**Response SLA:** 15 minutes

1. Acknowledge alert in PagerDuty
2. Check system health: `curl .../health`
3. Follow runbook section for specific alert
4. If cannot resolve, escalate to on-call engineer
5. Post incident summary in #scraping-incidents

### Warning Alerts (Slack)

**Response SLA:** 1 hour

1. Acknowledge in thread
2. Investigate using diagnosis steps
3. Apply fix or document as known issue
4. Update status if recurring

---

## Maintenance Tasks

### Daily

- [ ] Review cost report
- [ ] Check error rate trends
- [ ] Verify backup completion

### Weekly

- [ ] Review domain learning effectiveness
- [ ] Analyze cache hit rate trends
- [ ] Clean up stale queue jobs
- [ ] Review alert noise

### Monthly

- [ ] Rotate API credentials
- [ ] Review and update rate limits
- [ ] Analyze cost optimization opportunities
- [ ] Update runbook with new learnings

---

## Emergency Procedures

### Complete Service Outage

1. Check all dependencies (Redis, PostgreSQL)
2. Check container/process status
3. Review recent deployments
4. If cannot recover, rollback to last known good

```bash
# Rollback deployment
kubectl rollout undo deployment/scraping-service

# Or restart service
systemctl restart scraping-service
```

### Data Corruption

1. Stop service immediately
2. Preserve corrupted state for analysis
3. Restore from backup
4. Replay any lost jobs from audit trail

### Budget Emergency Stop

If costs exceed emergency threshold:

```bash
# Emergency stop all scraping
curl -X POST http://localhost:3001/api/scraping/emergency-stop

# This will:
# - Pause all queues
# - Block new requests
# - Send alert to all channels
```

To resume after investigation:

```bash
curl -X POST http://localhost:3001/api/scraping/resume
```
```

---

### Task 95-09-03: Data Retention Policies

**File:** `open-seo-main/src/server/features/scraping/retention/RetentionManager.ts`

```typescript
interface RetentionPolicy {
  target: 'cache' | 'logs' | 'metrics' | 'domain_learning';
  retention: number;  // Days
  action: 'delete' | 'archive' | 'compress';
  schedule: string;   // Cron expression
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  // Cache retention
  {
    target: 'cache',
    retention: 30,  // 30 days for L3/L4 cache
    action: 'delete',
    schedule: '0 3 * * *',  // Daily at 3 AM
  },
  
  // Log retention
  {
    target: 'logs',
    retention: 90,  // 90 days for detailed logs
    action: 'archive',
    schedule: '0 4 * * 0',  // Weekly on Sunday at 4 AM
  },
  
  // Metrics retention
  {
    target: 'metrics',
    retention: 365,  // 1 year for aggregated metrics
    action: 'compress',
    schedule: '0 5 1 * *',  // Monthly on 1st at 5 AM
  },
  
  // Domain learning retention
  {
    target: 'domain_learning',
    retention: 180,  // 6 months for domain tier mappings
    action: 'delete',
    schedule: '0 2 * * *',  // Daily at 2 AM
  },
];

class RetentionManager {
  private jobs: Map<string, CronJob> = new Map();

  constructor(
    private redis: Redis,
    private pg: Pool,
    private r2: R2Client,
    private policies: RetentionPolicy[] = DEFAULT_POLICIES
  ) {}

  async start(): Promise<void> {
    for (const policy of this.policies) {
      const job = new CronJob(
        policy.schedule,
        () => this.executePolicy(policy),
        null,
        true,
        'UTC'
      );
      this.jobs.set(policy.target, job);
    }
  }

  private async executePolicy(policy: RetentionPolicy): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - policy.retention);

    this.logger.info(`Executing retention policy for ${policy.target}`, {
      cutoff: cutoff.toISOString(),
      action: policy.action,
    });

    switch (policy.target) {
      case 'cache':
        await this.cleanCache(cutoff, policy.action);
        break;
      case 'logs':
        await this.cleanLogs(cutoff, policy.action);
        break;
      case 'metrics':
        await this.cleanMetrics(cutoff, policy.action);
        break;
      case 'domain_learning':
        await this.cleanDomainLearning(cutoff, policy.action);
        break;
    }
  }

  private async cleanCache(cutoff: Date, action: string): Promise<void> {
    // L3 PostgreSQL cache
    const result = await this.pg.query(`
      DELETE FROM scraping_cache
      WHERE created_at < $1
      RETURNING id
    `, [cutoff]);

    this.logger.info(`Deleted ${result.rowCount} expired cache entries`);

    // L4 R2 archive - list and delete old objects
    if (action === 'delete') {
      const objects = await this.r2.list({
        prefix: 'cache/',
        maxKeys: 1000,
      });

      const oldObjects = objects.objects.filter(
        obj => obj.uploaded < cutoff
      );

      for (const obj of oldObjects) {
        await this.r2.delete(obj.key);
      }

      this.logger.info(`Deleted ${oldObjects.length} old R2 objects`);
    }
  }

  private async cleanLogs(cutoff: Date, action: string): Promise<void> {
    if (action === 'archive') {
      // Compress and move to archive
      const logs = await this.pg.query(`
        SELECT * FROM scraping_logs
        WHERE timestamp < $1
        ORDER BY timestamp
      `, [cutoff]);

      if (logs.rowCount > 0) {
        const compressed = await gzip(JSON.stringify(logs.rows));
        const archiveKey = `logs/archive-${cutoff.toISOString().split('T')[0]}.json.gz`;
        
        await this.r2.put(archiveKey, compressed);
        
        await this.pg.query(`
          DELETE FROM scraping_logs
          WHERE timestamp < $1
        `, [cutoff]);

        this.logger.info(`Archived ${logs.rowCount} log entries to ${archiveKey}`);
      }
    }
  }

  private async cleanMetrics(cutoff: Date, action: string): Promise<void> {
    if (action === 'compress') {
      // Aggregate old metrics into daily summaries
      await this.pg.query(`
        INSERT INTO scraping_metrics_daily (date, metrics)
        SELECT 
          DATE(timestamp) as date,
          jsonb_build_object(
            'requests', SUM((metrics->>'requests')::int),
            'errors', SUM((metrics->>'errors')::int),
            'cost', SUM((metrics->>'cost')::numeric),
            'cache_hits', SUM((metrics->>'cache_hits')::int)
          ) as metrics
        FROM scraping_metrics_hourly
        WHERE timestamp < $1
        GROUP BY DATE(timestamp)
        ON CONFLICT (date) DO UPDATE SET
          metrics = scraping_metrics_daily.metrics || EXCLUDED.metrics
      `, [cutoff]);

      // Delete compressed hourly data
      await this.pg.query(`
        DELETE FROM scraping_metrics_hourly
        WHERE timestamp < $1
      `, [cutoff]);
    }
  }

  private async cleanDomainLearning(cutoff: Date, action: string): Promise<void> {
    // Remove domain mappings not accessed recently
    const result = await this.pg.query(`
      DELETE FROM domain_tier_mappings
      WHERE last_accessed < $1
      RETURNING domain
    `, [cutoff]);

    this.logger.info(`Removed ${result.rowCount} stale domain mappings`);
  }

  async getStats(): Promise<RetentionStats> {
    const [cacheSize, logSize, metricsSize, domainCount] = await Promise.all([
      this.pg.query('SELECT pg_total_relation_size(\'scraping_cache\') as size'),
      this.pg.query('SELECT pg_total_relation_size(\'scraping_logs\') as size'),
      this.pg.query('SELECT pg_total_relation_size(\'scraping_metrics_hourly\') as size'),
      this.pg.query('SELECT COUNT(*) FROM domain_tier_mappings'),
    ]);

    return {
      cache: {
        sizeMb: Math.round(cacheSize.rows[0].size / 1024 / 1024),
        retentionDays: this.getPolicyRetention('cache'),
      },
      logs: {
        sizeMb: Math.round(logSize.rows[0].size / 1024 / 1024),
        retentionDays: this.getPolicyRetention('logs'),
      },
      metrics: {
        sizeMb: Math.round(metricsSize.rows[0].size / 1024 / 1024),
        retentionDays: this.getPolicyRetention('metrics'),
      },
      domainLearning: {
        count: parseInt(domainCount.rows[0].count),
        retentionDays: this.getPolicyRetention('domain_learning'),
      },
    };
  }
}
```

---

### Task 95-09-04: Cost Verification System

**File:** `open-seo-main/src/server/features/scraping/monitoring/CostVerifier.ts`

```typescript
interface CostVerificationReport {
  period: { start: Date; end: Date };
  tracked: {
    totalCost: number;
    byTier: Record<TierName, number>;
    byConsumer: Record<string, number>;
  };
  actual: {
    dataForSeo: number;
    webshare: number;
    geonode: number;
  };
  discrepancy: {
    absolute: number;
    percentage: number;
    withinTolerance: boolean;
  };
  savings: {
    vsLegacy: number;
    percentage: number;
  };
}

class CostVerifier {
  constructor(
    private costTracker: DfsCostTracker,
    private dfsClient: DataForSEOClient,
    private webshareClient: WebshareClient,
    private geonodeClient: GeonodeClient
  ) {}

  async generateReport(start: Date, end: Date): Promise<CostVerificationReport> {
    // Get tracked costs from our system
    const tracked = await this.costTracker.getReport(start, end);

    // Get actual costs from provider APIs
    const [dfsActual, webshareActual, geonodeActual] = await Promise.all([
      this.dfsClient.getUsage(start, end),
      this.webshareClient.getUsage(start, end),
      this.geonodeClient.getUsage(start, end),
    ]);

    const actual = {
      dataForSeo: dfsActual.cost,
      webshare: webshareActual.cost,
      geonode: geonodeActual.cost,
    };

    const actualTotal = Object.values(actual).reduce((a, b) => a + b, 0);
    const discrepancy = Math.abs(tracked.totalCost - actualTotal);
    const discrepancyPct = tracked.totalCost > 0 
      ? (discrepancy / tracked.totalCost) * 100 
      : 0;

    // Calculate savings vs legacy system
    // Legacy: DataForSEO for everything @ $0.02/page
    const legacyCost = tracked.totalRequests * 0.02;
    const savings = legacyCost - tracked.totalCost;
    const savingsPct = legacyCost > 0 ? (savings / legacyCost) * 100 : 0;

    return {
      period: { start, end },
      tracked: {
        totalCost: tracked.totalCost,
        byTier: tracked.costByTier,
        byConsumer: tracked.costByConsumer,
      },
      actual,
      discrepancy: {
        absolute: discrepancy,
        percentage: discrepancyPct,
        withinTolerance: discrepancyPct < 5, // 5% tolerance
      },
      savings: {
        vsLegacy: savings,
        percentage: savingsPct,
      },
    };
  }

  async verifyDailyReports(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const report = await this.generateReport(yesterday, today);

    if (!report.discrepancy.withinTolerance) {
      this.alertManager.fire({
        name: 'cost-tracking-discrepancy',
        severity: 'warning',
        message: `Cost tracking discrepancy: ${report.discrepancy.percentage.toFixed(1)}% (tracked: $${report.tracked.totalCost.toFixed(2)}, actual: $${Object.values(report.actual).reduce((a, b) => a + b, 0).toFixed(2)})`,
      });
    }

    // Log savings for visibility
    this.logger.info('Daily cost verification', {
      trackedCost: report.tracked.totalCost,
      actualCost: Object.values(report.actual).reduce((a, b) => a + b, 0),
      discrepancy: report.discrepancy,
      savings: report.savings,
    });

    // Store for historical analysis
    await this.storeReport(report);
  }
}
```

---

### Task 95-09-05: Health Check Endpoints

**File:** `open-seo-main/src/server/features/scraping/routes/health.ts`

```typescript
import { Router } from 'express';

export function createHealthRoutes(scrapingService: ScrapingService): Router {
  const router = Router();

  // Basic health check (for load balancers)
  router.get('/health', async (req, res) => {
    try {
      const health = await scrapingService.healthCheck();
      
      const status = health.components.every(c => c.status === 'up')
        ? 'healthy'
        : health.components.some(c => c.status === 'up')
        ? 'degraded'
        : 'unhealthy';

      res.status(status === 'unhealthy' ? 503 : 200).json({
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Detailed status (for debugging)
  router.get('/status', async (req, res) => {
    const [health, metrics, circuits, queue] = await Promise.all([
      scrapingService.healthCheck(),
      scrapingService.getMetrics(),
      scrapingService.getCircuitStates(),
      scrapingService.getQueueStats(),
    ]);

    res.json({
      health,
      metrics: {
        requestsToday: metrics.requestsToday,
        errorRate: metrics.errorRate,
        cacheHitRate: metrics.cacheHitRate,
        p95Latency: metrics.p95Latency,
      },
      circuits,
      queue: {
        waiting: queue.waiting,
        active: queue.active,
        completed: queue.completed,
        failed: queue.failed,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Prometheus metrics
  router.get('/metrics', async (req, res) => {
    const metrics = await scrapingService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  });

  // Cost report
  router.get('/cost-report', async (req, res) => {
    const { start, end } = req.query;
    const report = await scrapingService.getCostReport({
      start: start ? new Date(start as string) : undefined,
      end: end ? new Date(end as string) : undefined,
    });
    res.json(report);
  });

  // Circuit breaker status
  router.get('/circuits', async (req, res) => {
    const circuits = await scrapingService.getCircuitStates();
    res.json(circuits);
  });

  // Manual circuit control (protected)
  router.post('/circuits/:tier/close', requireAdmin, async (req, res) => {
    await scrapingService.forceCloseCircuit(req.params.tier);
    res.json({ success: true });
  });

  router.post('/circuits/:tier/open', requireAdmin, async (req, res) => {
    await scrapingService.forceOpenCircuit(req.params.tier);
    res.json({ success: true });
  });

  // Queue management
  router.get('/queue/stats', async (req, res) => {
    const stats = await scrapingService.getQueueStats();
    res.json(stats);
  });

  router.post('/queue/drain', requireAdmin, async (req, res) => {
    const { older_than } = req.query;
    const count = await scrapingService.drainQueue(
      older_than ? parseInt(older_than as string) : undefined
    );
    res.json({ drained: count });
  });

  // Cache management
  router.get('/cache/stats', async (req, res) => {
    const stats = await scrapingService.getCacheStats();
    res.json(stats);
  });

  router.post('/cache/warm', requireAdmin, async (req, res) => {
    const { domains } = req.body;
    await scrapingService.warmCache(domains);
    res.json({ success: true });
  });

  router.post('/cache/invalidate', requireAdmin, async (req, res) => {
    const { pattern } = req.body;
    const count = await scrapingService.invalidateCache(pattern);
    res.json({ invalidated: count });
  });

  // Emergency controls
  router.post('/emergency-stop', requireAdmin, async (req, res) => {
    await scrapingService.emergencyStop();
    res.json({ success: true, message: 'All scraping stopped' });
  });

  router.post('/resume', requireAdmin, async (req, res) => {
    await scrapingService.resume();
    res.json({ success: true, message: 'Scraping resumed' });
  });

  return router;
}
```

---

### Task 95-09-06: Grafana Dashboard Template

**File:** `open-seo-main/docs/monitoring/grafana-dashboard.json`

```json
{
  "title": "Scraping Infrastructure",
  "uid": "scraping-infra",
  "panels": [
    {
      "title": "Requests per Second",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(scraping_requests_total[5m])",
          "legendFormat": "{{tier}}"
        }
      ],
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 }
    },
    {
      "title": "Error Rate",
      "type": "gauge",
      "targets": [
        {
          "expr": "rate(scraping_errors_total[5m]) / rate(scraping_requests_total[5m])"
        }
      ],
      "thresholds": {
        "steps": [
          { "value": 0, "color": "green" },
          { "value": 0.05, "color": "yellow" },
          { "value": 0.15, "color": "red" }
        ]
      },
      "gridPos": { "h": 8, "w": 6, "x": 12, "y": 0 }
    },
    {
      "title": "Daily Cost",
      "type": "stat",
      "targets": [
        {
          "expr": "scraping_cost_daily_total"
        }
      ],
      "options": {
        "reduceOptions": {
          "values": false,
          "calcs": ["lastNotNull"],
          "fields": ""
        }
      },
      "fieldConfig": {
        "defaults": {
          "unit": "currencyUSD",
          "thresholds": {
            "steps": [
              { "value": 0, "color": "green" },
              { "value": 50, "color": "yellow" },
              { "value": 100, "color": "red" }
            ]
          }
        }
      },
      "gridPos": { "h": 8, "w": 6, "x": 18, "y": 0 }
    },
    {
      "title": "Cache Hit Rate by Level",
      "type": "timeseries",
      "targets": [
        {
          "expr": "scraping_cache_hits_total{level=\"L1\"} / scraping_cache_requests_total{level=\"L1\"}",
          "legendFormat": "L1 Memory"
        },
        {
          "expr": "scraping_cache_hits_total{level=\"L2\"} / scraping_cache_requests_total{level=\"L2\"}",
          "legendFormat": "L2 Redis"
        },
        {
          "expr": "scraping_cache_hits_total{level=\"L3\"} / scraping_cache_requests_total{level=\"L3\"}",
          "legendFormat": "L3 PostgreSQL"
        }
      ],
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 }
    },
    {
      "title": "Queue Depth",
      "type": "timeseries",
      "targets": [
        {
          "expr": "scraping_queue_waiting",
          "legendFormat": "Waiting"
        },
        {
          "expr": "scraping_queue_active",
          "legendFormat": "Active"
        }
      ],
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 }
    },
    {
      "title": "Circuit Breaker States",
      "type": "state-timeline",
      "targets": [
        {
          "expr": "scraping_circuit_state",
          "legendFormat": "{{tier}}"
        }
      ],
      "gridPos": { "h": 8, "w": 24, "x": 0, "y": 16 }
    },
    {
      "title": "P95 Latency by Tier",
      "type": "heatmap",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, rate(scraping_latency_seconds_bucket[5m]))",
          "legendFormat": "{{tier}}"
        }
      ],
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 24 }
    },
    {
      "title": "Cost by Tier (Last 7 Days)",
      "type": "piechart",
      "targets": [
        {
          "expr": "sum(increase(scraping_cost_total[7d])) by (tier)"
        }
      ],
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 24 }
    }
  ]
}
```

---

### Task 95-09-07: Unit Tests for Monitoring

**File:** `open-seo-main/src/server/features/scraping/monitoring/__tests__/`

```typescript
// AlertManager.test.ts
describe('AlertManager', () => {
  it('should fire alert when condition met', async () => {
    const slackHandler = vi.fn();
    alertManager.registerChannel('slack', { send: slackHandler });
    
    alertManager.registerAlert({
      name: 'test-alert',
      condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 0,
    });
    
    await alertManager.evaluate({ 'cost.daily': 75 });
    
    expect(slackHandler).toHaveBeenCalled();
  });

  it('should respect cooldown period', async () => {
    const slackHandler = vi.fn();
    alertManager.registerChannel('slack', { send: slackHandler });
    
    alertManager.registerAlert({
      name: 'test-alert',
      condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600,
    });
    
    await alertManager.evaluate({ 'cost.daily': 75 });
    await alertManager.evaluate({ 'cost.daily': 75 });
    
    expect(slackHandler).toHaveBeenCalledTimes(1);
  });
});

// RetentionManager.test.ts
describe('RetentionManager', () => {
  it('should delete expired cache entries', async () => {
    // Insert old entries
    await pg.query(`
      INSERT INTO scraping_cache (key, value, created_at)
      VALUES ('old-key', '{}', NOW() - INTERVAL '60 days')
    `);
    
    await retentionManager.executePolicy({
      target: 'cache',
      retention: 30,
      action: 'delete',
      schedule: '* * * * *',
    });
    
    const result = await pg.query('SELECT * FROM scraping_cache WHERE key = $1', ['old-key']);
    expect(result.rowCount).toBe(0);
  });
});

// CostVerifier.test.ts
describe('CostVerifier', () => {
  it('should generate accurate cost report', async () => {
    // Mock provider APIs
    mockDfsClient.getUsage.mockResolvedValue({ cost: 10.50 });
    mockWebshareClient.getUsage.mockResolvedValue({ cost: 2.25 });
    mockGeonodeClient.getUsage.mockResolvedValue({ cost: 1.15 });
    
    // Mock tracked costs
    mockCostTracker.getReport.mockResolvedValue({
      totalCost: 13.90,
      totalRequests: 5000,
    });
    
    const report = await costVerifier.generateReport(start, end);
    
    expect(report.discrepancy.withinTolerance).toBe(true);
    expect(report.savings.percentage).toBeGreaterThan(90);
  });
});
```

---

## Environment Variables

```bash
# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_ROUTING_KEY=...
ALERT_EMAIL_RECIPIENTS=ops@example.com

# Retention
CACHE_RETENTION_DAYS=30
LOG_RETENTION_DAYS=90
METRICS_RETENTION_DAYS=365

# Cost verification
VERIFY_COSTS_DAILY=true
COST_DISCREPANCY_TOLERANCE=0.05

# Health checks
HEALTH_CHECK_INTERVAL_MS=30000
```

---

## Definition of Done

- [ ] AlertManager implemented with all default alerts
- [ ] Slack and PagerDuty channels working
- [ ] Operations runbook complete and reviewed
- [ ] Retention policies implemented and scheduled
- [ ] Cost verification running daily
- [ ] Health check endpoints exposed
- [ ] Grafana dashboard template created
- [ ] All monitoring tests passing
- [ ] Documentation reviewed by ops team
