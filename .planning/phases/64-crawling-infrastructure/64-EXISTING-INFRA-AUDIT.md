# Phase 64: Existing Crawling Infrastructure Audit

**Audited:** 2026-05-02
**Purpose:** Ensure Phase 64 integrates with existing infrastructure without duplication

---

## Summary

**Total crawling/scraping code:** ~4,606 lines across 19 components

| Status | Count | Lines |
|--------|-------|-------|
| World-class (keep as-is) | 7 | ~2,100 |
| Production (keep, may improve) | 10 | ~2,100 |
| Duplicate (delete) | 0 | 0 |
| Missing (need new) | 6 | TBD |

---

## Infrastructure Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CRAWLING INFRASTRUCTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  HybridCrawler  │───▶│  SitemapParser  │    │  DeltaSyncService│ │
│  │  (377 lines)    │    │  (191 lines)    │    │  (292 lines)    │ │
│  │  fetch+Playwright│    │  fast-xml-parser│    │  split hashes   │ │
│  └────────┬────────┘    └─────────────────┘    └─────────────────┘ │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  PageAnalyzer   │    │  LinkExtractor  │    │ ExtractionPipeline│
│  │  (134 lines)    │    │  (319 lines)    │    │  (261 lines)    │ │
│  │  cheerio        │    │  cheerio        │    │  LightRAG       │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    EXTERNAL SCRAPING (DataForSEO)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ DataForSEO      │───▶│ MultiPageScraper│    │ SerpAnalyzer    │ │
│  │ Scraper (433)   │    │ (119 lines)     │    │ (165 lines)     │ │
│  │ JS rendering    │    │ homepage+3 pages│    │ SERP analysis   │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    AI-POWERED EXTRACTION                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ SelectorDiscover│───▶│ CustomExtractor │    │ BusinessExtractor│
│  │ Service (182)   │    │ (170 lines)     │    │ (185 lines)     │ │
│  │ AI CSS selectors│    │ rule-based      │    │ AI enrichment   │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    PLATFORM DETECTION                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │ PlatformDetector│    │ DiscoveryModule │                        │
│  │ (333 lines)     │    │ (281 lines)     │                        │
│  │ WP/Shopify/etc  │    │ robots+sitemap  │                        │
│  └─────────────────┘    └─────────────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Tier 1: Core Crawling (Keep, World-Class)

#### HybridCrawler
**Location:** `open-seo-main/src/server/lib/crawler/hybrid-crawler.ts` (377 lines)
**Dependencies:** fetch, playwright (dynamic import)
**Purpose:** High-performance site crawler with HTTP-first + Playwright fallback
**Features:**
- 83+ pages/sec throughput (10k pages in 2 min)
- Semaphore-based concurrency (50 concurrent)
- Consent/bot detection
- Delta sync integration hooks
- Dynamic Playwright import (avoids overhead when not needed)

**Phase 64 Integration:**
- ✅ REUSE as primary crawler
- 🔧 EXTEND: Wire up DeltaSyncService (Phase 43 TODOs)
- 🔧 EXTEND: Add singleflight wrapper

#### SitemapParser  
**Location:** `open-seo-main/src/server/lib/crawler/sitemap-parser.ts` (191 lines)
**Dependencies:** fast-xml-parser
**Purpose:** XML sitemap parsing with lastmod for L0 delta crawling
**Features:**
- Recursive sitemap index handling
- lastmod filtering for delta crawls
- Platform-specific reliability notes (Yoast accurate, Shopify flips on any mutation)

**Phase 64 Integration:**
- ✅ REUSE for L0 delta layer
- Already world-class

#### DeltaSyncService
**Location:** `open-seo-main/src/server/lib/crawler/delta-sync.ts` (292 lines)
**Dependencies:** crypto, drizzle
**Purpose:** Split-hash change detection (seoContentHash, inventoryHash, fullHash)
**Features:**
- ChangeType enum: ADD, SEO_MODIFY, PRICE_UPDATE, DELETE, UNCHANGED
- Template-aware hashing (ignores nav/header/footer)
- Lazy database connection

**Phase 64 Integration:**
- ✅ REUSE for L2 delta layer
- Already implements template-aware hashing

#### PageAnalyzer
**Location:** `open-seo-main/src/server/lib/audit/page-analyzer.ts` (134 lines)
**Dependencies:** cheerio
**Purpose:** Core SEO data extraction from HTML
**Extracts:** title, meta, headings, images, links, canonical, OG, schema, robots, word count, hreflang

**Phase 64 Integration:**
- ✅ REUSE as-is
- Core SEO extraction, well-tested

### Tier 2: External APIs (Keep, Production)

#### DataForSEO Scraper
**Location:** `open-seo-main/src/server/lib/scraper/dataforseoScraper.ts` (433 lines)
**Cost:** ~$0.02/page with JS rendering
**Purpose:** JS-rendered HTML fetching via DataForSEO content_parsing API
**Features:**
- SSRF protection
- Rate limiting
- Two-step API flow (POST task → GET result)

**Phase 64 Integration:**
- ✅ REUSE for sites requiring JS rendering
- Use as fallback when HybridCrawler's HTTP-first fails

### Tier 3: Site Audit Workflow (Keep, Refactor)

#### SiteAuditCrawl
**Location:** `open-seo-main/src/server/workflows/siteAuditWorkflowCrawl.ts` (320 lines)
**Purpose:** BFS crawl orchestration for site audits
**Features:**
- CRAWL_CONCURRENCY = 25
- robots.txt compliance
- sitemap seeding
- Progress persistence to Redis KV

**Phase 64 Integration:**
- 🔧 REFACTOR: Extract generic crawl orchestration
- 🔧 REFACTOR: Add queue lane support (fast vs heavy)

---

## What Phase 64 MUST Add (Gaps)

### 1. Singleflight Pattern (Critical)
**Purpose:** Prevent duplicate concurrent crawl requests
**Implementation:** Redis `SET key NX EX ttl` pattern
**Location:** New file `open-seo-main/src/server/lib/crawler/singleflight.ts`
```typescript
// Pseudocode
async function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lock = await redis.set(key, 'locked', 'NX', 'EX', 300);
  if (!lock) {
    // Wait for existing request
    return await pollForResult(key);
  }
  const result = await fn();
  await redis.set(`${key}:result`, JSON.stringify(result), 'EX', 3600);
  return result;
}
```

### 2. Queue Lane Separation (Critical)
**Purpose:** Prevent heavy crawls from blocking fast API responses
**Implementation:** BullMQ named queues
**Lanes:**
- `fast-api` (<1m SLA): SERP, content analysis, keyword ops
- `heavy-crawl` (<15m SLA): Full site audits

### 3. L1 Delta Layer (Medium)
**Purpose:** HTTP conditional requests (If-None-Match, If-Modified-Since)
**Location:** Extend HybridCrawler
```typescript
const response = await fetch(url, {
  headers: {
    'If-None-Match': cachedEtag,
    'If-Modified-Since': cachedLastModified
  }
});
if (response.status === 304) return 'UNCHANGED';
```

### 4. Crawl Metrics Dashboard (Low)
**Purpose:** Visualize cost savings from singleflight + delta
**Metrics:**
- Cache hit rate
- Singleflight coalesce rate
- Cost savings ($)
- Pages crawled vs skipped

### 5. Cross-Worker Rate Limiting (Low)
**Purpose:** Coordinate per-domain rate limits across workers
**Implementation:** Redis rate limiter (sliding window)

### 6. Crawl State Machine (Optional)
**Purpose:** Formal lifecycle management
**States:** pending → running → completed/failed/cancelled

---

## Integration Strategy

```
Phase 64 adds:
┌─────────────────┐
│  Singleflight   │◀─────────── Wraps all crawl requests
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Queue Lanes    │     │  Delta Cascade  │
│  fast | heavy   │     │  L0→L1→L2→L3    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│        EXISTING INFRASTRUCTURE          │
│  HybridCrawler + SitemapParser + Delta  │
│  PageAnalyzer + DataForSEO + Cheerio    │
└─────────────────────────────────────────┘
```

---

## Files to Create (Phase 64)

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `lib/crawler/singleflight.ts` | Redis-based request coalescing | ~100 |
| `lib/crawler/rate-limiter.ts` | Cross-worker rate limiting | ~80 |
| `lib/crawler/delta-cascade.ts` | L0→L1→L2→L3 orchestration | ~150 |
| `server/workers/crawl-queue.ts` | BullMQ lane configuration | ~60 |
| `server/routes/crawl-metrics.ts` | Metrics API endpoint | ~80 |
| `components/CrawlMetricsDashboard.tsx` | Frontend visualization | ~200 |

**Total new code:** ~670 lines
**Reused code:** ~4,600 lines

---

*Audit completed: 2026-05-02*
