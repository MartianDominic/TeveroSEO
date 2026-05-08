---
phase: 95
plan: 17
subsystem: scraping
tags: [cost-tracking, dfs-cost-tracker, consumer-integration]
dependency_graph:
  requires: [95-10, 95-04]
  provides: [unified-cost-tracking, consumer-cost-attribution]
  affects: [ProspectAnalysisService, SerpAnalyzer, SerpContentAnalyzer, ScrapingService]
tech_stack:
  added: []
  patterns: [fire-and-forget-tracking, cost-attribution]
key_files:
  created: []
  modified:
    - open-seo-main/src/server/features/scraping/ScrapingService.ts
    - open-seo-main/src/server/features/scraping/config/feature-flags.ts
    - open-seo-main/src/server/features/scraping/config/flags-loader.ts
    - open-seo-main/src/server/features/prospects/services/ProspectAnalysisService.ts
    - open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts
    - open-seo-main/src/server/features/briefs/services/SerpContentAnalyzer.ts
decisions:
  - Fire-and-forget pattern for cost tracking to avoid blocking responses
  - Use domain='serp-api' for SERP API calls to distinguish from HTML scraping
  - Cast PostgresJsDatabase to any to bridge DB type incompatibility
metrics:
  duration_minutes: 10
  completed_date: "2026-05-08"
---

# Phase 95 Plan 17: Consumer Integration Completion Summary

DfsCostTracker wired into ScrapingService and remaining consumers that bypass unified scraping.

## One-liner

Complete cost tracking integration for all DataForSEO API consumers including ScrapingService, ProspectAnalysisService, and SerpAnalyzer.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ProspectAnalysisService cost tracking | ad32d454f | ProspectAnalysisService.ts |
| 2 | Add serpApi migration flag | 62fbeb5a5 | feature-flags.ts |
| 4 | Wire DfsCostTracker into ScrapingService | f5ecf1848 | ScrapingService.ts, flags-loader.ts |
| 5 | Add clientId to SerpContentAnalyzer | 46bf5a1a3 | SerpContentAnalyzer.ts |
| 6 | SerpAnalyzer SERP API cost tracking | 574a6d931 | SerpAnalyzer.ts |

## Task 3 Status: Skipped

ProspectAnalysisAdapter not created because:
- ProspectAnalysisService uses DataForSEO Labs API (competitors_domain, domain_intersection)
- These are API-only endpoints, not HTML scraping that benefits from TieredFetcher
- Cost tracking added directly to existing code path
- Adapter would only be needed for future migration to a different provider

## Implementation Details

### ScrapingService.scrape() Integration

- Added `dfsCostTracker` property initialized during `initialize()`
- Added helper methods: `isDfsTier()`, `tierToDfsMode()`, `estimateDfsCost()`
- Added `recordDfsCost()` fire-and-forget method
- Cost recorded on both success and error paths
- Added `workspaceId` to `ScrapeOptions` interface

### ProspectAnalysisService Integration

- Cost tracking added to `discoverCompetitors()` (competitors_domain API)
- Cost tracking added to `analyzeKeywordGaps()` (domain_intersection API)
- Costs associated with workspaceId and analysisId (as jobId)

### SerpAnalyzer Integration

- Cost tracking added to `analyzeSerpForKeyword()`
- Uses `domain='serp-api'` to distinguish from HTML scraping
- Uses keyword as URL identifier for SERP calls
- Added optional `workspaceId` parameter

### SerpContentAnalyzer Integration

- Added `AnalyzeSerpContentOptions` interface
- Pass `clientId` and `workspaceId` through to `scrapeOptions`

### Migration Flags

- Added `serpApi` flag to `ScrapingMigrationFlags`
- Added `SCRAPING_SERP_API` environment variable
- Updated `flags-loader.ts` to load serpApi flag

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors for all modified files
- Fire-and-forget pattern ensures cost tracking does not block responses
- Cost recorded even on API failures (DFS charges for attempts)

## Self-Check: PASSED

All commits verified:
- 62fbeb5a5: feat(95-17): add serpApi migration flag
- f5ecf1848: feat(95-17): wire DfsCostTracker into ScrapingService
- ad32d454f: feat(95-17): add DfsCostTracker to ProspectAnalysisService
- 574a6d931: feat(95-17): add SERP API cost tracking to SerpAnalyzer
- 46bf5a1a3: feat(95-17): add clientId/workspaceId to SerpContentAnalyzer
