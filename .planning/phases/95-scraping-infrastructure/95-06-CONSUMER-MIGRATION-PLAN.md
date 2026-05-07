---
phase: 95
plan: 06
title: Consumer Migration Wiring
status: ready
priority: P1
estimated_effort: 3 days
dependencies: [95-05]
wave: 4
---

# Plan 95-06: Consumer Migration Wiring

## Objective

Wire all 6 scraping consumers through the MigrationRouter to enable gradual rollout of the unified scraping infrastructure. Currently, SerpContentAnalyzer and CompetitorSpyService bypass the unified ScrapingService entirely.

## Context

From the Integration Review:
- `SerpContentAnalyzer` uses `OptimizedDataForSEOFetcher` directly
- `CompetitorSpyService` calls `fetchOrganicKeywords()` directly with separate 24hr Redis cache
- Migration flags exist but are not wired to actual consumer code
- 4 of 6 consumers have no integration path to ScrapingService

## Success Criteria

- [ ] All 6 consumers can be toggled via feature flags
- [ ] Shadow mode comparison logs for each consumer
- [ ] Legacy behavior preserved when flag is `legacy`
- [ ] New behavior activates when flag is `shadow`/`canary`/`rollout`/`migrated`
- [ ] Integration tests verify migration routing for each consumer

---

## Tasks

### Task 1: Create Consumer Adapter Interfaces

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/types.ts`

```typescript
/**
 * Consumer Adapter Types
 * Phase 95-06: Consumer Migration Wiring
 * 
 * Define interfaces for adapting legacy consumers to unified ScrapingService.
 */

import type { ScrapeResult, ScrapeOptions } from "../../types";

/**
 * Legacy scraper function signature.
 */
export type LegacyScraper<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

/**
 * Adapter that bridges legacy consumer to ScrapingService.
 */
export interface ConsumerAdapter<TInput, TLegacyOutput, TNewOutput = ScrapeResult> {
  /** Feature name for flag lookup */
  feature: ScrapingFeature;
  
  /** Convert legacy input to ScrapingService options */
  toScrapeOptions(input: TInput): ScrapeOptions & { url: string };
  
  /** Convert ScrapeResult to legacy output format */
  toConsumerOutput(result: TNewOutput, input: TInput): TLegacyOutput;
  
  /** Compare outputs for shadow mode logging */
  compareOutputs(legacy: TLegacyOutput, adapted: TLegacyOutput): ComparisonResult;
}

export interface ComparisonResult {
  match: boolean;
  differences: Array<{
    field: string;
    legacy: unknown;
    new: unknown;
  }>;
}

export type ScrapingFeature = 
  | "siteAudits"
  | "hybridCrawler"
  | "prospectAnalysis"
  | "serpContent"
  | "competitorSpy"
  | "contentBriefs";
```

**Verification:** TypeScript compiles without errors

---

### Task 2: Wire SerpContentAnalyzer to MigrationRouter

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/SerpContentAdapter.ts`

```typescript
/**
 * SERP Content Adapter
 * Phase 95-06: Consumer Migration Wiring
 * 
 * Adapts SerpContentAnalyzer to use unified ScrapingService.
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../types";

export interface SerpContentInput {
  url: string;
  keyword: string;
  serpPosition?: number;
}

export interface SerpContentOutput {
  url: string;
  html: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount?: number;
  fetchedAt: Date;
}

export const serpContentAdapter: ConsumerAdapter<SerpContentInput, SerpContentOutput> = {
  feature: "serpContent",
  
  toScrapeOptions(input: SerpContentInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "serpContent",
      includeHtml: true,
      includeParsedData: true,
      // SERP content pages are typically simple HTML
      maxTier: "dfs_js", // Don't escalate to browser for SERP content
      metadata: {
        keyword: input.keyword,
        serpPosition: input.serpPosition,
      },
    };
  },
  
  toConsumerOutput(result: ScrapeResult, input: SerpContentInput): SerpContentOutput {
    return {
      url: input.url,
      html: result.html ?? "",
      title: result.parsed?.title,
      metaDescription: result.parsed?.metaDescription,
      h1: result.parsed?.h1?.[0],
      wordCount: result.parsed?.wordCount,
      fetchedAt: new Date(),
    };
  },
  
  compareOutputs(legacy: SerpContentOutput, adapted: SerpContentOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];
    
    if (legacy.wordCount !== adapted.wordCount) {
      differences.push({
        field: "wordCount",
        legacy: legacy.wordCount,
        new: adapted.wordCount,
      });
    }
    
    // Title comparison (normalize whitespace)
    const legacyTitle = legacy.title?.trim().toLowerCase();
    const adaptedTitle = adapted.title?.trim().toLowerCase();
    if (legacyTitle !== adaptedTitle) {
      differences.push({
        field: "title",
        legacy: legacy.title,
        new: adapted.title,
      });
    }
    
    return {
      match: differences.length === 0,
      differences,
    };
  },
};
```

**Verification:** Unit tests pass for adapter conversion

---

### Task 3: Update SerpContentAnalyzer to Use Adapter

**File:** `open-seo-main/src/server/features/briefs/services/SerpContentAnalyzer.ts`

**Changes:**
1. Import MigrationRouter and SerpContentAdapter
2. Replace direct `OptimizedDataForSEOFetcher` calls with `routeRequest()`
3. Preserve legacy behavior when flag is `legacy`

```typescript
// Add imports
import { routeRequest } from "@/server/features/scraping/migration/MigrationRouter";
import { serpContentAdapter } from "@/server/features/scraping/migration/adapters/SerpContentAdapter";
import { getScrapingService } from "@/server/features/scraping";

// Replace fetchSerpContent method
async fetchSerpContent(url: string, keyword: string, position?: number): Promise<SerpContentOutput> {
  const input: SerpContentInput = { url, keyword, serpPosition: position };
  
  return routeRequest({
    feature: "serpContent",
    input,
    legacyFn: () => this.legacyFetchSerpContent(url),
    adapter: serpContentAdapter,
  });
}

// Keep legacy implementation as fallback
private async legacyFetchSerpContent(url: string): Promise<SerpContentOutput> {
  // Existing OptimizedDataForSEOFetcher logic
  const result = await this.dfsClient.fetch(url);
  return {
    url,
    html: result.html,
    title: result.parsed?.title,
    // ... existing mapping
  };
}
```

**Verification:** 
- Existing tests pass with flag=`legacy`
- New scraping metrics appear with flag=`shadow`

---

### Task 4: Wire CompetitorSpyService to MigrationRouter

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/CompetitorSpyAdapter.ts`

```typescript
/**
 * Competitor Spy Adapter
 * Phase 95-06: Consumer Migration Wiring
 * 
 * Adapts CompetitorSpyService page fetching to unified ScrapingService.
 * Note: Keyword API calls (fetchOrganicKeywords) remain direct - only HTML fetching migrates.
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../types";

export interface CompetitorPageInput {
  url: string;
  competitorDomain: string;
  targetKeyword?: string;
}

export interface CompetitorPageOutput {
  url: string;
  html: string;
  contentHash?: string;
  wordCount?: number;
  headings?: {
    h1: string[];
    h2: string[];
  };
  fetchedAt: Date;
}

export const competitorSpyAdapter: ConsumerAdapter<CompetitorPageInput, CompetitorPageOutput> = {
  feature: "competitorSpy",
  
  toScrapeOptions(input: CompetitorPageInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "competitorSpy",
      includeHtml: true,
      includeParsedData: true,
      metadata: {
        competitorDomain: input.competitorDomain,
        targetKeyword: input.targetKeyword,
      },
    };
  },
  
  toConsumerOutput(result: ScrapeResult, _input: CompetitorPageInput): CompetitorPageOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      contentHash: result.contentHash,
      wordCount: result.parsed?.wordCount,
      headings: {
        h1: result.parsed?.h1 ?? [],
        h2: result.parsed?.h2 ?? [],
      },
      fetchedAt: new Date(),
    };
  },
  
  compareOutputs(legacy: CompetitorPageOutput, adapted: CompetitorPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];
    
    // Word count within 10% tolerance (different parsing)
    if (legacy.wordCount && adapted.wordCount) {
      const diff = Math.abs(legacy.wordCount - adapted.wordCount) / legacy.wordCount;
      if (diff > 0.1) {
        differences.push({
          field: "wordCount",
          legacy: legacy.wordCount,
          new: adapted.wordCount,
        });
      }
    }
    
    // H1 count should match
    if (legacy.headings?.h1.length !== adapted.headings?.h1.length) {
      differences.push({
        field: "h1Count",
        legacy: legacy.headings?.h1.length,
        new: adapted.headings?.h1.length,
      });
    }
    
    return {
      match: differences.length === 0,
      differences,
    };
  },
};
```

**Verification:** Unit tests pass for adapter

---

### Task 5: Update CompetitorSpyService for Page Fetching

**File:** `open-seo-main/src/server/features/keywords/services/CompetitorSpyService.ts`

**Changes:**
1. Add page content fetching method using MigrationRouter
2. Keep keyword API calls direct (Labs API is cost-efficient)
3. Add method for fetching competitor page content

```typescript
// Add imports
import { routeRequest } from "@/server/features/scraping/migration/MigrationRouter";
import { competitorSpyAdapter, type CompetitorPageInput, type CompetitorPageOutput } from "@/server/features/scraping/migration/adapters/CompetitorSpyAdapter";

// Add new method for page content fetching
async fetchCompetitorPageContent(
  url: string, 
  competitorDomain: string,
  targetKeyword?: string
): Promise<CompetitorPageOutput> {
  const input: CompetitorPageInput = { url, competitorDomain, targetKeyword };
  
  return routeRequest({
    feature: "competitorSpy",
    input,
    legacyFn: () => this.legacyFetchPage(url),
    adapter: competitorSpyAdapter,
  });
}

// Legacy page fetching (existing direct fetch logic)
private async legacyFetchPage(url: string): Promise<CompetitorPageOutput> {
  // Use existing HTTP client or Playwright
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ..." },
  });
  const html = await response.text();
  
  return {
    url,
    html,
    fetchedAt: new Date(),
  };
}
```

**Verification:**
- Keyword API calls unchanged
- Page fetching routes through MigrationRouter with flag=`shadow`

---

### Task 6: Wire ProspectAnalysis Adapter

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/ProspectAnalysisAdapter.ts`

```typescript
/**
 * Prospect Analysis Adapter
 * Phase 95-06: Consumer Migration Wiring
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../types";

export interface ProspectPageInput {
  url: string;
  prospectId: string;
  pageType: "homepage" | "about" | "services" | "contact";
}

export interface ProspectPageOutput {
  url: string;
  html: string;
  businessInfo?: {
    companyName?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  technologies?: string[];
  wordCount?: number;
  fetchedAt: Date;
}

export const prospectAnalysisAdapter: ConsumerAdapter<ProspectPageInput, ProspectPageOutput> = {
  feature: "prospectAnalysis",
  
  toScrapeOptions(input: ProspectPageInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "prospectAnalysis",
      includeHtml: true,
      includeParsedData: true,
      metadata: {
        prospectId: input.prospectId,
        pageType: input.pageType,
      },
    };
  },
  
  toConsumerOutput(result: ScrapeResult, _input: ProspectPageInput): ProspectPageOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      technologies: result.quality?.technologies,
      wordCount: result.parsed?.wordCount,
      fetchedAt: new Date(),
    };
  },
  
  compareOutputs(legacy: ProspectPageOutput, adapted: ProspectPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];
    
    if (Math.abs((legacy.wordCount ?? 0) - (adapted.wordCount ?? 0)) > 50) {
      differences.push({
        field: "wordCount",
        legacy: legacy.wordCount,
        new: adapted.wordCount,
      });
    }
    
    return { match: differences.length === 0, differences };
  },
};
```

**Verification:** TypeScript compiles, adapter tests pass

---

### Task 7: Wire ContentBriefs Adapter

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/ContentBriefsAdapter.ts`

```typescript
/**
 * Content Briefs Adapter
 * Phase 95-06: Consumer Migration Wiring
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../types";

export interface BriefPageInput {
  url: string;
  keyword: string;
  serpRank: number;
}

export interface BriefPageOutput {
  url: string;
  html: string;
  title?: string;
  h1?: string;
  h2s: string[];
  wordCount?: number;
  internalLinks: number;
  externalLinks: number;
  fetchedAt: Date;
}

export const contentBriefsAdapter: ConsumerAdapter<BriefPageInput, BriefPageOutput> = {
  feature: "contentBriefs",
  
  toScrapeOptions(input: BriefPageInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "contentBriefs",
      includeHtml: true,
      includeParsedData: true,
      metadata: {
        keyword: input.keyword,
        serpRank: input.serpRank,
      },
    };
  },
  
  toConsumerOutput(result: ScrapeResult, _input: BriefPageInput): BriefPageOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      title: result.parsed?.title,
      h1: result.parsed?.h1?.[0],
      h2s: result.parsed?.h2 ?? [],
      wordCount: result.parsed?.wordCount,
      internalLinks: result.parsed?.internalLinks?.length ?? 0,
      externalLinks: result.parsed?.externalLinks?.length ?? 0,
      fetchedAt: new Date(),
    };
  },
  
  compareOutputs(legacy: BriefPageOutput, adapted: BriefPageOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];
    
    if (legacy.h2s.length !== adapted.h2s.length) {
      differences.push({
        field: "h2Count",
        legacy: legacy.h2s.length,
        new: adapted.h2s.length,
      });
    }
    
    return { match: differences.length === 0, differences };
  },
};
```

**Verification:** TypeScript compiles, adapter tests pass

---

### Task 8: Update MigrationRouter for Generic Adapter Support

**File:** `open-seo-main/src/server/features/scraping/migration/MigrationRouter.ts`

**Changes:** Add generic `routeRequest()` that accepts any ConsumerAdapter

```typescript
/**
 * Route a consumer request through the migration system.
 * Handles legacy/shadow/canary/rollout/migrated states automatically.
 */
export async function routeRequest<TInput, TOutput>(params: {
  feature: ScrapingFeature;
  input: TInput;
  legacyFn: () => Promise<TOutput>;
  adapter: ConsumerAdapter<TInput, TOutput>;
}): Promise<TOutput> {
  const { feature, input, legacyFn, adapter } = params;
  const flags = loadMigrationFlagsCached();
  const state = flags[feature];
  
  // Legacy: use old implementation only
  if (state === "legacy") {
    return legacyFn();
  }
  
  // Get scraping service
  const scrapingService = getScrapingService();
  const scrapeOptions = adapter.toScrapeOptions(input);
  
  // Shadow: run both, log differences, return legacy
  if (state === "shadow") {
    const [legacyResult, newResult] = await Promise.allSettled([
      legacyFn(),
      scrapingService.scrape(scrapeOptions.url, scrapeOptions),
    ]);
    
    if (legacyResult.status === "fulfilled" && newResult.status === "fulfilled") {
      const adaptedNew = adapter.toConsumerOutput(newResult.value, input);
      const comparison = adapter.compareOutputs(legacyResult.value, adaptedNew);
      
      if (!comparison.match) {
        logShadowMismatch(feature, scrapeOptions.url, comparison.differences);
      }
    }
    
    if (legacyResult.status === "fulfilled") {
      return legacyResult.value;
    }
    throw legacyResult.reason;
  }
  
  // Canary: 10% new, 90% legacy
  if (state === "canary") {
    if (Math.random() < 0.1) {
      const result = await scrapingService.scrape(scrapeOptions.url, scrapeOptions);
      return adapter.toConsumerOutput(result, input);
    }
    return legacyFn();
  }
  
  // Rollout: 100% new with legacy fallback
  if (state === "rollout") {
    try {
      const result = await scrapingService.scrape(scrapeOptions.url, scrapeOptions);
      return adapter.toConsumerOutput(result, input);
    } catch (error) {
      console.warn(`[MigrationRouter] ${feature} rollout failed, falling back to legacy:`, error);
      incrementFallbackCounter(feature);
      return legacyFn();
    }
  }
  
  // Migrated: new only
  const result = await scrapingService.scrape(scrapeOptions.url, scrapeOptions);
  return adapter.toConsumerOutput(result, input);
}
```

**Verification:** All adapter integration tests pass

---

### Task 9: Adapter Index and Exports

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/index.ts`

```typescript
/**
 * Consumer Adapters Index
 * Phase 95-06: Consumer Migration Wiring
 */

export * from "./types";
export * from "./SerpContentAdapter";
export * from "./CompetitorSpyAdapter";
export * from "./ProspectAnalysisAdapter";
export * from "./ContentBriefsAdapter";

// Re-export for convenience
export { routeRequest } from "../MigrationRouter";
```

**Verification:** All exports resolve correctly

---

### Task 10: Integration Tests for Consumer Migration

**File:** `open-seo-main/src/server/features/scraping/migration/adapters/adapters.test.ts`

```typescript
/**
 * Consumer Adapter Integration Tests
 * Phase 95-06: Consumer Migration Wiring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { routeRequest } from "../MigrationRouter";
import { serpContentAdapter } from "./SerpContentAdapter";
import { competitorSpyAdapter } from "./CompetitorSpyAdapter";
import * as flagsModule from "../../config/flags-loader";

// Mock ScrapingService
vi.mock("../../index", () => ({
  getScrapingService: () => ({
    scrape: vi.fn().mockResolvedValue({
      success: true,
      url: "https://example.com",
      html: "<html><head><title>Test</title></head><body><h1>Hello</h1><p>Content here</p></body></html>",
      parsed: {
        title: "Test",
        h1: ["Hello"],
        h2: [],
        wordCount: 2,
      },
    }),
  }),
}));

describe("SerpContentAdapter", () => {
  beforeEach(() => {
    vi.spyOn(flagsModule, "loadMigrationFlagsCached").mockReturnValue({
      siteAudits: "legacy",
      hybridCrawler: "legacy",
      prospectAnalysis: "legacy",
      serpContent: "shadow", // Enable shadow for this test
      competitorSpy: "legacy",
      contentBriefs: "legacy",
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it("should route through shadow mode and compare outputs", async () => {
    const legacyFn = vi.fn().mockResolvedValue({
      url: "https://example.com",
      html: "<html>...</html>",
      title: "Test",
      wordCount: 100,
      fetchedAt: new Date(),
    });
    
    const result = await routeRequest({
      feature: "serpContent",
      input: { url: "https://example.com", keyword: "test" },
      legacyFn,
      adapter: serpContentAdapter,
    });
    
    // Should return legacy result in shadow mode
    expect(result.title).toBe("Test");
    expect(legacyFn).toHaveBeenCalled();
  });
  
  it("should skip new implementation in legacy mode", async () => {
    vi.spyOn(flagsModule, "loadMigrationFlagsCached").mockReturnValue({
      serpContent: "legacy",
      // ... other flags
    });
    
    const legacyFn = vi.fn().mockResolvedValue({
      url: "https://example.com",
      html: "<html>...</html>",
      fetchedAt: new Date(),
    });
    
    const result = await routeRequest({
      feature: "serpContent",
      input: { url: "https://example.com", keyword: "test" },
      legacyFn,
      adapter: serpContentAdapter,
    });
    
    expect(legacyFn).toHaveBeenCalled();
    expect(result.url).toBe("https://example.com");
  });
});

describe("CompetitorSpyAdapter", () => {
  it("should convert ScrapeResult to CompetitorPageOutput", () => {
    const scrapeResult = {
      success: true,
      url: "https://competitor.com/page",
      html: "<html>...</html>",
      contentHash: "abc123",
      parsed: {
        wordCount: 500,
        h1: ["Main Heading"],
        h2: ["Sub 1", "Sub 2"],
      },
    };
    
    const output = competitorSpyAdapter.toConsumerOutput(scrapeResult, {
      url: "https://competitor.com/page",
      competitorDomain: "competitor.com",
    });
    
    expect(output.wordCount).toBe(500);
    expect(output.headings?.h1).toEqual(["Main Heading"]);
    expect(output.headings?.h2.length).toBe(2);
  });
});
```

**Verification:** All integration tests pass

---

## Verification Checklist

- [ ] All 6 adapters created and exported
- [ ] MigrationRouter accepts generic adapters
- [ ] SerpContentAnalyzer routes through MigrationRouter
- [ ] CompetitorSpyService page fetching routes through MigrationRouter
- [ ] Shadow mode logs comparison results
- [ ] Legacy mode bypasses new implementation
- [ ] Integration tests cover all migration states
- [ ] TypeScript compiles without errors
- [ ] Existing functionality unchanged with flag=`legacy`

---

## Rollout Strategy

1. **Day 1:** Deploy with all flags at `legacy`
2. **Day 2:** Set `prospectAnalysis` to `shadow`, monitor logs
3. **Day 3:** Set `contentBriefs` and `serpContent` to `shadow`
4. **Day 4:** Set `competitorSpy` to `shadow`
5. **Day 5:** Review shadow logs, address any discrepancies
6. **Day 6-7:** Graduate low-risk consumers to `canary` (10%)
7. **Week 2:** Graduate to `rollout` based on metrics
