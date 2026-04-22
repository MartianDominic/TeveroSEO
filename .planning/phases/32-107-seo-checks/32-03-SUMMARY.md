---
phase: 32-107-seo-checks
plan: 03
subsystem: audit-checks
tags: [tier2, workflow, checks, finalize]
dependency_graph:
  requires: [32-01, 32-02]
  provides: [tier2-integration, analyzing-phase]
  affects: [siteAuditWorkflowPhases, siteAuditWorkflowCrawl]
tech_stack:
  added: []
  patterns: [workflow-phases, batch-check-execution]
key_files:
  created: []
  modified:
    - open-seo-main/src/server/workflows/siteAuditWorkflowPhases.ts
    - open-seo-main/src/server/workflows/siteAuditWorkflowCrawl.ts
    - open-seo-main/src/server/lib/audit/checks/tier2/content-quality.test.ts
    - open-seo-main/src/server/lib/audit/checks/tier2/index.test.ts
decisions:
  - Tier 2 runs after crawl completes (all HTML available) but before Lighthouse
  - HTML accumulated across crawl batches and passed via CrawlPhaseResult
  - currentPhase set to "analyzing" during Tier 2 execution
metrics:
  duration_seconds: 313
  completed_date: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 8
  tests_total: 75
---

# Phase 32 Plan 03: Tier 2 Check Integration Summary

Tier 2 checks integrated into audit workflow analyzing phase with comprehensive test coverage.

## One-Liner

Tier 2 light calculation checks (reading level, keyword density, schema completeness) now execute automatically after crawl completes.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6124f4e | feat | Integrate Tier 2 checks into analyzing phase |
| 6bb8551 | test | Add comprehensive edge case tests for content quality |
| 25fa4eb | test | Add performance benchmark tests for Tier 2 checks |

## Implementation Details

### Task 1: Tier 2 Check Execution in Analyzing Phase

Modified the audit workflow to run Tier 2 checks after crawl completes:

1. **CrawlPhaseResult Export**: Extended `siteAuditWorkflowCrawl.ts` to return both `allPages` and `htmlByPageId` for Tier 2 access.

2. **runTier2ChecksPhase Function**: New workflow step that:
   - Updates audit currentPhase to "analyzing"
   - Iterates all crawled pages with valid HTML
   - Executes 21 Tier 2 checks per page via `runTier2Checks()`
   - Persists findings to `audit_findings` table
   - Non-blocking: errors logged but don't fail audit

3. **Execution Order**: Discovery -> Crawl (Tier 1) -> Analyzing (Tier 2) -> Lighthouse -> Finalize

### Task 2: Content Quality Test Coverage

Added comprehensive edge case tests to `content-quality.test.ts`:
- Empty content handling for T2-01 (reading level)
- 1500 word verification for T2-03 (word count range)
- Empty content edge case for T2-03
- Single-section content test for T2-05
- Empty sections handling for T2-05

### Task 3: Performance Benchmark Tests

Added to `index.test.ts`:
- Flesch-Kincaid test with ~10k words verifies <500ms execution
- Anchor analysis with 150 internal links verifies <100ms
- Complex nested schema JSON-LD parsing verifies <100ms

## Verification Results

```bash
npx vitest run src/server/lib/audit/checks/tier2/
# 75 tests passed across 6 test files
# Tier 2 execution time: ~15ms for all 21 checks
```

## Architecture

```
runAuditPhases()
  |-- runDiscoveryPhase()      # sitemap/robots
  |-- runCrawlPhase()          # crawl + Tier 1 checks
  |     |-- returns CrawlPhaseResult { allPages, htmlByPageId }
  |-- runTier2ChecksPhase()    # NEW: Tier 2 checks
  |     |-- currentPhase: "analyzing"
  |     |-- runTier2Checks() per page
  |     |-- FindingsRepository.insertFindings()
  |-- runLighthousePhase()     # PageSpeed Insights
  |-- finalizeAudit()          # persist + cleanup
```

## Threat Model Compliance

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-32-05 | Mitigated | Content truncated at 50k words in Flesch-Kincaid |
| T-32-06 | Mitigated | JSON.parse wrapped in try-catch for schema parsing |

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria

- [x] Tier 2 checks run automatically during audit analyzing phase
- [x] 21 checks execute in under 500ms per page (measured: ~15ms)
- [x] Check results persisted to audit_findings table
- [x] All tests pass (75 tests)
