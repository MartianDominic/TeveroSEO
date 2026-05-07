# World-Class Web Scraping Architecture
## DARPA-Level Infrastructure for Billion-Page Crawling at Minimal Cost

**Research Date:** May 2026  
**Objective:** Reverse-engineer how Ahrefs, SEMrush, Moz, Screaming Frog, and Sitebulb achieve massive-scale scraping at fractions of a cent per page

---

## Executive Summary

World-class SEO companies crawl **billions of pages** while charging **$99-999/month**. Their per-page cost is **$0.0000001 - $0.000001** — roughly **30,000x cheaper** than using DataForSEO or commercial APIs at scale.

**Key Insight:** The secret is NOT fancy technology — it's **owning the infrastructure** and **intelligent routing** (98% simple HTTP fetch, 2% browser rendering).

---

## Part 1: How the Giants Do It

### 1.1 Ahrefs Architecture (The Gold Standard)

**Scale Metrics (2026):**
- 8 billion pages crawled per day
- 35 trillion external backlinks (up 960% from 2022)
- 456.5 billion indexed pages
- 500 billion backend requests/day
- 100+ PB storage

**Infrastructure:**
| Component | Specification |
|-----------|---------------|
| Servers | 4,000+ custom bare metal |
| CPU Cores | 691,000 |
| RAM | 4 PB (petabytes) |
| SSD Storage | ~500 PB |
| Supercomputer | "Yep1" @ 23.32 petaflops (top 50 globally) |
| Investment | $900M every 3 years for infrastructure |

**Technology Stack:**
- **Primary Language:** OCaml (compiled natively for maximum performance)
- **Codebase:** 1.5 million lines of OCaml
- **Database:** Custom fork of ClickHouse
- **Performance Components:** C++ for storage engines and distributed systems
- **Frontend:** Melange with ReasonML (shares types with OCaml backend)

**Why OCaml?**
- Programs run for **months without intervention**
- Compile-time type checking prevents petabyte-scale data format errors
- Small team (150 employees managing $100M+ ARR)
- Maximum efficiency from a lean engineering organization

**Key Architectural Decisions:**
1. **Bare metal over cloud** — No AWS/GCP markups
2. **Custom everything** — Storage engines, distributed systems, crawlers
3. **Compile-time safety** — OCaml catches errors before production
4. **Supercomputing approach** — Dedicated processing power, not elastic scaling

**Estimated Cost per Page:**
```
$900M / 3 years = $300M/year
8B pages/day * 365 = 2.92 trillion pages/year
$300M / 2.92T = $0.0001/page

But infrastructure serves ALL services (backlinks, keywords, content, etc.)
Actual crawl-only cost: ~$0.00001/page
```

### 1.2 SEMrush Architecture

**Scale Metrics:**
- 25B+ keywords tracked
- 43T+ backlinks indexed
- 800M+ domains monitored
- 10M+ marketing professionals using daily
- 143 countries supported

**Known Technical Details:**
- Cloud-based scheduled crawls
- JS rendering with ShadowDOM support
- Lighthouse-based audits integration
- API + custom dashboard integrations
- Enterprise crawls support 1M pages per audit

**Key Features:**
- Crawler profiles that simulate different bots (Googlebot, ChatGPT, etc.)
- Standard crawler + list-based crawler for targeted validation
- Scheduled recurring crawls

*Note: Less public information available about their internal infrastructure compared to Ahrefs.*

### 1.3 Screaming Frog / Sitebulb (Desktop Crawlers)

**Architecture Pattern: "Bring Your Own Bandwidth"**

This is a **genius cost optimization**:
- User installs desktop application
- Crawling uses **user's own IP and bandwidth**
- **Zero infrastructure costs** for the vendor
- **Zero proxy costs**
- User pays $259/year for unlimited crawling

**Key Benefits:**
| Benefit | Impact |
|---------|--------|
| No bandwidth costs | User pays their ISP |
| No proxy rotation | User's residential IP |
| No server costs | Runs on user's machine |
| No Cloudflare issues | Residential IPs trusted |
| Scales with users | More users = more distributed crawling |

**Sitebulb Server Variant:**
- For agencies/enterprises
- Runs on dedicated server (often AWS/Hetzner)
- Frees up local resources
- Same architecture, different deployment

**Can We Adopt This?**
Yes — offer a **"TeveroSEO Local Crawler"** mode:
- Electron app or CLI tool
- Crawls client's own site from their IP
- Zero infrastructure cost for us
- Works perfectly for on-page SEO audits
- **Caveat:** Only works for crawling sites the user owns/controls

---

## Part 2: Open-Source Crawler Architectures

### 2.1 Apache Nutch (Hadoop-Based)

**Architecture:**
- Built on Hadoop/MapReduce ecosystem
- Batch processing model (select URLs → fetch → parse → update)
- Can handle **billions of pages monthly**
- Highly extensible plugin architecture

**Pros:**
- Massive scale capability
- Integrates with existing Hadoop clusters
- Well-documented, mature project

**Cons:**
- Not real-time (batch jobs)
- Heavy infrastructure requirements
- Overkill for most use cases

### 2.2 Apache StormCrawler (Stream-Based)

**Architecture:**
- Built on Apache Storm
- Real-time streaming processing
- URLs indexed as they're fetched (no batch delay)
- DAG-based processing components

**Pros:**
- Real-time indexing
- Modular — plug into Elasticsearch, SOLR, SQL
- Fault-tolerant
- Continuous crawling (not discrete batches)

**Cons:**
- Requires Storm expertise
- More complex to deploy than batch crawlers

**Best For:** News monitoring, live content tracking, real-time SEO audits

### 2.3 Heritrix (Internet Archive)

**Architecture:**
- Archival-quality web crawling
- Comprehensive configuration for crawl tuning
- Designed for **preservation**, not real-time

**Pros:**
- Rock-solid reliability (powers archive.org)
- Preserves original page format
- Extensive metadata capture

**Cons:**
- Not dynamically scalable
- Requires upfront partitioning decisions
- Focused on archiving, not SEO

### 2.4 Comparison Table

| Crawler | Processing | Scale | Real-Time | Complexity | Best For |
|---------|-----------|-------|-----------|------------|----------|
| Nutch | Batch | Billions | No | High | Enterprise crawling |
| StormCrawler | Stream | Millions | Yes | Medium | Live monitoring |
| Heritrix | Batch | Millions | No | Medium | Archiving |
| Custom (Scrapy) | Both | Tens of millions | Yes | Low | Our use case |

---

## Part 3: The 98/2 Split Strategy

### 3.1 The Core Insight

**98% of pages:** Simple HTTP fetch (near-free)  
**2% of pages:** Full browser rendering (expensive)

**Cost Difference:**
```
HTTP fetch: ~$0.0000001/page (bandwidth only)
Browser render: ~$0.001/page (compute + memory)

Ratio: 10,000x more expensive for browser rendering
```

### 3.2 How to Detect Which Sites Need JS

**Method 1: Technology Stack Detection**
Use Wappalyzer-style detection:
```javascript
// Signals requiring JavaScript rendering:
const JS_REQUIRED_SIGNALS = {
  // Framework indicators
  'window.__NUXT__': 'Nuxt.js',
  'window.__NEXT_DATA__': 'Next.js',
  'window.webpackJsonp': 'Webpack SPA',
  
  // Minimal HTML indicators
  '<div id="root"></div>': 'React SPA',
  '<div id="app"></div>': 'Vue SPA',
  
  // Script-only pages
  'body.innerHTML.length < 500': 'Likely JS-rendered'
};
```

**Method 2: Initial Fetch Comparison**
1. Fetch raw HTML with simple HTTP client
2. Check if `<body>` contains meaningful content
3. If body is mostly empty divs + scripts → needs JS rendering

**Method 3: Pre-classify by Technology**
Build a database of domains and their stack:
```sql
CREATE TABLE domain_technology (
  domain VARCHAR(255) PRIMARY KEY,
  requires_js BOOLEAN DEFAULT FALSE,
  framework VARCHAR(50),
  last_checked TIMESTAMP,
  confidence FLOAT
);
```

**Method 4: Headers-Based Detection**
```
X-Powered-By: Next.js → Likely SSR (may not need JS)
X-Powered-By: Express → Check content
Set-Cookie: _gatsby → Static site (no JS needed)
```

### 3.3 Implementation Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     URL Queue (Redis)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Technology Classifier                      │
│  • Check domain_technology table                            │
│  • If unknown: quick HEAD request + content sniff           │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌────────────────────────┐     ┌────────────────────────────┐
│  Simple HTTP Workers   │     │   Headless Browser Pool    │
│  (98% of requests)     │     │   (2% of requests)         │
│  • Plain fetch         │     │   • Playwright/Puppeteer   │
│  • Cheerio parsing     │     │   • Full JS execution      │
│  • <1KB memory/req     │     │   • ~500MB memory/req      │
└────────────────────────┘     └────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Unified Parser                            │
│  • Extract SEO elements                                      │
│  • Normalize data                                           │
│  • Store to PostgreSQL + Redis cache                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 4: Edge Computing for Crawling

### 4.1 Cloudflare Workers Analysis

**Pricing (2026):**
| Tier | Requests | Price |
|------|----------|-------|
| Free | 100K/day | $0 |
| Paid | 10M/month | $5 |
| Extra | +1M requests | $0.30 |

**Cost Calculation for 1M Pages/Day:**
```
30M requests/month = $5 + (20M × $0.30/M) = $5 + $6 = $11/month
Cost per page: $11 / 30M = $0.00000037
```

**Key Constraint:** Only CPU time is billed, NOT wall time.
- A worker waiting 2 seconds for upstream fetch only uses milliseconds of CPU
- Perfect for proxy/fetch operations

**Edge Network Benefits:**
- 330+ cities globally
- Natural geo-distribution of requests
- Different IP per edge location
- Bypass geo-blocks automatically

**Use Cases:**
1. **Proxy layer** — Route requests through edge
2. **Light parsing** — Extract basic metadata at edge
3. **Deduplication** — Check seen-URLs at edge before backend
4. **Rate limiting** — Distributed rate control per domain

### 4.2 Deno Deploy

**Benefits:**
- V8 isolates (not containers) — 3.5 second deploys
- TypeScript native
- Global edge distribution
- Open-source runtime (portable)

**Limitations:**
- No heavy compute (no browser execution)
- Memory limits

### 4.3 Fastly Compute

**Benefits:**
- WebAssembly-based (max performance)
- No cold starts
- Memory-safe sandbox per request

**Limitations:**
- WASM complexity
- Less ecosystem support

### 4.4 Edge Crawling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Central Coordinator                         │
│  • URL queue                                                │
│  • Domain rate limiting                                     │
│  • Job assignment                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Cloudflare Workers (330+ PoPs)                    │
│  • Receive URL assignment                                   │
│  • Execute fetch from nearest edge                          │
│  • Extract headers + basic content                          │
│  • Return to coordinator                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 5: Self-Hosted Proxy Networks

### 5.1 The Problem with Commercial Proxies

**Costs at Scale:**
| Provider | 1M Requests | 100M Requests |
|----------|-------------|---------------|
| Bright Data | $500/month | $25,000/month |
| Oxylabs | $450/month | $20,000/month |
| SmartProxy | $400/month | $15,000/month |

For 1B pages/month: **$100,000 - $250,000/month just for proxies**

### 5.2 DIY Proxy Network

**Strategy:** Buy 20-50 cheap VPS instances across providers

**Provider Options:**
| Provider | Cheapest VPS | Location |
|----------|-------------|----------|
| Hetzner | €3.29/mo | Germany, Finland, US |
| Contabo | $4.50/mo | Germany, US, Asia |
| BuyVM | $3.50/mo | US, Luxembourg |
| RackNerd | $2.00/mo | US |
| HostHatch | $2.50/mo | Netherlands, US |
| Vultr | $5.00/mo | Global |

**20-Node Network Cost:**
```
20 VPS × $3.50/mo average = $70/month
vs. Commercial proxy: $500+/month for similar coverage
Savings: 85%+
```

### 5.3 CloudProxy Implementation

Open-source tool for managing DIY proxy network:
- Supports Hetzner, DigitalOcean, AWS, GCP
- Auto-provisions VPS as proxies
- Manages pool rotation
- Free software (you pay only for VPS)

**Setup:**
```yaml
# cloudproxy config
providers:
  - name: hetzner
    token: ${HETZNER_TOKEN}
    instances: 10
    region: fsn1
    size: cx11
    
  - name: digitalocean
    token: ${DO_TOKEN}
    instances: 5
    region: nyc1
    size: s-1vcpu-1gb
```

### 5.4 IP Reputation Challenges

**Problem:** Datacenter IPs are "low trust"
- Cloud provider ASNs are known
- Aggressive scraping burns entire subnets
- "Neighbor poisoning" — one bad actor ruins the range

**Mitigations:**
1. **Rotate providers** — Spread across many ASNs
2. **Low request rate per IP** — Stay under radar
3. **IP warm-up** — Use IPs for legitimate traffic first
4. **IPv6 preference** — Less reputation tracking on IPv6
5. **Residential fallback** — Use residential proxies only for blocked domains

### 5.5 Hybrid Approach

```
┌─────────────────────────────────────────────────────────────┐
│                     Request Router                           │
└─────────────────────────────────────────────────────────────┘
         │              │                   │
         ▼              ▼                   ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
│ Direct Fetch │ │ DIY Proxies  │ │ Commercial Proxies   │
│ (no proxy)   │ │ ($70/mo)     │ │ (residential $500/mo)│
│              │ │              │ │                      │
│ For:         │ │ For:         │ │ For:                 │
│ • Own sites  │ │ • Most sites │ │ • Cloudflare Ultra   │
│ • Whitelisted│ │ • Light WAF  │ │ • Hard-blocked       │
│ • APIs       │ │ • No JS      │ │ • Anti-bot protected │
└──────────────┘ └──────────────┘ └──────────────────────┘
     80%              18%                  2%
```

---

## Part 6: Bypassing Anti-Bot Protection

### 6.1 Cloudflare Detection Methods (2026)

Cloudflare's Bot Score (0-99) combines:
1. **TLS fingerprint** — Library-specific patterns
2. **HTTP/2 fingerprint** — Frame ordering, priorities
3. **JavaScript challenge results** — Canvas, WebGL, audio
4. **Behavioral signals** — Mouse movement, timing

**Scores above 30 get challenged or blocked.**

### 6.2 Current Working Bypass Tools (2026)

| Tool | Type | Effectiveness | Scalability |
|------|------|---------------|-------------|
| Camoufox | Modified Firefox | High | Low |
| SeleniumBase | Stealth Selenium | Medium | Medium |
| Scrapling | Python library | Medium | High |
| Pydoll | Browser automation | Medium | Low |
| FlareSolverr | Proxy service | Medium | Medium |

**Deprecated (No Longer Works):**
- puppeteer-stealth (deprecated Feb 2025)
- Cloudscraper
- cfscrape
- Traditional stealth plugins

### 6.3 New Defenses to Watch

**AI Labyrinth (2025-2026):**
- Cloudflare generates fake AI-created pages
- Hidden links trap bots in endless maze
- Bots waste crawl budget on fake content

**Countermeasure:** Entropy-based content validation
- Check content similarity to known patterns
- Verify page follows expected structure
- Detect auto-generated nonsense text

### 6.4 Mobile Proxies: The Nuclear Option

**Why Mobile Works:**
- 4G/5G IPs are "high trust"
- Shared by thousands of real users
- Constant rotation (CGNAT)
- Not datacenter ASNs

**Cost:**
- $300-1000/month for 10GB of bandwidth
- Use sparingly for hardest targets

### 6.5 Stealth Architecture

```javascript
// Modern anti-detection requirements (2026)
const stealthConfig = {
  // TLS fingerprint spoofing
  tls: {
    ja3: 'match-real-browser',
    alpn: ['h2', 'http/1.1'],
    cipherSuites: [...chromeFingerprint]
  },
  
  // HTTP/2 fingerprint
  http2: {
    frameOrder: 'match-chrome',
    priorities: 'realistic',
    settings: {...chromeSettings}
  },
  
  // Browser fingerprint
  browser: {
    webgl: 'spoof',
    canvas: 'noise',
    audioContext: 'spoof',
    webdriver: false,
    plugins: [...realPlugins]
  },
  
  // Behavioral
  behavior: {
    mouseMovement: 'simulate',
    scrollPatterns: 'human',
    timing: 'jitter'
  }
};
```

---

## Part 7: Headless Browser Farms

### 7.1 Cost Comparison

**Browserless.io (Managed):**
| Plan | Monthly | Units | Cost/Unit |
|------|---------|-------|-----------|
| Starter | $50 | ~1,700 | $0.03 |
| Scale | $200 | ~10,000 | $0.02 |
| Enterprise | Custom | Custom | ~$0.01 |

*Unit = 30 seconds of browser time*

**Self-Hosted Cluster:**
| Component | Monthly Cost |
|-----------|--------------|
| Hetzner CPX41 (8 vCPU, 16GB) | $31 |
| Browserless license | $0 (SSPL) |
| Concurrent browsers | ~8-12 |
| Pages/month | ~500,000 |
| **Cost per page** | **$0.00006** |

**Savings:** 300-500x cheaper self-hosted vs managed

### 7.2 AWS Lambda + Playwright

**Pros:**
- Scales to zero
- Pay only for execution
- No server maintenance

**Cons:**
- 15-minute max execution
- Cold starts (several seconds)
- Memory: 1024MB minimum recommended
- Package size limits (use container images)

**Cost Calculation:**
```
Lambda: $0.0000166667 per GB-second
1 page = ~10 seconds @ 2GB = 20 GB-seconds
Cost per page: $0.00033

For 100,000 pages/month:
100,000 × $0.00033 = $33/month
```

**Best For:** Sporadic JS rendering needs, not bulk crawling

### 7.3 Self-Hosted Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Browser Pool Manager                       │
│  • Tracks available browser instances                       │
│  • Health checks                                            │
│  • Auto-restart crashed browsers                            │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Playwright #1   │ │  Playwright #2   │ │  Playwright #N   │
│  (Container)     │ │  (Container)     │ │  (Container)     │
│  Max 3 tabs      │ │  Max 3 tabs      │ │  Max 3 tabs      │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

**Key Optimizations:**
1. **Reuse browser instances** — Don't launch/close per page
2. **Block non-essential resources** — Images, CSS, fonts
3. **Memory limits per container** — Prevent runaway usage
4. **Tab pooling** — Multiple tabs per browser instance

---

## Part 8: Storage & Bandwidth Optimization

### 8.1 Compression Strategy

**Algorithm Comparison (HTML):**
| Algorithm | Compression Ratio | Speed | Browser Support |
|-----------|------------------|-------|-----------------|
| gzip | ~65% reduction | Fast | 100% |
| Brotli | ~70% reduction | Medium | 95.9% |
| zstd | ~70% reduction | Fastest | ~80% |

**For Storage:** Use zstd (best speed/ratio)
**For Transfer:** Use Brotli (best browser support)

### 8.2 Average Page Sizes

| Content Type | Uncompressed | Compressed (Brotli) |
|--------------|--------------|---------------------|
| HTML | 100 KB | 30 KB |
| JSON API | 50 KB | 15 KB |
| Full page + assets | 2-3 MB | 800 KB |

**Storage Calculation for 1B pages:**
```
1B pages × 30KB compressed = 30 TB
With deduplication (many shared templates): ~10-15 TB actual
```

### 8.3 Hetzner Bandwidth Pricing

| Uplink | Included Traffic | Overage |
|--------|-----------------|---------|
| 1 Gbit | Unlimited | $0 |
| 10 Gbit | 20 TB | €1/TB (~$1.20) |

**For 100TB/month @ 10 Gbit:**
```
20 TB included + 80 TB × €1 = €80/month ($100)
```

Compare to AWS: 100 TB egress = $8,500/month

### 8.4 Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Hot Storage (SSD)                        │
│  • Last 30 days of crawl data                               │
│  • PostgreSQL for structured data                           │
│  • Redis for active caching                                 │
│  Cost: ~$50/month for 1TB                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cold Storage (HDD)                        │
│  • Historical snapshots                                     │
│  • Compressed archives                                      │
│  • Hetzner Storage Box: €3.21/TB                           │
│  Cost: ~$15/month for 5TB                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 9: Distributed Architecture with Redis

### 9.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     URL Frontier                             │
│  Redis Sorted Set: domain:queue with priority scores        │
│  Key features:                                               │
│  • Priority ordering                                         │
│  • Deduplication (seen URLs in Bloom filter)                │
│  • Domain-level rate limiting                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Worker Pool (Scalable)                     │
│  • Pull URLs from Redis                                     │
│  • Execute fetch/render                                     │
│  • Push results to processing queue                         │
│  • Ack only on success (fault tolerance)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Result Processor                           │
│  • Parse HTML/extract data                                  │
│  • Store to PostgreSQL                                      │
│  • Discover new URLs → add to frontier                      │
│  • Update domain_technology table                           │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Scrapy-Redis Pattern

**Key Features:**
- All crawlers share same URL queue
- No duplicate crawling
- Resume from crash
- Scale by adding workers

```python
# Distributed crawler configuration
SCHEDULER = "scrapy_redis.scheduler.Scheduler"
DUPEFILTER_CLASS = "scrapy_redis.dupefilter.RFPDupeFilter"
SCHEDULER_PERSIST = True  # Resume on restart
REDIS_URL = 'redis://redis:6379'
```

### 9.3 Rate Limiting at Scale

```python
# Distributed token bucket in Redis
class DomainRateLimiter:
    def acquire(self, domain: str) -> bool:
        key = f"ratelimit:{domain}"
        tokens = redis.get(key) or 10  # 10 requests/second default
        
        if tokens > 0:
            redis.decr(key)
            return True
        return False
    
    def refill(self):
        # Background task: refill all buckets every second
        for key in redis.scan_iter("ratelimit:*"):
            redis.set(key, min(redis.get(key) + 1, 10))
```

### 9.4 Bloom Filter for Deduplication

**Problem:** Storing millions of URLs for deduplication uses too much memory

**Solution:** Bloom filter
- 1B URLs: ~1.2 GB memory (vs. 50+ GB for hash set)
- False positive rate: 1%
- No false negatives

```python
from pybloom_live import BloomFilter

seen_urls = BloomFilter(capacity=1_000_000_000, error_rate=0.01)

def should_crawl(url: str) -> bool:
    if url in seen_urls:
        return False  # Probably seen (1% false positive)
    seen_urls.add(url)
    return True
```

---

## Part 10: Crawl Budget & Politeness

### 10.1 Politeness Rules

**Mandatory:**
1. Respect `robots.txt` directives
2. Honor `Crawl-delay` when specified
3. Identify crawler in User-Agent
4. Include contact information
5. Back off on 429/503 responses

**Recommended Delays:**
| Site Type | Delay |
|-----------|-------|
| Small business | 10-15 seconds |
| Large site (explicit permission) | 1-2 seconds |
| Own sites | No limit |

### 10.2 Adaptive Rate Control

```python
class AdaptiveRateLimiter:
    def __init__(self, domain: str):
        self.domain = domain
        self.base_delay = 1.0
        self.current_delay = 1.0
        self.error_count = 0
    
    def on_response(self, status: int, latency: float):
        if status == 429 or status >= 500:
            self.error_count += 1
            self.current_delay = min(self.current_delay * 2, 60)  # Double delay, max 60s
        elif latency > 5.0:
            self.current_delay = min(self.current_delay * 1.5, 30)  # Slow response
        elif self.error_count == 0:
            self.current_delay = max(self.current_delay * 0.9, self.base_delay)  # Recover
        
        if status < 400:
            self.error_count = max(0, self.error_count - 1)
```

### 10.3 Legal Considerations

**Safe:**
- Crawling public pages
- Respecting robots.txt
- Own client's sites
- API access

**Risky:**
- Ignoring robots.txt
- Bypassing authentication
- Scraping PII
- Aggressive rate limiting

---

## Part 11: Cost-at-Scale Mathematics

### 11.1 Ahrefs-Style Full Infrastructure

**For 1 Billion Pages/Month:**

| Component | Monthly Cost |
|-----------|-------------|
| 10x Hetzner AX102 (128 cores, 512GB) | $1,200 |
| Bandwidth (100TB @ Hetzner) | $100 |
| Storage (50TB HDD) | $150 |
| Redis/PostgreSQL servers | $200 |
| DIY proxy network (30 VPS) | $100 |
| Browserless cluster (2% of pages) | $50 |
| **Total** | **$1,800/month** |

**Cost per page:** $1,800 / 1B = **$0.0000018**

### 11.2 DataForSEO Comparison

| Metric | DIY | DataForSEO |
|--------|-----|------------|
| 1B pages/month | $1,800 | $600,000+ |
| Cost per page | $0.0000018 | $0.0006 |
| Ratio | 1x | 333x |

### 11.3 Minimum Viable Infrastructure (1M pages/day)

**Target:** <$100/month for 30M pages/month

| Component | Specification | Monthly Cost |
|-----------|---------------|--------------|
| Hetzner CPX41 | 8 vCPU, 16GB RAM | $31 |
| Hetzner Storage Box | 1TB | $4 |
| Redis Cloud (free tier) | 30MB | $0 |
| Supabase (free tier) | 500MB DB | $0 |
| DIY proxies (5 VPS) | 5 × $3 | $15 |
| Cloudflare Workers | 30M requests | $11 |
| **Total** | | **$61/month** |

**Cost per page:** $61 / 30M = **$0.000002**

**Architecture:**
```
┌────────────────────────────────────────────────────────────┐
│                 Cloudflare Workers (Edge)                   │
│  • URL router                                               │
│  • Technology classifier                                    │
│  • Light HTML fetch                                         │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│               Hetzner CPX41 (Central Server)                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   Redis     │ │  PostgreSQL │ │ Playwright (2 inst) │   │
│  │   Queue     │ │  Storage    │ │ For JS pages only   │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            HTTP Fetch Workers (8 concurrent)         │   │
│  │            • Cheerio parsing                         │   │
│  │            • 50 requests/second capacity             │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                  DIY Proxy Pool (5 VPS)                     │
│  • Hetzner (DE), Contabo (US), BuyVM (LU)                  │
│  • Round-robin rotation                                     │
│  • IP warm-up via light browsing                           │
└────────────────────────────────────────────────────────────┘
```

---

## Part 12: Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Hetzner CPX41 server
- [ ] Deploy Redis + PostgreSQL
- [ ] Implement basic HTTP fetcher with Cheerio
- [ ] Build URL frontier with deduplication
- [ ] Domain rate limiting

### Phase 2: Smart Routing (Week 3-4)
- [ ] Technology stack detector (Wappalyzer-style)
- [ ] 98/2 split router
- [ ] Playwright pool for JS pages (2 instances)
- [ ] Integrate DIY proxy network (5 VPS)

### Phase 3: Edge Layer (Week 5-6)
- [ ] Deploy Cloudflare Workers for edge fetching
- [ ] Implement URL classification at edge
- [ ] Build distributed rate limiter
- [ ] Add geographic routing

### Phase 4: Scale & Optimize (Week 7-8)
- [ ] Bloom filter for billion-URL deduplication
- [ ] Adaptive rate control
- [ ] Anti-bot stealth (Camoufox integration)
- [ ] Content change detection (incremental crawling)

### Phase 5: Production Hardening (Week 9-10)
- [ ] Monitoring and alerting
- [ ] Graceful degradation
- [ ] Cost tracking per client
- [ ] SLA compliance checks

---

## Part 13: Key Insights Summary

### The Ahrefs Secret
1. **Own the metal** — Bare metal is 10-50x cheaper than cloud at scale
2. **Custom everything** — Purpose-built systems outperform generic solutions
3. **Lean team** — OCaml's type safety enables small teams to manage massive systems
4. **Long-term thinking** — $900M/3yr investment in infrastructure

### The Screaming Frog Secret
1. **Zero infrastructure** — User's machine does all the work
2. **Residential IPs** — No proxy costs, no Cloudflare issues
3. **One-time sale** — $259/year license, no recurring compute costs

### Our Strategy
1. **Hybrid approach** — Edge + central server + user's machine (optional)
2. **98/2 split** — Don't waste compute on static pages
3. **DIY proxies** — 85% savings over commercial providers
4. **Incremental crawling** — Only re-crawl changed pages
5. **Technology classification** — Pre-route requests optimally

### Final Cost Comparison

| Scale | Our Cost | DataForSEO | Savings |
|-------|----------|------------|---------|
| 1M pages/month | $61 | $600 | 90% |
| 10M pages/month | $150 | $6,000 | 97.5% |
| 100M pages/month | $600 | $60,000 | 99% |
| 1B pages/month | $1,800 | $600,000 | 99.7% |

---

## Sources

### Ahrefs Architecture
- [Petabyte-Scale Web Crawling and Data Processing (OCaml)](https://ocaml.org/success-stories/petabyte-scale-web-crawling-and-data-processing)
- [Engineering at Scale - Ahrefs Tech](https://ahrefs.com/tech)
- [Ahrefs Statistics 2026](https://sqmagazine.co.uk/ahrefs-statistics/)

### Open Source Crawlers
- [The Battle of the Crawlers: Apache Nutch vs. StormCrawler](https://dzone.com/articles/the-battle-of-the-crawlers-apache-nutch-vs-stormcr)
- [Apache StormCrawler FAQ](https://stormcrawler.apache.org/faq/)

### Desktop Crawlers
- [Sitebulb Server Technical Tips](https://www.gsqi.com/marketing-blog/sitebulb-server-technical-tips-and-tricks/)
- [Screaming Frog vs Sitebulb](https://hashmeta.com/blog/screaming-frog-vs-sitebulb-which-technical-seo-crawler-is-right-for-you/)

### Edge Computing
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Edge Computing for Frontend Developers](https://daily.dev/blog/edge-computing-frontend-developers-cloudflare-workers-deno-deploy-vercel)

### Proxy Networks
- [CloudProxy GitHub](https://github.com/claffin/cloudproxy)
- [The Proxy Economy](https://dev.to/deepak_mishra_35863517037/the-proxy-economy-residential-datacenter-and-isp-rotation-59o8)

### Anti-Bot Bypass
- [How to Bypass Cloudflare in 2026](https://scrapfly.io/blog/posts/how-to-bypass-cloudflare-anti-scraping)
- [Bypass Cloudflare with Puppeteer 2026](https://www.browserless.io/blog/bypass-cloudflare-with-puppeteer)

### Headless Browsers
- [Running Playwright on AWS Lambda](https://www.browsercat.com/post/running-playwright-on-aws-lambda)
- [Browserless Pricing](https://www.browserless.io/pricing)

### Distributed Crawling
- [Distributed Web Crawling Guide](https://brightdata.com/blog/web-data/distributed-web-crawling)
- [Web Scraping at Scale: From 1K to 10M Pages](https://dev.to/agenthustler/web-scraping-at-scale-from-1k-to-10m-pages-4ggk)

### Compression & Storage
- [Choosing Between gzip, Brotli and zStandard](https://paulcalvano.com/2024-03-19-choosing-between-gzip-brotli-and-zstandard-compression/)
- [Hetzner Traffic Pricing](https://docs.hetzner.com/robot/general/traffic/)

### Technology Detection
- [Wappalyzer](https://www.wappalyzer.com/)
- [Website Tech Detector](https://apify.com/miccho27/website-tech-detector)

### Google Infrastructure
- [A Peek Behind Colossus, Google's File System](https://cloud.google.com/blog/products/storage-data-transfer/a-peek-behind-colossus-googles-file-system)

### DataForSEO Pricing
- [DataForSEO API v3 Pricing](https://dataforseo.com/pricing)
