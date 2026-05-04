---
phase: 73
plan: 02
subsystem: crawler
tags: [delta-detection, cheerio, hashing, seo, performance]
dependency_graph:
  requires: [64-02-delta-cascade]
  provides: [template-aware-hash, improved-l2-detection]
  affects: [delta-cascade, crawler-performance]
tech_stack:
  added: []
  patterns: [cheerio-dom-manipulation, sha256-hashing, template-aware-extraction]
key_files:
  created:
    - open-seo-main/src/server/lib/crawler/template-hash.ts
    - open-seo-main/src/server/lib/crawler/template-hash.test.ts
  modified:
    - open-seo-main/src/server/lib/crawler/delta-cascade.ts
    - open-seo-main/src/server/lib/crawler/index.ts
decisions:
  - Cheerio for DOM manipulation (already in deps, reliable)
  - Full 64-char SHA256 hash for collision resistance
  - 30 dynamic block selectors cover common e-commerce patterns
  - 16 SEO-relevant selectors based on research prescription
metrics:
  duration: 3m 8s
  completed: 2026-05-04
  tests_added: 33
  tests_total: 70
---

# Phase 73 Plan 02: Template-aware Delta Hash Summary

Cheerio-based template-aware hashing for L2 delta detection, stripping dynamic blocks and extracting SEO-relevant content.

## One-liner

Template-aware hash using Cheerio to strip 30 dynamic selectors (price/stock/widgets) and extract 16 SEO-relevant selectors for improved L2 skip rates.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a8977bb7f | feat(73-02): add template-aware hash for L2 delta detection |
| 2 | fa33ad998 | refactor(73-02): integrate template-aware hash into delta cascade |

## Implementation Details

### Task 1: Template-aware Hash Function

Created `template-hash.ts` with:

**DYNAMIC_BLOCKS (30 selectors to strip):**
- Price/inventory: `.price`, `.product-price`, `[itemprop="price"]`, `[data-price]`, `.stock`, `.availability`, `[itemprop="availability"]`, `.cart`, `.add-to-cart`, `.buy-button`
- Social proof: `.product-reviews-count`, `.reviews-summary`, `.rating-count`, `.recently-viewed`, `.people-viewing`
- Related content: `.recommended`, `.related-products`, `.you-may-also-like`, `.cross-sell`, `.upsell`
- Cookie/consent: `.cookie-banner`, `.consent-modal`, `#onetrust-banner`
- Non-content: `script`, `style`, `noscript`, `iframe`, `form`, `input`, `button:not([type="submit"])`

**SEO_RELEVANT (16 selectors to extract):**
- Meta: `title`, `meta[name="description"]`, `meta[property="og:title"]`, `meta[property="og:description"]`
- Headings: `h1`, `h2`, `h3`
- Structured data: `[itemprop="description"]`, `[itemprop="name"]`
- Main content: `main`, `article`, `.product-description`, `.content`, `.entry-content`, `.post-content`

**Functions:**
- `computeTemplateAwareHash(html)` - Returns hash, extractedParts, dynamicBlocksRemoved
- `hasSemanticChanges(oldHtml, newHtml)` - Boolean comparison helper

### Task 2: Delta Cascade Integration

Modified `delta-cascade.ts`:
- Replaced regex-based `extractSeoContentFromHtml` with `computeTemplateAwareHash`
- L2 check now uses Cheerio DOM manipulation
- Skip reason includes dynamic blocks stripped count for observability
- Removed deprecated regex extraction functions (89 lines)

## Test Coverage

33 new tests in `template-hash.test.ts`:
- 10 tests for ignoring dynamic content (price, stock, cart, reviews, etc.)
- 12 tests for detecting SEO changes (h1-h3, title, meta, main, article)
- 6 tests for metadata reporting (extracted parts, dynamic blocks count)
- 3 tests for hasSemanticChanges helper
- 2 tests for complex e-commerce scenarios

All 70 crawler module tests passing.

## Deviations from Plan

None - plan executed exactly as written.

## Expected Impact

Per 73-02-PLAN.md research prescription:
- Current L2 skip rate: 50-70%
- Expected L2 skip rate: 65-80%
- Cost reduction: ~20% fewer unnecessary re-crawls

The improvement comes from properly stripping dynamic e-commerce elements (price tickers, stock counters, "13 people viewing this" widgets) that previously caused hash changes on every crawl.

## Self-Check: PASSED

- [x] `template-hash.ts` exists: FOUND
- [x] `template-hash.test.ts` exists: FOUND
- [x] Commit a8977bb7f exists: FOUND
- [x] Commit fa33ad998 exists: FOUND
- [x] All 70 crawler tests pass: VERIFIED
