# Plan 95-11: Reliability & Resilience Completion

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 11 - Reliability & Resilience Completion  
**Status:** Ready  
**Priority:** P0 (Critical)  
**Estimated Effort:** 12 hours  
**Dependencies:** 95-01 (TieredFetcher), 95-08 (CircuitBreaker), 95-09 (Operational)

---

## Objective

Complete the reliability and resilience infrastructure to ensure:
- CircuitBreaker integrated with TieredFetcher (prevents cascade failures)
- Health endpoints return real data (enables load balancer integration)
- AlertManager fully configured (enables incident response)
- Prometheus metrics exported (enables monitoring dashboards)

---

## Current State Analysis

### Gaps Identified in Review

| Component | Current State | Required State |
|-----------|--------------|----------------|
| CircuitBreaker | Exists standalone | Integrated with TieredFetcher |
| `ScrapingService.healthCheck()` | Returns `{ healthy: true }` stub | Real Redis/DB/Queue pings |
| `ScrapingService.getPrometheusMetrics()` | Returns empty string | Real metrics export |
| Health endpoints | Return mock data | Return live component status |
| AlertManager | Code exists | Env vars configured, thresholds tuned |

### Files to Modify

```
open-seo-main/src/server/features/scraping/
├── TieredFetcher.ts                    # Task 1 (CircuitBreaker integration)
├── ScrapingService.ts                  # Task 2 (healthCheck), Task 3 (metrics)
├── routes/health.ts                    # Task 4 (real health data)
├── monitoring/AlertManager.ts          # Task 5 (configuration)
└── monitoring/MetricsExporter.ts       # Task 3 (new file)
```

---

## Task Breakdown

### Task 1: Integrate CircuitBreaker with TieredFetcher

**File:** `open-seo-main/src/server/features/scraping/TieredFetcher.ts`

**Current State:**
- CircuitBreaker exists at `/resilience/CircuitBreaker.ts`
- TieredFetcher does NOT use it
- Tier failures can cascade

**Implementation:**

```typescript
// TieredFetcher.ts

import { CircuitBreaker, CircuitState } from './resilience/CircuitBreaker';

export class TieredFetcher {
  private circuitBreakers: Map<ScrapingTier, CircuitBreaker> = new Map();
  
  constructor(options: TieredFetcherOptions) {
    // Initialize circuit breaker per tier
    const tiers: ScrapingTier[] = [
      'direct', 'webshare', 'geonode', 'camoufox',
      'dfs_basic', 'dfs_js', 'dfs_browser'
    ];
    
    for (const tier of tiers) {
      this.circuitBreakers.set(tier, new CircuitBreaker({
        name: `tier-${tier}`,
        failureThreshold: this.getFailureThreshold(tier),
        resetTimeoutMs: this.getResetTimeout(tier),
        halfOpenRequests: 3,
        onStateChange: (from, to) => {
          this.logger.warn(`Circuit ${tier}: ${from} -> ${to}`);
          if (to === 'open') {
            this.alertManager?.alert({
              severity: 'warning',
              title: `Circuit breaker opened for tier: ${tier}`,
              message: `Tier ${tier} has exceeded failure threshold`,
              source: 'TieredFetcher',
            });
          }
        },
      }));
    }
  }

  private getFailureThreshold(tier: ScrapingTier): number {
    // Higher tiers (more expensive) have lower thresholds
    const thresholds: Record<ScrapingTier, number> = {
      direct: 10,      // Allow more failures (free)
      webshare: 10,    // Allow more failures (free)
      geonode: 5,      // Moderate threshold
      camoufox: 5,     // Moderate threshold
      dfs_basic: 3,    // Lower threshold (paid)
      dfs_js: 3,       // Lower threshold (paid)
      dfs_browser: 2,  // Lowest threshold (expensive)
    };
    return thresholds[tier];
  }

  private getResetTimeout(tier: ScrapingTier): number {
    // DataForSEO tiers have longer cooldown
    const timeouts: Record<ScrapingTier, number> = {
      direct: 30_000,      // 30 seconds
      webshare: 30_000,    // 30 seconds
      geonode: 60_000,     // 1 minute
      camoufox: 60_000,    // 1 minute
      dfs_basic: 120_000,  // 2 minutes
      dfs_js: 120_000,     // 2 minutes
      dfs_browser: 300_000, // 5 minutes
    };
    return timeouts[tier];
  }

  async fetch(url: string, options: FetchOptions): Promise<FetchResult> {
    const tier = options.startTier || await this.selectTier(url, options);
    
    // Check circuit breaker before attempting
    const breaker = this.circuitBreakers.get(tier);
    if (breaker && breaker.getState() === 'open') {
      this.logger.debug(`Circuit open for ${tier}, escalating to next tier`);
      return this.escalateToNextTier(url, tier, options);
    }

    try {
      // Execute through circuit breaker
      const result = await breaker.execute(async () => {
        return this.performFetch(url, tier, options);
      });
      
      // Record success for circuit breaker
      breaker.recordSuccess();
      return result;
      
    } catch (error) {
      // Record failure for circuit breaker
      breaker.recordFailure();
      
      // Escalate if breaker trips
      if (breaker.getState() === 'open') {
        return this.escalateToNextTier(url, tier, options);
      }
      
      throw error;
    }
  }

  private async escalateToNextTier(
    url: string, 
    currentTier: ScrapingTier, 
    options: FetchOptions
  ): Promise<FetchResult> {
    const nextTier = this.getNextTier(currentTier);
    if (!nextTier) {
      throw new Error(`All tiers exhausted for ${url}`);
    }
    
    this.logger.info(`Escalating ${url} from ${currentTier} to ${nextTier}`);
    return this.fetch(url, { ...options, startTier: nextTier });
  }

  getCircuitStates(): Record<ScrapingTier, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [tier, breaker] of this.circuitBreakers) {
      states[tier] = breaker.getState();
    }
    return states as Record<ScrapingTier, CircuitState>;
  }

  resetCircuit(tier: ScrapingTier): void {
    const breaker = this.circuitBreakers.get(tier);
    if (breaker) {
      breaker.reset();
      this.logger.info(`Circuit ${tier} manually reset`);
    }
  }
}
```

**Acceptance Criteria:**
- [ ] CircuitBreaker per tier initialized
- [ ] Fetch attempts check circuit state first
- [ ] Failures recorded to circuit breaker
- [ ] Open circuits trigger tier escalation
- [ ] Alert fired when circuit opens
- [ ] `getCircuitStates()` returns real data
- [ ] Manual `resetCircuit()` available
- [ ] Unit tests for circuit integration

---

### Task 2: Implement Real Health Check

**File:** `open-seo-main/src/server/features/scraping/ScrapingService.ts`

**Current State (stub):**
```typescript
async healthCheck(): Promise<HealthCheckResult> {
  return { healthy: true };
}
```

**Implementation:**

```typescript
import Redis from 'ioredis';
import { Pool } from 'pg';

interface HealthCheckResult {
  healthy: boolean;
  timestamp: string;
  components: {
    redis: ComponentHealth;
    postgres: ComponentHealth;
    queue: ComponentHealth;
    circuits: ComponentHealth;
    cache: ComponentHealth;
  };
  latencyMs: number;
}

interface ComponentHealth {
  healthy: boolean;
  latencyMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

async healthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const results: HealthCheckResult = {
    healthy: true,
    timestamp: new Date().toISOString(),
    components: {
      redis: { healthy: false, latencyMs: 0 },
      postgres: { healthy: false, latencyMs: 0 },
      queue: { healthy: false, latencyMs: 0 },
      circuits: { healthy: false, latencyMs: 0 },
      cache: { healthy: false, latencyMs: 0 },
    },
    latencyMs: 0,
  };

  // Check Redis
  const redisStart = Date.now();
  try {
    const redis = this.getRedisClient();
    await redis.ping();
    results.components.redis = {
      healthy: true,
      latencyMs: Date.now() - redisStart,
      details: {
        connected: redis.status === 'ready',
      },
    };
  } catch (error) {
    results.components.redis = {
      healthy: false,
      latencyMs: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    results.healthy = false;
  }

  // Check PostgreSQL
  const pgStart = Date.now();
  try {
    const pool = this.getPostgresPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    results.components.postgres = {
      healthy: true,
      latencyMs: Date.now() - pgStart,
      details: {
        poolSize: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
    };
  } catch (error) {
    results.components.postgres = {
      healthy: false,
      latencyMs: Date.now() - pgStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    results.healthy = false;
  }

  // Check BullMQ Queue
  const queueStart = Date.now();
  try {
    const queueManager = this.getQueueManager();
    const queueHealth = await queueManager.healthCheck();
    results.components.queue = {
      healthy: queueHealth.healthy,
      latencyMs: Date.now() - queueStart,
      details: {
        waiting: queueHealth.waiting,
        active: queueHealth.active,
        completed: queueHealth.completed,
        failed: queueHealth.failed,
      },
    };
    if (!queueHealth.healthy) {
      results.healthy = false;
    }
  } catch (error) {
    results.components.queue = {
      healthy: false,
      latencyMs: Date.now() - queueStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    results.healthy = false;
  }

  // Check Circuit Breakers
  const circuitStart = Date.now();
  try {
    const tieredFetcher = this.getTieredFetcher();
    const states = tieredFetcher.getCircuitStates();
    const openCircuits = Object.entries(states)
      .filter(([_, state]) => state === 'open')
      .map(([tier]) => tier);
    
    results.components.circuits = {
      healthy: openCircuits.length === 0,
      latencyMs: Date.now() - circuitStart,
      details: {
        states,
        openCircuits,
      },
    };
    // Circuits being open is warning, not failure
  } catch (error) {
    results.components.circuits = {
      healthy: false,
      latencyMs: Date.now() - circuitStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Cache Layers
  const cacheStart = Date.now();
  try {
    const cacheManager = this.getCacheManager();
    const cacheHealth = await cacheManager.healthCheck();
    results.components.cache = {
      healthy: cacheHealth.healthy,
      latencyMs: Date.now() - cacheStart,
      details: {
        l1: cacheHealth.l1,
        l2: cacheHealth.l2,
        l3: cacheHealth.l3,
        l4: cacheHealth.l4,
      },
    };
  } catch (error) {
    results.components.cache = {
      healthy: false,
      latencyMs: Date.now() - cacheStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  results.latencyMs = Date.now() - startTime;
  return results;
}
```

**Add to QueueManager:**

```typescript
// queue/QueueManager.ts

async healthCheck(): Promise<QueueHealthResult> {
  const queues = ['scrape:priority', 'scrape:standard', 'scrape:background'];
  const results: QueueHealthResult = {
    healthy: true,
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
  };

  for (const queueName of queues) {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts();
    results.waiting += counts.waiting;
    results.active += counts.active;
    results.completed += counts.completed;
    results.failed += counts.failed;
  }

  // Unhealthy if too many failed or waiting
  if (results.failed > 100 || results.waiting > 1000) {
    results.healthy = false;
  }

  return results;
}
```

**Acceptance Criteria:**
- [ ] Redis ping with latency
- [ ] PostgreSQL connection with pool stats
- [ ] Queue job counts from BullMQ
- [ ] Circuit breaker states from TieredFetcher
- [ ] Cache layer health from CacheManager
- [ ] Overall healthy flag computed
- [ ] Total latency tracked
- [ ] Unit tests for health check

---

### Task 3: Implement Prometheus Metrics Export

**New File:** `open-seo-main/src/server/features/scraping/monitoring/MetricsExporter.ts`

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsExporter {
  private registry: Registry;
  
  // Counters
  private requestsTotal: Counter;
  private errorsTotal: Counter;
  private cacheHitsTotal: Counter;
  private cacheMissesTotal: Counter;
  private tierUsageTotal: Counter;
  
  // Histograms
  private requestDuration: Histogram;
  private costPerRequest: Histogram;
  
  // Gauges
  private activeRequests: Gauge;
  private queueDepth: Gauge;
  private circuitState: Gauge;
  private cacheSize: Gauge;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: 'tevero-scraping' });
    
    // Initialize metrics
    this.requestsTotal = new Counter({
      name: 'scraping_requests_total',
      help: 'Total number of scraping requests',
      labelNames: ['tier', 'feature', 'status'],
      registers: [this.registry],
    });

    this.errorsTotal = new Counter({
      name: 'scraping_errors_total',
      help: 'Total number of scraping errors',
      labelNames: ['tier', 'error_type'],
      registers: [this.registry],
    });

    this.cacheHitsTotal = new Counter({
      name: 'scraping_cache_hits_total',
      help: 'Total cache hits',
      labelNames: ['level'],
      registers: [this.registry],
    });

    this.cacheMissesTotal = new Counter({
      name: 'scraping_cache_misses_total',
      help: 'Total cache misses',
      registers: [this.registry],
    });

    this.tierUsageTotal = new Counter({
      name: 'scraping_tier_usage_total',
      help: 'Usage count per tier',
      labelNames: ['tier'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'scraping_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['tier', 'cached'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.costPerRequest = new Histogram({
      name: 'scraping_cost_per_request_usd',
      help: 'Cost per request in USD',
      labelNames: ['tier'],
      buckets: [0, 0.0001, 0.001, 0.005, 0.01],
      registers: [this.registry],
    });

    this.activeRequests = new Gauge({
      name: 'scraping_active_requests',
      help: 'Number of active requests',
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: 'scraping_queue_depth',
      help: 'Number of jobs in queue',
      labelNames: ['queue', 'state'],
      registers: [this.registry],
    });

    this.circuitState = new Gauge({
      name: 'scraping_circuit_state',
      help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
      labelNames: ['tier'],
      registers: [this.registry],
    });

    this.cacheSize = new Gauge({
      name: 'scraping_cache_size_bytes',
      help: 'Cache size in bytes',
      labelNames: ['level'],
      registers: [this.registry],
    });
  }

  // Recording methods
  recordRequest(tier: string, feature: string, status: 'success' | 'error') {
    this.requestsTotal.inc({ tier, feature, status });
  }

  recordError(tier: string, errorType: string) {
    this.errorsTotal.inc({ tier, error_type: errorType });
  }

  recordCacheHit(level: string) {
    this.cacheHitsTotal.inc({ level });
  }

  recordCacheMiss() {
    this.cacheMissesTotal.inc();
  }

  recordTierUsage(tier: string) {
    this.tierUsageTotal.inc({ tier });
  }

  recordDuration(tier: string, cached: boolean, durationSeconds: number) {
    this.requestDuration.observe({ tier, cached: String(cached) }, durationSeconds);
  }

  recordCost(tier: string, costUsd: number) {
    this.costPerRequest.observe({ tier }, costUsd);
  }

  setActiveRequests(count: number) {
    this.activeRequests.set(count);
  }

  setQueueDepth(queue: string, state: string, count: number) {
    this.queueDepth.set({ queue, state }, count);
  }

  setCircuitState(tier: string, state: 'closed' | 'half-open' | 'open') {
    const stateValue = { closed: 0, 'half-open': 1, open: 2 }[state];
    this.circuitState.set({ tier }, stateValue);
  }

  setCacheSize(level: string, bytes: number) {
    this.cacheSize.set({ level }, bytes);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

// Singleton
let metricsExporter: MetricsExporter | null = null;

export function getMetricsExporter(): MetricsExporter {
  if (!metricsExporter) {
    metricsExporter = new MetricsExporter();
  }
  return metricsExporter;
}
```

**Update ScrapingService:**

```typescript
// ScrapingService.ts

import { getMetricsExporter } from './monitoring/MetricsExporter';

async getPrometheusMetrics(): Promise<string> {
  const exporter = getMetricsExporter();
  
  // Update gauges before export
  const health = await this.healthCheck();
  
  // Circuit states
  const circuits = health.components.circuits.details?.states as Record<string, string>;
  if (circuits) {
    for (const [tier, state] of Object.entries(circuits)) {
      exporter.setCircuitState(tier, state as 'closed' | 'half-open' | 'open');
    }
  }
  
  // Queue depths
  const queueDetails = health.components.queue.details;
  if (queueDetails) {
    exporter.setQueueDepth('scrape', 'waiting', queueDetails.waiting as number);
    exporter.setQueueDepth('scrape', 'active', queueDetails.active as number);
    exporter.setQueueDepth('scrape', 'failed', queueDetails.failed as number);
  }
  
  // Cache sizes
  const cacheDetails = health.components.cache.details;
  if (cacheDetails) {
    exporter.setCacheSize('l1', (cacheDetails.l1 as any)?.sizeBytes || 0);
    exporter.setCacheSize('l2', (cacheDetails.l2 as any)?.sizeBytes || 0);
  }
  
  return exporter.getMetrics();
}

getMetricsContentType(): string {
  return getMetricsExporter().getContentType();
}
```

**Acceptance Criteria:**
- [ ] prom-client dependency added
- [ ] MetricsExporter with all metrics
- [ ] Recording methods called in TieredFetcher
- [ ] Gauges updated before export
- [ ] `/metrics` endpoint returns valid Prometheus format
- [ ] Grafana dashboard can scrape metrics

---

### Task 4: Implement Real Health Endpoints

**File:** `open-seo-main/src/server/features/scraping/routes/health.ts`

**Current State:**
```typescript
router.get('/health', (req, res) => {
  res.json({ status: 'ok' }); // Stub
});
```

**Implementation:**

```typescript
import { Router, Request, Response } from 'express';
import { getScrapingService } from '../';

export function createHealthRoutes(): Router {
  const router = Router();

  // Liveness probe (is the process running?)
  router.get('/health/live', (req: Request, res: Response) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  // Readiness probe (is the service ready to handle requests?)
  router.get('/health/ready', async (req: Request, res: Response) => {
    try {
      const service = getScrapingService();
      const health = await service.healthCheck();
      
      if (health.healthy) {
        res.status(200).json({
          status: 'ready',
          timestamp: health.timestamp,
          latencyMs: health.latencyMs,
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: health.timestamp,
          unhealthyComponents: Object.entries(health.components)
            .filter(([_, v]) => !v.healthy)
            .map(([k]) => k),
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Detailed health (for debugging)
  router.get('/health/detailed', async (req: Request, res: Response) => {
    try {
      const service = getScrapingService();
      const health = await service.healthCheck();
      res.status(health.healthy ? 200 : 503).json(health);
    } catch (error) {
      res.status(500).json({
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Circuit breaker states
  router.get('/health/circuits', async (req: Request, res: Response) => {
    try {
      const service = getScrapingService();
      const tieredFetcher = service.getTieredFetcher();
      const states = tieredFetcher.getCircuitStates();
      
      const openCircuits = Object.entries(states)
        .filter(([_, state]) => state === 'open')
        .map(([tier]) => tier);
      
      res.status(openCircuits.length > 0 ? 503 : 200).json({
        states,
        openCircuits,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Reset circuit breaker (admin only)
  router.post('/health/circuits/:tier/reset', async (req: Request, res: Response) => {
    const { tier } = req.params;
    
    try {
      const service = getScrapingService();
      const tieredFetcher = service.getTieredFetcher();
      tieredFetcher.resetCircuit(tier as any);
      
      res.status(200).json({
        message: `Circuit ${tier} reset`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Queue stats
  router.get('/health/queues', async (req: Request, res: Response) => {
    try {
      const service = getScrapingService();
      const queueManager = service.getQueueManager();
      const health = await queueManager.healthCheck();
      
      res.status(health.healthy ? 200 : 503).json({
        ...health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Prometheus metrics
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const service = getScrapingService();
      const metrics = await service.getPrometheusMetrics();
      res.set('Content-Type', service.getMetricsContentType());
      res.send(metrics);
    } catch (error) {
      res.status(500).send(`# Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  });

  return router;
}
```

**Acceptance Criteria:**
- [ ] `/health/live` always returns 200
- [ ] `/health/ready` returns 503 if any component unhealthy
- [ ] `/health/detailed` returns full health check
- [ ] `/health/circuits` shows circuit breaker states
- [ ] `/health/circuits/:tier/reset` allows manual reset
- [ ] `/health/queues` shows BullMQ stats
- [ ] `/metrics` returns Prometheus format

---

### Task 5: Configure AlertManager

**File:** `open-seo-main/src/server/features/scraping/monitoring/AlertManager.ts`

**Environment Variables Required:**

```bash
# .env.example additions
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
SLACK_CHANNEL=#scraping-alerts
PAGERDUTY_ROUTING_KEY=your-routing-key
ALERT_ENVIRONMENT=production
```

**Implementation:**

```typescript
import { SlackAlertChannel } from './SlackAlertChannel';
import { PagerDutyAlertChannel } from './PagerDutyAlertChannel';

interface AlertConfig {
  slackWebhookUrl?: string;
  slackChannel?: string;
  pagerDutyRoutingKey?: string;
  environment: string;
}

interface AlertThresholds {
  circuitOpenCount: number;      // Alert if N circuits open
  queueDepthWarning: number;     // Warn if queue > N
  queueDepthCritical: number;    // Critical if queue > N
  errorRateWarning: number;      // Warn if error rate > N%
  errorRateCritical: number;     // Critical if error rate > N%
  costDailyWarning: number;      // Warn if daily cost > $N
  costDailyCritical: number;     // Critical if daily cost > $N
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  circuitOpenCount: 2,
  queueDepthWarning: 500,
  queueDepthCritical: 1000,
  errorRateWarning: 5,
  errorRateCritical: 15,
  costDailyWarning: 40,
  costDailyCritical: 80,
};

export class AlertManager {
  private config: AlertConfig;
  private thresholds: AlertThresholds;
  private channels: AlertChannel[] = [];
  private recentAlerts: Map<string, number> = new Map(); // Deduplication
  private readonly dedupeWindowMs = 5 * 60 * 1000; // 5 minutes

  constructor(config?: Partial<AlertConfig>, thresholds?: Partial<AlertThresholds>) {
    this.config = {
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      slackChannel: process.env.SLACK_CHANNEL || '#scraping-alerts',
      pagerDutyRoutingKey: process.env.PAGERDUTY_ROUTING_KEY,
      environment: process.env.ALERT_ENVIRONMENT || process.env.NODE_ENV || 'development',
      ...config,
    };
    
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.initializeChannels();
  }

  private initializeChannels() {
    // Slack for all alerts
    if (this.config.slackWebhookUrl) {
      this.channels.push(new SlackAlertChannel({
        webhookUrl: this.config.slackWebhookUrl,
        channel: this.config.slackChannel,
        environment: this.config.environment,
      }));
    }

    // PagerDuty for critical only
    if (this.config.pagerDutyRoutingKey) {
      this.channels.push(new PagerDutyAlertChannel({
        routingKey: this.config.pagerDutyRoutingKey,
        environment: this.config.environment,
        severityFilter: ['critical'], // Only critical alerts
      }));
    }

    if (this.channels.length === 0) {
      console.warn('AlertManager: No alert channels configured. Set SLACK_WEBHOOK_URL or PAGERDUTY_ROUTING_KEY');
    }
  }

  async alert(alert: Alert): Promise<void> {
    // Deduplicate
    const dedupeKey = `${alert.severity}:${alert.title}`;
    const lastAlertTime = this.recentAlerts.get(dedupeKey);
    if (lastAlertTime && Date.now() - lastAlertTime < this.dedupeWindowMs) {
      return; // Skip duplicate
    }
    this.recentAlerts.set(dedupeKey, Date.now());

    // Send to all channels
    const promises = this.channels.map(channel => 
      channel.send(alert).catch(err => {
        console.error(`Failed to send alert to ${channel.name}:`, err);
      })
    );
    
    await Promise.all(promises);
  }

  // Threshold-based alert methods
  async checkCircuits(openCircuits: string[]): Promise<void> {
    if (openCircuits.length >= this.thresholds.circuitOpenCount) {
      await this.alert({
        severity: openCircuits.length >= 4 ? 'critical' : 'warning',
        title: `${openCircuits.length} circuit breakers open`,
        message: `Open circuits: ${openCircuits.join(', ')}`,
        source: 'CircuitBreaker',
        metadata: { openCircuits },
      });
    }
  }

  async checkQueueDepth(waiting: number): Promise<void> {
    if (waiting >= this.thresholds.queueDepthCritical) {
      await this.alert({
        severity: 'critical',
        title: 'Queue depth critical',
        message: `${waiting} jobs waiting in queue (threshold: ${this.thresholds.queueDepthCritical})`,
        source: 'QueueManager',
        metadata: { waiting },
      });
    } else if (waiting >= this.thresholds.queueDepthWarning) {
      await this.alert({
        severity: 'warning',
        title: 'Queue depth warning',
        message: `${waiting} jobs waiting in queue (threshold: ${this.thresholds.queueDepthWarning})`,
        source: 'QueueManager',
        metadata: { waiting },
      });
    }
  }

  async checkErrorRate(errorRate: number): Promise<void> {
    if (errorRate >= this.thresholds.errorRateCritical) {
      await this.alert({
        severity: 'critical',
        title: 'Error rate critical',
        message: `${errorRate.toFixed(1)}% error rate (threshold: ${this.thresholds.errorRateCritical}%)`,
        source: 'TieredFetcher',
        metadata: { errorRate },
      });
    } else if (errorRate >= this.thresholds.errorRateWarning) {
      await this.alert({
        severity: 'warning',
        title: 'Error rate elevated',
        message: `${errorRate.toFixed(1)}% error rate (threshold: ${this.thresholds.errorRateWarning}%)`,
        source: 'TieredFetcher',
        metadata: { errorRate },
      });
    }
  }

  async checkDailyCost(costUsd: number): Promise<void> {
    if (costUsd >= this.thresholds.costDailyCritical) {
      await this.alert({
        severity: 'critical',
        title: 'Daily cost critical',
        message: `$${costUsd.toFixed(2)} spent today (threshold: $${this.thresholds.costDailyCritical})`,
        source: 'DfsCostTracker',
        metadata: { costUsd },
      });
    } else if (costUsd >= this.thresholds.costDailyWarning) {
      await this.alert({
        severity: 'warning',
        title: 'Daily cost warning',
        message: `$${costUsd.toFixed(2)} spent today (threshold: $${this.thresholds.costDailyWarning})`,
        source: 'DfsCostTracker',
        metadata: { costUsd },
      });
    }
  }

  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  updateThresholds(updates: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
  }
}
```

**Acceptance Criteria:**
- [ ] Slack channel sends alerts
- [ ] PagerDuty channel sends critical alerts
- [ ] Alert deduplication (5 min window)
- [ ] Threshold-based alert methods
- [ ] Environment variables documented
- [ ] Unit tests for alert routing

---

## Testing Requirements

### Unit Tests

```typescript
// __tests__/reliability.test.ts

describe('Reliability & Resilience', () => {
  describe('CircuitBreaker Integration', () => {
    it('escalates to next tier when circuit opens', async () => {
      const fetcher = new TieredFetcher();
      
      // Fail enough times to open circuit
      for (let i = 0; i < 10; i++) {
        await fetcher.fetch('https://blocked-site.com', { startTier: 'direct' })
          .catch(() => {});
      }
      
      expect(fetcher.getCircuitStates().direct).toBe('open');
      
      // Next request should escalate
      const result = await fetcher.fetch('https://blocked-site.com', {});
      expect(result.tierUsed).not.toBe('direct');
    });

    it('recovers circuit after timeout', async () => {
      jest.useFakeTimers();
      const fetcher = new TieredFetcher();
      
      // Open circuit
      fetcher.circuitBreakers.get('direct')!.forceOpen();
      expect(fetcher.getCircuitStates().direct).toBe('open');
      
      // Advance past reset timeout
      jest.advanceTimersByTime(31_000);
      expect(fetcher.getCircuitStates().direct).toBe('half-open');
      
      jest.useRealTimers();
    });
  });

  describe('Health Check', () => {
    it('returns unhealthy when Redis down', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));
      
      const service = getScrapingService();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.components.redis.healthy).toBe(false);
      expect(health.components.redis.error).toContain('Connection refused');
    });

    it('returns healthy when all components up', async () => {
      const service = getScrapingService();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.components.redis.healthy).toBe(true);
      expect(health.components.postgres.healthy).toBe(true);
      expect(health.components.queue.healthy).toBe(true);
    });
  });

  describe('AlertManager', () => {
    it('sends to Slack when configured', async () => {
      const manager = new AlertManager({ slackWebhookUrl: 'https://hooks.slack.com/test' });
      await manager.alert({ severity: 'warning', title: 'Test', message: 'Test', source: 'Test' });
      
      expect(mockSlackWebhook).toHaveBeenCalled();
    });

    it('deduplicates repeated alerts', async () => {
      const manager = new AlertManager({ slackWebhookUrl: 'https://hooks.slack.com/test' });
      
      await manager.alert({ severity: 'warning', title: 'Same', message: 'Same', source: 'Test' });
      await manager.alert({ severity: 'warning', title: 'Same', message: 'Same', source: 'Test' });
      
      expect(mockSlackWebhook).toHaveBeenCalledTimes(1);
    });
  });
});
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Circuit breaker coverage | 100% of tiers |
| Health check latency | <500ms |
| Prometheus metrics count | 15+ metrics |
| Alert delivery rate | >99% |
| False positive rate | <5% |

---

## Deliverables

1. Modified `TieredFetcher.ts` with CircuitBreaker integration
2. Modified `ScrapingService.ts` with real healthCheck()
3. New `MetricsExporter.ts` with Prometheus metrics
4. Modified `health.ts` with real endpoints
5. Modified `AlertManager.ts` with configuration
6. Environment variables documentation
7. Unit tests for all components
8. Updated runbook with circuit breaker procedures
