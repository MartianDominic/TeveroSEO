# Cheap crawling infrastructure for an SEO SaaS scaling 10 → 5,000 tasks/day

**The headline answer is that 60–70% of the workload should never touch your crawler at all.** A "research task" decomposes into six shapes; only one of them (full client audits, ~5–10% of volume) is an irreducible deep crawl. The rest collapses onto DataForSEO at fractions of a cent per call — and DataForSEO is the only major SEO API whose Terms of Service permit resale to agency clients. Build the infrastructure around that asymmetry: a thin DataForSEO orchestration layer for two-thirds of tasks, an async ARQ + Hetzner crawler for the remaining third, a Redis-backed singleflight cache so 50 clients monitoring the same Lithuanian retailer share one fetch, and a delta-crawl cascade (sitemap → conditional GET → template-aware hash) that eliminates 65–80% of recurring fetches. The full Phase-2 stack lands at **~€95/mo of Hetzner + ~$2,000–$5,000/mo of proxies + DataForSEO at variable cost**, comfortably under the $0.10/task ceiling at 5,000 tasks/day. The non-obvious traps — Cloudflare bot-fight rewriting ETags, Shopify's `updated_at` flipping on inventory writes, trafilatura extracting prices into the content hash, and Apify residential bandwidth dwarfing CU costs — are where naive implementations bleed money silently.

---

## 1. Six task shapes, not one — and only one is a real crawl

The single most leverage-positive architectural decision is to refuse the assumption that "research task = crawl." Workload decomposes as follows for a typical SMB/mid-market SEO agency:

| Type | Share of daily volume | Pages fetched (median) | JS render? | API-replaceable? | Cheapest per-task cost | Cache-shareable? |
|---|---|---|---|---|---|---|
| **A. Full client site audit** | 5–10% | ~1,500 (range 200–15,000) | 30–50% | No — must crawl | **$0.30–$0.75** self-hosted; $0.63 via DataForSEO OnPage | Low (client-specific) |
| **B. Competitor snapshot** | 15–20% | ~600 | 40–60% | Partial — APIs + targeted fetch | **$0.15–$0.50** | **High** (small competitor universe in LT) |
| **C. Keyword gap** | 35–45% | 0 | n/a | **Fully** — DataForSEO Labs | **$0.30–$1.20** at 500–2,000 keywords | High (SERPs stable 24–72h) |
| **D. Backlink profile** | 10–15% | 0 | n/a | **Fully** — DataForSEO Backlinks | **$0.05–$0.20** | High |
| **E. Content gap / topical authority** | 10–15% | ~300 | ~30% | Partial — Exa discovery + selective fetch | **~$3** total (Exa $2 + DataForSEO $1) | Medium |
| **F. Local SEO audit** | 10–15% | 0–1 | n/a | **Fully** — DataForSEO Business Data | **$0.05–$0.25** | High |

**The implication**: only ~250–500 of 5,000 daily tasks are real crawls. Build **two queue lanes**: a heavy-crawl lane with headless capability and 15-minute SLA, and a fast lane (sub-minute) that runs API workflows. A unified "spider everything" architecture would burn 5–10× the budget.

**Trap (Q1)**: GDPR cookie-consent walls and Cloudflare bot-challenge pages return **HTTP 200 with `<title>` and structured-looking HTML**, but the body is a consent shell — not the page content. Your audit silently reports "thin content / missing schema / no internal links" for pages that are actually rich. Fix: fingerprint Cookiebot/OneTrust/Iubenda DOM signatures on the first page of every crawl, sanity-check HTML byte-size against expected baselines, and maintain a per-domain "render mode" cache so headless cost is paid once per domain per week.

---

## 2. The hosted-crawler price floor is $0.10–$0.13 per 1,000 simple pages — and you cannot hit sub-$0.02 without self-hosting

Verified April 2026 pricing across the entire hosted-scraping market, sorted by effective $/1,000 pages at the 5M/month tier:

| Provider | $/1k no-JS | $/1k with JS | Min plan | EU/LT IPs | Anti-bot | Self-hostable? |
|---|---|---|---|---|---|---|
| **Spider.cloud** (Rust, MIT) | $0.10–$0.48 | ~$0.48 (flat) | PAYG, no minimum | Yes, 199 countries | Built-in | **Yes (spider-rs OSS)** |
| **Scrape.do** | $0.12–$0.29 | $0.58 | $29/mo Hobby | Yes, 150+ countries | 98% benchmark | No |
| **Zyte API** | $0.13 (Tier 1) → $0.40 | $1.00–$5+ | $5 free + $100 commit | Yes | Top-tier in Proxyway 2025 | Scrapy is OSS; cloud isn't |
| **ScrapingBee** (now Oxylabs) | $0.20 | $0.98 (5× mult) | $49/mo | EU on Business+ only | Decent on simple sites | No |
| **Apify** | $0.30–$0.50 (Cheerio) | $2–$5 (Playwright) | $29 Starter | Yes | Strong | **Crawlee is OSS** |
| **Firecrawl** | $0.16–$0.67 | $2.68 (9× cr enhanced) | $16 Hobby | Yes | OK; CF bypass cloud-only | AGPL-3 self-host (no proxies) |
| **Bright Data Web Scraper API** | $1.50 flat | $1.50 (incl.) | $499/mo | Yes (best LT pool with ZIP targeting) | Best-in-class (98.4%) | No |
| **Oxylabs** | $0.30–$1.00 | $0.75–$1.35 | $49 Micro | Yes (Vilnius HQ) | 92.5% benchmark | No |
| **ScrapeOps proxy aggregator** | $0.36 → ~$0.10 at scale | $0.50 | $9/mo Hobby | Yes (multi-provider) | Variable by upstream | DIY-friendly |

**The true floor at 50M pages/month from a reputable hosted provider is ~$0.08–$0.13 per 1,000 simple HTTP pages** (Zyte Tier-1 with $500 commit + 70% volume discount, or Scrape.do enterprise). For protected sites needing JS rendering, the realistic hosted floor is **$0.30–$0.50 per 1,000 pages**. Sub-$0.02/1k blended is **only achievable via self-hosted Crawl4AI/Crawlee + datacenter proxies + residential overlay**, and then operational cost (1 SRE) often exceeds the savings until you're well past 25M pages/month.

**Phase fit**: Phase 1 (~150k pages/mo, $200–$800 budget) → **Spider.cloud PAYG (~$72/mo)** for AI/LLM pipelines, or **Scrape.do Pro ($99)** for unprotected targets, or **Zyte API at $200 commit** for hard sites. Avoid Bright Data ($499 minimum) and ScrapingBee Business+ ($249 just to unlock JS). Phase 2 (~25M pages/mo, $0.10/task ceiling = $15,000/mo total) → **self-hosted Crawl4AI + tiered proxies wins decisively**.

**Trap (Q2)**: ScrapingBee's "$49 / 250k credits" plan delivers only **3,333 stealth-proxy requests** because JS+premium+stealth multipliers stack to 75×. Apify's residential proxy bandwidth, not compute units, is the dominant cost — a single Playwright Actor without `request.abort()` on images burns 2 GB per run × $7.50/GB. Zyte can quietly **reassign your target to a higher difficulty tier** with 2 weeks' notice; G2 reviewers report invoices 40× expectations after a tier shift.

---

## 3. Lithuanian e-commerce mostly does not warrant residential proxies — but the GB math will kill you when it does

The reality of Lithuanian e-commerce bot protection is that **most local sites (varle.lt, senukai.lt, topo.lt, eurovaistine.lt) run stock LAMP/Magento/PrestaShop with Cloudflare Free or Pro tier — Bot Fight Mode at most, not Bot Management or DataDome**. A single Hetzner CX22 (€4.49/mo) IP with realistic User-Agent, `Accept-Language: lt-LT`, curl_cffi for TLS fingerprint, and 0.5–1 req/s rate limiting will reliably crawl them at < 500k pages/month per site without blocks. **Pigu.lt is the exception** (large Baltic marketplace with WAF rules), and any UK/DE/PL targets the agency adds — Allegro, Otto, Zalando, Argos — **do** warrant residential rotation.

**Bandwidth math that drives the budget**: a 2026 e-commerce HTML page averages **120 KB compressed** (range 50–200 KB). Per 1M pages crawled HTML-only that's ~120 GB transferred. Headless Chromium without `block_resources()` on images/fonts multiplies this **10–20×** — a single missed Playwright config line turns a $300/mo proxy bill into $6,000.

**Cheapest proxy paths in 2026** (verified pricing):

| Provider | DC | Residential at scale | LT IPs claimed |
|---|---|---|---|
| **Webshare** (Oxylabs-owned) | $0.018/IP | **$1.12–$1.40/GB** (50%-off "permanent" promo) | ~122,768 |
| **IPRoyal** | $1.39–$2.40/IP | $1.75/GB at 1TB | ~557,685 (largest LT pool) |
| **Oxylabs** | $0.49/GB | $2.00–$2.75/GB Corporate | Vilnius-HQ, deepest authentic LT quality |
| **Decodo (ex-Smartproxy)** | $0.47/GB | **$1.50/GB at 1TB enterprise** | broad EU |
| **SOAX** | mixed | **$0.32/GB enterprise** (~$1k+/mo commitment) | 155M IPs |
| **Bright Data** | $0.066/GB | $2.50–$3.00 enterprise | LT zip-code targeting |

**Self-hosted vs hosted crossover** (HTML-only, 120 KB pages):

| Volume | Apify Scale | Zyte API Tier-1 | Self-hosted Hetzner + Webshare $1.40/GB | Hetzner + no proxy |
|---|---|---|---|---|
| 1M pages/mo | ~$200 | ~$1,000 | **$201** ($33 + $168) | $33 |
| 5M pages/mo | ~$1,000 | ~$5,000 | **$873** | $33 (LT-only) |
| 25M pages/mo | ~$5,000 | ~$25,000 | **$1,850–$4,250** | n/a |

**The crossover is at ~1M pages/month against Apify and ~50,000 pages/month against Zyte browser-tier.** Above 1M pages/mo, self-hosting wins linearly.

**Phase recommendation**: Phase 0 → single Hetzner CX22 + free Webshare DC for emergency rotation, no proxy spend. Phase 1 → Hetzner CPX31 + Webshare residential at $1.40/GB for blocked targets ($140–$700/mo, capacity 5–10M pages/mo). Phase 2 → negotiate **SOAX enterprise at $0.32/GB (~$960/mo for 3 TB)** or IPRoyal/Decodo at ~$1.50/GB; mix with cheap Hetzner Cloud Floating IPs (€1/mo each) for unprotected LT sites.

**Trap (Q3)**: **Residential GB billing meters every byte through the tunnel — failed requests, 3xx redirects, blocked CAPTCHA pages, TLS handshake retries, and headless asset downloads all count.** A 30% block rate on a Cloudflare target converts your $1.40/GB rate to effective $2.00/GB. Worse: Webshare's "$1.40/GB" is contractually a 50%-off promo (running "permanently" for 2+ years) — list price $2.80/GB could return. And Oxylabs **owns Webshare** as of 2024, so using both for "redundancy" gives you the same network.

---

## 4. ARQ + Redis singleflight handles 5,000 tasks/day on €95/month of Hetzner

The math is unambiguous: 5,000 tasks/day ÷ 24h ≈ 208 tasks/hour, with a 15-minute average, requires ~52 concurrent workers steady-state plus safety factor → 60–80 concurrent. Every task is I/O-bound (HTTP fetch + parsing + LLM extraction over network), so **one async event loop with N coroutines beats N OS processes** for both memory and tail latency.

**Library verdict (April 2026 health check)**:

| Library | 2025–26 status | Verdict for this workload |
|---|---|---|
| **ARQ** | Maintenance-only mode (issue #510), bugfix commits through Jan 2026 | **Winner Phase 0/1, fallback Phase 2.** Smallest blast radius (~700 LOC), best DX with FastAPI+aiohttp |
| **TaskIQ** | Very active, 0.12.2 Apr 2026, OpenTelemetry/multi-queue PRs in flight | **Migration target if ARQ stops shipping**. API similar enough to make the move mechanical |
| **Dramatiq** | Steady (2.1.0 Mar 2026) | Sync API fights aiohttp; needs gevent monkey-patching |
| **Celery** | 5.6.x active "recovery" series with documented Redis-broker reconnect bugs | **Avoid** — prefork workers don't release memory, RSS ratchets up over 15-min tasks until OOM |
| **Huey** | 2.6.0 Jan 2026, single maintainer with visible fatigue | Designed for small Django apps, not for 60+ concurrent long crawls |
| **Temporal** | Heavy operational overhead | Overkill until Phase 3+ |

**Recommendation**: ARQ everywhere through Phase 2; migrate to TaskIQ only if ARQ goes truly dormant.

**The two patterns that matter** are crawl deduplication (so 50 clients hitting the same domain share one fetch) and weighted fair queuing (so one heavy client doesn't starve others). The deduplication primitive is **`SET key NX EX seconds` (atomic, not `SETNX`+`EXPIRE`) plus pub/sub completion notification with subscribe-before-recheck to avoid lost wakeups**. Working code:

```python
# worker.py — ARQ with Redis SETNX-with-TTL singleflight + result sharing
import asyncio, hashlib, json, time
import aiohttp
from arq.connections import RedisSettings

LEADER_TTL, RESULT_TTL, WAIT_TIMEOUT = 30*60, 30*60, 25*60
def site_key(url): return hashlib.sha256(url.lower().rstrip("/").encode()).hexdigest()[:16]

CLAIM_LUA = """
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return 1 end
return 0
"""

async def crawl_with_dedup(ctx, url, client_id):
    redis = ctx["redis"]
    k = site_key(url)
    lkey, rkey, chan = f"crawl:leader:{k}", f"crawl:result:{k}", f"crawl:done:{k}"
    cached = await redis.get(rkey)
    if cached:
        return {"client_id": client_id, "shared": True, **json.loads(cached)}
    worker_id = f"{ctx['worker_id']}:{int(time.time())}"
    am_leader = await redis.eval(CLAIM_LUA, 1, lkey, worker_id, LEADER_TTL)
    if am_leader:
        try:
            result = await _do_crawl(ctx, url)
            async with redis.pipeline(transaction=True) as p:
                p.set(rkey, json.dumps(result), ex=RESULT_TTL)
                p.delete(lkey); p.publish(chan, "done")
                await p.execute()
            return {"client_id": client_id, "shared": False, **result}
        except Exception:
            await redis.delete(lkey); await redis.publish(chan, "fail"); raise
    pubsub = redis.pubsub()
    await pubsub.subscribe(chan)              # subscribe BEFORE recheck (no lost wakeup)
    try:
        cached = await redis.get(rkey)
        if cached: return {"client_id": client_id, "shared": True, **json.loads(cached)}
        deadline = time.monotonic() + WAIT_TIMEOUT
        while time.monotonic() < deadline:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0)
            if msg and msg["data"] in (b"done", "done"):
                cached = await redis.get(rkey)
                if cached: return {"client_id": client_id, "shared": True, **json.loads(cached)}
            if msg and msg["data"] in (b"fail", "fail"):
                return await crawl_with_dedup(ctx, url, client_id)   # self-promote
        raise TimeoutError(f"crawl wait timeout for {url}")
    finally:
        await pubsub.unsubscribe(chan); await pubsub.close()

class WorkerSettings:
    redis_settings = RedisSettings(host="127.0.0.1", port=6379)
    functions = [crawl_with_dedup]
    max_jobs = 20; job_timeout = 30 * 60; keep_result = 60 * 60; max_tries = 3
```

**Fair queuing across `client_id` buckets uses Deficit Round Robin** — provably gives each client `weight_i / Σ weights` of throughput, O(1) dequeue, and lets you tune priority at runtime. The full DRR Lua-backed implementation is in the appendix, but the dispatcher loop pattern is: pull from `FairQueue.dequeue()` → `arq_pool.enqueue_job(..., _job_id=f"{client_id}:{url}")` for idempotency → ARQ consumes from a bounded sorted set.

**VPS sizing on Hetzner (April 2026, EU prices ex-VAT)**:

| Phase | Tasks/day | Concurrency | Topology | SKU | Specs | €/mo |
|---|---|---|---|---|---|---|
| 0 | 10–20 | 1–2 | All-in-one | CX22 | 2 vCPU / 4 GB | **€4.49** |
| 1 | 50–500 | 5–10 | Single box | **CPX31** | 4 vCPU / 8 GB | **€15.99** |
| 2 | 5,000 | 60–80 | Split: control + Redis + 2 workers | CCX23 + CPX21 + 2× CPX41 | 24 vCPU / 52 GB total | **€94.96** |

Critical sizing rule: each aiohttp+lxml+spaCy coroutine ≈ 200 MB resident at peak; CPX21's 4 GB is **too tight** at Phase 1 (10 × 200 MB + Postgres = OOM). Pay the extra €7 for CPX31. **Use CPX (shared vCPU) for workers**, not CCX — crawl tasks await TCP, so vCPU steal time is irrelevant; double cost for 10% throughput gain isn't worth it. Pay for CCX23 only on the control/Postgres box where p99 latency matters under crawler write bursts.

**Task granularity**: hybrid — top-level task is `crawl_site(url, client_id)` with a per-site `asyncio.Semaphore(8)` for in-process page concurrency. Don't enqueue per-page tasks (would explode Redis to 250k jobs/day). Escalate a single page to a separate ARQ job *only* if it requires Playwright rendering — that's CPU-heavy and benefits from process isolation.

**Monitoring**: Grafana Cloud free tier (10k series, 50 GB logs, 14-day retention) + redis_exporter + a thin ARQ Prometheus middleware. Total cost: **€0**. If `client_id` cardinality becomes constraining, drop the label from metrics and keep it in Loki logs only.

**Trap (Q4)**: `aiohttp.TCPConnector(limit=N)` is **per-`ClientSession`**, not global. If you create a session inside each task you have no global cap and will SYN-flood targets. Always create one session in `on_startup` and share via `ctx`. And the classic dedup bug: `SETNX` followed by `EXPIRE` is **non-atomic** — must be `SET key value NX EX seconds` as a single command (or wrapped in Lua). The two-command form is the most common production dedup race.

---

## 5. Delta crawling kills 65–80% of recurring fetches — but only with a template-aware hash

The naive approach (hash the whole HTML body) fails on e-commerce because price tickers, "13 people viewing this" widgets, and stock counters flip every fetch. **Trafilatura and readability-lxml are not safe for e-commerce delta detection** — they extract the price block as part of "main content" and your SHA256 changes constantly, defeating the entire strategy.

**The four-layer cascade**, cheapest gate first:

| Layer | Mechanism | Expected hit rate | Origin cost saved |
|---|---|---|---|
| L0 | Sitemap `lastmod` unchanged + age < 30d → skip | 25–55% | 100% (no fetch) |
| L1 | Conditional GET (`If-None-Match` / `If-Modified-Since`) → 304 | 10–20% | ~95% (200B response) |
| L2 | Full body received → strip dynamic blocks → SHA256 of SEO-relevant text → matches stored | 10–20% | 0% bandwidth, 100% downstream NLP/SERP |
| Fetch + reprocess | | 10–25% | — |

**Sitemap `lastmod` reliability ranking** for Lithuanian/EN e-commerce in 2026:
- **Yoast/RankMath WordPress** — fairly accurate, tied to `post_modified_gmt`; price/stock writes don't bump it (good for SEO false-positive avoidance)
- **Shopify** — `lastmod` flips on **any** admin mutation including inventory/variant price/metafield writes; treat as negative-only signal (unchanged → skip; changed → still verify)
- **Magento 2** — depends on cron interval; bug #9151 produces `0000-00-00` garbage timestamps; date-truncate to day
- **Custom Lithuanian CMSes** — assume unreliable until validated per-site

**Conditional GET reality**: only ~20–40% of e-commerce HTML responses honor `If-None-Match` correctly in 2026. Cloudflare downgrades strong ETags to weak unless Email Obfuscation/Auto-HTTPS-Rewrites/Rocket Loader/Minification are all disabled, and on cache miss it doesn't forward `If-None-Match` to origin. **Don't use HEAD-first** — Cloudflare promotes HEAD→GET on cache miss, doubling origin load.

**Storage cost for 10M page hashes**: **PostgreSQL as source of truth + Redis as hot cache (write-through)**. Raw schema `(url_hash BYTEA(16) PK, content_hash BYTEA(32), etag TEXT, last_modified TIMESTAMPTZ, last_seen TIMESTAMPTZ, lastmod_sitemap TIMESTAMPTZ)` is ~200 B/row → ~3 GB total at 10M rows including indexes, fits a single Hetzner CX22 (€4.49/mo). Redis adds ~1.5–2 GB RAM for hot lookups during crawl. Pure-Redis loses durability and SQL reporting; pure-Postgres can't hit sub-ms during 1,000 req/s crawls.

**No drop-in 2026 library does the full cascade**. Closest building blocks: Scrapy's `RFC2616Policy` (with `HTTPCACHE_IGNORE_RESPONSE_CACHE_CONTROLS = ['no-store','no-cache','must-revalidate','private']` to override e-commerce anti-cache headers), selectolax for template-aware extraction, ~300 LOC of glue. Reference implementation pattern:

```python
DYNAMIC_BLOCKS = [".price", ".product-price", "[itemprop='price']", "[data-price]",
                  ".stock", ".availability", "[itemprop='availability']", ".cart",
                  ".add-to-cart", ".product-reviews-count", ".recommended",
                  ".related-products", ".cookie-banner", "script", "style", "noscript"]
SEO_RELEVANT = ["title", "h1", "h2", "h3", "meta[name='description']",
                "meta[property='og:title']", "meta[property='og:description']",
                "[itemprop='description']", "main", "article", ".product-description"]

def clean_and_hash(html: bytes) -> str:
    tree = HTMLParser(html)
    for sel in DYNAMIC_BLOCKS:
        for node in tree.css(sel): node.decompose()
    parts = []
    for sel in SEO_RELEVANT:
        for node in tree.css(sel):
            txt = node.attributes.get("content") or node.text(separator=" ", strip=True)
            if txt: parts.append(f"{sel}::{txt}")
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()
```

**Realistic blended savings**: 65–80% across a typical Lithuanian SMB e-commerce portfolio. 80%+ achievable on Shopify/Yoast-WP-dominant portfolios with weekly cadence and template-aware hashing. Drops to 30–50% on custom-CMS or heavily personalized sites.

**Trap (Q5)**: WordPress sitemap caching plugins (W3TC, WP Rocket) serve XML that's hours-to-days stale. Your L0 says "unchanged" because the cached XML hasn't refreshed — you miss real edits. Mitigation: re-fetch the sitemap with `Cache-Control: no-cache` request header and cross-validate with `<meta property="article:modified_time">` (Yoast outputs it).

---

## 6. DataForSEO is the resale-legal foundation — Ahrefs and Semrush APIs are off-limits for SaaS

The most consequential finding from the search-API research is a **legal one, not a pricing one**:

- **Ahrefs API ToS**: "You will not... resell, redistribute or provide Ahrefs Data to any party other than the End User" — and the End User must have an active paid Ahrefs account. **You cannot legally resell Ahrefs data to your agency clients.** Even displaying numbers in a client-facing dashboard is dubious without their own OAuth-authorized account.
- **Semrush API ToS**: "solely for your internal business purposes... may not sublicense, resell, rent, lease, transfer..." Cache limit: **1 month maximum**.
- **DataForSEO**: no resale restriction. Can be embedded in client-facing white-label products.
- **SerpApi**: legal to resell but currently in **active Google DMCA litigation** (hearing May 19, 2026), so don't bet infrastructure on it.

This narrows the choice to DataForSEO as the primary stack, with Exa or Tavily as a discovery-layer complement and Serper.dev as a fast-SERP fallback.

**DataForSEO pricing (verified April 2026)**, all with native Lithuanian locale support (`location_code=2440`, `language_code=lt`):
- **SERP API standard queue (~5 min)**: $0.0006/SERP — 1,000 SERPs ≈ $0.60
- **Keywords Data (Google Ads)**: ~$0.05 per request covering up to 1,000 keywords → $0.00005/keyword
- **Labs (Ranked Keywords, Domain Intersection, Bulk KD)**: $0.01 + $0.0001/item → $0.11 per 1,000-row pull
- **Backlinks**: $0.02/req + $0.00003/row, $100/mo minimum → ~660,000 backlinks for $100 ($0.00015/row)
- **OnPage**: $0.000125 per crawled page (basic); ~$0.001 with browser rendering — cheaper than Screaming Frog license + Ahrefs Enterprise below ~5M pages/year

**The full Lithuanian competitor keyword gap analysis (1 client + 3 competitors, 3,000 keywords) costs $2.20–$3.60 via DataForSEO** vs ~$5.15 via SerpApi+crawl vs ~$43 via pure crawl + LLM classification. DataForSEO wins by 20× and removes the entire anti-bot/parser maintenance burden.

**Exa as a discovery layer cuts crawls 60–80% on "soft" SEO tasks** (content gap, topical authority, link prospecting) but does **not** reduce technical-audit or rank-tracking workloads — those are inherently exhaustive. Exa search-with-contents at $7/1k requests = $0.0007 per fetched-and-cleaned page makes it the cheapest commercial "search + extract in one call" option for Type E content gap work.

**Cost-per-task by type using these APIs**:

| Task type | Recommended stack | Cost per task |
|---|---|---|
| A. Full audit (5K pages) | DataForSEO OnPage or self-hosted | **$0.63** API / $0.05–$0.30 self-hosted |
| B. Competitor snapshot | DataForSEO Labs + Backlinks | **$0.40 per competitor** |
| C. Keyword gap (3K keywords) | DataForSEO Labs + Keywords Data | **$2.20–$3.60** |
| D. Backlinks | DataForSEO Backlinks | **$0.05–$0.20** |
| E. Content gap | Exa discovery + DataForSEO + selective crawl | **~$3** |
| F. Local SEO (5K SERPs + 200 GMB/mo) | DataForSEO SERP + Business Data | **$3–$10/month** |

**Trap (Q6)**: DataForSEO SERP results paginate at 10 per page since September 2025 — pulling 100 organic results costs $0.00465 not $0.0006, a **7.75× cost increase** if you naively request `depth=100`. Always check whether first-page (10 results) is sufficient for the use case. And `enable_browser_rendering` on OnPage raises per-page cost from $0.000125 to ~$0.001 (8×) — audit your task POSTs because users leave it on by default.

---

## 7. The three-phase migration with explicit numeric triggers

### Phase 0 — $0–$50/mo, 5–20 tasks/day (manual + first paying clients)

**Stack**: Single Hetzner CX22 (€4.49/mo) running FastAPI + PostgreSQL + Redis + ARQ worker on one box. Crawler is pure aiohttp + selectolax + sitemap parser, no proxies for LT sites (just realistic UA + `Accept-Language: lt-LT` + 0.5–1 req/s + curl_cffi for TLS fingerprint). DataForSEO PAYG ($50 deposit) for Types C/D/F. Free Webshare DC tier (10 IPs, 1 GB/mo) for emergency rotation. Grafana Cloud free + Uptime Kuma for monitoring. **What's mocked/skipped**: no delta crawling, no shared cache, no fair queuing, no Playwright (route headless tasks to DataForSEO OnPage with `enable_browser_rendering` — it's cheaper than self-hosting Chromium at this volume).

**Cost per task**: ~$0.005–$0.05 for API-bound tasks (60–70% of volume), ~$0.10–$0.30 for crawl-bound tasks → blended **~$0.03–$0.08 per task**.

**What breaks first**: at ~30–50 tasks/day, single-VPS RAM becomes contended when audit-crawl tasks coincide with Postgres writes. The trigger is queue depth spiking above 20 or task p95 exceeding 25 minutes.

### Phase 1 — $200–$800/mo, 50–500 tasks/day (active agency clients)

**Stack**: Migrate to Hetzner CPX31 (€15.99/mo) — keep all-in-one topology but with 8 GB RAM and 4 vCPU. Add **Webshare residential at $1.40/GB ($140–$700/mo for 100–500 GB)** for sites that block DC IPs. Add 5–10 Hetzner Cloud Floating IPs (€10/mo) as a free rotation layer ahead of any residential spend. Enable delta crawling cascade (sitemap → conditional GET → template-aware hash) — this immediately cuts re-crawl cost 65–80%. Enable Redis singleflight dedup so 50 clients monitoring the same Lithuanian retailer share one fetch. Introduce ARQ multi-queue priority lanes (heavy crawl vs API fast lane).

**Hosted scraping introduction**: hold off on Apify/Zyte until specific blocked-target traffic exceeds ~500k pages/mo on a small set of hard sites. Then introduce **Spider.cloud PAYG (~$0.48/1k pages, $72/mo for 150k)** rather than Apify for that specific tranche.

**Cost per task at Phase 1**: blended **~$0.05–$0.15 per task**.

**What breaks next**: Redis becomes single-point-of-bottleneck around ~150 concurrent active jobs.

### Phase 2 — $3,000–$15,000/mo, 1,000–5,000 tasks/day, sub-$0.10/task ceiling

**Stack**: Split topology — CCX23 control box (€25.99) + CPX21 Redis (€8.99) + 2× CPX41 workers (€29.99 each) = **€94.96/mo Hetzner**. Run 2 ARQ processes × `max_jobs=20` per worker = 80 concurrent. Deploy in **Hetzner Helsinki or Falkenstein** for Lithuanian latency. Negotiate **SOAX residential enterprise at $0.32/GB (~$960/mo for 3 TB at 25M pages/mo)** or IPRoyal/Decodo at ~$1.50/GB ($4,500). Mix: cheap Webshare DC ($0.018/IP at 60k IPs ≈ $1,080/mo) for unprotected LT sites; residential only for protected DE/UK/PL targets. Self-hosted Crawl4AI + Crawlee for the actual crawler. **Skip Kubernetes** — Docker Compose on each VPS with systemd is sufficient and ~5× cheaper to operate at this scale.

**Self-hosted is the only path to sub-$0.10/task at this volume**. No reputable hosted provider hits sub-$0.02/1k pages including JS rendering retail. Zyte Tier-1 enterprise at $0.10/1k works only if 70%+ of targets are easy.

**Total Phase 2 monthly**: ~€95 Hetzner + $1,500–$5,000 proxies + $200–$1,000 DataForSEO + $0–$500 Exa = **$2,000–$7,500/mo** at 5,000 tasks/day. That's **$0.013–$0.050 per task**, comfortably under the $0.10 ceiling with 2× headroom for traffic spikes.

### Decision triggers table

| Trigger | Action |
|---|---|
| Tasks/day > 100 sustained | Migrate Phase 0 → Phase 1 (CPX31, Webshare residential, delta crawling, dedup) |
| Crawl failure rate > 5% on a target domain | Add residential proxy tier (Webshare $1.40/GB → SOAX $0.32/GB at >500 GB/mo) |
| Duplicate site requests > 100/day across clients | Enable shared crawl cache + Redis singleflight (already in Phase 1 stack — verify it's wired) |
| ARQ queue depth > 1,000 for 10 min | Add worker replica (next CPX41, €29.99/mo) |
| Worker p95 latency > 25 min | Split topology: move Postgres+Redis off worker box |
| Monthly page volume > 1M | Self-hosted beats Apify; > 5M, self-hosted beats Zyte browser-tier |
| Monthly page volume > 500k on a single hard target | Introduce Spider.cloud PAYG for that target only |
| Redis used_memory > 70% | Upsize CPX21 → CPX31 and enable `io-threads=4` |
| One client > 30% of daily volume | Activate DRR fair-queue weight reduction for that client |

### Agency pricing model and margin

Benchmark prices for what SEO tools charge per "audit" or "research report":

- **Screaming Frog SEO Spider**: £199/year desktop license (effectively self-served, not per-audit)
- **Ahrefs**: $129–$1,249/mo subscription, audits included up to credit limits
- **Semrush**: $139.95–$499.95/mo, project-based audits
- **SE Ranking**: $52–$240/mo
- **SiteGuru**: $29–$99/mo per project
- **Sitebulb Cloud**: ~$13.50 per audit (cloud crawl) on top of license
- **Freelance/agency one-off audits**: $500–$5,000 per technical audit deliverable

**Per-task pricing strategy**:
- Phase 0: charge **$2–$5 per research task** (10–60× margin on $0.03–$0.08 cost) — undercut SiteGuru, sell as bulk
- Phase 1: charge **$1–$3 per task** at volume — still 10–30× margin
- Phase 2: charge **$0.30–$1 per task** to compete with DataForSEO white-label resellers — 6–30× margin

The leverage is the **task decomposition**: an agency paying $1 for a "competitor snapshot" gets 95% of their internal cost replaced; you pay $0.40 in DataForSEO calls and pocket $0.60. Type C keyword gap analyses are even better — you charge $5–$10, you pay $2–$4 in DataForSEO, the work is fully automated.

**Trap (Q7)**: agencies churn when audits feel "automated" and the deliverable looks like a generic dashboard export. Even at sub-$0.10 per task internal cost, you must invest in **per-client narrative synthesis** (a small LLM pass over the structured output, branded PDF generation, prioritized fix list) — otherwise you're competing on commodity API resale and DataForSEO will eventually undercut you with their own client portal. The real moat at Phase 2 is the **shared-crawl-cache flywheel**: the more clients in the same vertical you have, the more cross-client cache hits, the cheaper your marginal task — a pricing position competitors can't replicate without your dataset.

---

## Conclusion: design decisions ranked by leverage

The single highest-leverage decision is **task decomposition** — refusing the "research task = full crawl" framing collapses 60–70% of workload onto APIs. Second is **DataForSEO as the resale-legal foundation**, eliminating Ahrefs/Semrush ToS landmines that would otherwise force you to white-label a competitor's product. Third is **the Redis singleflight + shared-cache pattern** that turns vertical-clustering of agency clients into a structural cost advantage. Fourth is **delta crawling with template-aware hashing** (not trafilatura — that breaks on price tickers), which compounds with the cache to make recurring monitoring nearly free.

Everything else — choice of queue library, choice of proxy provider, choice of VPS — is **second-order**. ARQ vs TaskIQ doesn't move the cost curve; SOAX vs IPRoyal is a 4× residential price delta that only matters above 1 TB/month. The Phase-2 economics (~$0.013–$0.050 per task all-in) buy enormous headroom on the $0.10/task ceiling, and that headroom is what funds the per-client narrative synthesis layer that prevents commodification.

The infrastructure ceiling at 5,000 tasks/day is comfortably reachable on **~€95/mo of Hetzner plus variable proxy + API spend**. The real ceiling is product differentiation, not infrastructure cost.