---
phase: 64-crawling-infrastructure
plan: 02
subsystem: crawler
tags: [delta-crawling, conditional-get, http-304, caching]
dependency_graph:
  requires: [sitemap-parser, delta-sync]
  provides: [deltaCascade, conditionalGet, DeltaResult, CachedHeaders]
  affects: [crawl-efficiency, cost-reduction]
tech_stack:
  added: []
  patterns: [L0-L1-L2-L3-cascade, conditional-GET, weak-ETag]
key_files:
  created:
    - open-seo-main/src/server/lib/crawler/conditional-get.ts
    - open-seo-main/src/server/lib/crawler/delta-cascade.ts
    - open-seo-main/src/server/lib/crawler/delta-cascade.test.ts
  modified:
    - open-seo-main/src/server/lib/crawler/index.ts
decisions:
  - "L0 treated as negative-only signal for Shopify-like platforms"
  - "Accept weak ETags (W/ prefix) per Cloudflare Pitfall 1"
  - "30-second timeout for conditional GET requests (T-64-05)"
  - "L3 fallback when no cached state or all layers indicate change"
metrics:
  duration_minutes: 4
  completed: "2026-05-02T21:36:00Z"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 10
  coverage_delta: "+10 tests"
---

# Phase 64 Plan 02: Delta Crawling Cascade Summary

L0->L1->L2->L3 orchestration to skip unchanged content at earliest possible layer, targeting 80%+ skip rate.

## What Was Built

### Conditional GET Helper (`conditional-get.ts`)

HTTP 304 support (~115 lines):

- Sends `If-None-Match` for ETag validation
- Sends `If-Modified-Since` for date validation
- Returns "unchanged" on 304 status (skip body download)
- Returns "changed" with response + new headers on 200
- Returns "error" on network failure or non-2xx/304
- Accepts weak ETags (`W/` prefix) per Cloudflare behavior

Key exports:
- `conditionalGet(url, cached)`: Perform conditional request
- `hasConditionalHeaders(cached)`: Check if headers available
- `CachedHeaders`: Interface for etag + lastModified
- `ConditionalGetResult`: Result with status and optional response

### Delta Cascade Orchestration (`delta-cascade.ts`)

L0->L3 decision logic (~180 lines):

| Layer | Check | Cost | Skip Condition |
|-------|-------|------|----------------|
| L0 | Sitemap lastmod | Free | lastmod < lastCrawledAt |
| L1 | Conditional GET | Cheap | HTTP 304 response |
| L2 | Hash comparison | Medium | seoContentHash unchanged |
| L3 | Full reprocess | Full | Fallback when change detected |

Key exports:
- `deltaCascade()`: Main orchestration function
- `calculateSkipRate(results)`: Metric for skip efficiency
- `getLayerStats(results)`: Count per layer
- `DeltaResult`: Result with action, reason, layer

### Tests (`delta-cascade.test.ts`)

10 tests covering:
- L0 skip on unchanged lastmod
- L0 proceed when lastmod changed
- L1 skip on 304 response
- L1 proceed on 200 to L2
- L2/L3 hash comparison logic
- L3 fallback for new URLs
- Cloudflare weak ETag handling
- L1 error graceful fallback
- Shopify negative-only signal behavior

## Implementation Details

### Layer Decision Flow

```
URL arrives
    |
    v
[L0: Sitemap lastmod]
    |-- unchanged --> SKIP (free)
    |-- changed/unknown --> continue
    v
[L1: Conditional GET]
    |-- 304 --> SKIP (cheap)
    |-- 200 --> continue with HTML
    |-- error --> L3 fallback
    v
[L2: Hash comparison]
    |-- seoContentHash match --> SKIP
    |-- hash differs --> PROCESS
    v
[L3: Full reprocess]
    --> FETCH/PROCESS (new URL or change confirmed)
```

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| T-64-04 Spoofing | ETag/Last-Modified spoofing causes cache miss, not security issue |
| T-64-05 DoS | 30-second AbortSignal.timeout; continue to L3 on failure |
| T-64-06 Tampering | Sitemap lastmod treated as negative-only signal |

### Shopify Behavior Handling

Per 64-RESEARCH.md Pitfall 2: Shopify sitemap lastmod flips on ANY admin mutation (inventory, metafield, price) - not just content changes.

Solution: L0 is negative-only signal:
- `unchanged = skip` (safe, no false positives)
- `changed = verify with L1/L2` (may be false alarm)

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5a73ff536 | test | Add failing tests for delta cascade (RED) |
| ab49b1842 | feat | Implement delta cascade L0->L1->L2->L3 (GREEN) |

## Self-Check: PASSED

- [x] `open-seo-main/src/server/lib/crawler/conditional-get.ts` exists (119 lines)
- [x] `open-seo-main/src/server/lib/crawler/delta-cascade.ts` exists (184 lines)
- [x] `open-seo-main/src/server/lib/crawler/delta-cascade.test.ts` exists (319 lines)
- [x] All 2 commits exist in git log
- [x] 10 tests pass
- [x] No TypeScript errors in delta modules
