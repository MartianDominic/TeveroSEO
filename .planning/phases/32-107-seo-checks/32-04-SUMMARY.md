---
phase: 32-107-seo-checks
plan: 04
subsystem: audit-checks
tags: [tier3, tier4, api-checks, crawl-checks, site-context, workflow]
dependency_graph:
  requires: [32-01, 32-02, 32-03]
  provides: [tier3-integration, tier4-integration, site-context-builder]
  affects: [siteAuditWorkflowPhases, runner, audit-findings]
tech_stack:
  added: []
  patterns: [bfs-traversal, dos-mitigation, graceful-skip]
key_files:
  created:
    - open-seo-main/src/server/lib/audit/checks/tier3/index.test.ts
    - open-seo-main/src/server/lib/audit/checks/tier4/index.test.ts
  modified:
    - open-seo-main/src/server/workflows/siteAuditWorkflowPhases.ts
    - open-seo-main/src/server/lib/audit/checks/runner.ts
decisions:
  - Tier 3 runs after Lighthouse phase (API data available)
  - Tier 4 runs after Tier 3 (site-wide context built once)
  - BFS click depth calculation with DoS limits (max 10 depth, 10k iterations)
  - Link graph limited to 50k entries per threat model T-32-08
  - Checks gracefully skip when data unavailable (severity: info)
metrics:
  duration_seconds: 271
  completed_date: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 22
  tests_total: 156
---

# Phase 32 Plan 04: Tier 3/4 Check Integration Summary

Tier 3 (API) and Tier 4 (crawl) checks integrated into audit workflow with SiteContext.

## One-Liner

All 107 SEO checks now execute during audit: 66 Tier 1 (DOM) + 21 Tier 2 (calc) + 13 Tier 3 (API) + 7 Tier 4 (crawl).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 3cf9b66 | feat | Add buildSiteContext and Tier 3/4 runner functions |
| 368cae7 | feat | Integrate Tier 3 and Tier 4 checks into audit workflow |
| 9d6e446 | test | Add comprehensive tests for Tier 3 and Tier 4 checks |

## Implementation Details

### Task 1: Build SiteContext from Crawl Data

Added `buildSiteContext()` function to construct site-wide context for Tier 4 checks:

1. **Link Graph Construction**: Builds `Map<string, string[]>` from internal links
2. **Click Depth Calculation**: BFS from homepage to compute click depth for each page
3. **DoS Mitigations** (per threat model):
   - `MAX_CLICK_DEPTH = 10` - stops BFS at depth 10
   - `MAX_BFS_ITERATIONS = 10,000` - limits total BFS iterations
   - `MAX_LINK_GRAPH_SIZE = 50,000` - caps link graph entries

Added runner functions:
- `runTier3Checks()` - API-based checks (CrUX, GSC, GA4)
- `runTier4Checks()` - crawl-based checks with SiteContext parameter

### Task 2: Workflow Integration

Modified `siteAuditWorkflowPhases.ts` to execute Tier 3 and Tier 4 checks:

**Execution Order:**
```
Discovery -> Crawl (Tier 1) -> Analyzing (Tier 2) -> Lighthouse -> Tier 3 -> Tier 4 -> Finalize
```

Added workflow steps:
- `runTier3ChecksPhase()` - runs after Lighthouse, uses API data
- `runTier4ChecksPhase()` - runs after Tier 3, builds SiteContext once

Both phases:
- Skip pages without HTML or non-200 status
- Log errors but don't fail audit (non-blocking)
- Persist findings to `audit_findings` table

### Task 3: Test Coverage

Created comprehensive tests for Tier 3 and Tier 4:

**Tier 3 Tests (11 tests):**
- Registration verification (13 checks)
- CWV checks skip when API key missing (T3-01 to T3-03)
- Engagement checks skip when OAuth not configured (T3-11 to T3-13)
- Performance benchmark: 13 checks in <500ms

**Tier 4 Tests (11 tests):**
- Registration verification (7 checks)
- Click depth detection with SiteContext (T4-01)
- Orphan page detection (T4-02)
- Hub-spoke check skipping without cluster data (T4-03 to T4-05)
- Scaled content pattern detection (T4-07)
- Content fingerprinting (T4-06)
- Performance benchmark: 7 checks in <200ms

## Architecture

```
runAuditPhases()
  |-- runDiscoveryPhase()           # sitemap/robots
  |-- runCrawlPhase()               # crawl + Tier 1 checks
  |     |-- returns CrawlPhaseResult { allPages, htmlByPageId }
  |-- runTier2ChecksPhase()         # light calculations
  |-- runLighthousePhase()          # PageSpeed Insights
  |-- runTier3ChecksPhase()         # NEW: API-based (CrUX, GSC, GA4)
  |-- runTier4ChecksPhase()         # NEW: crawl-based with SiteContext
  |     |-- buildSiteContext(allPages) → { linkGraph, clickDepths }
  |-- finalizeAudit()               # persist + cleanup
```

## Threat Model Compliance

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-32-07 | Mitigated | BFS max depth 10, max iterations 10k |
| T-32-08 | Mitigated | Link graph capped at 50k entries |
| T-32-09 | Accepted | Tier 3 gracefully skips when APIs unavailable |

## Check Distribution

| Tier | Count | Category | Execution Point |
|------|-------|----------|-----------------|
| 1 | 66 | DOM/regex | During crawl batches |
| 2 | 21 | Light calc | After crawl completes |
| 3 | 13 | API-based | After Lighthouse |
| 4 | 7 | Crawl-based | After Tier 3 |
| **Total** | **107** | | |

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria

- [x] Tier 3 checks use external APIs when available, skip gracefully when not
- [x] Tier 4 checks use site-wide link graph and click depths from SiteContext
- [x] All 107 checks now execute during audit workflow
- [x] Tests verify check execution (22 new tests, 156 total)
- [x] Each task committed individually (3 commits)

## Self-Check: PASSED

- [x] open-seo-main/src/server/lib/audit/checks/tier3/index.test.ts exists
- [x] open-seo-main/src/server/lib/audit/checks/tier4/index.test.ts exists
- [x] Commit 3cf9b66 exists (Task 1)
- [x] Commit 368cae7 exists (Task 2)
- [x] Commit 9d6e446 exists (Task 3)
