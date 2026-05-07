---
phase: 95
plan: 12
subsystem: scraping
tags:
  - cwv
  - core-web-vitals
  - consolidation
  - tier3-checks
dependency_graph:
  requires:
    - 95-07 (CwvService)
  provides:
    - CwvCheckAdapter
    - Unified CWV check interface
    - Weighted CWV scoring
  affects:
    - Tier 3 SEO checks
    - Audit scoring
tech_stack:
  added: []
  patterns:
    - Adapter pattern for service integration
    - Singleton for shared state
    - In-memory cache for audit sessions
key_files:
  created:
    - open-seo-main/src/server/lib/audit/checks/tier3/CwvCheckAdapter.ts
    - open-seo-main/src/server/lib/audit/checks/tier3/__tests__/CwvCheckAdapter.test.ts
  modified:
    - open-seo-main/src/server/features/scraping/cwv/types.ts
    - open-seo-main/src/server/lib/audit/checks/tier3/cwv.ts
    - open-seo-main/src/server/lib/audit/checks/tier3/index.ts
decisions:
  - In-memory cache for adapter instead of Redis (audit session scope)
  - Weighted scoring with INP at 34% (highest as primary interactivity metric)
  - Deprecated but maintained legacy functions for backwards compatibility
metrics:
  duration: 8 minutes
  completed: 2026-05-07T17:57:00Z
  tasks_completed: 6
  tests_added: 14
---

# Phase 95 Plan 12: CWV Consolidation Summary

CwvCheckAdapter bridges Tier 3 SEO checks to unified CwvService with PSI fallback and weighted scoring.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| da090e5a7 | feat | Export CWV thresholds and type-safe metric names |
| 1db97cbd5 | feat | Create CwvCheckAdapter for Tier 3 checks |
| c3db84905 | refactor | Migrate CWV checks to use CwvCheckAdapter |
| 8b57a3b10 | feat | Add aggregate CWV runner with weighted scoring |
| 4df9082a3 | test | Add CwvCheckAdapter tests and update tier3 exports |

## Key Deliverables

### 1. Exported CWV Types (types.ts)

- `CWV_THRESHOLDS` constant with official Google thresholds
- `CwvMetricName` type-safe metric name (lcp, fid, cls, inp, ttfb)
- `CwvRating` type alias (good, needs-improvement, poor)
- `CwvMetric` interface for detailed metric distribution
- `CwvResult` interface for consolidated service responses

### 2. CwvCheckAdapter (CwvCheckAdapter.ts)

```typescript
class CwvCheckAdapter {
  getCwvForCheck(url: string, clientId?: string): Promise<CwvMetrics | null>
  evaluateMetric(metrics: CwvMetrics, metricName: CwvMetricName): CwvCheckResult | null
  runCwvCheck(url: string, metricName: CwvMetricName, clientId?: string): Promise<CwvCheckResult | null>
}
```

Features:
- Lazy CwvService initialization
- In-memory cache for audit sessions (no Redis required)
- PSI fallback enabled by default
- Score calculation (0-100, linear interpolation)
- Rating determination based on thresholds

### 3. Migrated CWV Checks (cwv.ts)

- T3-01 (LCP), T3-02 (INP), T3-03 (CLS) now use adapter
- Removed 200+ lines of legacy direct CrUX API code
- Added standalone check functions: `checkLCP`, `checkINP`, `checkCLS`
- Added `runCwvChecks` for parallel execution with shared cache

### 4. Weighted Overall Scoring

```typescript
const CWV_WEIGHTS = {
  lcp: 0.33,  // Largest Contentful Paint
  inp: 0.34,  // Interaction to Next Paint (highest)
  cls: 0.33,  // Cumulative Layout Shift
};
```

INP weighted highest (34%) as it's the primary interactivity metric that replaced FID in March 2024.

### 5. Test Coverage

14 unit tests covering:
- evaluateMetric with null handling
- Score calculation for good/needs-improvement/poor ratings
- Singleton pattern and reset functionality
- Threshold constant verification

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| CrUX API calls | Duplicate per check | Shared cache |
| PSI fallback | None | 100% coverage |
| Cache scope | Per-audit in-memory | Shared across checks |
| Code duplication | 200+ lines | Centralized adapter |

## Backwards Compatibility

Deprecated functions maintained for migration:
- `setCruxClientContext()` - delegates to adapter reset
- `clearCruxCache()` - delegates to adapter reset

These will be removed in the next release.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] types.ts exports CWV_THRESHOLDS
- [x] CwvCheckAdapter.ts created
- [x] cwv.ts uses adapter
- [x] All commits recorded
- [x] 14 tests passing
