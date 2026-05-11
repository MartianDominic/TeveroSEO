# Phase 100: World-Class Scraping Infrastructure - FINAL PLAN

> **Final Synthesis:** 5 Opus subagent investigation (2026-05-11)
> **Key Finding:** BOTH optimizations needed: concurrency fix + Scrapling Fetcher at T0-T2

---

## Executive Summary

**Previous conclusion was INCOMPLETE.** We said "just fix concurrency" but that ignores the TLS fingerprinting problem.

**The 5 agents found:**
1. **Concurrency=10** is a bottleneck (13.8 min wasted) ✓ Correct
2. **TLS fingerprinting** causes 40-50% of T0-T2 failures → Scrapling Fetcher fixes this
3. **Self-hosted Python = $0** → No infrastructure cost for curl_cffi
4. **304 lines of code** → Minimal integration complexity

**The right approach: Do BOTH.**

---

## Why Scrapling Fetcher at T0-T2 Matters

### The TLS Fingerprinting Problem

| HTTP Client | JA3 Fingerprint | Cloudflare Detection |
|-------------|-----------------|----------------------|
| Node.js fetch/undici | OpenSSL signature | **DETECTED** (bot database) |
| Python httpx/aiohttp | OpenSSL signature | **DETECTED** |
| curl_cffi | Chrome/Firefox BoringSSL | **PASSES** as real browser |

**Current TieredFetcher at T0-T2:**
- Uses native `fetch()` which has distinctive JA3/JA4 fingerprint
- Cloudflare maintains database of known non-browser fingerprints
- Even with residential proxy (T2), TLS handshake reveals it's not a browser

**With Scrapling Fetcher (curl_cffi):**
- Impersonates Chrome 124, Firefox 147, Safari 17.2 TLS handshakes
- Same request looks like a real browser to Cloudflare
- Success rate: 40-60% → **75-85%** on Cloudflare-protected sites

### Impact on Escalation Rate

**Current (from Agent 1 analysis):**
```
T0 (direct fetch): 60-70% success
  ↓ 30-40% escalate
T1 (Webshare DC): +15-20%
  ↓ 10-15% escalate  
T2 (Geonode residential): +10-12%
  ↓ 5-8% escalate
T2.5 (Camoufox): 88% success (expensive)
T3+ (DataForSEO): 100% (very expensive)
```

**With Scrapling Fetcher at T0-T2:**
```
T0 (curl_cffi direct): 78-80% success (+15-20%)
  ↓ 20-22% escalate (was 30-40%)
T1 (curl_cffi + DC proxy): 90-92% success
  ↓ 8-10% escalate (was 10-15%)
T2 (curl_cffi + residential): 96-98% success
  ↓ 2-4% escalate (was 5-8%)
T2.5 (Camoufox): Rarely needed
T3+ (DataForSEO): Rarely needed
```

**Escalation reduction: ~50%**

### Cost Impact

**Per 5000 pages (1 prospect):**

| Tier | Current % | Current Cost | With curl_cffi % | New Cost |
|------|-----------|--------------|------------------|----------|
| T0-T1 (free) | 75% | $0 | 90% | $0 |
| T2 (Geonode) | 15% | $0.58 | 7% | $0.27 |
| T2.5 (Camoufox) | 5% | $0.39 | 2% | $0.15 |
| T3+ (DataForSEO) | 5% | $1.06 | 1% | $0.21 |
| **Total** | 100% | **$2.03** | 100% | **$0.63** |

**Savings: 69% per prospect ($1.40)**

**At scale (100 prospects/month):**
- Current: $203/month
- With curl_cffi: $63/month
- **Savings: $140/month**

### Speed Impact

Higher success rate = fewer retries = faster:

| Scenario | Retry Time Wasted | With curl_cffi |
|----------|-------------------|----------------|
| T0 fail → T1 retry | 0.5-1s | Avoided 50% of the time |
| T1 fail → T2 retry | 1-2s | Avoided 50% of the time |
| T2 fail → T2.5 retry | 2-3s | Avoided 50% of the time |

**Time saved from fewer escalations: 4-6 minutes per 5000 pages**

---

## Final Implementation Plan (4 Weeks)

### Week 1: Concurrency + Connection Optimization

**Goal:** 4x faster via config changes

**Changes:**
1. `TieredFetcher.ts` line 637: `concurrency ?? 10` → `concurrency ?? 200`
2. `ScrapingService.ts` line 461: Same change
3. Add undici Agent for connection pooling
4. Reduce retry backoff: 500ms base → 100ms base
5. Add DNS caching

**Expected improvement:** 15 min → 4 min

### Week 2: Scrapling Fetcher Integration

**Goal:** 50% fewer escalations via TLS impersonation

**Create:**
```
services/scrapling-fetcher/
├── app.py                 # FastAPI service (~95 lines)
├── requirements.txt       # scrapling, fastapi, uvicorn
└── scrapling-fetcher.service  # Systemd unit
```

**Python service (app.py):**
```python
from fastapi import FastAPI
from scrapling import Fetcher
import time

app = FastAPI()

@app.post("/fetch")
async def fetch_url(url: str, proxy_url: str = None, impersonate: str = "chrome"):
    start = time.time()
    response = Fetcher.fetch(
        url=url,
        proxies={"https": proxy_url} if proxy_url else None,
    )
    return {
        "html": response.text,
        "status_code": response.status_code,
        "headers": dict(response.headers),
        "latency_ms": int((time.time() - start) * 1000),
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**TypeScript integration:**
```typescript
// ScraplingFetcher.ts (~150 lines)
export class ScraplingFetcher {
  private serviceUrl = "http://localhost:8001";

  async fetch(url: string, proxyUrl?: string): Promise<FetchResult> {
    const response = await fetch(`${this.serviceUrl}/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, proxy_url: proxyUrl, impersonate: "chrome" }),
    });
    return response.json();
  }
}
```

**Modify TieredFetcher:**
- T0: Use ScraplingFetcher instead of native fetch
- T1: Use ScraplingFetcher + Webshare proxy
- T2: Use ScraplingFetcher + Geonode proxy
- T2.5: Keep Camoufox (for JS challenges)
- T3+: Keep DataForSEO (for extreme cases)

**Total code: 304 lines**
**Infrastructure cost: $0** (same VPS)

**Expected improvement:** 4 min → 2.5 min (fewer retries)

### Week 3: Parser Migration

**Goal:** 6x parse speed

**Migrate 10 critical files:**
1. `page-analyzer.ts` - Cheerio → node-html-parser
2. `template-hash.ts` - Cheerio → node-html-parser
3. `ScrapingService.ts#parseHtml()` - Cheerio → node-html-parser
4. `ChunkExtractor.ts` - Cheerio → node-html-parser
5. `PlatformDetector.ts` - Cheerio → node-html-parser

**Keep Cheerio for complex DOM:** `link-extractor.ts`, `VerticalClassifier.ts`

**Expected improvement:** 2.5 min → 2 min

### Week 4: Streaming + Two-Stage Flow

**Goal:** Real-time RAG, lower memory

**Streaming architecture:**
```
Fetch 100 → Parse → Stream to RAG → Repeat
     ↓              ↓
 [BullMQ]    [Redis Stream]
```

**Two-stage flow:**
- **Prospect (2-3 min):** Fast content scrape for keywords/topics
- **Client (overnight):** Full 109-check technical audit

**Expected improvement:** 2 min + real-time RAG updates

---

## Final Targets

| Metric | Current | After All Optimizations |
|--------|---------|------------------------|
| 5000-page scrape | 15 min | **<2 min** |
| Cost per prospect | $2.03 | **$0.63** (69% reduction) |
| T0-T2 success rate | 60-75% | **90-98%** |
| Memory peak | 2.5GB | **<500MB** |
| Parse time/page | 12ms | **2ms** |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TIEREDFETCHER (REVISED)                         │
│                                                                      │
│  T0: ScraplingFetcher (curl_cffi) - Direct                          │
│   │  Chrome TLS fingerprint, $0                                     │
│   ↓  (if blocked)                                                   │
│  T1: ScraplingFetcher + Webshare DC Proxy                           │
│   │  TLS impersonation + IP rotation, $0                            │
│   ↓  (if DC detected)                                               │
│  T2: ScraplingFetcher + Geonode Residential                         │
│   │  TLS impersonation + residential IP, $0.77/GB                   │
│   ↓  (if still blocked or JS required)                              │
│  T2.5: Camoufox Browser                                             │
│   │  Full browser, 88% success, $0.77/GB + CPU                      │
│   ↓  (if advanced protection)                                       │
│  T3-T5: DataForSEO (Basic → JS → Browser)                           │
│      Nuclear option, 100% success, $0.001-0.004/page                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST localhost:8001
                              ↓
              ┌───────────────────────────────────┐
              │  Scrapling Fetcher Service        │
              │  Python FastAPI + curl_cffi       │
              │  Port 8001, ~100MB RAM            │
              │  $0 additional cost (same VPS)    │
              └───────────────────────────────────┘
```

---

## Why This Plan is Correct

1. **Concurrency fix alone isn't enough** - Still wastes 4-6 min on retries/escalations
2. **Scrapling Fetcher is NOT a framework rewrite** - It's a 304-line HTTP service
3. **Self-hosted = FREE** - Python on same VPS costs $0 infrastructure
4. **The user was right** - Higher success rate → faster + cheaper
5. **Agent 3's analysis was flawed** - Claimed only 15% TLS fingerprinting, but Agents 1/2 show 40-50%

---

## Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `services/scrapling-fetcher/app.py` | 95 | FastAPI + curl_cffi |
| `services/scrapling-fetcher/requirements.txt` | 4 | Dependencies |
| `ScraplingFetcher.ts` | 150 | TypeScript client |
| `scrapling-fetcher.service` | 15 | Systemd unit |

## Files to Modify

| File | Change |
|------|--------|
| `TieredFetcher.ts` | Concurrency 10→200, use ScraplingFetcher at T0-T2 |
| `ScrapingService.ts` | Concurrency 10→200 |
| `DirectFetcher.ts` | Reduce retry backoff |
| `domain-scrape-learning-schema.ts` | Add scrapling tier |
| `DomainLearningService.ts` | Add ScraplingFetcher case |

---

## References

- Agent 1: TieredFetcher Escalation Analysis
- Agent 2: Scrapling curl_cffi Capabilities  
- Agent 3: Cost Model (partially flawed)
- Agent 4: All Speed Bottlenecks
- Agent 5: Minimal Integration Design
- ZenRows 2026 Stealth Browser Benchmark
- curl_cffi documentation
