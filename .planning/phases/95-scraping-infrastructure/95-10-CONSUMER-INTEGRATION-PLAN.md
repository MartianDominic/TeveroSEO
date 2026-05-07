# Plan 95-10: Consumer Integration Completion

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 10 - Consumer Integration Completion  
**Status:** Ready  
**Priority:** P0 (Critical)  
**Estimated Effort:** 16 hours  
**Dependencies:** 95-05 (ScrapingService), 95-06 (Migration Router)

---

## Objective

Complete the integration of all platform consumers with the unified ScrapingService, ensuring:
- All HTML/content fetching routes through ScrapingService
- Unified cost tracking via DfsCostTracker
- Domain learning benefits all consumers
- Migration flags enable gradual rollout

---

## Current State Analysis

### Consumer Integration Status (from Review)

| Consumer | Current Method | Bypasses ScrapingService | Cost Tracked |
|----------|---------------|-------------------------|--------------|
| SerpContentAnalyzer | Direct `OptimizedDataForSEOFetcher.fetchBatch()` | YES | NO |
| CompetitorSpyService | Direct `fetchOrganicKeywords()` + own Redis cache | YES | NO |
| Volume Refresh Worker | Direct DataForSEO via sandboxed processor | YES | NO |
| Crawl Workflow | Legacy `HybridCrawler` | YES | NO |
| TaskRouter (CRAWL) | Own Crawler interface | YES | NO |
| On-Page Checks | Receives pre-fetched HTML | N/A | N/A |

### Files to Modify

```
open-seo-main/src/server/features/
├── briefs/services/SerpContentAnalyzer.ts          # Task 1
├── keywords/services/CompetitorSpyService.ts       # Task 2
├── keywords/services/TaskRouter.ts                 # Task 3
├── scraping/migration/MigrationRouter.ts           # Task 4 (add flags)
└── /workers/volume-refresh-worker.ts               # Task 5

open-seo-main/src/server/workflows/
├── siteAuditWorkflowCrawl.ts                       # Task 6
└── site-audit-workflow-helpers.ts                  # Task 6
```

---

## Task Breakdown

### Task 1: Wire SerpContentAnalyzer Through MigrationRouter

**File:** `open-seo-main/src/server/features/briefs/services/SerpContentAnalyzer.ts`

**Current Implementation (lines 60-65):**
```typescript
const fetcher = getOptimizedDataForSEOFetcher();
const results = await fetcher.fetchBatch(urls, {
  mode: 'basic',
  urgency: 'bulk',
});
```

**Target Implementation:**
```typescript
import { getMigrationRouter } from '@/server/features/scraping/migration/MigrationRouter';

// In analyzeSerpContent method:
const router = getMigrationRouter();
const results = await router.routeRequest({
  feature: 'serpContent',
  operation: 'fetchBatch',
  urls,
  options: {
    mode: 'basic',
    urgency: 'bulk',
    clientId: options.clientId,
    source: 'content_briefs',
  },
  legacyFn: async () => {
    const fetcher = getOptimizedDataForSEOFetcher();
    return fetcher.fetchBatch(urls, { mode: 'basic', urgency: 'bulk' });
  },
  newFn: async () => {
    const scrapingService = getScrapingService();
    return scrapingService.scrapeBatch(urls, {
      feature: 'serpContent',
      mode: 'basic',
      urgency: 'bulk',
      clientId: options.clientId,
    });
  },
});
```

**Acceptance Criteria:**
- [ ] MigrationRouter import added
- [ ] `routeRequest` call replaces direct fetcher call
- [ ] Legacy function preserved for rollback
- [ ] New function uses ScrapingService.scrapeBatch()
- [ ] Cost tracking via DfsCostTracker automatic
- [ ] Unit test for both paths

---

### Task 2: Wire CompetitorSpyService Page Fetching

**File:** `open-seo-main/src/server/features/keywords/services/CompetitorSpyService.ts`

**Current Implementation (lines 89-96):**
```typescript
// Direct DataForSEO call with own Redis cache
const cached = await this.redis.get(`competitor:${domain}:keywords`);
if (cached) return JSON.parse(cached);

const result = await this.dfsClient.fetchOrganicKeywords(domain, options);
await this.redis.set(`competitor:${domain}:keywords`, JSON.stringify(result), 'EX', 86400);
```

**Strategy:**
- Keep Labs API direct (keyword data, not HTML)
- Route any **page content fetching** through ScrapingService
- Integrate cache via CacheManager instead of direct Redis

**Target Implementation:**
```typescript
import { getMigrationRouter } from '@/server/features/scraping/migration/MigrationRouter';
import { getScrapingService } from '@/server/features/scraping';

class CompetitorSpyService {
  // For keyword data (Labs API) - keep direct, add cost tracking only
  async fetchOrganicKeywords(domain: string, options: KeywordOptions) {
    const cached = await this.redis.get(`competitor:${domain}:keywords`);
    if (cached) return JSON.parse(cached);

    const result = await this.dfsClient.fetchOrganicKeywords(domain, options);
    
    // NEW: Track cost even for direct Labs API calls
    await this.costTracker.recordCost({
      url: `labs://organic-keywords/${domain}`,
      domain,
      mode: 'labs',
      queueType: 'live',
      estimatedCostUsd: 0.001, // Labs API cost
      source: 'competitor_spy',
      clientId: options.clientId,
    });

    await this.redis.set(`competitor:${domain}:keywords`, JSON.stringify(result), 'EX', 86400);
    return result;
  }

  // For page content (HTML) - route through ScrapingService
  async fetchCompetitorPage(url: string, options: FetchOptions) {
    const router = getMigrationRouter();
    return router.routeRequest({
      feature: 'competitorSpy',
      operation: 'fetchPage',
      urls: [url],
      options,
      legacyFn: async () => this.legacyFetchPage(url),
      newFn: async () => {
        const service = getScrapingService();
        return service.scrape(url, {
          feature: 'competitorSpy',
          clientId: options.clientId,
        });
      },
    });
  }
}
```

**Acceptance Criteria:**
- [ ] Labs API calls remain direct (cost-efficient)
- [ ] DfsCostTracker records Labs API costs
- [ ] Page content fetching routes through MigrationRouter
- [ ] Own Redis cache migrated to CacheManager pattern
- [ ] Unit tests for both keyword and page fetching paths

---

### Task 3: Wire TaskRouter CRAWL Source

**File:** `open-seo-main/src/server/features/keywords/services/TaskRouter.ts`

**Current Implementation:**
```typescript
switch (task.dataSource) {
  case DataSource.CRAWL:
    return this.crawler.crawl(task.urls, task.options);
  // ...
}
```

**Target Implementation:**
```typescript
import { getMigrationRouter } from '@/server/features/scraping/migration/MigrationRouter';

switch (task.dataSource) {
  case DataSource.CRAWL:
    const router = getMigrationRouter();
    return router.routeRequest({
      feature: 'clientAudit',
      operation: 'crawlBatch',
      urls: task.urls,
      options: task.options,
      legacyFn: async () => this.crawler.crawl(task.urls, task.options),
      newFn: async () => {
        const service = getScrapingService();
        return service.scrapeBatch(task.urls, {
          feature: 'clientAudit',
          clientId: task.clientId,
          source: 'task_router',
        });
      },
    });
}
```

**Acceptance Criteria:**
- [ ] CRAWL source routes through MigrationRouter
- [ ] Legacy crawler preserved for rollback
- [ ] Client audits benefit from domain learning
- [ ] Cost tracking integrated

---

### Task 4: Add Migration Flags for New Consumers

**File:** `open-seo-main/src/server/features/scraping/migration/MigrationRouter.ts`

**Add new feature flags:**
```typescript
export const MIGRATION_FLAGS = {
  // Existing
  prospectAnalysis: 'legacy',
  contentBriefs: 'legacy',
  siteAudits: 'legacy',
  
  // NEW: Add these flags
  serpContent: 'legacy',      // SerpContentAnalyzer
  competitorSpy: 'legacy',    // CompetitorSpyService
  clientAudit: 'legacy',      // TaskRouter CRAWL
  volumeRefresh: 'legacy',    // Volume Refresh Worker
  crawlWorkflow: 'legacy',    // Site Audit Crawl Workflow
} as const;

export type MigrationFlag = keyof typeof MIGRATION_FLAGS;
export type MigrationState = 'legacy' | 'shadow' | 'canary' | 'rollout' | 'migrated';
```

**Database Schema Update:**
```typescript
// In migration-flags-schema.ts
export const migrationFlags = pgTable('scraping_migration_flags', {
  feature: varchar('feature', { length: 50 }).primaryKey(),
  state: varchar('state', { length: 20 }).notNull().default('legacy'),
  canaryPercentage: integer('canary_percentage').default(10),
  shadowCompareEnabled: boolean('shadow_compare_enabled').default(true),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by', { length: 100 }),
});
```

**Acceptance Criteria:**
- [ ] All new consumer flags defined
- [ ] Database schema supports flag persistence
- [ ] Admin endpoint to update flags
- [ ] Flag changes logged for audit

---

### Task 5: Integrate Volume Refresh with DfsCostTracker

**File:** `open-seo-main/src/server/workers/volume-refresh-worker.ts`

**Current Implementation:**
- Uses BullMQ with sandboxed processor
- Own rate limiting (5 req/min)
- No cost tracking integration

**Target Implementation:**
```typescript
// In volume-refresh-processor.js (sandboxed)
import { DfsCostTracker } from '@/server/features/scraping/providers/DfsCostTracker';

async function processVolumeRefresh(job) {
  const { keywords, clientId, workspaceId } = job.data;
  const costTracker = new DfsCostTracker();
  
  for (const keyword of keywords) {
    const result = await dataForSEO.getSearchVolume(keyword);
    
    // Track cost
    await costTracker.recordCost({
      url: `labs://search-volume/${encodeURIComponent(keyword)}`,
      domain: 'dataforseo-labs',
      mode: 'labs',
      queueType: 'standard', // Volume refresh uses standard queue
      estimatedCostUsd: 0.0001, // Labs keyword volume cost
      actualCostUsd: result.cost,
      source: 'volume_refresh',
      clientId,
      workspaceId,
      jobId: job.id,
    });
  }
}
```

**Acceptance Criteria:**
- [ ] DfsCostTracker imported in processor
- [ ] Every DataForSEO call tracked
- [ ] Cost aggregated in daily_scraping_costs table
- [ ] Job ID linked for debugging

---

### Task 6: Migrate Crawl Workflow to ScrapingService

**Files:**
- `open-seo-main/src/server/workflows/siteAuditWorkflowCrawl.ts`
- `open-seo-main/src/server/workflows/site-audit-workflow-helpers.ts`

**Current Implementation:**
```typescript
// In siteAuditWorkflowCrawl.ts
import { HybridCrawler } from '@/server/lib/crawler/HybridCrawler';

async function crawlPages(urls: string[], options: CrawlOptions) {
  const crawler = new HybridCrawler();
  return crawler.crawlBatch(urls, {
    concurrency: 25,
    timeout: 30000,
  });
}
```

**Target Implementation:**
```typescript
import { getMigrationRouter } from '@/server/features/scraping/migration/MigrationRouter';
import { getScrapingService } from '@/server/features/scraping';

async function crawlPages(urls: string[], options: CrawlOptions) {
  const router = getMigrationRouter();
  
  return router.routeRequest({
    feature: 'crawlWorkflow',
    operation: 'crawlBatch',
    urls,
    options,
    legacyFn: async () => {
      const crawler = new HybridCrawler();
      return crawler.crawlBatch(urls, {
        concurrency: 25,
        timeout: 30000,
      });
    },
    newFn: async () => {
      const service = getScrapingService();
      return service.scrapeBatch(urls, {
        feature: 'crawlWorkflow',
        clientId: options.clientId,
        jobId: options.jobId,
        concurrency: 25,
        timeout: 30000,
      });
    },
  });
}
```

**Benefits:**
- Domain learning for client sites
- 7-tier escalation for blocked pages
- Unified cost tracking
- 4-level cache utilization

**Acceptance Criteria:**
- [ ] HybridCrawler wrapped in MigrationRouter
- [ ] ScrapingService.scrapeBatch used for new path
- [ ] Audit results unchanged (shadow comparison)
- [ ] Domain learning records created for client domains
- [ ] Integration test with real audit

---

## Rollout Strategy

### Phase 1: Shadow Mode (Week 1)
```typescript
// Set all new flags to shadow
serpContent: 'shadow',
competitorSpy: 'shadow',
clientAudit: 'shadow',
volumeRefresh: 'shadow',
crawlWorkflow: 'shadow',
```
- Run both implementations
- Compare results
- Log discrepancies
- No user impact

### Phase 2: Canary Mode (Week 2)
```typescript
// 10% new implementation
serpContent: 'canary',
competitorSpy: 'canary',
// Keep high-volume at shadow
crawlWorkflow: 'shadow',
```
- Monitor error rates
- Compare latency
- Verify cost tracking

### Phase 3: Rollout Mode (Week 3)
```typescript
// 100% new with legacy fallback
serpContent: 'rollout',
competitorSpy: 'rollout',
clientAudit: 'rollout',
volumeRefresh: 'rollout',
crawlWorkflow: 'rollout',
```
- Full traffic through ScrapingService
- Legacy available for fallback
- Monitor for 1 week

### Phase 4: Migrated (Week 4)
```typescript
// Remove legacy code paths
serpContent: 'migrated',
competitorSpy: 'migrated',
clientAudit: 'migrated',
volumeRefresh: 'migrated',
crawlWorkflow: 'migrated',
```
- Delete legacy functions
- Clean up imports
- Archive old code

---

## Testing Requirements

### Unit Tests

```typescript
// __tests__/consumer-integration.test.ts

describe('Consumer Integration', () => {
  describe('SerpContentAnalyzer', () => {
    it('routes through MigrationRouter when flag is not legacy', async () => {
      setMigrationFlag('serpContent', 'rollout');
      const analyzer = new SerpContentAnalyzer();
      await analyzer.analyzeSerpContent(['https://example.com'], {});
      
      expect(mockScrapingService.scrapeBatch).toHaveBeenCalled();
      expect(mockLegacyFetcher.fetchBatch).not.toHaveBeenCalled();
    });

    it('uses legacy path when flag is legacy', async () => {
      setMigrationFlag('serpContent', 'legacy');
      const analyzer = new SerpContentAnalyzer();
      await analyzer.analyzeSerpContent(['https://example.com'], {});
      
      expect(mockLegacyFetcher.fetchBatch).toHaveBeenCalled();
      expect(mockScrapingService.scrapeBatch).not.toHaveBeenCalled();
    });

    it('runs both and compares in shadow mode', async () => {
      setMigrationFlag('serpContent', 'shadow');
      const analyzer = new SerpContentAnalyzer();
      await analyzer.analyzeSerpContent(['https://example.com'], {});
      
      expect(mockLegacyFetcher.fetchBatch).toHaveBeenCalled();
      expect(mockScrapingService.scrapeBatch).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('shadow comparison')
      );
    });
  });

  describe('CompetitorSpyService', () => {
    it('tracks Labs API cost even for direct calls', async () => {
      const service = new CompetitorSpyService();
      await service.fetchOrganicKeywords('example.com', { clientId: 'test' });
      
      expect(mockCostTracker.recordCost).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'labs',
          source: 'competitor_spy',
        })
      );
    });
  });

  describe('VolumeRefreshWorker', () => {
    it('tracks cost for each keyword lookup', async () => {
      await processVolumeRefresh({
        data: { keywords: ['seo', 'marketing'], clientId: 'test' },
        id: 'job-123',
      });
      
      expect(mockCostTracker.recordCost).toHaveBeenCalledTimes(2);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/consumer-integration.integration.test.ts

describe('Consumer Integration E2E', () => {
  it('SerpContentAnalyzer benefits from domain learning', async () => {
    // First request learns domain
    await analyzer.analyzeSerpContent(['https://difficult-site.com/page1'], {});
    
    // Check domain learning record created
    const config = await domainLearningService.getConfig('difficult-site.com');
    expect(config.optimalTier).toBeDefined();
    
    // Second request uses learned tier
    await analyzer.analyzeSerpContent(['https://difficult-site.com/page2'], {});
    
    // Verify tier was used directly
    expect(mockTieredFetcher.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ startTier: config.optimalTier })
    );
  });

  it('Crawl workflow produces identical results in shadow mode', async () => {
    setMigrationFlag('crawlWorkflow', 'shadow');
    
    const auditJob = await createTestAudit('https://test-site.com');
    await runAuditWorkflow(auditJob);
    
    // Shadow comparison logged
    const logs = getRecentLogs('shadow_comparison');
    expect(logs).toContainEqual(
      expect.objectContaining({
        feature: 'crawlWorkflow',
        resultsMatch: true,
      })
    );
  });
});
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Consumer coverage | 100% | All 6 consumers routed through MigrationRouter |
| Cost tracking | 100% | All DataForSEO calls tracked in daily_scraping_costs |
| Shadow match rate | >99% | New vs legacy results match |
| Latency delta | <10% | New path not significantly slower |
| Domain learning hits | >0 | Consumers benefit from learned tiers |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Shadow comparison reveals bugs | Medium | Low | Fix before canary |
| Labs API cost tracking slows queries | Low | Medium | Batch cost inserts |
| Crawl workflow behavioral change | Medium | High | Extended shadow period |
| Volume refresh processor isolation | Low | Medium | Test in staging |

---

## Deliverables

1. Modified `SerpContentAnalyzer.ts` with MigrationRouter
2. Modified `CompetitorSpyService.ts` with cost tracking
3. Modified `TaskRouter.ts` with CRAWL routing
4. Updated `MigrationRouter.ts` with new flags
5. Modified `volume-refresh-processor.js` with DfsCostTracker
6. Modified `siteAuditWorkflowCrawl.ts` with ScrapingService
7. Unit tests for all paths
8. Integration tests for shadow comparison
9. Migration flag admin endpoint
10. Runbook update for rollout procedure
