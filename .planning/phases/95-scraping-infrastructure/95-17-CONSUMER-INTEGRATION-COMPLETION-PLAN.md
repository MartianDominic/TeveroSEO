# Plan 95-17: Consumer Integration Completion

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 17 - Consumer Integration Completion  
**Status:** Ready  
**Priority:** P1 (High)  
**Estimated Effort:** 8 hours  
**Dependencies:** 95-10 (Consumer Integration)

---

## Objective

Complete the integration of remaining consumers that bypass the unified ScrapingService, and fully wire DfsCostTracker into the scrape flow for accurate cost attribution.

---

## Current State Analysis

### Consumers Bypassing ScrapingService

**1. ProspectAnalysisService** (`features/prospects/services/ProspectAnalysisService.ts`)
- Calls DataForSEO directly via `createDataforseoClient()`
- Uses `competitorsDomain()` and `domainIntersection()` endpoints
- **Impact:** No cost tracking, no caching, no migration flag support

**2. SerpAnalyzer** (`features/briefs/services/SerpAnalyzer.ts`)
- Calls DataForSEO directly via `fetchLiveSerpItemsRaw()` for SERP data
- HTML fetching uses SerpContentAnalyzer (which IS integrated)
- **Impact:** SERP API calls not cost tracked

### DfsCostTracker Integration Gap

**Current State:**
- `DfsCostTracker` exists with `recordCost()` method
- `ScrapingService.scrape()` has internal `trackCost()` but uses simple Map
- Cost attribution to clients/workspaces not fully implemented

**File:** `ScrapingService.ts` lines 700-720:
```typescript
// Current (incomplete):
private costByTier: Map<string, number> = new Map();

private trackCost(tier: ScrapeTier, cost: number): void {
  const current = this.costByTier.get(tier) || 0;
  this.costByTier.set(tier, current + cost);
}
```

**Should be:**
```typescript
// Integrated with DfsCostTracker:
await this.dfsCostTracker.recordCost({
  clientId,
  workspaceId,
  url,
  tier,
  cost,
  success,
  // ...
});
```

---

## Task Breakdown

### Task 1: Integrate ProspectAnalysisService with MigrationRouter

**File:** `open-seo-main/src/server/features/prospects/services/ProspectAnalysisService.ts` (modify)

```typescript
import { getMigrationRouter, routeRequest } from '../../scraping/migration/MigrationRouter';
import { loadMigrationFlagsCached } from '../../scraping/config/flags-loader';
import { getDfsCostTracker } from '../../scraping/providers/DfsCostTracker';

class ProspectAnalysisService {
  private router = getMigrationRouter();
  private costTracker = getDfsCostTracker();

  async getCompetitorsDomain(
    domain: string,
    options: CompetitorsDomainOptions
  ): Promise<CompetitorsDomainResult> {
    const flags = loadMigrationFlagsCached();
    
    // If using new system
    if (flags.prospectAnalysis !== 'legacy') {
      return this.router.routeRequest({
        feature: 'prospectAnalysis',
        input: { domain, ...options },
        legacyFn: () => this.legacyGetCompetitorsDomain(domain, options),
        adapter: this.createCompetitorsAdapter(),
        transformer: this.transformCompetitorsResult,
      });
    }
    
    // Legacy path with cost tracking added
    return this.legacyGetCompetitorsDomain(domain, options);
  }

  private async legacyGetCompetitorsDomain(
    domain: string,
    options: CompetitorsDomainOptions
  ): Promise<CompetitorsDomainResult> {
    const startTime = Date.now();
    const client = createDataforseoClient();
    
    try {
      const result = await client.prospect.competitorsDomain({
        domain,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        limit: options.limit,
      });
      
      // Record cost even in legacy mode
      await this.costTracker.recordCost({
        clientId: options.clientId,
        workspaceId: options.workspaceId,
        url: domain,
        domain,
        mode: 'prospect_competitors',
        usedStandardQueue: false,
        estimatedCost: 0.001, // DFS prospect API cost
        actualCost: 0.001,
        success: true,
        responseTimeMs: Date.now() - startTime,
      });
      
      return result;
    } catch (error) {
      await this.costTracker.recordCost({
        clientId: options.clientId,
        url: domain,
        domain,
        mode: 'prospect_competitors',
        usedStandardQueue: false,
        estimatedCost: 0.001,
        actualCost: 0.001,
        success: false,
        errorMessage: error.message,
        responseTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  // Similar pattern for domainIntersection...
  async getDomainIntersection(
    domains: string[],
    options: DomainIntersectionOptions
  ): Promise<DomainIntersectionResult> {
    // ... similar implementation
  }
}
```

**Acceptance Criteria:**
- [ ] ProspectAnalysisService routes through MigrationRouter
- [ ] Cost tracking added to both legacy and new paths
- [ ] Migration flag `prospectAnalysis` controls routing

---

### Task 2: Add ProspectAnalysis Migration Flag

**File:** `open-seo-main/src/server/features/scraping/config/feature-flags.ts` (modify)

```typescript
export interface ScrapingMigrationFlags {
  // Existing
  siteAudits: MigrationState;
  hybridCrawler: MigrationState;
  prospectAnalysis: MigrationState;  // Ensure exists
  serpContent: MigrationState;
  competitorSpy: MigrationState;
  contentBriefs: MigrationState;
  volumeRefresh: MigrationState;
  crawlWorkflow: MigrationState;
  
  // New
  serpApi: MigrationState;  // For SerpAnalyzer SERP calls
}

export const DEFAULT_FLAGS: ScrapingMigrationFlags = {
  siteAudits: 'legacy',
  hybridCrawler: 'legacy',
  prospectAnalysis: 'legacy',
  serpContent: 'legacy',
  competitorSpy: 'legacy',
  contentBriefs: 'legacy',
  volumeRefresh: 'legacy',
  crawlWorkflow: 'legacy',
  serpApi: 'legacy',
};
```

**Acceptance Criteria:**
- [ ] `prospectAnalysis` flag defined
- [ ] `serpApi` flag added for SerpAnalyzer
- [ ] Environment variable loading updated

---

### Task 3: Create ProspectAnalysis Adapter

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/ProspectAnalysisAdapter.ts` (new or verify)

```typescript
import { ScrapingService, getScrapingService } from '../../ScrapingService';
import { getDfsCostTracker } from '../../providers/DfsCostTracker';

export interface ProspectAnalysisInput {
  domain: string;
  locationCode?: number;
  languageCode?: string;
  limit?: number;
  clientId?: string;
  workspaceId?: string;
}

export interface ProspectAnalysisResult {
  competitors: Array<{
    domain: string;
    rank: number;
    metrics: {
      organicTraffic: number;
      organicKeywords: number;
      backlinks: number;
    };
  }>;
  intersections?: Array<{
    keyword: string;
    yourPosition: number;
    competitorPosition: number;
  }>;
}

export async function prospectAnalysisAdapter(
  input: ProspectAnalysisInput
): Promise<ProspectAnalysisResult> {
  const scrapingService = getScrapingService();
  const costTracker = getDfsCostTracker();
  const startTime = Date.now();

  try {
    // For prospect analysis, we use DataForSEO's specialized endpoint
    // This goes through ScrapingService's DFS provider
    const result = await scrapingService.fetchDfsEndpoint('prospect/competitors', {
      domain: input.domain,
      locationCode: input.locationCode,
      languageCode: input.languageCode,
      limit: input.limit,
    });

    await costTracker.recordCost({
      clientId: input.clientId,
      workspaceId: input.workspaceId,
      url: input.domain,
      domain: input.domain,
      mode: 'prospect_competitors',
      usedStandardQueue: false,
      estimatedCost: 0.001,
      actualCost: result.cost || 0.001,
      success: true,
      responseTimeMs: Date.now() - startTime,
    });

    return {
      competitors: result.data.competitors || [],
    };
  } catch (error) {
    await costTracker.recordCost({
      clientId: input.clientId,
      url: input.domain,
      domain: input.domain,
      mode: 'prospect_competitors',
      success: false,
      errorMessage: error.message,
      responseTimeMs: Date.now() - startTime,
    });
    throw error;
  }
}
```

**Acceptance Criteria:**
- [ ] Adapter wraps DFS prospect endpoints
- [ ] Cost tracking integrated
- [ ] Error handling with cost recording

---

### Task 4: Wire DfsCostTracker into ScrapingService.scrape()

**File:** `open-seo-main/src/server/features/scraping/ScrapingService.ts` (modify)

```typescript
import { getDfsCostTracker, DfsCostTracker } from './providers/DfsCostTracker';

class ScrapingService {
  private dfsCostTracker: DfsCostTracker;

  constructor(config: ScrapingServiceConfig) {
    // ... existing initialization
    this.dfsCostTracker = getDfsCostTracker();
  }

  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const startTime = Date.now();
    const domain = new URL(url).hostname;
    
    try {
      const result = await this.tieredFetcher.fetch(url, options);
      
      // Record cost to DfsCostTracker for DFS tiers
      if (this.isDfsTier(result.tier)) {
        await this.dfsCostTracker.recordCost({
          clientId: options.clientId,
          workspaceId: options.workspaceId,
          jobId: options.jobId,
          url,
          domain,
          mode: this.tierToMode(result.tier),
          usedStandardQueue: result.usedStandardQueue || false,
          taskId: result.taskId,
          estimatedCost: this.estimateCost(result.tier),
          actualCost: result.cost || this.estimateCost(result.tier),
          success: true,
          statusCode: result.statusCode,
          responseSizeBytes: result.html?.length,
          responseTimeMs: Date.now() - startTime,
        });
      }
      
      return result;
    } catch (error) {
      // Record failed cost for DFS tiers
      if (options.startTier && this.isDfsTier(options.startTier)) {
        await this.dfsCostTracker.recordCost({
          clientId: options.clientId,
          workspaceId: options.workspaceId,
          jobId: options.jobId,
          url,
          domain,
          mode: this.tierToMode(options.startTier),
          usedStandardQueue: false,
          estimatedCost: this.estimateCost(options.startTier),
          actualCost: this.estimateCost(options.startTier), // Charged even on failure
          success: false,
          errorMessage: error.message,
          dfsErrorCode: error.code,
          responseTimeMs: Date.now() - startTime,
        });
      }
      throw error;
    }
  }

  private isDfsTier(tier: ScrapeTier): boolean {
    return tier.startsWith('dfs_');
  }

  private tierToMode(tier: ScrapeTier): 'basic' | 'js' | 'browser' {
    switch (tier) {
      case 'dfs_basic': return 'basic';
      case 'dfs_js': return 'js';
      case 'dfs_browser': return 'browser';
      default: return 'basic';
    }
  }

  private estimateCost(tier: ScrapeTier): number {
    const costs: Record<string, number> = {
      dfs_basic: 0.000125,
      dfs_js: 0.00125,
      dfs_browser: 0.00425,
    };
    return costs[tier] || 0;
  }
}
```

**Acceptance Criteria:**
- [ ] DfsCostTracker called on every DFS tier scrape
- [ ] clientId/workspaceId/jobId propagated
- [ ] Cost recorded even on failure
- [ ] Mode correctly mapped from tier

---

### Task 5: Add clientId Parameter to Consumer Methods

**Files to update:**
- `SerpContentAnalyzer.analyzeSerpContent()` - add clientId param
- `CompetitorSpyService` methods - verify clientId propagation
- `TaskRouter.crawlAndExtract()` - verify clientId from task

**Example for SerpContentAnalyzer:**

```typescript
interface AnalyzeSerpContentOptions {
  keyword: string;
  urls: string[];
  clientId?: string;  // ADD
  workspaceId?: string;  // ADD
  // ... existing options
}

async analyzeSerpContent(options: AnalyzeSerpContentOptions): Promise<SerpContentResult> {
  const { keyword, urls, clientId, workspaceId } = options;
  
  const results = await this.scrapingService.scrapeBatch(urls, {
    feature: 'serpContent',
    clientId,  // PROPAGATE
    workspaceId,  // PROPAGATE
    priority: 'high',
  });
  
  // ... rest of analysis
}
```

**Acceptance Criteria:**
- [ ] clientId parameter added to all consumer methods
- [ ] Parameter propagated to ScrapingService calls
- [ ] Existing callers updated to pass clientId where available

---

### Task 6: Add SerpAnalyzer SERP API Cost Tracking

**File:** `open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts` (modify)

```typescript
import { getDfsCostTracker } from '../../scraping/providers/DfsCostTracker';

class SerpAnalyzer {
  private costTracker = getDfsCostTracker();

  async fetchLiveSerpItemsRaw(
    keyword: string,
    options: SerpOptions
  ): Promise<SerpItem[]> {
    const startTime = Date.now();
    
    try {
      const result = await this.dfsClient.serp.googleOrganicLive({
        keyword,
        locationCode: options.locationCode,
        languageCode: options.languageCode,
        depth: options.depth || 10,
      });
      
      // Record SERP API cost
      await this.costTracker.recordCost({
        clientId: options.clientId,
        workspaceId: options.workspaceId,
        url: keyword, // Use keyword as "url" for SERP calls
        domain: 'serp-api',
        mode: 'serp_live',
        usedStandardQueue: false,
        estimatedCost: 0.002, // SERP API cost
        actualCost: 0.002,
        success: true,
        responseTimeMs: Date.now() - startTime,
      });
      
      return result.items;
    } catch (error) {
      await this.costTracker.recordCost({
        clientId: options.clientId,
        url: keyword,
        domain: 'serp-api',
        mode: 'serp_live',
        success: false,
        errorMessage: error.message,
        responseTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

**Acceptance Criteria:**
- [ ] SERP API calls cost tracked
- [ ] clientId propagated from brief generation
- [ ] Separate mode 'serp_live' for SERP calls

---

## Testing Requirements

### Unit Tests

```typescript
describe('ProspectAnalysisService Integration', () => {
  it('should route through MigrationRouter when flag is not legacy');
  it('should track cost in legacy mode');
  it('should track cost in new mode');
  it('should record failure costs');
});

describe('DfsCostTracker Integration', () => {
  it('should record cost for DFS tier scrapes');
  it('should propagate clientId through scrape flow');
  it('should record cost even on failure');
  it('should map tier to correct mode');
});
```

### Integration Tests

```typescript
describe('End-to-End Cost Tracking', () => {
  it('should attribute costs to correct client');
  it('should aggregate costs in daily report');
  it('should include SERP API costs');
  it('should include prospect API costs');
});
```

---

## Acceptance Criteria

- [ ] ProspectAnalysisService uses MigrationRouter
- [ ] All DFS tier scrapes record cost via DfsCostTracker
- [ ] clientId propagated through all consumer paths
- [ ] SERP API calls cost tracked
- [ ] Cost report includes all API types
- [ ] TypeScript compiles without errors
- [ ] All tests pass
