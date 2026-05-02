# Delta Crawling Cascade Audit

**Date:** 2026-05-01  
**Auditor:** Claude Opus 4.5  
**Reference:** `docs/infra-research/crawling-10-5000-tasks-day.md`

---

## Executive Summary

The TeveroSEO codebase has **schema infrastructure** for delta crawling but **no implementation**. The database schema (`crawl-schema.ts`) includes `etag`, `lastModified`, `seoContentHash`, and `inventoryHash` columns, but no code reads or writes these values. All crawling currently fetches full pages every time.

### Overall Status: ~10% Implemented (Schema Only)

---

## 4-Layer Delta Cascade Requirements vs Implementation

| Layer | Mechanism | Expected Savings | Status | Implementation |
|-------|-----------|------------------|--------|----------------|
| **L0** | Sitemap `lastmod` | 25-55% | **NOT IMPLEMENTED** | No sitemap parsing |
| **L1** | Conditional GET (ETag/If-Modified-Since) | 10-20% | **NOT IMPLEMENTED** | Schema exists, no code |
| **L2** | Template-aware content hash | 10-20% | **PARTIAL** | Schema exists, no stripping |
| **L3** | Full reprocess | 10-25% | **DEFAULT** | Current state |

---

## Detailed Findings

### Layer 0: Sitemap lastmod

**Infra Doc Specifies:**
> If unchanged + age < 30d → skip fetch entirely. 25-55% expected hit rate.

**Current Implementation:** None

- No sitemap parsing code found
- No `lastmod_sitemap` column in schema (missing vs infra doc)
- `fast-xml-parser` available in dependencies but unused for sitemaps

**Reliability Warning from Infra Doc:**
- Shopify `lastmod` flips on ANY inventory write → treat as negative-only signal
- WordPress sitemap caching plugins serve stale XML → verify with `article:modified_time`

### Layer 1: Conditional GET

**Infra Doc Specifies:**
> `If-None-Match` / `If-Modified-Since` → 304 response. 10-20% hit rate.

**Current Implementation:** Schema exists, no code

```typescript
// crawl-schema.ts - EXISTS but UNUSED
export const pageSnapshots = pgTable("page_snapshots", {
  etag: text("etag"),
  lastModified: timestamp("last_modified", { withTimezone: true }),
  // ...
});
```

**No conditional request headers sent:**
```typescript
// dataforseoScraper.ts - No ETag/If-Modified-Since
const responseRaw = await postDataforseo(
  "/v3/on_page/content_parsing/live",
  [{ url, enable_javascript: true, store_raw_html: true }],
);
```

**Infra Doc Warning:**
> Only ~20-40% of e-commerce HTML responses honor If-None-Match correctly. Cloudflare downgrades strong ETags to weak.

### Layer 2: Template-Aware Content Hash

**Infra Doc Specifies:**
> Strip dynamic blocks → SHA256 of SEO-relevant text only

**Required Stripping (from infra doc):**
```python
DYNAMIC_BLOCKS = [".price", ".product-price", "[itemprop='price']", "[data-price]",
                  ".stock", ".availability", "[itemprop='availability']", ".cart",
                  ".add-to-cart", ".product-reviews-count", ".recommended",
                  ".related-products", ".cookie-banner", "script", "style", "noscript"]
```

**Current Implementation:**

Schema exists with split hashes (GOOD design):
```typescript
// crawl-schema.ts
seoContentHash: text("seo_content_hash"),   // SEO-relevant only
inventoryHash: text("inventory_hash"),      // Price/stock changes
```

Page analyzer strips only basic elements (INCOMPLETE):
```typescript
// page-analyzer.ts
private stripNonContent(doc: Document): void {
  const selectorsToRemove = ['script', 'style', 'noscript', 'svg'];
  // MISSING: .price, .stock, .cart, .availability, etc.
}
```

**Impact:** Price ticker changes would trigger false-positive "content changed" signals.

### Layer 3: Full Reprocess

**Current Default:** 100% of pages fully reprocessed every time.

---

## trafilatura Usage Check

**Infra Doc Warning:**
> trafilatura and readability-lxml are NOT safe for e-commerce delta detection — they extract the price block as part of "main content"

**Current Status:** trafilatura NOT in dependencies (CORRECT)

```bash
# No trafilatura found
grep -r "trafilatura" package.json requirements.txt
# (no results)
```

---

## Cost Impact Analysis

Without delta crawling at 1,000 recurring pages/day:

| Scenario | Current | With Delta Cascade |
|----------|---------|-------------------|
| Pages fetched/day | 1,000 | 200-350 |
| DataForSEO cost/month | $600 | $120-$210 |
| **Monthly savings** | - | **$390-$480** |

At Phase 2 scale (25M pages/month):
- Current: ~$500,000/year in redundant fetches
- With delta: ~$100,000-$175,000/year
- **Savings: $325,000-$400,000/year**

---

## Recommendations

### Priority 1: Implement L2 Template-Aware Hashing

Extend `page-analyzer.ts` to strip e-commerce dynamic blocks:

```typescript
// Proposed: Add to DYNAMIC_SELECTORS
const DYNAMIC_SELECTORS = [
  'script', 'style', 'noscript', 'svg',
  '.price', '.product-price', '[itemprop="price"]', '[data-price]',
  '.stock', '.availability', '[itemprop="availability"]',
  '.cart', '.add-to-cart', '.product-reviews-count',
  '.recommended', '.related-products', '.cookie-banner'
];
```

### Priority 2: Implement L0 Sitemap Parsing

Create sitemap service:

```typescript
// Proposed: server/lib/sitemap/SitemapService.ts
export class SitemapService {
  async getLastModified(domain: string): Promise<Map<string, Date>> {
    const sitemapUrls = await this.discoverSitemaps(domain);
    const entries = new Map<string, Date>();
    for (const sitemap of sitemapUrls) {
      const parsed = await this.parseSitemap(sitemap);
      for (const entry of parsed) {
        entries.set(entry.loc, entry.lastmod);
      }
    }
    return entries;
  }
}
```

### Priority 3: Add lastmod_sitemap Column

```sql
ALTER TABLE page_snapshots 
ADD COLUMN lastmod_sitemap TIMESTAMPTZ;
```

### Priority 4: Wire Up Schema to Scraper

Currently the schema exists but nothing writes to it. Add:

```typescript
// After successful scrape
await db.insert(pageSnapshots).values({
  urlHash: hashUrl(url),
  etag: response.headers.get('etag'),
  lastModified: response.headers.get('last-modified'),
  seoContentHash: computeSeoHash(strippedHtml),
  inventoryHash: computeInventoryHash(priceElements),
}).onConflictDoUpdate(...);
```

---

## Files Audited

| File | Status |
|------|--------|
| `open-seo-main/src/db/crawl-schema.ts` | Schema exists, unused |
| `open-seo-main/src/server/lib/scraper/dataforseoScraper.ts` | No conditional GET |
| `open-seo-main/src/server/lib/audit/page-analyzer.ts` | Incomplete stripping |
| `open-seo-main/package.json` | No trafilatura (correct) |

---

## Implementation Roadmap

| Phase | Task | Effort | Savings |
|-------|------|--------|---------|
| 1 | L2: Extend dynamic block stripping | 4h | 10-20% |
| 2 | Wire schema to scraper | 8h | Enables L1 |
| 3 | L1: Add conditional GET headers | 4h | 10-20% |
| 4 | L0: Sitemap parsing | 12h | 25-55% |
| **Total** | | **28h** | **65-80%** |
