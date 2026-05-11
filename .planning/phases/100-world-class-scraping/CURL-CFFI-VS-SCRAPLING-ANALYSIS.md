# curl_cffi vs Scrapling: Deep Analysis

> **Investigation:** 3 Opus subagents (2026-05-11)
> **Key Finding:** Scrapling IS built on curl_cffi. They're not competing libraries.

---

## The Relationship

**Scrapling Fetcher uses curl_cffi internally.** The choice is:
1. Use curl_cffi directly (minimal)
2. Use Scrapling's wrapper around curl_cffi (more features we don't need)
3. Use Node.js alternative like got-scraping (stay in same language)

```
┌───────────────────────────────────────────────────────────────┐
│                    SCRAPLING LIBRARY                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           FETCHING LAYER (what we need)                 │ │
│  │                                                         │ │
│  │  Fetcher/AsyncFetcher ──uses──► curl_cffi               │ │
│  │                                  (TLS impersonation)    │ │
│  │                                                         │ │
│  │  StealthyFetcher ──uses──► Patchright                   │ │
│  │                            (browser automation)         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           PARSING LAYER (we DON'T need)                 │ │
│  │                                                         │ │
│  │  Selector ──uses──► lxml + cssselect                    │ │
│  │  Auto-matching ──uses──► SQLite fingerprints            │ │
│  │  Adaptive selectors (survive DOM changes)               │ │
│  │                                                         │ │
│  │  (TeveroSEO already has node-html-parser in TypeScript) │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## Comparison Table

| Aspect | curl_cffi Direct | Scrapling Fetcher | got-scraping (Node.js) |
|--------|------------------|-------------------|------------------------|
| **Language** | Python | Python | Node.js |
| **LOC for service** | 63 | ~95 | 0 (npm install) |
| **Dependencies** | 4 | 15+ | npm package |
| **TLS impersonation** | ✅ Chrome/Firefox/Safari | ✅ (via curl_cffi) | ✅ Header fingerprints |
| **HTTP/2** | ✅ | ✅ | ✅ |
| **HTTP/3** | ✅ | ✅ | ❌ |
| **Parsing included** | ❌ | ✅ (lxml) | ❌ |
| **Auto-matching** | ❌ | ✅ | ❌ |
| **Needs Python** | Yes | Yes | **No** |
| **IPC overhead** | 2-5ms | 2-5ms | **0ms** |

---

## What Each Provides

### curl_cffi (Foundation)
- TLS fingerprint impersonation (JA3/JA4)
- HTTP/2 and HTTP/3 support
- Chrome, Firefox, Safari, Edge, Tor fingerprints
- Async support via AsyncSession
- Proxy support
- Cookie handling

**Minimal curl_cffi service (63 lines):**
```python
from curl_cffi.requests import AsyncSession
from fastapi import FastAPI

app = FastAPI()

@app.post("/fetch")
async def fetch(url: str, proxy: str = None, impersonate: str = "chrome124"):
    async with AsyncSession(impersonate=impersonate) as s:
        proxies = {"https": proxy} if proxy else None
        r = await s.get(url, proxies=proxies, timeout=30)
        return {"html": r.text, "status": r.status_code, "headers": dict(r.headers)}
```

### Scrapling Adds (on top of curl_cffi)
- Stealth headers auto-generation
- Random browser selection
- Response → Selector object conversion
- Auto-matching (survive DOM changes)
- Adaptive selectors (SQLite storage)
- StealthyFetcher (Patchright browser)

**Most of these are NOT needed for SEO scraping:**
- Auto-matching: SEO targets standard HTML (`<title>`, `<meta>`, `<h1>`)
- Adaptive selectors: Not needed, our selectors are stable
- Parsing layer: We use node-html-parser in TypeScript

### got-scraping (Node.js Alternative)
- Fingerprint-based header generation
- Browser-like request headers
- **Same language as TeveroSEO**
- No Python dependency
- No IPC overhead

```typescript
import { gotScraping } from 'got-scraping';

const response = await gotScraping({
  url,
  headerGeneratorOptions: {
    browsers: ['chrome'],
    operatingSystems: ['linux'],
  },
});
```

---

## TeveroSEO Analysis

### What We Need
1. **TLS fingerprint impersonation** at T0-T2 to avoid detection
2. **Higher success rate** = fewer escalations to expensive tiers
3. **Self-hosted** = $0 infrastructure cost

### What We DON'T Need
1. Scrapling's parsing layer (we have node-html-parser)
2. Auto-matching / adaptive selectors (SEO selectors are stable)
3. StealthyFetcher (we have Camoufox at T2.5, which is better: 88% vs 58%)

### Options Ranked

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **got-scraping** | Node.js native, 0 IPC | Less TLS impersonation depth | **Best for simplicity** |
| **curl_cffi direct** | Full TLS impersonation, minimal | Python dependency | **Best for anti-detection** |
| **Scrapling** | More features | 15+ dependencies, overhead | Overkill |

---

## Recommendation

### Option A: Try got-scraping First (Node.js Native)

```bash
npm install got-scraping
```

```typescript
// DirectFetcher.ts - Replace native fetch with got-scraping
import { gotScraping } from 'got-scraping';

async fetch(url: string, options: FetchOptions): Promise<FetchResult> {
  const response = await gotScraping({
    url,
    timeout: { request: options.timeout || 15000 },
    proxyUrl: options.proxy,
    headerGeneratorOptions: {
      browsers: ['chrome'],
      devices: ['desktop'],
      locales: ['en-US'],
    },
  });
  
  return {
    html: response.body,
    statusCode: response.statusCode,
    headers: response.headers,
  };
}
```

**Pros:** No Python, no IPC, same language stack.
**Cons:** Not as deep TLS impersonation as curl_cffi.

### Option B: curl_cffi Direct (If got-scraping Insufficient)

If got-scraping doesn't improve success rates enough:

```python
# Minimal 63-line FastAPI service
from curl_cffi.requests import AsyncSession
from fastapi import FastAPI

app = FastAPI()

@app.post("/fetch")
async def fetch(url: str, proxy: str = None):
    async with AsyncSession(impersonate="chrome124") as s:
        r = await s.get(url, proxies={"https": proxy} if proxy else None)
        return {"html": r.text, "status": r.status_code}
```

**Pros:** Best TLS impersonation available.
**Cons:** Python dependency, 2-5ms IPC.

### NOT Recommended: Scrapling

**Why not Scrapling:**
- 15+ dependencies vs 4 for curl_cffi
- 620KB framework vs 63 lines
- Parsing layer we don't use
- Auto-matching we don't need
- Same curl_cffi underneath anyway

---

## Updated Phase 100 Plan

### Week 1: Concurrency + got-scraping
1. Change `concurrency ?? 10` → `concurrency ?? 200`
2. Install `got-scraping` npm package
3. Replace `fetch()` with `gotScraping()` in DirectFetcher
4. Benchmark success rate improvement

### Week 2: Evaluate Results
- If got-scraping improves T0 success by 15%+ → Done
- If not → Add curl_cffi Python microservice

### Week 3-4: Parser + Streaming (unchanged)

---

## Summary

| Question | Answer |
|----------|--------|
| **curl_cffi vs Scrapling?** | Same TLS layer - Scrapling wraps curl_cffi |
| **Which to use?** | curl_cffi directly (simpler) |
| **Even better option?** | got-scraping (Node.js native) |
| **Scrapling's value?** | Parsing + auto-matching (NOT needed for TeveroSEO) |
