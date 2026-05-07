# Phase 95: Unified Scraping Infrastructure - Research

**Researched:** 2026-05-07
**Domain:** Web scraping, proxy rotation, multi-level caching, rate limiting
**Confidence:** HIGH

## Summary

Phase 95 builds a unified scraping infrastructure that all features consume. The codebase already has **substantial foundation work** from Phase 92, including the `domain-scrape-learning-schema.ts` (500+ lines), `DomainLearningService.ts` (800+ lines with discovery logic), and comprehensive types. This phase completes the implementation by adding:

1. **TieredFetcher class** - The missing orchestrator that actually performs HTTP requests using undici's ProxyAgent
2. **Proxy provider implementations** - DirectFetcher, WebshareFetcher, GeonodeFetcher (wrappers for undici)
3. **CacheManager** - 4-level cache (L1 memory, L2 Redis, L3 PostgreSQL, L4 R2)
4. **RateLimiter** - Per-domain sliding window rate limiting
5. **Queue integration** - BullMQ group-based rate limiting with per-domain concurrency

**Primary recommendation:** Use undici's ProxyAgent with native fetch() for all proxy tiers (not got-scraping), implement lru-cache v11 for L1 with byte-based sizing, use LZ4 compression for Redis/PostgreSQL, and leverage BullMQ Pro's group concurrency for per-domain rate limiting.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP fetching with proxy | TieredFetcher (backend) | - | All network IO in backend |
| Cache orchestration | CacheManager (backend) | - | Cache logic centralized |
| L1 memory cache | Node.js process (backend) | - | Per-process LRU |
| L2 Redis cache | Redis (infrastructure) | - | Shared cross-worker |
| L3 PostgreSQL cache | PostgreSQL (infrastructure) | - | Persistent storage |
| L4 R2 archive | Cloudflare R2 (infrastructure) | - | Cold storage archive |
| Rate limiting | RateLimiter (backend) | BullMQ | Application + queue layer |
| Domain learning | DomainLearningService (backend) | Redis | Already implemented |
| Queue scheduling | BullMQ (backend) | - | Already integrated |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `undici` | 8.2.0 | HTTP client with ProxyAgent | [VERIFIED: npm registry] Node.js native fetch backend, best proxy support |
| `lru-cache` | 11.3.6 | L1 memory cache | [VERIFIED: npm registry] ~200M weekly downloads, npm's own cache, byte-based sizing |
| `ioredis` | 5.10.1 | Redis client for L2 cache | [VERIFIED: existing in project] Already used in codebase |
| `lz4js` | 0.2.0 | Fast compression for L2/L3 | [VERIFIED: npm registry] 4x compression, fast decompression |
| `@aws-sdk/client-s3` | 3.1044.0 | R2 access for L4 | [VERIFIED: npm registry] S3-compatible, works with R2 |
| `cheerio` | 1.2.0 | HTML parsing | [VERIFIED: existing in project] Already used for content validation |
| `bullmq` | existing | Queue with rate limiting | [VERIFIED: existing in project] Group-based per-domain limiting |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `limiter` | 3.1.0 | Token bucket rate limiting | [VERIFIED: npm registry] For in-memory per-domain rate limits |
| `zstd-codec` | 0.1.5 | Higher compression for L4 | [CITED: R2 docs] 6x compression for cold storage |
| `p-limit` | 6.2.0 | Concurrency control | [VERIFIED: npm registry] Limit concurrent fetches |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| undici | got-scraping | got-scraping has browser fingerprinting but undici is Node.js native and already powers fetch() |
| lru-cache | quick-lru | quick-lru is simpler but lacks byte-based sizing needed for HTML |
| lz4js | snappy | LZ4 2x faster decompression than Snappy per DoorDash benchmarks |
| BullMQ groups | Custom rate limiter | BullMQ Pro groups provide built-in per-domain concurrency |

**Installation:**
```bash
pnpm add undici lz4js zstd-codec limiter p-limit
# @aws-sdk/client-s3 only if R2 L4 cache is implemented
pnpm add @aws-sdk/client-s3
```

**Version verification:**
- undici 8.2.0 - confirmed 2026-05-07
- lru-cache 11.3.6 - confirmed 2026-05-07
- lz4js 0.2.0 - confirmed 2026-05-07
- @aws-sdk/client-s3 3.1044.0 - confirmed 2026-05-07

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────────────────────┐
                            │               Consumer Services              │
                            │  SiteAudit │ Hybrid │ Prospect │ SERP │ Spy │
                            └─────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ScrapingService                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ fetchPage()  │  │ crawlSite()  │  │ batchFetch() │  │ warmCache()  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         └──────────────────┴──────────────────┴────────────────┘            │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   RateLimiter   │       │   CacheManager  │       │ DomainLearning  │
│  per-domain     │       │    (L1-L4)      │       │   Service       │
│  sliding window │       │                 │       │  (existing)     │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         │ cache miss              │ tier lookup
         │                         ▼                         │
         │               ┌─────────────────┐                 │
         │               │  TieredFetcher  │◄────────────────┘
         │               └────────┬────────┘
         │                        │
         │    ┌───────────────────┼───────────────────┐
         │    │                   │                   │
         │    ▼                   ▼                   ▼
         │  ┌───────┐     ┌──────────────┐    ┌────────────────┐
         └─►│ T0-T1 │────►│   T2: Geo    │───►│ T3-T5: DFS     │
            │Direct/│     │   Geonode    │    │ Basic/JS/Brwsr │
            │Webshare│    │ ($0.77/GB)   │    │ ($0.000125+)   │
            └───────┘     └──────────────┘    └────────────────┘
                                     │
                                     │ success
                                     ▼
                            ┌─────────────────┐
                            │  Store in L1-L4 │
                            │  Update Domain  │
                            │  Learning       │
                            └─────────────────┘
```

### Recommended Project Structure

```
open-seo-main/src/server/features/scraping/
├── ScrapingService.ts          # Unified entry point (NEW)
├── TieredFetcher.ts            # Tier orchestration (NEW)
├── DomainLearningService.ts    # Already exists (800+ lines)
├── types.ts                    # Already exists (450 lines)
├── index.ts                    # Already exists
├── RevalidationCronJob.ts      # Already exists
├── providers/                  # NEW directory
│   ├── DirectFetcher.ts        # T0: Native fetch
│   ├── WebshareFetcher.ts      # T1: Free DC proxy
│   ├── GeonodeFetcher.ts       # T2: Residential proxy
│   └── DataForSEOFetcher.ts    # T3-T5: DFS API
├── cache/                      # NEW directory
│   ├── CacheManager.ts         # L1-L4 orchestration
│   ├── L1Cache.ts              # LRU memory cache
│   ├── L2Cache.ts              # Redis cache
│   ├── L3Cache.ts              # PostgreSQL cache
│   ├── L4Cache.ts              # R2 archive
│   ├── compression.ts          # LZ4/zstd helpers
│   ├── urlNormalization.ts     # URL hashing
│   └── ttlStrategy.ts          # Content-type TTLs
├── ratelimit/                  # NEW directory
│   ├── RateLimiter.ts          # Sliding window
│   └── DomainSemaphore.ts      # Per-domain concurrency
└── __tests__/
    ├── DomainLearningService.test.ts  # Already exists
    ├── TieredFetcher.test.ts          # NEW
    ├── CacheManager.test.ts           # NEW
    └── RateLimiter.test.ts            # NEW
```

### Pattern 1: Proxy Rotation with undici ProxyAgent

**What:** Use undici's ProxyAgent for HTTP/HTTPS proxy support with native fetch()
**When to use:** All proxy tiers (T1 Webshare, T2 Geonode)

```typescript
// Source: [CITED: https://undici.nodejs.org/]
import { ProxyAgent, fetch } from "undici";

async function fetchWithProxy(url: string, proxyUrl: string): Promise<Response> {
  const dispatcher = new ProxyAgent({
    uri: proxyUrl,
    // Optional: connection pooling
    connections: 10,
    pipelining: 1,
  });

  return fetch(url, {
    dispatcher,
    headers: {
      "User-Agent": "TeveroSEO/1.0 (+https://tevero.io/bot)",
      "Accept-Encoding": "br, gzip, deflate",
    },
    signal: AbortSignal.timeout(30000),
  });
}

// Geonode example
const geonodeProxy = `http://${username}:${password}@rotating-residential.geonode.com:9000`;
const response = await fetchWithProxy("https://example.com", geonodeProxy);
```

### Pattern 2: LRU Cache with Byte-Based Sizing

**What:** Memory cache with size limits based on actual byte usage
**When to use:** L1 cache for hot pages during active audits

```typescript
// Source: [CITED: https://github.com/isaacs/node-lru-cache]
import { LRUCache } from "lru-cache";

interface CachedPage {
  html: string;
  fetchedAt: Date;
  tierUsed: ScrapeTier;
}

const l1Cache = new LRUCache<string, CachedPage>({
  // 100MB max size
  maxSize: 100 * 1024 * 1024,
  
  // Calculate actual memory usage
  sizeCalculation: (value) => {
    return value.html.length + JSON.stringify(value).length;
  },
  
  // 5 minute TTL for hot pages
  ttl: 5 * 60 * 1000,
  
  // Return stale while revalidating
  allowStale: true,
  
  // Cleanup callback
  dispose: (value, key, reason) => {
    // Optional: promote to L2 on eviction
  },
});
```

### Pattern 3: LZ4 Compression for Redis

**What:** Fast compression before storing in Redis
**When to use:** L2 cache to reduce memory and network overhead

```typescript
// Source: [CITED: https://careersatdoordash.com/blog/speeding-up-redis-with-compression/]
import lz4 from "lz4js";

const COMPRESSION_THRESHOLD = 1024; // Only compress > 1KB

function compressHtml(html: string): Buffer {
  if (html.length < COMPRESSION_THRESHOLD) {
    return Buffer.from(html);
  }
  
  const input = Buffer.from(html);
  const compressed = lz4.compress(input);
  
  // Only use if actually smaller
  return compressed.length < input.length ? compressed : input;
}

function decompressHtml(data: Buffer, wasCompressed: boolean): string {
  if (!wasCompressed) {
    return data.toString();
  }
  return lz4.decompress(data).toString();
}

// Redis storage pattern
await redis.hset(`html:${urlHash}`, {
  data: compressHtml(html).toString("base64"),
  compressed: html.length >= COMPRESSION_THRESHOLD ? "1" : "0",
  fetchedAt: Date.now(),
  tier: tierUsed,
});
```

### Pattern 4: BullMQ Group-Based Rate Limiting

**What:** Per-domain concurrency limits using BullMQ groups
**When to use:** Queue-level rate limiting for batch crawls

```typescript
// Source: [CITED: https://docs.bullmq.io/guide/rate-limiting]
import { Queue, Worker } from "bullmq";

// Add job with group ID = domain
await scrapingQueue.add(
  "fetch",
  { url, domain },
  {
    group: {
      id: domain, // Per-domain grouping
    },
  }
);

// Worker with group rate limiting
const worker = new Worker(
  "scraping",
  processor,
  {
    connection: redisConnection,
    concurrency: 100, // Global concurrency
    limiter: {
      max: 2, // 2 requests per second per group
      duration: 1000,
      groupKey: "domain",
    },
  }
);
```

### Pattern 5: DataForSEO Standard Queue Optimization

**What:** Use Standard Queue ($0.0006/query) instead of Live ($0.002/query)
**When to use:** Batch rank tracking, non-interactive bulk fetches

```typescript
// Source: [CITED: https://nextgrowth.ai/dataforseo-api-guide/]
// Standard queue: $0.0006/query (3x cheaper than Live)
// 5-minute delay acceptable for batch jobs

async function submitToStandardQueue(tasks: DFSTask[]): Promise<string[]> {
  const response = await fetch(
    "https://api.dataforseo.com/v3/on_page/task_post",
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tasks.map(t => ({
        ...t,
        priority: 1, // Standard queue (not 2 for Live)
        callback: `${CALLBACK_URL}/dataforseo/callback`,
      }))),
    }
  );
  
  const data = await response.json();
  return data.tasks.map((t: any) => t.id);
}
```

### Anti-Patterns to Avoid

- **Using Live API for batch jobs:** The 3x cost premium delivers speed with no value when no one is waiting. Standard Queue at $0.0006/query is correct for bulk rank refresh. [CITED: https://nextgrowth.ai/dataforseo-api-guide/]

- **Single-process rate limiting without Redis:** Each Node.js process has its own memory. Without shared state in Redis, rate limits are per-process, effectively multiplying the allowed rate. [CITED: https://dev.to/young_gao/advanced-api-rate-limiting-sliding-windows-token-buckets-and-distributed-counters-5afa]

- **Compressing values under 1KB:** Small values see little benefit from compression and add CPU cost. Use a 1KB threshold. [CITED: https://www.logicmonitor.com/blog/redis-compression-benchmarking]

- **Fixed window rate limiting:** Requests at window boundaries can effectively double the allowed rate. Use sliding window or token bucket. [CITED: https://blog.arcjet.com/rate-limiting-algorithms-token-bucket-vs-sliding-window-vs-fixed-window/]

- **Storing tenant-specific cache keys for public HTML:** Public HTML is identical for all clients. Use shared cache keys without tenant prefix for HTML, only isolate analysis results. [VERIFIED: existing COST-OPTIMIZATION-MASTERPLAN.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LRU cache | Custom Map + linked list | `lru-cache` v11 | 200M weekly downloads, byte-sizing, TTL, stale-while-revalidate |
| Rate limiting | setTimeout-based limiter | `limiter` + Redis | Distributed coordination, sliding window accuracy |
| Proxy rotation | Manual HTTP agent | `undici` ProxyAgent | Node.js native, connection pooling, HTTP/2 support |
| Compression | Raw zlib | `lz4js` | 2x faster decompression than zlib, better for hot paths |
| S3/R2 client | Raw HTTP | `@aws-sdk/client-s3` | Handles auth, retries, multipart, streaming |
| Per-domain queuing | Custom queue logic | BullMQ groups | Built-in group concurrency, rate limiting, persistence |

**Key insight:** The scraping domain has many subtle edge cases (connection pooling, proxy authentication, compression edge cases, rate limit coordination). Every hand-rolled solution creates maintenance burden.

## Common Pitfalls

### Pitfall 1: Node.js native fetch ignores HTTP_PROXY

**What goes wrong:** Using `fetch()` without undici dispatcher and expecting proxy env vars to work
**Why it happens:** Node.js 18-23 native fetch ignores HTTP_PROXY environment variables
**How to avoid:** Always use undici ProxyAgent dispatcher for proxy support
**Warning signs:** All requests go directly to target, proxy never used

```typescript
// WRONG: fetch() ignores proxy env vars
const res = await fetch(url); // Goes direct

// CORRECT: Use ProxyAgent dispatcher
import { ProxyAgent, fetch } from "undici";
const dispatcher = new ProxyAgent(proxyUrl);
const res = await fetch(url, { dispatcher });
```
[CITED: https://scrapeops.io/nodejs-web-scraping-playbook/nodejs-proxy-rotation/]

### Pitfall 2: Memory exhaustion from unbounded in-process cache

**What goes wrong:** LRU cache grows beyond available memory, triggering OOM
**Why it happens:** Using item count limits when items vary greatly in size (HTML pages)
**How to avoid:** Use byte-based `maxSize` with `sizeCalculation` function
**Warning signs:** Growing heap memory, increasing GC pauses, OOM crashes

```typescript
// WRONG: Item count assumes uniform size
const cache = new LRUCache({ max: 1000 }); // 1000 HTML pages = unbounded memory

// CORRECT: Byte-based sizing
const cache = new LRUCache({
  maxSize: 100 * 1024 * 1024, // 100MB limit
  sizeCalculation: (v) => v.html.length,
});
```
[CITED: https://www.pkgpulse.com/blog/lru-cache-vs-node-cache-vs-quick-lru-in-memory-caching-2026]

### Pitfall 3: DC proxies fail on Cloudflare-protected sites

**What goes wrong:** Webshare free DC proxies return 403/challenge pages
**Why it happens:** Cloudflare detects datacenter IP ranges (ASN detection)
**How to avoid:** Skip directly to residential proxies (Geonode T2) when Cloudflare detected
**Warning signs:** `cf-browser-verification`, `__cf_chl_opt` in response HTML

```typescript
if (CLOUDFLARE_PATTERNS.some(p => html.includes(p))) {
  // Skip T1 (Webshare DC), go directly to T2 (Geonode residential)
  return escalateTo("geonode");
}
```
[VERIFIED: existing TIERED-SCRAPING-ARCHITECTURE.md]

### Pitfall 4: Rate limit explosion across multiple workers

**What goes wrong:** Each worker independently allows traffic, multiplying effective limit
**Why it happens:** In-memory rate limiters don't share state across processes
**How to avoid:** Use Redis-backed rate limiting or BullMQ group limiter
**Warning signs:** Actual request rate is N times configured limit (N = worker count)

```typescript
// Store rate limit state in Redis, not memory
// Or use BullMQ group rate limiting which is Redis-native
const worker = new Worker("scraping", processor, {
  limiter: { max: 2, duration: 1000, groupKey: "domain" },
});
```
[CITED: https://dev.to/young_gao/advanced-api-rate-limiting-sliding-windows-token-buckets-and-distributed-counters-5afa]

### Pitfall 5: Conditional GET headers ignored by proxies

**What goes wrong:** ETags work on direct fetch but not through proxies
**Why it happens:** Some proxies strip or modify If-None-Match headers
**How to avoid:** Store and validate ETags at application layer, not just rely on 304
**Warning signs:** Never getting 304 responses through proxy tiers

## Code Examples

### Complete TieredFetcher Implementation

```typescript
// Source: [ASSUMED] Based on existing DomainLearningService patterns
import { ProxyAgent, fetch } from "undici";
import type { ScrapeTier, TieredFetchRequest, TieredFetchResult } from "./types";

export class TieredFetcher {
  private readonly providers: Map<ScrapeTier, ProxyProvider>;
  
  constructor(
    private domainLearning: DomainLearningService,
    private cache: CacheManager,
    private rateLimiter: RateLimiter,
    config: TieredFetcherConfig
  ) {
    this.providers = new Map([
      ["direct", new DirectFetcher()],
      ["webshare", new WebshareFetcher(config.webshareApiKey)],
      ["geonode", new GeonodeFetcher(config.geonodeUsername, config.geonodePassword)],
      ["dfs_basic", new DataForSEOFetcher(config.dfsApiKey, "basic")],
      ["dfs_js", new DataForSEOFetcher(config.dfsApiKey, "js")],
      ["dfs_browser", new DataForSEOFetcher(config.dfsApiKey, "browser")],
    ]);
  }

  async fetch(request: TieredFetchRequest): Promise<TieredFetchResult> {
    const domain = normalizeDomain(new URL(request.url).hostname);
    const startTime = Date.now();
    
    // 1. Check cache first
    if (!request.skipCache) {
      const cached = await this.cache.get(request.url);
      if (cached.hit) {
        return this.buildCacheHitResult(request.url, cached, startTime);
      }
    }
    
    // 2. Acquire rate limit
    await this.rateLimiter.acquire(domain);
    
    // 3. Get optimal tier from domain learning
    const config = await this.domainLearning.getConfig(domain);
    const startTier = request.startTier ?? config?.optimalTier ?? "direct";
    
    // 4. Fetch with escalation
    const result = await this.fetchWithEscalation(request.url, startTier, request);
    
    // 5. Cache successful results
    if (result.success && result.html) {
      await this.cache.set(request.url, {
        html: result.html,
        fetchedAt: new Date(),
        tierUsed: result.tier,
        statusCode: result.statusCode,
      });
    }
    
    // 6. Update domain learning
    await this.domainLearning.updateConfig(domain, {
      success: result.success,
      tier: result.tier,
      responseTimeMs: result.responseTimeMs,
      responseSizeBytes: result.responseSizeBytes,
      escalationReason: result.error?.reason,
    });
    
    return result;
  }

  private async fetchWithEscalation(
    url: string,
    startTier: ScrapeTier,
    request: TieredFetchRequest
  ): Promise<TieredFetchResult> {
    let currentTier = startTier;
    const tiersAttempted: ScrapeTier[] = [];
    const escalationPath: Array<{ tier: ScrapeTier; reason: EscalationReason }> = [];
    
    while (currentTier) {
      tiersAttempted.push(currentTier);
      const provider = this.providers.get(currentTier)!;
      
      try {
        const result = await provider.fetch(url, request);
        
        // Validate content quality
        const validation = this.validateContent(result.html ?? "");
        
        if (this.isSuccessful(result, validation)) {
          return {
            ...result,
            validation,
            discovery: tiersAttempted.length > 1 ? {
              isNewDomain: false,
              tiersAttempted,
              escalationPath,
            } : undefined,
          };
        }
        
        // Need escalation
        const reason = this.detectEscalationReason(result, validation);
        escalationPath.push({ tier: currentTier, reason });
        currentTier = this.getNextTier(currentTier, reason);
        
      } catch (error) {
        const reason = this.classifyError(error);
        escalationPath.push({ tier: currentTier, reason });
        currentTier = this.getNextTier(currentTier, reason);
      }
    }
    
    // All tiers failed
    throw new Error(`Failed to fetch ${url} with all tiers`);
  }
}
```

### URL Normalization for Cache Keys

```typescript
// Source: [VERIFIED: existing urlNormalization pattern in plans]
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "dclid",
  "_ga", "_gl", "mc_eid", "ref", "source",
]);

export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  
  // 1. Lowercase scheme and host
  let normalized = `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}`;
  
  // 2. Sort and filter query params
  const params = new URLSearchParams(parsed.search);
  const sortedParams = Array.from(params.entries())
    .filter(([key]) => !TRACKING_PARAMS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  
  // 3. Normalize path
  let path = parsed.pathname
    .replace(/\/+/g, "/")                          // Collapse multiple slashes
    .replace(/\/index\.(html?|php)$/i, "/")        // Remove index files
    .replace(/\/$/, "");                           // Remove trailing slash
  
  if (path === "") path = "/";
  normalized += path;
  
  // 4. Append sorted query string
  if (sortedParams.length > 0) {
    normalized += "?" + sortedParams.map(([k, v]) => `${k}=${v}`).join("&");
  }
  
  return normalized;
}

export function getUrlHash(url: string): string {
  const normalized = normalizeUrl(url);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| got + proxy-agent | undici ProxyAgent | Node.js 18+ (2022) | Native fetch, better performance |
| Single LRU cache | Multi-level (L1-L4) | 2024+ | 80%+ hit rate, cross-worker sharing |
| All DataForSEO | Tiered escalation | 2025+ | 96-98% cost reduction |
| Per-request proxy | Per-domain learning | 2025+ | Avoid re-discovery overhead |
| Fixed rate limits | Adaptive backoff | 2026 | Better handling of 429s |

**Deprecated/outdated:**
- `node-fetch`: Replaced by native fetch() in Node.js 18+
- `got-scraping`: Complex fingerprinting not needed for SEO scraping, undici is simpler
- `proxy-chain`: undici ProxyAgent is now standard

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Geonode $0.77/GB pricing is current | Standard Stack | Moderate - verify pricing before deployment |
| A2 | DataForSEO Standard Queue ~5 min delay | Architecture Patterns | Low - documented in their API |
| A3 | BullMQ Pro group concurrency available | Don't Hand-Roll | High - may need Pro license |
| A4 | 80% cache hit rate achievable | Success Criteria | Moderate - depends on workload patterns |

## Open Questions

1. **BullMQ Pro License**
   - What we know: Group-based rate limiting requires BullMQ Pro
   - What's unclear: Is Pro license already available? Cost?
   - Recommendation: Check if existing BullMQ is Pro, otherwise implement custom Redis-based per-domain limiting

2. **R2 Bucket Configuration**
   - What we know: R2 is S3-compatible, free egress
   - What's unclear: Is Cloudflare account already set up? R2 bucket created?
   - Recommendation: Defer L4 cache to later if R2 not configured, L1-L3 provide 95%+ value

3. **Webshare Free Tier Limits**
   - What we know: 10 IPs, 1GB/month
   - What's unclear: Is 1GB sufficient for discovery phase?
   - Recommendation: Track bandwidth usage, consider paid tier if insufficient

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | L2 cache, rate limiting | Yes | existing | - |
| PostgreSQL | L3 cache, domain configs | Yes | existing | - |
| ioredis | Redis client | Yes | 5.10.1 | - |
| cheerio | Content validation | Yes | 1.2.0 | - |
| BullMQ | Queue integration | Yes | existing | - |
| Cloudflare R2 | L4 archive | Unknown | - | Skip L4, use L1-L3 only |
| Webshare API key | T1 proxies | User must provide | - | Skip T1, use T0 and T2+ |
| Geonode credentials | T2 proxies | User must provide | - | Skip T2, use T0 and T3+ |

**Missing dependencies with no fallback:**
- None critical - L1-L3 caching works without R2

**Missing dependencies with fallback:**
- R2 credentials: Skip L4 archive, focus on L1-L3
- Webshare/Geonode credentials: Use direct fetch + DataForSEO only (higher cost)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test --filter=scraping` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCR-01 | TieredFetcher escalates on failure | unit | `pnpm test TieredFetcher.test.ts -x` | Wave 0 |
| SCR-02 | L1 cache respects byte limits | unit | `pnpm test L1Cache.test.ts -x` | Wave 0 |
| SCR-03 | L2 cache compresses HTML | unit | `pnpm test L2Cache.test.ts -x` | Wave 0 |
| SCR-04 | RateLimiter enforces per-domain | unit | `pnpm test RateLimiter.test.ts -x` | Wave 0 |
| SCR-05 | CacheManager promotes levels | integration | `pnpm test CacheManager.test.ts -x` | Wave 0 |
| SCR-06 | DomainLearning persists config | unit | `pnpm test DomainLearningService.test.ts -x` | Exists |

### Wave 0 Gaps

- [ ] `src/server/features/scraping/__tests__/TieredFetcher.test.ts` - covers SCR-01
- [ ] `src/server/features/scraping/cache/__tests__/L1Cache.test.ts` - covers SCR-02
- [ ] `src/server/features/scraping/cache/__tests__/L2Cache.test.ts` - covers SCR-03
- [ ] `src/server/features/scraping/ratelimit/__tests__/RateLimiter.test.ts` - covers SCR-04
- [ ] `src/server/features/scraping/cache/__tests__/CacheManager.test.ts` - covers SCR-05

### Sampling Rate

- **Per task commit:** `pnpm test --filter=scraping --run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | - |
| V3 Session Management | No | - |
| V4 Access Control | No | - |
| V5 Input Validation | Yes | URL normalization, response validation |
| V6 Cryptography | No | - |

### Known Threat Patterns for Scraping Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via proxy | Spoofing | Validate URLs before proxying, block internal IPs |
| Credential exposure | Information Disclosure | Store proxy credentials in env vars, never log |
| Cache poisoning | Tampering | Validate HTML content before caching |
| DoS via unbounded cache | Denial of Service | Byte-based cache limits, TTLs |

## Sources

### Primary (HIGH confidence)

- [npm registry: undici 8.2.0](https://www.npmjs.com/package/undici) - Verified version
- [npm registry: lru-cache 11.3.6](https://www.npmjs.com/package/lru-cache) - Verified version
- [npm registry: lz4js 0.2.0](https://www.npmjs.com/package/lz4js) - Verified version
- [Existing codebase: domain-scrape-learning-schema.ts](open-seo-main/src/db/domain-scrape-learning-schema.ts) - Schema already implemented
- [Existing codebase: DomainLearningService.ts](open-seo-main/src/server/features/scraping/DomainLearningService.ts) - Service exists
- [Phase 92 research: TIERED-SCRAPING-ARCHITECTURE.md](.planning/phases/92-on-page-seo-mastery/TIERED-SCRAPING-ARCHITECTURE.md) - Tier definitions
- [Phase 92 research: COST-OPTIMIZATION-MASTERPLAN.md](.planning/phases/92-on-page-seo-mastery/COST-OPTIMIZATION-MASTERPLAN.md) - Cost analysis

### Secondary (MEDIUM confidence)

- [undici.nodejs.org](https://undici.nodejs.org/) - Official undici docs
- [Cloudflare R2 S3 API docs](https://developers.cloudflare.com/r2/api/s3/api/) - S3 compatibility
- [BullMQ rate limiting docs](https://docs.bullmq.io/guide/rate-limiting) - Group-based limiting
- [DoorDash Redis compression](https://careersatdoordash.com/blog/speeding-up-redis-with-compression/) - LZ4 benchmarks
- [LogicMonitor Redis compression](https://www.logicmonitor.com/blog/redis-compression-benchmarking) - Compression thresholds

### Tertiary (LOW confidence)

- [ScrapeOps Node.js Proxy Guide](https://scrapeops.io/nodejs-web-scraping-playbook/nodejs-proxy-rotation/) - Proxy patterns
- [DataForSEO pricing review](https://nextgrowth.ai/dataforseo-review/) - Standard Queue pricing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified npm versions, existing implementations in codebase
- Architecture: HIGH - Builds on existing Phase 92 research and partial implementation
- Pitfalls: MEDIUM - Based on web research and documentation, not production testing

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days - stable domain)
