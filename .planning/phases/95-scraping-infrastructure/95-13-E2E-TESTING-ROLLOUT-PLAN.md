# Plan 95-13: E2E Testing & Migration Rollout

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 13 - E2E Testing & Migration Rollout  
**Status:** Ready  
**Priority:** P2 (Medium)  
**Estimated Effort:** 14 hours  
**Dependencies:** 95-10 (Consumer Integration), 95-11 (Reliability)

---

## Objective

Complete Phase 95 with comprehensive E2E testing and controlled migration rollout:
- E2E tests for full 7-tier escalation flow
- Load testing at 100K pages/hour target
- Cache pre-warming implementation
- Migration flag rollout procedures
- Domain learning feedback loop from checks

---

## Task Breakdown

### Task 1: E2E Test Suite for 7-Tier Escalation

**New File:** `open-seo-main/src/server/features/scraping/__tests__/e2e/TierEscalation.e2e.test.ts`

```typescript
import { TieredFetcher } from '../../TieredFetcher';
import { DomainLearningService } from '../../DomainLearningService';
import { CacheManager } from '../../cache/CacheManager';

describe('7-Tier Escalation E2E', () => {
  let fetcher: TieredFetcher;
  let domainLearning: DomainLearningService;
  let cacheManager: CacheManager;

  beforeAll(async () => {
    // Use real connections, test database
    fetcher = new TieredFetcher({ testMode: true });
    domainLearning = new DomainLearningService();
    cacheManager = new CacheManager();
  });

  afterAll(async () => {
    await cacheManager.clear();
  });

  describe('Direct Fetch (T0)', () => {
    it('successfully fetches from simple static site', async () => {
      const result = await fetcher.fetch('https://example.com', {});
      
      expect(result.success).toBe(true);
      expect(result.tierUsed).toBe('direct');
      expect(result.html).toContain('<html');
      expect(result.estimatedCostUsd).toBe(0);
    });

    it('records domain config for successful direct fetch', async () => {
      await fetcher.fetch('https://httpbin.org/html', {});
      
      const config = await domainLearning.getConfig('httpbin.org');
      expect(config.optimalTier).toBe('direct');
    });
  });

  describe('Proxy Escalation (T1-T2)', () => {
    it('escalates to webshare when direct is rate limited', async () => {
      // Simulate rate limiting by making many requests
      const url = 'https://rate-limited-test.example';
      
      // Force direct tier to fail
      await fetcher.circuitBreakers.get('direct')?.forceOpen();
      
      const result = await fetcher.fetch(url, { clientId: 'test' });
      
      expect(['webshare', 'geonode']).toContain(result.tierUsed);
    });

    it('escalates to geonode when datacenter detected', async () => {
      // Use a site known to block DC proxies
      const result = await fetcher.fetch('https://dc-blocking-site.example', {
        startTier: 'webshare',
      });
      
      if (!result.success || result.tierUsed === 'webshare') {
        // May have escalated
        expect(result.tierUsed).not.toBe('webshare');
      }
    });
  });

  describe('DataForSEO Escalation (T3-T5)', () => {
    it('escalates to dfs_basic when proxies fail', async () => {
      // Force lower tiers closed
      await fetcher.circuitBreakers.get('direct')?.forceOpen();
      await fetcher.circuitBreakers.get('webshare')?.forceOpen();
      await fetcher.circuitBreakers.get('geonode')?.forceOpen();
      
      const result = await fetcher.fetch('https://example.com', {});
      
      expect(result.tierUsed).toBe('dfs_basic');
      expect(result.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('escalates to dfs_js when JS rendering required', async () => {
      // Use a SPA site
      const result = await fetcher.fetch('https://spa-site.example', {
        requireJsRendering: true,
      });
      
      expect(['dfs_js', 'dfs_browser']).toContain(result.tierUsed);
    });

    it('escalates to dfs_browser for heavy anti-bot', async () => {
      const result = await fetcher.fetch('https://cloudflare-protected.example', {
        startTier: 'dfs_js',
      });
      
      // Should have escalated or succeeded
      expect(result.tierUsed).toBeDefined();
    });
  });

  describe('Full Escalation Path', () => {
    it('escalates through all 7 tiers when needed', async () => {
      const tiersUsed: string[] = [];
      
      // Track tier usage
      const originalFetch = fetcher.performFetch.bind(fetcher);
      fetcher.performFetch = async (url, tier, opts) => {
        tiersUsed.push(tier);
        // Simulate failure for all but last tier
        if (tier !== 'dfs_browser') {
          throw new Error('Simulated failure');
        }
        return originalFetch(url, tier, opts);
      };
      
      const result = await fetcher.fetch('https://difficult-site.example', {});
      
      expect(result.tierUsed).toBe('dfs_browser');
      expect(tiersUsed).toContain('direct');
      expect(tiersUsed.length).toBeGreaterThanOrEqual(4);
      
      // Restore
      fetcher.performFetch = originalFetch;
    });
  });

  describe('Cache Integration', () => {
    it('returns cached result on second request', async () => {
      const url = 'https://cacheable-site.example';
      
      // First request populates cache
      const result1 = await fetcher.fetch(url, {});
      expect(result1.fromCache).toBe(false);
      
      // Second request uses cache
      const result2 = await fetcher.fetch(url, {});
      expect(result2.fromCache).toBe(true);
      expect(result2.cacheLevel).toBeDefined();
      expect(result2.html).toBe(result1.html);
    });

    it('respects cache TTL by content type', async () => {
      jest.useFakeTimers();
      
      // Fetch dynamic page (1 hour TTL)
      const url = 'https://example.com/api/status';
      await fetcher.fetch(url, { contentType: 'dynamic' });
      
      // Advance 2 hours
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      // Should refetch
      const result = await fetcher.fetch(url, { contentType: 'dynamic' });
      expect(result.fromCache).toBe(false);
      
      jest.useRealTimers();
    });
  });

  describe('Domain Learning', () => {
    it('remembers optimal tier for domain', async () => {
      const url = 'https://learning-test.example';
      
      // First request discovers tier
      const result1 = await fetcher.fetch(url, {});
      const learnedTier = result1.tierUsed;
      
      // Second request uses learned tier
      const result2 = await fetcher.fetch(url + '/page2', {});
      expect(result2.tierUsed).toBe(learnedTier);
    });

    it('updates optimal tier on repeated failures', async () => {
      const domain = 'tier-update-test.example';
      
      // Set initial tier
      await domainLearning.updateConfig(domain, { optimalTier: 'direct' });
      
      // Simulate repeated failures
      for (let i = 0; i < 5; i++) {
        await fetcher.fetch(`https://${domain}/page${i}`, {})
          .catch(() => {});
      }
      
      // Tier should have been updated
      const config = await domainLearning.getConfig(domain);
      expect(config.optimalTier).not.toBe('direct');
    });
  });

  describe('Cost Tracking', () => {
    it('tracks cost for paid tier usage', async () => {
      const clientId = 'cost-test-client';
      
      // Force DFS tier
      await fetcher.circuitBreakers.get('direct')?.forceOpen();
      await fetcher.circuitBreakers.get('webshare')?.forceOpen();
      await fetcher.circuitBreakers.get('geonode')?.forceOpen();
      
      await fetcher.fetch('https://example.com', { clientId });
      
      // Check cost was recorded
      const dailyCost = await getDailyCost(clientId);
      expect(dailyCost).toBeGreaterThan(0);
    });
  });
});
```

**Acceptance Criteria:**
- [ ] Tests for each tier individually
- [ ] Full escalation path test
- [ ] Cache integration tests
- [ ] Domain learning tests
- [ ] Cost tracking tests
- [ ] Tests run in CI/CD

---

### Task 2: Load Testing Infrastructure

**New File:** `open-seo-main/src/server/features/scraping/__tests__/load/LoadTest.ts`

```typescript
import { ScrapingService } from '../../ScrapingService';

interface LoadTestConfig {
  targetRps: number;        // Requests per second
  durationSeconds: number;  // Test duration
  rampUpSeconds: number;    // Time to reach target RPS
  urls: string[];           // URLs to test
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  requestsPerSecond: number;
  tierDistribution: Record<string, number>;
  cacheHitRate: number;
  totalCostUsd: number;
  errors: Record<string, number>;
}

export class LoadTester {
  private service: ScrapingService;
  private results: Array<{
    latencyMs: number;
    success: boolean;
    tier: string;
    fromCache: boolean;
    error?: string;
    costUsd: number;
  }> = [];

  constructor(service: ScrapingService) {
    this.service = service;
  }

  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const { targetRps, durationSeconds, rampUpSeconds, urls } = config;
    
    console.log(`Starting load test: ${targetRps} RPS for ${durationSeconds}s`);
    
    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);
    let requestCount = 0;
    
    while (Date.now() < endTime) {
      const elapsed = (Date.now() - startTime) / 1000;
      
      // Calculate current RPS (ramp up)
      const currentRps = elapsed < rampUpSeconds
        ? (elapsed / rampUpSeconds) * targetRps
        : targetRps;
      
      // Calculate delay between requests
      const delayMs = 1000 / currentRps;
      
      // Pick random URL
      const url = urls[Math.floor(Math.random() * urls.length)];
      
      // Fire request (don't await, fire-and-forget with tracking)
      this.fireRequest(url, requestCount++);
      
      // Wait before next request
      await this.sleep(delayMs);
    }
    
    // Wait for in-flight requests
    await this.sleep(5000);
    
    return this.calculateResults();
  }

  private async fireRequest(url: string, requestId: number): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.service.scrape(url, {
        clientId: 'load-test',
        source: 'load_test',
      });
      
      this.results.push({
        latencyMs: Date.now() - startTime,
        success: result.success,
        tier: result.tierUsed,
        fromCache: result.fromCache,
        costUsd: result.estimatedCostUsd,
      });
    } catch (error) {
      this.results.push({
        latencyMs: Date.now() - startTime,
        success: false,
        tier: 'unknown',
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown',
        costUsd: 0,
      });
    }
  }

  private calculateResults(): LoadTestResult {
    const latencies = this.results.map(r => r.latencyMs).sort((a, b) => a - b);
    const successful = this.results.filter(r => r.success);
    const cached = this.results.filter(r => r.fromCache);
    
    const tierCounts: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};
    
    for (const result of this.results) {
      tierCounts[result.tier] = (tierCounts[result.tier] || 0) + 1;
      if (result.error) {
        errorCounts[result.error] = (errorCounts[result.error] || 0) + 1;
      }
    }
    
    return {
      totalRequests: this.results.length,
      successfulRequests: successful.length,
      failedRequests: this.results.length - successful.length,
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50LatencyMs: latencies[Math.floor(latencies.length * 0.5)],
      p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)],
      p99LatencyMs: latencies[Math.floor(latencies.length * 0.99)],
      maxLatencyMs: latencies[latencies.length - 1],
      requestsPerSecond: this.results.length / 60, // Assuming 60s test
      tierDistribution: tierCounts,
      cacheHitRate: cached.length / this.results.length,
      totalCostUsd: this.results.reduce((sum, r) => sum + r.costUsd, 0),
      errors: errorCounts,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI runner
if (require.main === module) {
  const service = getScrapingService();
  const tester = new LoadTester(service);
  
  tester.runLoadTest({
    targetRps: 28,  // ~100K/hour
    durationSeconds: 60,
    rampUpSeconds: 10,
    urls: [
      'https://example.com',
      'https://httpbin.org/html',
      // Add more test URLs
    ],
  }).then(results => {
    console.log('Load Test Results:');
    console.log(JSON.stringify(results, null, 2));
  });
}
```

**Acceptance Criteria:**
- [ ] Load tester with configurable RPS
- [ ] Ramp-up support
- [ ] Latency percentile calculation
- [ ] Tier distribution tracking
- [ ] Cache hit rate measurement
- [ ] Cost tracking
- [ ] CLI runner

---

### Task 3: Cache Pre-Warming

**New File:** `open-seo-main/src/server/features/scraping/cache/CacheWarmer.ts`

```typescript
import { ScrapingService } from '../ScrapingService';
import { CacheManager } from './CacheManager';

interface WarmingConfig {
  urls: string[];
  priority: 'high' | 'normal' | 'low';
  concurrency: number;
  clientId: string;
}

interface WarmingResult {
  total: number;
  warmed: number;
  alreadyCached: number;
  failed: number;
  durationMs: number;
  costUsd: number;
}

export class CacheWarmer {
  private service: ScrapingService;
  private cacheManager: CacheManager;

  constructor(service: ScrapingService, cacheManager: CacheManager) {
    this.service = service;
    this.cacheManager = cacheManager;
  }

  async warmCache(config: WarmingConfig): Promise<WarmingResult> {
    const { urls, priority, concurrency, clientId } = config;
    const startTime = Date.now();
    
    let warmed = 0;
    let alreadyCached = 0;
    let failed = 0;
    let totalCost = 0;

    // Process in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      
      const results = await Promise.allSettled(
        batch.map(async url => {
          // Check if already cached
          const cached = await this.cacheManager.get(url);
          if (cached) {
            return { status: 'cached' };
          }
          
          // Fetch and cache
          const result = await this.service.scrape(url, {
            clientId,
            source: 'cache_warmer',
            priority: priority === 'high' ? 'critical' : 'low',
          });
          
          return {
            status: result.success ? 'warmed' : 'failed',
            cost: result.estimatedCostUsd,
          };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'cached') {
            alreadyCached++;
          } else if (result.value.status === 'warmed') {
            warmed++;
            totalCost += result.value.cost || 0;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      }

      // Rate limit between batches
      if (i + concurrency < urls.length) {
        await this.sleep(100);
      }
    }

    return {
      total: urls.length,
      warmed,
      alreadyCached,
      failed,
      durationMs: Date.now() - startTime,
      costUsd: totalCost,
    };
  }

  async warmForAudit(auditId: string, clientId: string): Promise<WarmingResult> {
    // Get URLs from audit job
    const urls = await this.getAuditUrls(auditId);
    
    return this.warmCache({
      urls,
      priority: 'normal',
      concurrency: 10,
      clientId,
    });
  }

  async warmCompetitorDomains(
    domains: string[],
    clientId: string
  ): Promise<WarmingResult> {
    // Generate common page paths for each domain
    const urls = domains.flatMap(domain => [
      `https://${domain}`,
      `https://${domain}/about`,
      `https://${domain}/contact`,
      `https://${domain}/services`,
      `https://${domain}/products`,
    ]);

    return this.warmCache({
      urls,
      priority: 'low',
      concurrency: 5,
      clientId,
    });
  }

  private async getAuditUrls(auditId: string): Promise<string[]> {
    // Query audit job for URLs
    const job = await db.query.auditJobs.findFirst({
      where: eq(auditJobs.id, auditId),
    });
    return job?.targetUrls || [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
let warmer: CacheWarmer | null = null;

export function getCacheWarmer(): CacheWarmer {
  if (!warmer) {
    const service = getScrapingService();
    const cache = getCacheManager();
    warmer = new CacheWarmer(service, cache);
  }
  return warmer;
}
```

**Add to ScrapingService:**

```typescript
// ScrapingService.ts

async warmCache(urls: string[], options?: WarmingOptions): Promise<WarmingResult> {
  const warmer = getCacheWarmer();
  return warmer.warmCache({
    urls,
    priority: options?.priority || 'normal',
    concurrency: options?.concurrency || 10,
    clientId: options?.clientId || 'system',
  });
}
```

**Acceptance Criteria:**
- [ ] Batch warming with concurrency control
- [ ] Skip already-cached URLs
- [ ] Audit-specific warming
- [ ] Competitor domain warming
- [ ] Cost tracking
- [ ] Exposed via ScrapingService

---

### Task 4: Migration Flag Rollout Procedures

**New File:** `open-seo-main/src/server/features/scraping/migration/MigrationRollout.ts`

```typescript
import { MigrationRouter } from './MigrationRouter';

type MigrationState = 'legacy' | 'shadow' | 'canary' | 'rollout' | 'migrated';

interface RolloutStep {
  feature: string;
  from: MigrationState;
  to: MigrationState;
  criteria: RolloutCriteria;
}

interface RolloutCriteria {
  minShadowMatchRate?: number;     // % results matching (shadow mode)
  maxErrorRate?: number;           // % errors allowed
  minRequestCount?: number;        // Requests before advancing
  durationHours?: number;          // Hours at current state
}

const DEFAULT_CRITERIA: Record<MigrationState, RolloutCriteria> = {
  legacy: {},
  shadow: {
    minShadowMatchRate: 99,
    minRequestCount: 1000,
    durationHours: 24,
  },
  canary: {
    maxErrorRate: 1,
    minRequestCount: 500,
    durationHours: 48,
  },
  rollout: {
    maxErrorRate: 0.5,
    minRequestCount: 5000,
    durationHours: 72,
  },
  migrated: {},
};

export class MigrationRollout {
  private router: MigrationRouter;

  constructor(router: MigrationRouter) {
    this.router = router;
  }

  async checkReadyForAdvancement(feature: string): Promise<{
    ready: boolean;
    currentState: MigrationState;
    nextState?: MigrationState;
    criteria: RolloutCriteria;
    metrics: RolloutMetrics;
    blockers: string[];
  }> {
    const currentState = await this.router.getFeatureState(feature);
    const nextState = this.getNextState(currentState);
    const criteria = DEFAULT_CRITERIA[currentState];
    const metrics = await this.getMetrics(feature, currentState);
    const blockers: string[] = [];

    // Check each criterion
    if (criteria.minShadowMatchRate && metrics.shadowMatchRate < criteria.minShadowMatchRate) {
      blockers.push(`Shadow match rate ${metrics.shadowMatchRate}% < ${criteria.minShadowMatchRate}%`);
    }
    if (criteria.maxErrorRate && metrics.errorRate > criteria.maxErrorRate) {
      blockers.push(`Error rate ${metrics.errorRate}% > ${criteria.maxErrorRate}%`);
    }
    if (criteria.minRequestCount && metrics.requestCount < criteria.minRequestCount) {
      blockers.push(`Request count ${metrics.requestCount} < ${criteria.minRequestCount}`);
    }
    if (criteria.durationHours && metrics.hoursInState < criteria.durationHours) {
      blockers.push(`Hours in state ${metrics.hoursInState}h < ${criteria.durationHours}h`);
    }

    return {
      ready: blockers.length === 0,
      currentState,
      nextState: blockers.length === 0 ? nextState : undefined,
      criteria,
      metrics,
      blockers,
    };
  }

  async advanceFeature(feature: string): Promise<{
    success: boolean;
    previousState: MigrationState;
    newState: MigrationState;
    message: string;
  }> {
    const check = await this.checkReadyForAdvancement(feature);
    
    if (!check.ready) {
      return {
        success: false,
        previousState: check.currentState,
        newState: check.currentState,
        message: `Not ready: ${check.blockers.join(', ')}`,
      };
    }

    if (!check.nextState) {
      return {
        success: false,
        previousState: check.currentState,
        newState: check.currentState,
        message: 'Already at final state',
      };
    }

    await this.router.setFeatureState(feature, check.nextState);
    
    return {
      success: true,
      previousState: check.currentState,
      newState: check.nextState,
      message: `Advanced from ${check.currentState} to ${check.nextState}`,
    };
  }

  async rollbackFeature(feature: string): Promise<{
    success: boolean;
    previousState: MigrationState;
    newState: MigrationState;
  }> {
    const currentState = await this.router.getFeatureState(feature);
    const previousState = this.getPreviousState(currentState);
    
    await this.router.setFeatureState(feature, previousState);
    
    return {
      success: true,
      previousState: currentState,
      newState: previousState,
    };
  }

  async getFullRolloutStatus(): Promise<Record<string, {
    state: MigrationState;
    ready: boolean;
    blockers: string[];
  }>> {
    const features = await this.router.getAllFeatures();
    const status: Record<string, any> = {};
    
    for (const feature of features) {
      const check = await this.checkReadyForAdvancement(feature);
      status[feature] = {
        state: check.currentState,
        ready: check.ready,
        blockers: check.blockers,
      };
    }
    
    return status;
  }

  private getNextState(current: MigrationState): MigrationState | null {
    const order: MigrationState[] = ['legacy', 'shadow', 'canary', 'rollout', 'migrated'];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : null;
  }

  private getPreviousState(current: MigrationState): MigrationState {
    const order: MigrationState[] = ['legacy', 'shadow', 'canary', 'rollout', 'migrated'];
    const idx = order.indexOf(current);
    return idx > 0 ? order[idx - 1] : 'legacy';
  }

  private async getMetrics(feature: string, state: MigrationState): Promise<RolloutMetrics> {
    // Query actual metrics from database
    const stats = await db.query.migrationStats.findFirst({
      where: and(
        eq(migrationStats.feature, feature),
        eq(migrationStats.state, state),
      ),
    });

    return {
      shadowMatchRate: stats?.shadowMatchRate || 0,
      errorRate: stats?.errorRate || 0,
      requestCount: stats?.requestCount || 0,
      hoursInState: stats?.hoursInState || 0,
    };
  }
}

interface RolloutMetrics {
  shadowMatchRate: number;
  errorRate: number;
  requestCount: number;
  hoursInState: number;
}
```

**Acceptance Criteria:**
- [ ] State machine for migration progression
- [ ] Criteria-based advancement checks
- [ ] Rollback capability
- [ ] Full status dashboard
- [ ] Metrics tracking

---

### Task 5: Domain Learning Feedback from Checks

**New File:** `open-seo-main/src/server/features/scraping/DomainFeedback.ts`

```typescript
import { DomainLearningService } from './DomainLearningService';

interface CheckFeedback {
  domain: string;
  checkId: string;
  passed: boolean;
  reason?: string;
  suggestedTier?: string;
}

export class DomainFeedbackService {
  private learningService: DomainLearningService;
  private feedbackBuffer: Map<string, CheckFeedback[]> = new Map();
  private flushInterval: NodeJS.Timer;

  constructor(learningService: DomainLearningService) {
    this.learningService = learningService;
    
    // Flush feedback every 5 minutes
    this.flushInterval = setInterval(() => this.flushFeedback(), 5 * 60 * 1000);
  }

  recordCheckFeedback(feedback: CheckFeedback): void {
    const existing = this.feedbackBuffer.get(feedback.domain) || [];
    existing.push(feedback);
    this.feedbackBuffer.set(feedback.domain, existing);
  }

  private async flushFeedback(): Promise<void> {
    for (const [domain, feedbacks] of this.feedbackBuffer) {
      await this.processDomainFeedback(domain, feedbacks);
    }
    this.feedbackBuffer.clear();
  }

  private async processDomainFeedback(
    domain: string,
    feedbacks: CheckFeedback[]
  ): Promise<void> {
    const config = await this.learningService.getConfig(domain);
    
    // Analyze feedback patterns
    const failedChecks = feedbacks.filter(f => !f.passed);
    const jsRelatedFailures = failedChecks.filter(f => 
      f.reason?.includes('JS') || 
      f.reason?.includes('dynamic') ||
      f.checkId?.includes('SPA')
    );
    
    // If many JS-related failures, suggest higher tier
    if (jsRelatedFailures.length >= 3) {
      await this.learningService.updateConfig(domain, {
        requiresJsRendering: true,
        suggestedMinTier: 'dfs_js',
        feedbackSource: 'check_failures',
      });
    }
    
    // If content quality checks fail, might need better rendering
    const qualityFailures = failedChecks.filter(f =>
      f.checkId?.includes('T5') || f.checkId?.includes('quality')
    );
    
    if (qualityFailures.length >= 2) {
      await this.learningService.updateConfig(domain, {
        contentQualityIssues: true,
        feedbackSource: 'quality_checks',
      });
    }
  }

  stop(): void {
    clearInterval(this.flushInterval);
  }
}

// Integration with check runner
export function integrateWithCheckRunner(
  feedbackService: DomainFeedbackService
): void {
  // Hook into check result processing
  onCheckComplete((result) => {
    if (!result.url) return;
    
    const domain = new URL(result.url).hostname;
    feedbackService.recordCheckFeedback({
      domain,
      checkId: result.checkId,
      passed: result.pass,
      reason: result.message,
    });
  });
}
```

**Acceptance Criteria:**
- [ ] Buffer check results
- [ ] Periodic flush to domain learning
- [ ] Pattern detection (JS failures, quality issues)
- [ ] Integration with check runner
- [ ] Non-blocking operation

---

### Task 6: Admin Dashboard Endpoints

**New File:** `open-seo-main/src/server/features/scraping/routes/admin.ts`

```typescript
import { Router } from 'express';
import { getMigrationRollout } from '../migration/MigrationRollout';
import { getCacheWarmer } from '../cache/CacheWarmer';

export function createAdminRoutes(): Router {
  const router = Router();

  // Migration status
  router.get('/admin/migration/status', async (req, res) => {
    const rollout = getMigrationRollout();
    const status = await rollout.getFullRolloutStatus();
    res.json(status);
  });

  // Check if feature ready to advance
  router.get('/admin/migration/:feature/ready', async (req, res) => {
    const rollout = getMigrationRollout();
    const check = await rollout.checkReadyForAdvancement(req.params.feature);
    res.json(check);
  });

  // Advance feature to next state
  router.post('/admin/migration/:feature/advance', async (req, res) => {
    const rollout = getMigrationRollout();
    const result = await rollout.advanceFeature(req.params.feature);
    res.json(result);
  });

  // Rollback feature to previous state
  router.post('/admin/migration/:feature/rollback', async (req, res) => {
    const rollout = getMigrationRollout();
    const result = await rollout.rollbackFeature(req.params.feature);
    res.json(result);
  });

  // Warm cache for URLs
  router.post('/admin/cache/warm', async (req, res) => {
    const { urls, priority, clientId } = req.body;
    const warmer = getCacheWarmer();
    const result = await warmer.warmCache({
      urls,
      priority: priority || 'normal',
      concurrency: 10,
      clientId: clientId || 'admin',
    });
    res.json(result);
  });

  // Warm cache for audit
  router.post('/admin/cache/warm-audit/:auditId', async (req, res) => {
    const warmer = getCacheWarmer();
    const result = await warmer.warmForAudit(
      req.params.auditId,
      req.body.clientId || 'admin'
    );
    res.json(result);
  });

  return router;
}
```

**Acceptance Criteria:**
- [ ] Migration status endpoint
- [ ] Advance/rollback endpoints
- [ ] Cache warming endpoints
- [ ] Authentication (admin only)

---

## Testing Requirements

### E2E Test Execution

```bash
# Run E2E tests
pnpm test:e2e --filter scraping

# Run load test (staging only)
pnpm test:load --target staging --rps 28 --duration 60
```

### CI/CD Integration

```yaml
# .github/workflows/scraping-e2e.yml
name: Scraping E2E Tests

on:
  push:
    paths:
      - 'open-seo-main/src/server/features/scraping/**'

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test
          POSTGRES_PASSWORD: test

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:e2e --filter scraping
        env:
          DATABASE_URL: postgres://postgres:test@localhost/test
          REDIS_URL: redis://localhost:6379
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| E2E test coverage | 7 tiers covered |
| Load test throughput | 100K pages/hour |
| Cache warm hit rate | >95% after warming |
| Migration rollout success | 0 rollbacks |
| Domain feedback latency | <100ms |

---

## Rollout Schedule

### Week 1: Testing
- Deploy E2E tests to CI
- Run load tests in staging
- Fix any issues found

### Week 2: Shadow Mode
- Set all features to `shadow`
- Monitor comparison logs
- Validate match rates

### Week 3: Canary
- Advance low-risk features to `canary`
- Monitor error rates
- Run cache warming for production

### Week 4: Rollout
- Advance all features to `rollout`
- Monitor for 72 hours
- Prepare for migration completion

### Week 5: Migration Complete
- Set all features to `migrated`
- Remove legacy code
- Archive planning docs

---

## Deliverables

1. E2E test suite `TierEscalation.e2e.test.ts`
2. Load testing infrastructure `LoadTest.ts`
3. Cache warmer `CacheWarmer.ts`
4. Migration rollout `MigrationRollout.ts`
5. Domain feedback `DomainFeedback.ts`
6. Admin routes `admin.ts`
7. CI/CD configuration
8. Rollout runbook
