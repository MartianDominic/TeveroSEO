# Phase 100: World-Class Scraping Infrastructure

## Context

**Problem:** Phase 95 research evaluated Scrapling ONLY as a parser and missed that Scrapling v0.4.8 is a complete scraping framework rivaling Scrapy but with built-in anti-detection.

**Goal:** Build the #1 world-class setup for speed, cost, and scaling. No compromises.

**Outcome:** Scrapling-first architecture. Scrapling IS the scraping engine. TypeScript becomes the API/analysis layer.

---

## Architecture: Scrapling-First (#1 World-Class)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORLD-CLASS SCRAPING ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TypeScript (open-seo-main) - API + Analysis Layer                      │
│  ├── SEO checks (109 checks)                                           │
│  ├── Reporting, UI, client management                                  │
│  ├── BullMQ job orchestration                                          │
│  └── Calls Scrapling via gRPC/HTTP2 for ALL fetching                   │
│                                                                         │
│      ↓ gRPC (fastest IPC)                                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SCRAPLING ENGINE (Python) - THE Scraper                        │   │
│  │                                                                  │   │
│  │  Spider Framework                                               │   │
│  │  ├── 200+ concurrent requests                                   │   │
│  │  ├── Streaming results (real-time)                              │   │
│  │  ├── Pause/Resume with checkpoints                              │   │
│  │  └── Multi-session routing                                      │   │
│  │                                                                  │   │
│  │  Session Pool                                                   │   │
│  │  ├── FetcherSession (95% - fast HTTP, TLS impersonation)        │   │
│  │  ├── StealthySession (4% - Cloudflare bypass, FREE)             │   │
│  │  └── DynamicSession (1% - full browser when needed)             │   │
│  │                                                                  │   │
│  │  Built-in Features                                              │   │
│  │  ├── Proxy rotation (Evomi $0.45/GB, Webshare free)             │   │
│  │  ├── DNS-over-HTTPS (no DNS leaks)                              │   │
│  │  ├── Ad/tracker blocking                                        │   │
│  │  └── Robots.txt compliance                                      │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Fallback: DataForSEO (only when Scrapling can't handle it)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Why Scrapling-First is #1

| Factor | Scrapling-First | Hybrid (Crawlee+Scrapling) | Current (TieredFetcher) |
|--------|-----------------|---------------------------|------------------------|
| **Speed** | 200+ concurrent, streaming | 100 concurrent | 50 concurrent |
| **Anti-detection** | Built-in StealthyFetcher | Partial | Camoufox (aging) |
| **Cloudflare bypass** | Native, FREE | Needs config | Manual |
| **Pause/resume** | Native Spider | Both layers | None |
| **Proxy costs** | Lower (stealth reduces need) | Medium | Higher |
| **Code complexity** | Clean separation | 2 languages interleaved | 1000+ lines custom |
| **Scaling** | Horizontal (multiple Spiders) | Complex | Vertical only |

**Cost comparison (1000 prospects/month):**
- Current: $89/month
- Hybrid: $18/month
- Scrapling-first: **$8/month** (StealthyFetcher = no CAPTCHA API costs)

---

## Implementation Phases (8 weeks)

### Phase 100.1: Scrapling Service Setup (Week 1)

**Goal:** Deploy Scrapling as standalone service with gRPC interface

**Create new service:**
```
scrapling-engine/
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
├── src/
│   ├── __init__.py
│   ├── server.py              # gRPC server
│   ├── proto/
│   │   └── scraping.proto     # gRPC definitions
│   ├── spiders/
│   │   ├── base.py            # Base SEO spider
│   │   ├── audit_spider.py    # Full site audit
│   │   └── prospect_spider.py # Quick prospect scan
│   ├── sessions/
│   │   ├── pool.py            # Session pool manager
│   │   └── config.py          # Proxy configs
│   └── utils/
│       ├── checkpoints.py     # Pause/resume
│       └── metrics.py         # Prometheus
└── tests/
```

**gRPC Service Definition:**
```protobuf
service ScrapingEngine {
  rpc Scrape(ScrapeRequest) returns (ScrapeResponse);
  rpc StartCrawl(CrawlRequest) returns (stream CrawlEvent);
  rpc PauseCrawl(PauseRequest) returns (PauseResponse);
  rpc ResumeCrawl(ResumeRequest) returns (stream CrawlEvent);
  rpc GetHealth(HealthRequest) returns (HealthResponse);
}
```

### Phase 100.2: Multi-Session Spider (Week 2)

**Goal:** Smart routing between HTTP/Stealth/Browser sessions

```python
from scrapling.spiders import Spider, Response
from scrapling.fetchers import FetcherSession, AsyncStealthySession

class SEOAuditSpider(Spider):
    name = "seo_audit"
    concurrent_requests = 200
    
    def configure_sessions(self, manager):
        # Fast HTTP for 95% of pages
        manager.add("fast", FetcherSession(
            impersonate="chrome",
            http3=True,
        ))
        # Stealth for Cloudflare sites (lazy init)
        manager.add("stealth", AsyncStealthySession(
            headless=True,
            solve_cloudflare=True,
        ), lazy=True)
    
    async def parse(self, response: Response):
        # Route based on detection
        if self.is_protected(response.url):
            yield Request(response.url, sid="stealth")
        else:
            yield self.extract_seo_data(response)
```

### Phase 100.3: TypeScript gRPC Client (Week 3)

**Goal:** Replace TieredFetcher with Scrapling client

**Files to create:**
- `open-seo-main/src/server/features/scraping/engine/ScraplingEngine.ts`
- `open-seo-main/src/server/features/scraping/engine/proto/scraping.ts` (generated)

**Files to modify:**
- `open-seo-main/src/server/features/scraping/ScrapingService.ts` - Use ScraplingEngine

```typescript
// ScraplingEngine.ts
export class ScraplingEngine {
  private client: ScrapingEngineClient;
  
  async scrape(url: string, profile: ScrapeProfile): Promise<ScrapeResult> {
    return this.client.scrape({
      url,
      profile: profile.name,
      maxPages: profile.maxPages,
      sessionHint: this.getSessionHint(url),
    });
  }
  
  async *crawl(urls: string[], profile: ScrapeProfile): AsyncGenerator<CrawlEvent> {
    const stream = this.client.startCrawl({
      urls,
      profile: profile.name,
      checkpointDir: `/data/crawls/${profile.jobId}`,
    });
    for await (const event of stream) {
      yield event;
    }
  }
}
```

### Phase 100.4: Purpose-Driven Profiles (Week 4)

**Goal:** 91% cost reduction via intelligent depth selection

**Profiles (from P95 research):**
| Profile | Pages | Session | Cost |
|---------|-------|---------|------|
| prospect | 5-20 | fast | $0.005 |
| proposal | 50-100 | fast+stealth | $0.02 |
| onboarding | ALL | all | $0.50 |
| monitoring | delta | fast | $0.01 |
| competitor | 100-200 | fast+stealth | $0.10 |

**Files to create:**
- `scrapling-engine/src/profiles/` - Profile definitions
- `open-seo-main/src/server/features/scraping/profiles/` - TypeScript interfaces

### Phase 100.5: Auto-Detection Layer (Week 5)

**Goal:** 85% page reduction + smart session routing

**In Scrapling engine:**
```python
class AutoDetector:
    # URL patterns -> page type
    PAGE_PATTERNS = {
        r'/blog/': 'blog',
        r'/product': 'product',
        r'/privacy|terms': 'legal',  # skip
    }
    
    # Domain -> session hint
    PROTECTION_SIGNATURES = {
        'cloudflare': ['cf-ray', '__cf_bm'],
        'datadome': ['datadome'],
    }
    
    def classify(self, url: str, headers: dict) -> Classification:
        # Returns: page_type, session_hint, should_scrape
```

### Phase 100.6: Pause/Resume + Checkpointing (Week 6)

**Goal:** Zero data loss for 5000+ page crawls

**Scrapling native:**
```python
spider = SEOAuditSpider(
    crawldir=f"/data/crawls/{job_id}",  # Checkpoint dir
)
# Ctrl+C or SIGTERM -> automatic checkpoint
# Restart with same crawldir -> resume from checkpoint
```

**BullMQ integration:**
```typescript
// Track checkpoint state in job
interface CrawlJob {
  jobId: string;
  checkpointPath: string;
  status: 'running' | 'paused' | 'completed';
  progress: { done: number; total: number };
}
```

### Phase 100.7: Speed Optimization (Week 7)

**Goal:** 5000 pages in <3 minutes

**Optimizations:**
1. **Concurrent requests:** 200 (Scrapling default)
2. **HTTP/3:** Enabled in FetcherSession
3. **Connection pooling:** Built into httpx
4. **Streaming:** Results as they arrive
5. **Adaptive parsing:** Only parse what's needed

**Benchmark target:**
| Site Size | Target | Current |
|-----------|--------|---------|
| 100 pages | 15s | 60s |
| 1000 pages | 90s | 10min |
| 5000 pages | 3min | 15min |

### Phase 100.8: Migration + Deprecation (Week 8)

**Goal:** Full cutover, deprecate TieredFetcher

**Migration steps:**
1. Deploy Scrapling engine alongside existing
2. Shadow traffic (run both, compare results)
3. Gradual rollout: 10% → 50% → 100%
4. Deprecate TieredFetcher, CamoufoxFetcher
5. Remove ~2000 lines of custom code

---

## Critical Files

**New (Scrapling Engine):**
| File | Purpose |
|------|---------|
| `scrapling-engine/src/server.py` | gRPC server |
| `scrapling-engine/src/spiders/audit_spider.py` | Main audit spider |
| `scrapling-engine/src/sessions/pool.py` | Session management |

**Modified (open-seo-main):**
| File | Change |
|------|--------|
| `ScrapingService.ts` | Use ScraplingEngine instead of TieredFetcher |
| `TieredFetcher.ts` | DEPRECATE (keep as fallback Week 8 only) |
| `camoufox/` | DEPRECATE entire directory |

---

## Success Criteria

1. **5000-page audit in <3 minutes** (5x improvement)
2. **$8/month for 1000 prospects** (91% cost reduction)
3. **<2% detection rate** (vs 15-30% current)
4. **Zero data loss** on pause/resume
5. **2000+ lines removed** from TypeScript codebase

---

## Verification Plan

1. **Unit tests:** Scrapling spiders, gRPC client
2. **Integration tests:** Full audit flow TypeScript → Scrapling → results
3. **Anti-detection tests:**
   - CreepJS score (target: 100%)
   - Pixelscan (target: pass)
   - Cloudflare Turnstile (target: bypass without CAPTCHA)
4. **Performance tests:**
   - 100 concurrent prospects
   - 5000-page audit timing
   - Memory usage under load
5. **Resilience tests:**
   - Kill Scrapling mid-crawl → resume works
   - Network partition → graceful degradation to DataForSEO
