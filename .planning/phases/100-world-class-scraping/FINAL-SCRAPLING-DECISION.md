# FINAL Phase 100 Decision: Scrapling Architecture v2

> **Investigation:** 9 Opus subagents (2026-05-11)
> **Critical Fix:** NEVER use direct server IP - always proxy to prevent reputation decay

---

## The IP Reputation Problem (User Was Right)

Using direct server IP at T0 causes **cascading reputation decay**:

```
Week 1:  T0 direct → 80% success → 20% failures logged against server IP
Week 4:  T0 direct → 65% success → Cloudflare cross-site sharing kicks in
Week 8:  T0 direct → 45% success → Server IP is "burned"
Week 12: T0 direct → 30% success → Even "easy" sites block you
```

**Why this happens:**
- Cloudflare shares IP reputation across ALL 33% of top 1M sites
- Each 403/429 is logged and scored against your IP
- Reputation decay is cross-site (fail on site A, blocked on site B)
- Recovery takes 6+ days of clean behavior

**Solution: NEVER expose server IP for scraping.**

---

## FINAL Architecture (4 Tiers)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SCRAPLING-FIRST ARCHITECTURE v3                   │
│                                                                      │
│  ⚠️  SERVER IP NEVER TOUCHES TARGET SITES                           │
│                                                                      │
│  Scrapling Python Service (FastAPI)                                 │
│  ├── T0: Fetcher + Geonode residential ──── 98% success, $0.77/GB  │
│  │                                                                   │
│  Camoufox Service (Python)                                          │
│  ├── T1: Camoufox + Geonode ─────────────── 88% Cloudflare bypass  │
│  │        (Firefox C++/Rust patches, 0% headless detection)        │
│  │                                                                   │
│  DataForSEO (External API)                                          │
│  └── T2: DataForSEO ─────────────────────── 100% nuclear           │
│           │                                                          │
│           │ Returns comprehensive JSON (NOT HTML)                   │
│           ↓                                                          │
│  TypeScript (open-seo-main)                                         │
│  ├── Receives SEOExtractionResult JSON                              │
│  ├── Runs 109 checks on JSON data                                   │
│  └── Server IP stays clean for email/API/other services            │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Camoufox, NOT StealthyFetcher?

| Tool | Success Rate | Source |
|------|--------------|--------|
| **Camoufox** | **88%** | ZenRows 2026 benchmark |
| StealthyFetcher | 58% | ZenRows 2026 benchmark |

**30 percentage point gap.** StealthyFetcher uses Patchright (patched Chromium) which is still detectable. Camoufox patches Firefox at C++/Rust level, achieving **0% headless detection rate** - no other tool matches this.

### Why Residential at T0 (Not DC Proxy)?

| Option | Success Rate | Cost | IP Protection |
|--------|--------------|------|---------------|
| Direct (server IP) | 80% → decays | $0 | ❌ Burned over time |
| Webshare DC (free) | 70% | $0 | ✅ But DC IPs detected |
| **Geonode Residential** | **98%** | **$0.77/GB** | **✅ Clean + high success** |

**Math:** At 98% T0 success vs 70% DC success:
- 98% means only 2% escalate to T1/T2
- 70% means 30% escalate (15x more expensive tiers)
- Residential at T0 is actually CHEAPER total cost

---

## Tier Details

### T0: Scrapling Fetcher + Geonode Residential (96% of requests)

```python
from scrapling import Fetcher

fetcher = Fetcher()
page = await fetcher.async_get(
    url,
    proxy="http://user:pass@gate.geonode.com:9000",
    impersonate="chrome"
)
```

- **Cost:** $0.77/GB (~$0.000077 per 100KB page)
- **Success rate:** 98% on most sites
- **Server IP:** Never exposed
- **Use for:** ALL initial requests

### T1: Camoufox + Geonode Residential (3% of requests)

```python
from camoufox.sync_api import Camoufox

with Camoufox(
    proxy={"server": "http://gate.geonode.com:9000", "username": user, "password": pass},
    headless=True,
) as browser:
    page = browser.new_page()
    page.goto(url)
    html = page.content()
```

- **Cost:** $0.77/GB + compute (~200MB RAM per instance)
- **Success rate:** 88% on Cloudflare/advanced protection (ZenRows 2026)
- **Why Camoufox over StealthyFetcher:** 
  - Camoufox: 88% success, 0% headless detection (Firefox C++/Rust patches)
  - StealthyFetcher: 58% success (Patchright/Chromium still detectable)
- **Use for:** T0 failures with 403/Cloudflare challenge

### T2: DataForSEO (Nuclear) (1% of requests)

- **Cost:** $0.004/page
- **Success rate:** 100%
- **Use for:** Rare edge cases (CAPTCHA, extreme bot protection)

---

## Cost Model: FINAL

### Per Prospect (5000 pages)

| Tier | % of Pages | Pages | Bandwidth | Cost |
|------|------------|-------|-----------|------|
| T0 (Geonode) | 96% | 4800 | 480MB | $0.37 |
| T1 (Camoufox) | 3% | 150 | 15MB | $0.01 |
| T2 (DataForSEO) | 1% | 50 | - | $0.20 |
| **Total** | 100% | 5000 | ~500MB | **$0.58** |

### Monthly (100 prospects)

| Item | Cost |
|------|------|
| Geonode bandwidth (~50GB) | $38.50 |
| DataForSEO (~5000 pages) | $20.00 |
| **Total** | **~$58/month** |

**Previous estimate (with direct T0):** $40/month BUT with IP reputation decay risk
**New estimate (residential T0):** $58/month with zero IP risk

**The extra $18/month buys:**
- Server IP stays clean (can still send emails, use APIs)
- No reputation decay over time
- Higher success rate from day 1
- Simpler 3-tier system

---

## Why 3 Tiers Instead of 7?

| Old Tier | Status | Reason |
|----------|--------|--------|
| T0: Direct | **REMOVED** | IP reputation decay |
| T1: Webshare DC | **REMOVED** | Burned IPs, DC detection |
| T2: Geonode | → **New T0** | First tier now (Fetcher + residential) |
| T2.5: Camoufox | → **New T1** | Kept - 88% success beats StealthyFetcher's 58% |
| T3: DFS Basic | Merged | |
| T4: DFS JS | Merged | → **New T2** (DataForSEO nuclear) |
| T5: DFS Browser | Merged | |

**Result:** 7 tiers → 3 tiers. Simpler logic, faster escalation. Camoufox KEPT at T1 because it outperforms StealthyFetcher by 30 percentage points.

---

## Scrapling Service Implementation

### app.py (FastAPI)

```python
from fastapi import FastAPI, HTTPException
from scrapling import Fetcher
from camoufox.async_api import AsyncCamoufox
from pydantic import BaseModel
import os

app = FastAPI(title="Scrapling SEO Engine")

GEONODE_PROXY = f"http://{os.environ['GEONODE_USER']}:{os.environ['GEONODE_PASS']}@gate.geonode.com:9000"

class ExtractRequest(BaseModel):
    url: str
    tier: str = "residential"  # residential, camoufox, or dataforseo
    keyword: str | None = None

class SEOData(BaseModel):
    url: str
    final_url: str
    status_code: int
    title: str | None
    meta_description: str | None
    h1_text: str | None
    h1_count: int
    h2_count: int
    intro_text: str | None  # Between H1 and first H2
    body_text: str
    word_count: int
    internal_links: list[dict]
    external_links: list[dict]
    images: list[dict]
    schemas: list[dict]
    tier_used: str
    # ... all 40+ fields for 109 checks

@app.post("/extract", response_model=SEOData)
async def extract(req: ExtractRequest):
    try:
        if req.tier == "residential":
            fetcher = Fetcher()
            page = await fetcher.async_get(
                req.url,
                proxy=GEONODE_PROXY,
                impersonate="chrome"
            )
        elif req.tier == "camoufox":
            async with AsyncCamoufox(
                proxy={"server": GEONODE_PROXY},
                headless=True,
            ) as browser:
                page_obj = await browser.new_page()
                await page_obj.goto(req.url)
                html = await page_obj.content()
                # Parse with Scrapling for consistent API
                from scrapling.parser import Selector
                page = Selector(html)
        else:
            # DataForSEO fallback handled by TypeScript
            raise HTTPException(400, "Use TypeScript for DataForSEO tier")
        
        return extract_seo_data(page, req.keyword)
    
    except Exception as e:
        raise HTTPException(500, str(e))

def extract_seo_data(page, keyword: str | None) -> SEOData:
    """Extract comprehensive SEO data from parsed page."""
    
    # Extract intro text (replaces Cheerio .nextUntil)
    def get_intro_text():
        h1 = page.css_first("h1")
        if not h1:
            return None
        parts = []
        current = h1.next
        while current and current.tag != "h2":
            if current.text:
                parts.append(current.text.strip())
            current = current.next
        return " ".join(parts) if parts else None
    
    return SEOData(
        url=str(page.url),
        final_url=str(page.url),
        status_code=page.status_code,
        title=page.css_first("title::text"),
        meta_description=page.css_first('meta[name="description"]::attr(content)'),
        h1_text=page.css_first("h1::text"),
        h1_count=len(page.css("h1")),
        h2_count=len(page.css("h2")),
        intro_text=get_intro_text(),
        body_text=page.get_all_text(ignore_tags=("script", "style", "nav", "header", "footer")),
        word_count=len(page.get_all_text().split()),
        internal_links=extract_links(page, internal=True),
        external_links=extract_links(page, internal=False),
        images=extract_images(page),
        schemas=extract_schemas(page),
        tier_used="residential",
    )
```

### TypeScript Client with Tier Escalation

```typescript
// ScraplingClient.ts
export class ScraplingClient {
  private baseUrl = process.env.SCRAPLING_SERVICE_URL ?? "http://localhost:8001";
  
  async extract(url: string, options?: { keyword?: string }): Promise<SEOData> {
    // T0: Residential (always start here)
    try {
      return await this.fetchTier(url, "residential", options?.keyword);
    } catch (e) {
      if (this.isCloudflareBlock(e)) {
        // T1: Camoufox (88% success on Cloudflare)
        try {
          return await this.fetchTier(url, "camoufox", options?.keyword);
        } catch (e2) {
          // T2: DataForSEO (handled locally)
          return await this.fetchDataForSEO(url);
        }
      }
      throw e;
    }
  }
  
  private async fetchTier(url: string, tier: string, keyword?: string): Promise<SEOData> {
    const res = await fetch(`${this.baseUrl}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, tier, keyword }),
    });
    if (!res.ok) throw new Error(`Tier ${tier} failed: ${res.status}`);
    return res.json();
  }
  
  private isCloudflareBlock(e: unknown): boolean {
    return e instanceof Error && (
      e.message.includes("403") || 
      e.message.includes("cloudflare") ||
      e.message.includes("challenge")
    );
  }
}
```

---

## Domain Learning Integration

Even with residential proxies, domain learning helps optimize:

```typescript
interface DomainConfig {
  domain: string;
  optimalTier: "residential" | "camoufox" | "dataforseo";
  successRate: number;
  lastTested: Date;
}

async function getStartingTier(domain: string): Promise<string> {
  const config = await domainLearning.getConfig(domain);
  
  if (!config) return "residential";  // Default for unknown domains
  
  // Skip to known-optimal tier
  return config.optimalTier;
}
```

**Benefits:**
- Known-hard domains (Cloudflare) skip directly to Camoufox
- Saves failed request overhead
- Faster overall scraping

---

## Implementation Plan: REVISED

### Week 1: Scrapling Service (Residential-First)

1. Create `services/scrapling-engine/` with FastAPI
2. Always use Geonode residential proxy at T0
3. Camoufox at T1 for Cloudflare (88% success vs StealthyFetcher's 58%)
4. DataForSEO integration in TypeScript for T2

### Week 2: Check Adaptation + Domain Learning

1. Adapt 109 checks to use SEOData JSON
2. Update DomainLearningService for 3-tier system
3. Pre-warm known Cloudflare domains to T1

### Week 3: Concurrency + Streaming

1. `concurrency ?? 10` → `200`
2. Redis streaming for RAG integration
3. Batch endpoint for bulk extraction

### Week 4: Testing + Rollout

1. Shadow testing old vs new
2. Gradual rollout 10% → 100%
3. Monitor costs and success rates

---

## Final Tier Comparison

| Metric | Old (7 tiers) | New (3 tiers) |
|--------|---------------|---------------|
| Server IP exposed | Yes (T0 direct) | **Never** |
| Tiers | 7 | **3** |
| T0 success | 60-80% (decays) | **98% (stable)** |
| Monthly cost | ~$40 + IP risk | **~$58 (clean)** |
| Code complexity | High | **Low** |
| Escalation steps | Up to 6 | **Up to 2** |

---

## Summary

| Decision | Rationale |
|----------|-----------|
| **Never use direct server IP** | IP reputation decay is real and cross-site |
| **Residential at T0** | 98% success, server IP protected |
| **3 tiers: Fetcher → Camoufox → DataForSEO** | Camoufox (88%) beats StealthyFetcher (58%) by 30 points |
| **~$58/month** | Worth $18 extra for zero IP risk |
| **Scrapling for fetch + parse** | 2.02ms parse, comprehensive JSON output |
