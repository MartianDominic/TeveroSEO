---
phase: 32-seo-checks
plan: 03
subsystem: seo-checks
tags: [tier2, calculation, readability, schema, mobile]
dependency_graph:
  requires: [32-01]
  provides: [tier2Checks, ExtendedPageAnalysis]
  affects: [scoring, audit-runner]
tech_stack:
  added: []
  patterns: [flesch-kincaid, syllable-counting, heuristic-detection]
key_files:
  created:
    - src/server/lib/audit/checks/tier2/content-quality.ts
    - src/server/lib/audit/checks/tier2/anchor-analysis.ts
    - src/server/lib/audit/checks/tier2/schema-completeness.ts
    - src/server/lib/audit/checks/tier2/freshness.ts
    - src/server/lib/audit/checks/tier2/mobile.ts
    - src/server/lib/audit/checks/tier2/index.ts
  modified:
    - src/server/lib/audit/checks/types.ts
decisions:
  - "Added ExtendedPageAnalysis interface for optional fields (queryType, isYmyl, sitemapLastmod, etc.)"
  - "Mobile checks use DOM heuristics since full rendering accuracy requires browser"
  - "Freshness checks skip gracefully when historical data unavailable"
metrics:
  duration_minutes: 12
  completed_at: "2026-04-22T14:55:00Z"
---

# Phase 32 Plan 03: Tier 2 Light Calculation Checks Summary

21 Tier 2 checks implemented across 5 categories: content quality, anchor analysis, schema completeness, freshness signals, and mobile UX. All checks execute in <20ms total.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Content Quality and Anchor Analysis (8 checks) | 06f5220 | content-quality.ts, anchor-analysis.ts + tests |
| 2 | Schema, Freshness, and Mobile (13 checks) | 54390e8 | schema-completeness.ts, freshness.ts, mobile.ts + tests |
| 3 | Tier 2 Index and Performance Verification | 91d13b2 | index.ts, index.test.ts, types.ts |

## Implementation Details

### Content Quality Metrics (T2-01 to T2-05)

| Check ID | Name | Algorithm |
|----------|------|-----------|
| T2-01 | Reading level <= Grade 9 | Flesch-Kincaid formula with syllable counting |
| T2-02 | Keyword density < 3% | Word boundary regex counting |
| T2-03 | Word count by query type | Benchmark ranges (info: 1500-2500, transactional: 500-1000) |
| T2-04 | Statistics every 150-200 words | Regex patterns for %, $, x multipliers |
| T2-05 | Section word count 167-278 | H2 section extraction, 70% threshold |

### Anchor Text Analysis (T2-06 to T2-08)

| Check ID | Name | Algorithm |
|----------|------|-----------|
| T2-06 | >=10 unique anchor variations | Unique set counting |
| T2-07 | 50%/25%/25% anchor ratio | Keyword/brand/misc categorization |
| T2-08 | Links evenly distributed | Quartile position analysis |

### Schema Completeness (T2-09 to T2-14)

| Check ID | Name | Validation |
|----------|------|------------|
| T2-09 | author.url to author page | URL format validation |
| T2-10 | author.sameAs has 3+ links | Array length check |
| T2-11 | author.sameAs includes LinkedIn | Domain pattern matching |
| T2-12 | Organization sameAs array | Wikipedia/LinkedIn/Twitter presence |
| T2-13 | publisher.logo >= 112x112px | Dimension extraction from schema |
| T2-14 | citation array on YMYL | YMYL detection + citation presence |

### Freshness Signals (T2-15 to T2-17)

| Check ID | Name | Data Source |
|----------|------|-------------|
| T2-15 | Visible date matches schema | DOM date extraction vs JSON-LD |
| T2-16 | sitemap lastmod matches schema | Requires pageAnalysis.sitemapLastmod |
| T2-17 | No date-only updates | Requires historical content hash |

### Mobile Checks (T2-18 to T2-21)

| Check ID | Name | Detection Method |
|----------|------|------------------|
| T2-18 | H1 above fold on mobile | DOM position heuristic |
| T2-19 | No interstitials on load | Modal/overlay class pattern detection |
| T2-20 | Tap targets >= 48px | Inline style parsing |
| T2-21 | Text >= 16px on mobile | Font-size extraction + user-scalable check |

## Type System Extension

Added `ExtendedPageAnalysis` interface to `types.ts`:

```typescript
export interface ExtendedPageAnalysis extends PageAnalysis {
  queryType?: "informational" | "transactional" | "commercial" | "navigational";
  isYmyl?: boolean;
  sitemapLastmod?: string;
  contentHash?: string;
  previousContentHash?: string;
  previousDateModified?: string;
}
```

This allows checks to access optional extended data while maintaining backward compatibility.

## Performance Results

```
Tier 2 execution time: 15.20ms (target: <500ms)
```

All 21 checks execute well within the 500ms budget, leaving headroom for combined Tier 1+2 runs.

## Test Results

```
Test Files  6 passed (6)
Tests       67 passed (67)
Duration    534ms
```

Tests cover:
- All 21 check calculations
- Edge cases: empty content, missing schema, no keyword
- Performance: all checks in single run
- Registration: verify all IDs present

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all checks are fully functional with appropriate skip handling for missing data.

## Self-Check: PASSED

- [x] src/server/lib/audit/checks/tier2/content-quality.ts exists
- [x] src/server/lib/audit/checks/tier2/anchor-analysis.ts exists
- [x] src/server/lib/audit/checks/tier2/schema-completeness.ts exists
- [x] src/server/lib/audit/checks/tier2/freshness.ts exists
- [x] src/server/lib/audit/checks/tier2/mobile.ts exists
- [x] src/server/lib/audit/checks/tier2/index.ts exists
- [x] 21 checks registered (verified by test)
- [x] Commit 06f5220 exists
- [x] Commit 54390e8 exists
- [x] Commit 91d13b2 exists
