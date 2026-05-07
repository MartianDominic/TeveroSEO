# Plan 95-02: Multi-Level Caching System

**Status:** Planning  
**Effort:** 1 week  
**Priority:** P0 (Required for cost optimization)  
**Depends On:** 95-01 (TieredFetcher types)

---

## Executive Summary

This plan implements a 4-level caching architecture (L1-L4) designed to achieve 80%+ cache hit rate and eliminate redundant HTML fetches. The system directly enables the 96-98% cost reduction target by ensuring we never pay twice for the same page.

### Why Multi-Level Caching Matters

| Scenario | Without Cache | With L1-L4 Cache | Savings |
|----------|---------------|------------------|---------|
| Re-audit same site (100 pages) | $12.50 (all DFS) | $0.00 (cache hits) | 100% |
| Competitor overlap (5 clients) | $62.50 (5x fetch) | $12.50 (1 fetch) | 80% |
| Daily SERP monitoring | $18.00/month | $1.80/month (10% refresh) | 90% |
| Historical comparison | Re-fetch all | L4 archive | 100% |

**Key Insight:** Public HTML is not tenant-specific. A cached page for Client A is identical for Client B, enabling cross-tenant deduplication.

---

## Cache Level Design

### Architecture Overview

```
Request
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        L1: Memory LRU (~100MB)                          │
│  Purpose: Hot pages, sub-millisecond access                             │
│  TTL: 5 minutes                                                          │
│  Latency: <1ms                                                           │
│  Contents: Most recently accessed pages, parsed DOM fragments            │
└─────────────────────────────────────────────────────────────────────────┘
                              │ MISS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        L2: Redis (~2GB)                                  │
│  Purpose: Warm pages, cross-worker sharing                               │
│  TTL: 1-24 hours (content-type dependent)                                │
│  Latency: 1-2ms                                                          │
│  Contents: Compressed HTML, analysis results, tier configs               │
└─────────────────────────────────────────────────────────────────────────┘
                              │ MISS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        L3: PostgreSQL (compressed)                       │
│  Purpose: Persistent metadata, audit history                             │
│  TTL: 7-30 days                                                          │
│  Latency: 5-20ms                                                         │
│  Contents: LZ4-compressed HTML, parsed metadata, content hashes          │
└─────────────────────────────────────────────────────────────────────────┘
                              │ MISS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        L4: Cloudflare R2 (archive)                       │
│  Purpose: Raw HTML archive, historical snapshots                         │
│  TTL: 90 days                                                            │
│  Latency: 50-200ms                                                       │
│  Contents: zstd-compressed HTML, full audit snapshots                    │
│  Cost: $0.015/GB/mo + FREE egress                                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │ MISS
                              ▼
                    [ TieredFetcher - Actual Network Request ]
```

---

### L1: Memory LRU Cache

**Purpose:** Eliminate repeated database/Redis lookups for hot pages during active processing.

| Property | Value |
|----------|-------|
| **Library** | `lru-cache` (npm) |
| **Max Size** | 100MB (~1,000 pages at 100KB avg) |
| **Max Items** | 2,000 entries |
| **TTL** | 5 minutes |
| **Eviction** | LRU (least recently used) |

**What Gets Cached:**
- Most recently fetched HTML (for active audits)
- Parsed DOM fragments (for repeat selectors)
- Domain tier configs (hot lookup)

**Why 100MB Limit:**
- Contabo VPS has 24GB RAM
- Reserve 2GB for Redis, 4GB for PostgreSQL connections, 4GB for parsing buffers
- L1 at 100MB is conservative, leaves headroom for 200 concurrent fetches

```typescript
// L1 configuration
const l1Cache = new LRUCache<string, CachedPage>({
  maxSize: 100 * 1024 * 1024, // 100MB
  sizeCalculation: (value) => {
    return value.html?.length || 0 + JSON.stringify(value.metadata || {}).length;
  },
  ttl: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: true,
});
```

---

### L2: Redis Cache

**Purpose:** Cross-worker sharing, warm page access, analysis result caching.

| Property | Value |
|----------|-------|
| **Allocation** | ~2GB of Contabo's 24GB RAM |
| **TTL Range** | 1-24 hours (content-type dependent) |
| **Compression** | LZ4 (4x ratio, fast decompress) |
| **Eviction** | `volatile-lru` (only evict keys with TTL) |

**What Gets Cached:**
- Compressed HTML (LZ4)
- Pre-parsed SEO metadata (title, meta, h1, etc.)
- DataForSEO pre-parsed responses
- Domain scrape configs (30-day TTL)
- ETag/Last-Modified for conditional GET

**Redis Memory Configuration:**
```bash
# /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy volatile-lru
```

**Data Structures:**
```
# Compressed HTML
html:{url_hash} -> {compressed_html, content_hash, fetched_at, tier_used}

# Parsed metadata (faster than re-parsing)
meta:{url_hash} -> {title, description, h1[], canonical, word_count, ...}

# ETags for conditional GET
etag:{url_hash} -> {etag, last_modified}

# Domain configurations (shared)
domain:{domain} -> {optimal_tier, success_rate, requires_js, geo}

# In-flight deduplication (singleflight)
inflight:{url_hash} -> {worker_id, started_at}
```

---

### L3: PostgreSQL Cache

**Purpose:** Persistent HTML storage, audit history, content deduplication.

| Property | Value |
|----------|-------|
| **Storage** | PostgreSQL with LZ4 compression |
| **TTL** | 7-30 days (partitioned by date) |
| **Compression** | LZ4 (4x ratio) for hot, zstd (6x) for warm |
| **Partitioning** | By crawl_date (monthly) |

**What Gets Cached:**
- Compressed HTML for recent audits
- Parsed metadata (extracted once, reused)
- Content hashes for deduplication
- Full audit results (not just raw HTML)

**Schema Design:**
```sql
-- Partitioned by crawl_date for efficient archival
CREATE TABLE html_cache (
  id BIGSERIAL,
  url_hash CHAR(16) NOT NULL,        -- sha256(normalized_url).slice(0,16)
  url TEXT NOT NULL,
  content_hash CHAR(16) NOT NULL,    -- sha256(html).slice(0,16) for dedup
  html_compressed BYTEA NOT NULL,    -- LZ4 compressed
  compression_algo TEXT DEFAULT 'lz4',
  
  -- Metadata (denormalized for query efficiency)
  status_code SMALLINT NOT NULL,
  page_size_bytes INTEGER NOT NULL,
  tier_used TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- ETags for conditional GET
  etag TEXT,
  last_modified TIMESTAMPTZ,
  
  -- Partitioning
  crawl_date DATE NOT NULL,
  
  PRIMARY KEY (id, crawl_date)
) PARTITION BY RANGE (crawl_date);

-- Indexes
CREATE INDEX idx_html_cache_url ON html_cache (url_hash);
CREATE INDEX idx_html_cache_content ON html_cache (content_hash);
CREATE INDEX idx_html_cache_expires ON html_cache (expires_at);

-- Auto-create monthly partitions
CREATE TABLE html_cache_2026_05 PARTITION OF html_cache
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

---

### L4: Cloudflare R2 Archive

**Purpose:** Long-term HTML archive, historical snapshots, cold storage.

| Property | Value |
|----------|-------|
| **Provider** | Cloudflare R2 |
| **Cost** | $0.015/GB/mo + FREE egress |
| **TTL** | 90 days (configurable) |
| **Compression** | zstd (6x ratio) |
| **Access Pattern** | Cold (historical lookups) |

**Why R2 Over S3/B2:**
- FREE egress (S3 charges $0.09/GB)
- S3-compatible API (drop-in replacement)
- Workers integration for edge processing
- At 50GB archive: R2 = $0.75/mo vs S3 = $0.75 + $45 egress

**Object Key Structure:**
```
r2://scrape-archive/
  ├── html/
  │   ├── 2026/05/07/
  │   │   ├── {url_hash}.html.zst    # zstd compressed
  │   │   └── {url_hash}.meta.json   # metadata sidecar
  │   └── ...
  └── snapshots/
      └── audit-{audit_id}/
          ├── manifest.json          # URLs included in audit
          └── pages/
              └── {url_hash}.html.zst
```

**Lifecycle Rules:**
```json
{
  "rules": [
    {
      "id": "archive-90-day",
      "status": "Enabled",
      "expiration": {
        "days": 90
      },
      "prefix": "html/"
    },
    {
      "id": "snapshot-retention",
      "status": "Enabled",
      "expiration": {
        "days": 365
      },
      "prefix": "snapshots/"
    }
  ]
}
```

---

## Cache Key Strategy

### URL Normalization

URLs must be normalized before hashing to maximize cache hits:

```typescript
function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  
  // 1. Lowercase scheme and host
  let normalized = `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}`;
  
  // 2. Remove default ports
  // (URL class already does this)
  
  // 3. Sort query parameters
  const params = new URLSearchParams(parsed.search);
  const sortedParams = Array.from(params.entries())
    .filter(([key]) => !TRACKING_PARAMS.has(key)) // Remove UTM, etc.
    .sort(([a], [b]) => a.localeCompare(b));
  
  // 4. Normalize path
  let path = parsed.pathname;
  path = path.replace(/\/+/g, '/');           // Collapse multiple slashes
  path = path.replace(/\/index\.(html?|php)$/i, '/');  // Remove index files
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);                 // Remove trailing slash
  }
  
  normalized += path;
  
  // 5. Append sorted query string
  if (sortedParams.length > 0) {
    normalized += '?' + sortedParams.map(([k, v]) => `${k}=${v}`).join('&');
  }
  
  return normalized;
}

// Tracking parameters to strip
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'dclid',
  '_ga', '_gl', 'mc_eid', 'ref', 'source',
]);
```

### Cache Key Generation

```typescript
function getCacheKey(url: string, keyType: 'html' | 'meta' | 'etag'): string {
  const normalized = normalizeUrl(url);
  const hash = sha256(normalized).slice(0, 16); // 16 chars = 64 bits
  
  return `${keyType}:${hash}`;
}

// Example:
// URL: https://Example.com/products/?utm_source=google&sort=price
// Normalized: https://example.com/products?sort=price
// Key: html:a1b2c3d4e5f67890
```

### Content-Based Deduplication

```typescript
function getContentHash(html: string): string {
  // Strip volatile content before hashing
  const stable = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // Remove scripts
    .replace(/<!--[\s\S]*?-->/g, '')                   // Remove comments
    .replace(/\s+/g, ' ')                              // Normalize whitespace
    .trim();
  
  return sha256(stable).slice(0, 16);
}

// Dedup check before storage
async function storeHtml(url: string, html: string): Promise<void> {
  const contentHash = getContentHash(html);
  
  // Check if we already have this exact content
  const existing = await db.query.htmlCache.findFirst({
    where: eq(htmlCache.contentHash, contentHash),
    columns: { id: true, urlHash: true },
  });
  
  if (existing && existing.urlHash !== getCacheKey(url, 'html').split(':')[1]) {
    // Same content, different URL - store reference only
    await db.insert(htmlCacheAliases).values({
      aliasUrlHash: getCacheKey(url, 'html').split(':')[1],
      canonicalId: existing.id,
    });
    return;
  }
  
  // Store new content
  await db.insert(htmlCache).values({
    urlHash: getCacheKey(url, 'html').split(':')[1],
    contentHash,
    htmlCompressed: lz4Compress(html),
    // ...
  });
}
```

---

## TTL Strategy by Content Type

### Static vs Dynamic Content

| Content Type | Examples | TTL | Rationale |
|--------------|----------|-----|-----------|
| **Corporate pages** | About, Contact, Team | 7 days | Rarely changes |
| **Blog posts** | Articles, news | 24 hours | Occasional edits |
| **Product pages** | E-commerce PDPs | 4 hours | Price/stock changes |
| **Category pages** | Listings, archives | 12 hours | Product additions |
| **Homepage** | Landing pages | 4 hours | Frequent updates |
| **Dynamic feeds** | Search results, filters | 1 hour | Real-time content |

### Content Type Detection

```typescript
function inferContentType(url: string, html: string): ContentType {
  const path = new URL(url).pathname.toLowerCase();
  const $ = cheerio.load(html);
  
  // URL pattern matching
  if (/\/(blog|news|article|post)\//.test(path)) return 'blog_post';
  if (/\/(product|item|p)\//.test(path)) return 'product';
  if (/\/(category|collection|shop)\//.test(path)) return 'category';
  if (/\/(about|contact|team|careers)/.test(path)) return 'corporate';
  if (path === '/' || path === '') return 'homepage';
  
  // Schema.org detection
  const schemaTypes = $('script[type="application/ld+json"]')
    .map((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        return data['@type'];
      } catch { return null; }
    })
    .toArray()
    .filter(Boolean);
  
  if (schemaTypes.includes('Product')) return 'product';
  if (schemaTypes.includes('Article') || schemaTypes.includes('BlogPosting')) return 'blog_post';
  if (schemaTypes.includes('CollectionPage')) return 'category';
  
  // Default
  return 'generic';
}

const TTL_BY_CONTENT_TYPE: Record<ContentType, number> = {
  corporate: 7 * 24 * 60 * 60 * 1000,    // 7 days
  blog_post: 24 * 60 * 60 * 1000,        // 24 hours
  product: 4 * 60 * 60 * 1000,           // 4 hours
  category: 12 * 60 * 60 * 1000,         // 12 hours
  homepage: 4 * 60 * 60 * 1000,          // 4 hours
  dynamic: 1 * 60 * 60 * 1000,           // 1 hour
  generic: 12 * 60 * 60 * 1000,          // 12 hours (default)
};
```

### Per-Level TTL Adjustment

```typescript
function getTtlForLevel(baseTtl: number, level: CacheLevel): number {
  const multipliers: Record<CacheLevel, number> = {
    L1: 0.1,    // L1 TTL = 10% of base (max ~1.7 hours for corporate)
    L2: 0.5,    // L2 TTL = 50% of base (max ~3.5 days)
    L3: 1.0,    // L3 TTL = 100% of base
    L4: 3.0,    // L4 TTL = 300% of base (archive retention)
  };
  
  return Math.round(baseTtl * multipliers[level]);
}

// Example: Blog post (24h base)
// L1: 2.4 hours (hot access during audit)
// L2: 12 hours (warm access)
// L3: 24 hours (persistent)
// L4: 72 hours (archive)
```

---

## Cache Invalidation Patterns

### Event-Based Invalidation

```typescript
// Invalidation events
type InvalidationEvent = 
  | { type: 'url_changed'; url: string }
  | { type: 'domain_updated'; domain: string }
  | { type: 'audit_started'; auditId: string; urls: string[] }
  | { type: 'force_refresh'; url: string; reason: string };

async function handleInvalidation(event: InvalidationEvent): Promise<void> {
  switch (event.type) {
    case 'url_changed':
      // Single URL invalidation
      const hash = getCacheKey(event.url, 'html').split(':')[1];
      await l1Cache.delete(`html:${hash}`);
      await redis.del(`html:${hash}`, `meta:${hash}`, `etag:${hash}`);
      // L3/L4: Mark as stale, don't delete (historical value)
      await db.update(htmlCache)
        .set({ expires_at: new Date() })
        .where(eq(htmlCache.urlHash, hash));
      break;
      
    case 'domain_updated':
      // Invalidate all URLs for domain
      await invalidateDomain(event.domain);
      break;
      
    case 'audit_started':
      // Pre-warm L1 for audit URLs
      await prewarmForAudit(event.auditId, event.urls);
      break;
      
    case 'force_refresh':
      // Skip cache on next fetch
      await redis.set(`skip:${getCacheKey(event.url, 'html')}`, '1', 'EX', 300);
      break;
  }
}
```

### Conditional GET Revalidation

```typescript
async function revalidateIfStale(url: string): Promise<CachedPage | null> {
  const hash = getCacheKey(url, 'html').split(':')[1];
  
  // Get stored ETag/Last-Modified
  const etag = await redis.hgetall(`etag:${hash}`);
  if (!etag.value) return null;
  
  // Conditional request
  const response = await fetch(url, {
    headers: {
      'If-None-Match': etag.value,
      'If-Modified-Since': etag.lastModified,
    },
  });
  
  if (response.status === 304) {
    // Not modified - extend TTL
    await redis.expire(`html:${hash}`, TTL_BY_CONTENT_TYPE.generic / 1000);
    return await getFromL2(hash);
  }
  
  // Modified - update cache
  const html = await response.text();
  await storeInAllLevels(url, html, response.headers);
  return { html, fromCache: false };
}
```

### Cascade Invalidation

```typescript
// When L3 is invalidated, don't immediately delete L4
// L4 serves as "last known good" for historical comparisons
async function cascadeInvalidation(hash: string, source: CacheLevel): Promise<void> {
  // Always invalidate upstream (L1 <- L2 <- L3 <- L4)
  switch (source) {
    case 'L4':
      await db.update(htmlCache).set({ expires_at: new Date() }).where(eq(htmlCache.urlHash, hash));
      // fall through
    case 'L3':
      await redis.del(`html:${hash}`);
      // fall through
    case 'L2':
      l1Cache.delete(`html:${hash}`);
      break;
  }
  
  // L4 is never cascade-deleted, only replaced on new fetch
}
```

---

## TypeScript Interfaces

### CacheManager Interface

```typescript
// src/server/features/scraping/cache/types.ts

export type CacheLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface CachedPage {
  html: string;
  contentHash: string;
  fetchedAt: Date;
  expiresAt: Date;
  tierUsed: FetchTier;
  statusCode: number;
  pageSizeBytes: number;
  etag?: string;
  lastModified?: string;
  parsedData?: ParsedPageData;
}

export interface ParsedPageData {
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  images: number;
  hasSchema: boolean;
}

export interface CacheResult {
  hit: boolean;
  level?: CacheLevel;
  data?: CachedPage;
  latencyMs: number;
}

export interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l3Hits: number;
  l3Misses: number;
  l4Hits: number;
  l4Misses: number;
  hitRate: number;
  avgLatencyMs: number;
}

export interface CacheConfig {
  l1MaxSize: number;           // bytes
  l1MaxItems: number;
  l1DefaultTtlMs: number;
  
  l2MaxMemory: string;         // e.g., "2gb"
  l2CompressionEnabled: boolean;
  
  l3RetentionDays: number;
  l3CompressionAlgo: 'lz4' | 'zstd';
  
  l4Bucket: string;
  l4RetentionDays: number;
  l4CompressionAlgo: 'zstd' | 'brotli';
}
```

### CacheManager Class

```typescript
// src/server/features/scraping/cache/CacheManager.ts

export interface ICacheManager {
  /**
   * Get cached page, checking all levels in order
   */
  get(url: string, options?: GetOptions): Promise<CacheResult>;
  
  /**
   * Store page in all appropriate cache levels
   */
  set(url: string, page: CachedPage): Promise<void>;
  
  /**
   * Invalidate URL from all cache levels
   */
  invalidate(url: string): Promise<void>;
  
  /**
   * Invalidate all URLs for a domain
   */
  invalidateDomain(domain: string): Promise<void>;
  
  /**
   * Pre-warm cache for a list of URLs (bulk load from L3/L4 to L1/L2)
   */
  prewarm(urls: string[]): Promise<void>;
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
  
  /**
   * Check if URL should skip cache (forced refresh)
   */
  shouldSkipCache(url: string): Promise<boolean>;
  
  /**
   * Get ETag/Last-Modified for conditional GET
   */
  getRevalidationHeaders(url: string): Promise<RevalidationHeaders | null>;
}

export interface GetOptions {
  /** Maximum cache level to check (default: L4) */
  maxLevel?: CacheLevel;
  
  /** Return parsed data if available */
  includeParsedData?: boolean;
  
  /** Accept stale data (expired but not evicted) */
  acceptStale?: boolean;
}

export interface RevalidationHeaders {
  etag?: string;
  lastModified?: string;
}
```

### Implementation Skeleton

```typescript
// src/server/features/scraping/cache/CacheManager.ts

import { LRUCache } from 'lru-cache';
import { Redis } from 'ioredis';
import { S3Client } from '@aws-sdk/client-s3';
import { db } from '@/db';

export class CacheManager implements ICacheManager {
  private l1: LRUCache<string, CachedPage>;
  private l2: Redis;
  private l3Pool: Pool; // PostgreSQL
  private l4: S3Client; // R2 is S3-compatible
  
  private stats: CacheStats = {
    l1Hits: 0, l1Misses: 0,
    l2Hits: 0, l2Misses: 0,
    l3Hits: 0, l3Misses: 0,
    l4Hits: 0, l4Misses: 0,
    hitRate: 0,
    avgLatencyMs: 0,
  };
  
  constructor(config: CacheConfig) {
    this.l1 = new LRUCache({
      maxSize: config.l1MaxSize,
      max: config.l1MaxItems,
      ttl: config.l1DefaultTtlMs,
      sizeCalculation: (value) => value.html.length,
    });
    
    this.l2 = new Redis({
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    
    this.l4 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  
  async get(url: string, options: GetOptions = {}): Promise<CacheResult> {
    const startTime = Date.now();
    const hash = this.getHash(url);
    const maxLevel = options.maxLevel || 'L4';
    
    // L1: Memory
    const l1Result = this.l1.get(`html:${hash}`);
    if (l1Result && (!this.isExpired(l1Result) || options.acceptStale)) {
      this.stats.l1Hits++;
      return {
        hit: true,
        level: 'L1',
        data: l1Result,
        latencyMs: Date.now() - startTime,
      };
    }
    this.stats.l1Misses++;
    if (maxLevel === 'L1') return this.miss(startTime);
    
    // L2: Redis
    const l2Result = await this.getFromRedis(hash);
    if (l2Result && (!this.isExpired(l2Result) || options.acceptStale)) {
      this.stats.l2Hits++;
      this.promoteToL1(hash, l2Result);
      return {
        hit: true,
        level: 'L2',
        data: l2Result,
        latencyMs: Date.now() - startTime,
      };
    }
    this.stats.l2Misses++;
    if (maxLevel === 'L2') return this.miss(startTime);
    
    // L3: PostgreSQL
    const l3Result = await this.getFromPostgres(hash);
    if (l3Result && (!this.isExpired(l3Result) || options.acceptStale)) {
      this.stats.l3Hits++;
      await this.promoteToL2(hash, l3Result);
      this.promoteToL1(hash, l3Result);
      return {
        hit: true,
        level: 'L3',
        data: l3Result,
        latencyMs: Date.now() - startTime,
      };
    }
    this.stats.l3Misses++;
    if (maxLevel === 'L3') return this.miss(startTime);
    
    // L4: R2
    const l4Result = await this.getFromR2(hash);
    if (l4Result) {
      this.stats.l4Hits++;
      // Promote to all levels
      await this.promoteToL3(hash, l4Result, url);
      await this.promoteToL2(hash, l4Result);
      this.promoteToL1(hash, l4Result);
      return {
        hit: true,
        level: 'L4',
        data: l4Result,
        latencyMs: Date.now() - startTime,
      };
    }
    this.stats.l4Misses++;
    
    return this.miss(startTime);
  }
  
  async set(url: string, page: CachedPage): Promise<void> {
    const hash = this.getHash(url);
    
    // Store in all levels (parallel)
    await Promise.all([
      this.storeInL1(hash, page),
      this.storeInL2(hash, page),
      this.storeInL3(hash, page, url),
      this.storeInL4(hash, page, url),
    ]);
  }
  
  // ... remaining methods
}
```

---

## Database Schema

### Cache Metadata Tables

```typescript
// src/db/schema/cache.ts

import { 
  pgTable, text, integer, boolean, timestamp, 
  bytea, index, serial, jsonb 
} from 'drizzle-orm/pg-core';

/**
 * Primary HTML cache storage (L3)
 * Partitioned by crawl_date for efficient archival
 */
export const htmlCache = pgTable('html_cache', {
  id: serial('id'),
  urlHash: text('url_hash').notNull(),          // sha256(normalized_url).slice(0,16)
  url: text('url').notNull(),                   // Original URL for debugging
  contentHash: text('content_hash').notNull(),  // sha256(html).slice(0,16)
  
  // Compressed HTML
  htmlCompressed: bytea('html_compressed').notNull(),
  compressionAlgo: text('compression_algo').default('lz4').notNull(),
  
  // Metadata
  statusCode: integer('status_code').notNull(),
  pageSizeBytes: integer('page_size_bytes').notNull(),
  tierUsed: text('tier_used').notNull(),
  
  // Timestamps
  fetchedAt: timestamp('fetched_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  crawlDate: timestamp('crawl_date').notNull(), // For partitioning
  
  // Revalidation headers
  etag: text('etag'),
  lastModified: timestamp('last_modified'),
  
  // Pre-parsed data (optional, saves re-parsing)
  parsedData: jsonb('parsed_data'),
}, (table) => ({
  urlHashIdx: index('idx_html_cache_url').on(table.urlHash),
  contentHashIdx: index('idx_html_cache_content').on(table.contentHash),
  expiresIdx: index('idx_html_cache_expires').on(table.expiresAt),
}));

/**
 * URL aliases for content deduplication
 * Multiple URLs can point to same content
 */
export const htmlCacheAliases = pgTable('html_cache_aliases', {
  aliasUrlHash: text('alias_url_hash').primaryKey(),
  canonicalId: integer('canonical_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  canonicalIdx: index('idx_aliases_canonical').on(table.canonicalId),
}));

/**
 * Cache statistics for monitoring
 */
export const cacheStats = pgTable('cache_stats', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  
  // Per-level stats
  l1Hits: integer('l1_hits').notNull(),
  l1Misses: integer('l1_misses').notNull(),
  l2Hits: integer('l2_hits').notNull(),
  l2Misses: integer('l2_misses').notNull(),
  l3Hits: integer('l3_hits').notNull(),
  l3Misses: integer('l3_misses').notNull(),
  l4Hits: integer('l4_hits').notNull(),
  l4Misses: integer('l4_misses').notNull(),
  
  // Aggregate
  totalHitRate: integer('total_hit_rate').notNull(), // percentage
  avgLatencyMs: integer('avg_latency_ms').notNull(),
  
  // Storage
  l1SizeBytes: integer('l1_size_bytes'),
  l2SizeBytes: integer('l2_size_bytes'),
  l3SizeBytes: integer('l3_size_bytes'),
  l4SizeBytes: integer('l4_size_bytes'),
});
```

### Migration

```typescript
// src/db/migrations/20260507_cache_schema.ts

import { sql } from 'drizzle-orm';

export async function up(db: any) {
  // Create main cache table (partitioned)
  await db.execute(sql`
    CREATE TABLE html_cache (
      id BIGSERIAL,
      url_hash TEXT NOT NULL,
      url TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      html_compressed BYTEA NOT NULL,
      compression_algo TEXT NOT NULL DEFAULT 'lz4',
      status_code SMALLINT NOT NULL,
      page_size_bytes INTEGER NOT NULL,
      tier_used TEXT NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      crawl_date DATE NOT NULL,
      etag TEXT,
      last_modified TIMESTAMPTZ,
      parsed_data JSONB,
      PRIMARY KEY (id, crawl_date)
    ) PARTITION BY RANGE (crawl_date);
    
    CREATE INDEX idx_html_cache_url ON html_cache (url_hash);
    CREATE INDEX idx_html_cache_content ON html_cache (content_hash);
    CREATE INDEX idx_html_cache_expires ON html_cache (expires_at);
  `);
  
  // Create initial partitions
  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
    const tableName = `html_cache_${month.getFullYear()}_${String(month.getMonth() + 1).padStart(2, '0')}`;
    
    await db.execute(sql`
      CREATE TABLE ${sql.identifier(tableName)} PARTITION OF html_cache
      FOR VALUES FROM (${month.toISOString().split('T')[0]}) 
      TO (${nextMonth.toISOString().split('T')[0]})
    `);
  }
  
  // Create aliases table
  await db.execute(sql`
    CREATE TABLE html_cache_aliases (
      alias_url_hash TEXT PRIMARY KEY,
      canonical_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_aliases_canonical ON html_cache_aliases (canonical_id);
  `);
  
  // Create stats table
  await db.execute(sql`
    CREATE TABLE cache_stats (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      l1_hits INTEGER NOT NULL,
      l1_misses INTEGER NOT NULL,
      l2_hits INTEGER NOT NULL,
      l2_misses INTEGER NOT NULL,
      l3_hits INTEGER NOT NULL,
      l3_misses INTEGER NOT NULL,
      l4_hits INTEGER NOT NULL,
      l4_misses INTEGER NOT NULL,
      total_hit_rate INTEGER NOT NULL,
      avg_latency_ms INTEGER NOT NULL,
      l1_size_bytes INTEGER,
      l2_size_bytes INTEGER,
      l3_size_bytes INTEGER,
      l4_size_bytes INTEGER
    );
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS cache_stats`);
  await db.execute(sql`DROP TABLE IF EXISTS html_cache_aliases`);
  await db.execute(sql`DROP TABLE IF EXISTS html_cache CASCADE`);
}
```

---

## Implementation Tasks

### Task 1: L1 Memory Cache (0.5 day)

**Effort:** 4 hours

- [ ] Install `lru-cache` dependency
- [ ] Create `L1Cache.ts` wrapper class
- [ ] Implement size-based eviction (100MB limit)
- [ ] Add TTL support with per-content-type adjustment
- [ ] Unit tests for LRU eviction, TTL expiry

**Files:**
```
open-seo-main/src/server/features/scraping/cache/
├── L1Cache.ts
└── __tests__/L1Cache.test.ts
```

---

### Task 2: L2 Redis Cache (0.5 day)

**Effort:** 4 hours

- [ ] Create `L2Cache.ts` with Redis connection pooling
- [ ] Implement LZ4 compression for HTML storage
- [ ] Add key patterns (html:, meta:, etag:, domain:)
- [ ] Configure `volatile-lru` eviction policy
- [ ] Unit tests with Redis mock

**Files:**
```
open-seo-main/src/server/features/scraping/cache/
├── L2Cache.ts
├── compression.ts  # LZ4/zstd helpers
└── __tests__/L2Cache.test.ts
```

**Dependencies:**
```json
{
  "lz4": "^0.6.5",
  "ioredis": "^5.3.2"
}
```

---

### Task 3: L3 PostgreSQL Cache (0.5 day)

**Effort:** 4 hours

- [ ] Create Drizzle schema (`cache.ts`)
- [ ] Run migration for partitioned table
- [ ] Implement `L3Cache.ts` with decompression
- [ ] Add content deduplication via aliases table
- [ ] Create partition auto-creation cron job

**Files:**
```
open-seo-main/src/db/schema/cache.ts
open-seo-main/src/db/migrations/20260507_cache_schema.ts
open-seo-main/src/server/features/scraping/cache/L3Cache.ts
open-seo-main/src/server/features/scraping/cache/__tests__/L3Cache.test.ts
```

---

### Task 4: L4 R2 Archive (0.5 day)

**Effort:** 4 hours

- [ ] Configure R2 bucket and credentials
- [ ] Create `L4Cache.ts` with S3Client
- [ ] Implement zstd compression for archival
- [ ] Add lifecycle rules for 90-day retention
- [ ] Integration tests with R2 (or LocalStack S3)

**Files:**
```
open-seo-main/src/server/features/scraping/cache/
├── L4Cache.ts
└── __tests__/L4Cache.test.ts
```

**Environment:**
```env
R2_BUCKET=scrape-archive
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
CF_ACCOUNT_ID=xxx
```

---

### Task 5: CacheManager Orchestration (1 day)

**Effort:** 8 hours

- [ ] Implement `CacheManager.ts` with all levels
- [ ] Add level promotion logic (L4 -> L3 -> L2 -> L1)
- [ ] Implement `get()` with parallel fallback
- [ ] Implement `set()` with async storage to all levels
- [ ] Add stats collection and reporting
- [ ] Integration tests for full cache flow

**Files:**
```
open-seo-main/src/server/features/scraping/cache/
├── CacheManager.ts
├── types.ts
├── index.ts
└── __tests__/CacheManager.test.ts
```

---

### Task 6: URL Normalization & Key Generation (0.5 day)

**Effort:** 4 hours

- [ ] Implement `normalizeUrl()` with tracking param removal
- [ ] Implement `getContentHash()` for deduplication
- [ ] Add comprehensive test cases for URL edge cases
- [ ] Document normalization rules

**Files:**
```
open-seo-main/src/server/features/scraping/cache/
├── urlNormalization.ts
└── __tests__/urlNormalization.test.ts
```

---

### Task 7: TTL & Invalidation (0.5 day)

**Effort:** 4 hours

- [ ] Implement content type detection
- [ ] Create TTL strategy by content type
- [ ] Add invalidation event handlers
- [ ] Implement conditional GET revalidation
- [ ] Unit tests for TTL calculations

**Files:**
```
open-seo-main/src/server/features/scraping/cache/
├── ttlStrategy.ts
├── invalidation.ts
└── __tests__/ttlStrategy.test.ts
```

---

### Task 8: Integration with TieredFetcher (0.5 day)

**Effort:** 4 hours

- [ ] Wire `CacheManager` into `TieredFetcher`
- [ ] Add cache-first check before network fetch
- [ ] Store results after successful fetch
- [ ] Add `skipCache` option support
- [ ] End-to-end integration tests

**Files:**
```
open-seo-main/src/server/features/scraping/TieredFetcher.ts  # Modify
open-seo-main/src/server/features/scraping/__tests__/integration.test.ts
```

---

### Task 9: Monitoring & Metrics (0.5 day)

**Effort:** 4 hours

- [ ] Create cache stats collection job (hourly)
- [ ] Add Prometheus metrics export
- [ ] Create cache dashboard queries
- [ ] Document alerting thresholds

**Files:**
```
open-seo-main/src/server/features/scraping/cache/
├── metrics.ts
└── __tests__/metrics.test.ts
```

---

## Task Summary

| Task | Focus | Effort | Depends On |
|------|-------|--------|------------|
| 1 | L1 Memory Cache | 0.5 day | - |
| 2 | L2 Redis Cache | 0.5 day | - |
| 3 | L3 PostgreSQL Cache | 0.5 day | - |
| 4 | L4 R2 Archive | 0.5 day | - |
| 5 | CacheManager Orchestration | 1 day | 1, 2, 3, 4 |
| 6 | URL Normalization | 0.5 day | - |
| 7 | TTL & Invalidation | 0.5 day | 5 |
| 8 | TieredFetcher Integration | 0.5 day | 5, 95-01 |
| 9 | Monitoring & Metrics | 0.5 day | 5 |
| **Total** | | **5 days** | |

---

## Success Criteria

1. **Hit Rate:** 80%+ cache hit rate on re-audits
2. **Latency:** L1 <1ms, L2 <5ms, L3 <25ms, L4 <250ms
3. **Deduplication:** 30%+ storage savings from content hashing
4. **Coverage:** All TieredFetcher requests route through cache
5. **Test Coverage:** 80%+ for cache module
6. **Zero Regressions:** All existing tests pass

---

## Dependencies

**NPM Packages:**
```json
{
  "lru-cache": "^10.0.0",
  "lz4": "^0.6.5",
  "@aws-sdk/client-s3": "^3.500.0"
}
```

**Environment Variables:**
```env
# R2 (L4)
R2_BUCKET=scrape-archive
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
CF_ACCOUNT_ID=xxx

# Redis (L2) - existing
REDIS_URL=redis://localhost:6379
```

---

## Document History

- **v1.0** (2026-05-07): Initial plan based on Phase 95 context and cost optimization masterplan
