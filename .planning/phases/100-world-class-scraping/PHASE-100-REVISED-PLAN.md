# Phase 100: World-Class Scraping Infrastructure - REVISED PLAN

> **Revision v2:** Based on 6 Opus subagent deep investigation (2026-05-11)
> **Key Finding:** Replace httpx with Scrapling Fetcher (HTTP + TLS fingerprinting) at T0-T2. Keep Camoufox only for JS challenges.

---

## Executive Summary

**Original hypothesis:** Scrapling's better anti-detection would reduce retries and save money.

**Investigation result:** CORRECT - but we were comparing the wrong things.

- **Scrapling StealthyFetcher (browser):** 58% success - WORSE than Camoufox (88%)
- **Scrapling Fetcher (HTTP + curl_cffi):** 85-94% success - BETTER than httpx (~10% on protected sites)

The fix is replacing httpx at the HTTP layer (T0-T2), NOT replacing Camoufox at the browser layer (T2.5).

**Real bottlenecks:**
1. **httpx at T0-T2 gets TLS fingerprinted** → Replace with Scrapling Fetcher (curl_cffi)
2. **Concurrency set to 10** (should be 200-300)
3. **Cheerio parsing at 12ms** (node-html-parser = 2ms)
4. **Batch processing** (should stream to RAG)

---

## Architecture Decision: Scrapling HTTP at T0-T2, Keep Camoufox at T2.5

**Replace httpx with Scrapling Fetcher for HTTP requests. Keep Camoufox for JS challenges.**

| Tier | Current | Proposed | Why |
|------|---------|----------|-----|
| T0-T2 | httpx (gets JA3 fingerprinted) | Scrapling Fetcher (curl_cffi) | TLS fingerprint impersonation |
| T2.5 | Camoufox | Keep Camoufox | Best for JS challenges (88%) |
| T3-T5 | DataForSEO | Keep DataForSEO | Rare fallback |

**Why Scrapling Fetcher at HTTP layer:**
- Uses `curl_cffi` under the hood (TLS fingerprint impersonation)
- Mimics Chrome/Firefox/Safari JA3/JA4 fingerprints
- httpx uses Python OpenSSL → JA3 fingerprint is in every bot database
- Success rate: httpx ~10% vs Scrapling Fetcher ~85-94% on TLS-protected sites

**Why keep Camoufox at T2.5:**
- Scrapling StealthyFetcher (browser) has 58% success
- Camoufox has 88% success (C++ Firefox modifications)
- Camoufox still best for JavaScript challenges, Cloudflare Turnstile

Source: ZenRows 2026 benchmark, curl_cffi documentation, BrightData research.

---

## Revised Implementation Plan (5 Weeks)

### Week 1: Scrapling Fetcher Integration (HTTP Layer)

**Goal:** Replace httpx with Scrapling Fetcher at T0-T2 for TLS fingerprint impersonation

**Architecture change:**
```
BEFORE:
T0: undici/httpx → JA3 fingerprinted → ~10% success on protected sites

AFTER:
T0: Scrapling Fetcher (curl_cffi) → Chrome TLS fingerprint → ~85-94% success
```

**Implementation:**

Create Python microservice for Scrapling HTTP fetching:
```python
# scrapling-engine/src/http_fetcher.py
from scrapling.fetchers import Fetcher, AsyncFetcher

class ScraplingHttpService:
    async def fetch(self, url: str, proxy: str = None) -> dict:
        fetcher = AsyncFetcher(
            impersonate="chrome146",  # Latest Chrome TLS fingerprint
            stealthy_headers=True,
            timeout=15,
        )
        if proxy:
            fetcher.proxies = {"http": proxy, "https": proxy}
        
        response = await fetcher.get(url)
        return {
            "html": response.text,
            "status": response.status_code,
            "headers": dict(response.headers),
        }
```

**TypeScript integration via HTTP or gRPC:**
```typescript
// TieredFetcher.ts - T0 tier modification
async fetchT0(url: string): Promise<FetchResult> {
  // Replace undici with Scrapling HTTP service
  const response = await this.scraplingClient.fetch(url);
  return response;
}
```

**Files to create:**
- `scrapling-engine/` - Python microservice directory
- `scrapling-engine/src/http_fetcher.py` - Scrapling Fetcher wrapper
- `scrapling-engine/src/server.py` - FastAPI or gRPC server
- `scrapling-engine/Dockerfile` - Container for deployment

**Files to modify:**
- `TieredFetcher.ts` - Call Scrapling service instead of undici at T0-T2

**Success metric:** T0-T2 success rate increases from ~70% to ~90%

### Week 2: Concurrency Optimization

**Goal:** 3-4x speed improvement via config changes

**Changes:**
1. `TieredFetcher.ts` line 637: Change `concurrency ?? 10` to `concurrency ?? 200`
2. Test with Geonode rate limits (user suspects this is the real bottleneck)
3. Add per-domain rate limiting to prevent IP bans
4. Monitor circuit breaker trips

**Files to modify:**
- `open-seo-main/src/server/features/scraping/TieredFetcher.ts`
- `open-seo-main/src/server/features/scraping/config.ts`

**Success metric:** 5000 pages in <5 minutes (down from ~15 min)

### Week 3: Parser Migration

**Goal:** 6x parse speed via node-html-parser

**Migration order (10 critical files):**

| Priority | File | Complexity | Parse calls/page |
|----------|------|------------|------------------|
| 1 | `page-analyzer.ts` | LOW | 12+ |
| 2 | `template-hash.ts` | LOW | 4 |
| 3 | `ScrapingService.ts#parseHtml()` | LOW | 1 |
| 4 | `ChunkExtractor.ts` | MEDIUM | 2 |
| 5 | `PlatformDetector.ts` | MEDIUM | 4 |

**Keep Cheerio for complex DOM:**
- `link-extractor.ts` - uses `.parents()` traversal
- `VerticalClassifier.ts` - uses `.clone()` pattern
- `runner.ts` - shared context for 109 checks

**Success metric:** Parse time <3ms/page average

### Week 4: Streaming Architecture

**Goal:** Real-time RAG ingestion, lower memory, faster proposals

**Architecture:**

```
BEFORE (batch):
Fetch ALL 5000 → Parse ALL → Store ALL → RAG

AFTER (streaming):
Fetch 100 → Parse → Stream to RAG → Repeat
     ↓              ↓
 [BullMQ]    [Redis Stream]
```

**New components:**
- `StreamingBatchConfig` interface in QueueOrchestrator
- Redis Stream for parsed page events
- RAG consumer reading from stream

**Memory improvement:** 2.5GB peak → <500MB peak

**Success metric:** Proposals can generate while scrape still running

### Week 5: Worker Thread Parallelization + Polish

**Goal:** 4-8x parse throughput via multi-core

**Implementation:**
```typescript
// worker-pool.ts
const WORKER_COUNT = cpus().length; // 8 on Contabo
const pool = Array.from({ length: WORKER_COUNT }, () => 
  new Worker('./parse-worker.js')
);
```

**Benefits:**
- Parse 8 pages simultaneously on 8-core VPS
- Main thread stays responsive for HTTP handling
- Graceful degradation on lower-core machines

**Success metric:** 5000 pages in <3 minutes total

---

## Cost Model (SIGNIFICANTLY IMPROVED)

**Key insight:** Scrapling Fetcher at T0-T2 reduces Camoufox/DataForSEO usage by ~70%

| Scenario | Camoufox Usage | DataForSEO Usage | Cost/5000 pages |
|----------|----------------|------------------|-----------------|
| **Current (httpx at T0-T2)** | ~20% | ~10% | ~$2.60 |
| **Scrapling HTTP at T0-T2** | ~5% | ~3% | ~$0.80 |

**Savings: 70% reduction in scraping costs**

| Stage | Current Cost | New Cost | Notes |
|-------|-------------|----------|-------|
| Prospect scrape (5000 pages) | ~$0.15 | ~$0.05 | Less fallback to expensive tiers |
| Keyword Intelligence | ~$0.05 | ~$0.05 | Unchanged |
| Technical audit (client) | ~$0.15 | ~$0.10 | Less fallback |
| **Total per conversion** | **~$0.35** | **~$0.20** | **43% savings** |

**At 100 prospects/month:** $35 → $20 = **$15/month savings**
**At 1000 prospects/month:** $350 → $200 = **$150/month savings**

---

## Success Criteria

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| 5000-page scrape | ~15 min | <3 min | Concurrency + streaming |
| Parse time/page | 12ms | 2ms | node-html-parser |
| Memory peak | 2.5GB | <500MB | Streaming batches |
| Detection rate | 12% fallback | Maintain | Keep Camoufox |

---

## Files NOT Changing

- `CamoufoxFetcher.ts` - Keep, it works (88% success)
- Tiered escalation logic - Keep, optimized over time
- DataForSEO integration - Keep as fallback
- Proxy provider wrappers - Keep Geonode + Webshare

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Geonode rate limits at high concurrency | Start at 100, monitor, increase gradually |
| node-html-parser selector incompatibility | Keep Cheerio for complex DOM files |
| Streaming complexity | Use Redis Streams (proven pattern) |
| Worker thread overhead | Measure, fall back to single-thread if <10% gain |

---

## What We Learned

1. **Benchmark data matters:** Scrapling's marketing claims don't match ZenRows testing
2. **Camoufox is best-in-class:** C++ Firefox modifications can't be matched by JS patches
3. **The bottleneck was config:** `concurrency=10` was the problem, not the framework
4. **Parser overhead is real:** 12ms × 5000 = 60 seconds just for parsing

---

## References

- ZenRows 2026 Stealth Browser Benchmark
- TieredFetcher.ts line 637 (`concurrency ?? 10`)
- HIGH-SCALE-SCRAPING-ARCHITECTURE.md (100K pages/hour target)
- CHEERIO-SYSTEM-ANALYSIS.md (30 files using Cheerio)
