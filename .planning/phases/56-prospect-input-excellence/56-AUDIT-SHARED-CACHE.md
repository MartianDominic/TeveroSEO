# Shared Cache Flywheel Audit

**Date:** 2026-05-01  
**Auditor:** Claude Opus 4.5  
**Reference:** `docs/infra-research/crawling-10-5000-tasks-day.md`

---

## Executive Summary

The shared cache flywheel pattern is **60% implemented**. Classification singleflight exists and works correctly, but the core **crawl singleflight** (50 clients share one fetch) is missing. Database schema exists but lacks Redis write-through caching.

### Overall Status: 60% Implemented

---

## Requirements vs Implementation

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Cross-client cache sharing | **PARTIAL** | Classification only, not crawls |
| PostgreSQL source of truth | **YES** | `crawl-schema.ts` pageSnapshots |
| Redis hot cache (write-through) | **NOT IMPLEMENTED** | No Redis cache layer |
| url_hash, content_hash columns | **YES** | Schema complete |
| etag, last_modified columns | **YES** | Schema complete |
| lastmod_sitemap column | **MISSING** | Not in schema |
| Sub-ms lookups during 1000 req/s | **NOT POSSIBLE** | No Redis hot cache |
| 7-day result TTL | **YES** | Classification cache |

---

## Implemented Components

### 1. ClassificationSingleflight (COMPLETE)

Location: `ClassificationSingleflight.ts`

- Uses atomic SET NX EX pattern for leader election
- Pub/sub completion via `classify:done:{k}` channel
- 7-day result TTL
- Cross-tenant deduplication via keyword+categories hash

### 2. Page Snapshots Schema (EXISTS, UNUSED)

```typescript
// crawl-schema.ts
export const pageSnapshots = pgTable("page_snapshots", {
  id: serial("id").primaryKey(),
  urlHash: text("url_hash").notNull().unique(),
  seoContentHash: text("seo_content_hash"),
  inventoryHash: text("inventory_hash"),
  etag: text("etag"),
  lastModified: timestamp("last_modified", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  // MISSING: lastmodSitemap
});
```

### 3. ContentHasher (EXISTS, GOOD DESIGN)

```typescript
// ContentHasher.ts
export class ContentHasher {
  computeSeoHash(html: string): string {
    // Strips dynamic blocks, hashes SEO-relevant only
  }
  
  computeInventoryHash(html: string): string {
    // Hashes price/stock elements separately
  }
}
```

---

## Missing Components

### 1. Crawl Singleflight (CRITICAL)

**Infra Doc Pattern:** Leader claims lock atomically, followers wait for pub/sub notification.

**Current Status:** NOT IMPLEMENTED

**Impact:** 50 clients monitoring same retailer = 50 fetches instead of 1.

### 2. Redis Write-Through Cache

**Infra Doc:**
> PostgreSQL as source of truth + Redis as hot cache (write-through). Pure-Postgres can't hit sub-ms during 1,000 req/s crawls.

**Current Status:** No Redis caching for page snapshots.

### 3. lastmod_sitemap Column

**Missing from schema.** Required for L0 delta crawling cascade.

---

## Cache Keys Analysis

**Infra Doc Keys:**
- `crawl:leader:{k}` - Singleflight leader lock
- `crawl:result:{k}` - Crawl result cache
- `crawl:done:{k}` - Pub/sub completion

**Current Keys (Classification only):**
- `classify:leader:{k}` - EXISTS
- `classify:result:{k}` - EXISTS
- `classify:done:{k}` - EXISTS

**Current Keys (Keyword enrichment):**
- `CACHE_NS.KEYWORD` - 7-day TTL for DataForSEO metrics

---

## Cost Impact

| Scenario | Current | With Crawl Singleflight |
|----------|---------|------------------------|
| 50 clients, same retailer | 50 fetches | 1 fetch |
| DataForSEO cost | $1.00 | $0.02 |
| Proxy bandwidth | 6 GB | 120 KB |

**Monthly savings potential:** $300-$1,500 at 5,000 tasks/day with overlapping client portfolios.

---

## Recommendations

### Priority 1: Implement CrawlSingleflight

Copy pattern from `ClassificationSingleflight.ts`:

- Use atomic `SET key NX EX seconds` for leader election
- Store results in `crawl:result:{urlHash}` with 30-min TTL
- Publish completion to `crawl:done:{urlHash}` channel
- Followers subscribe before recheck (no lost wakeup)

### Priority 2: Add Redis Write-Through

Create `PageSnapshotCache` service:
- Write to both Postgres and Redis on insert/update
- Read from Redis first (sub-ms), fall back to Postgres
- Populate Redis on cache miss
- 24h TTL for hot cache

### Priority 3: Add lastmod_sitemap Column

```sql
ALTER TABLE page_snapshots 
ADD COLUMN lastmod_sitemap TIMESTAMPTZ;

CREATE INDEX idx_page_snapshots_lastmod_sitemap 
ON page_snapshots(lastmod_sitemap);
```

---

## Files Audited

| File | Status |
|------|--------|
| `open-seo-main/src/server/features/keywords/services/ClassificationSingleflight.ts` | Working pattern to copy |
| `open-seo-main/src/server/features/keywords/services/ContentHasher.ts` | Good split hash design |
| `open-seo-main/src/db/crawl-schema.ts` | Schema exists, missing lastmod_sitemap |
| `open-seo-main/src/server/lib/redis.ts` | Redis singleton, no write-through |

---

## Effort Estimate

| Task | Effort | Impact |
|------|--------|--------|
| CrawlSingleflight service | 8h | 98% crawl dedup |
| Redis write-through cache | 8h | Sub-ms lookups |
| Add lastmod_sitemap column | 1h | Enables L0 delta |
| **Total** | **17h** | **Shared cache flywheel** |
