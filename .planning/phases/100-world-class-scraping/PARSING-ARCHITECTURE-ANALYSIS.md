# Parsing Architecture Analysis: Cheerio vs node-html-parser vs Scrapling

> **Investigation:** 4 Opus subagents (2026-05-11)
> **User Question:** Why use 2 systems (Node.js fetch + Node.js parse) when Scrapling auto-parses?

---

## The Real Answer

**The 109 SEO checks are deeply integrated with Cheerio's jQuery-like DOM API.** They use patterns that require a live DOM:

```typescript
// T1-28: Intro before first H2 (needs DOM traversal)
h1.nextUntil("h2").each((_, el) => { ... })

// T2-18: Mobile tap targets (needs ancestor chain)
element.parents().each((_, parent) => { ... })

// Content extraction (needs clone + mutation)
$("body").clone().find("script, style").remove().text()
```

**If Scrapling parses, these checks can't run** without one of:
1. **Rewriting 109 checks for Python** (3-4 weeks + 2 weeks testing)
2. **Serializing DOM to JSON** (lossy - can't traverse a JSON object like a DOM)
3. **Sending HTML back to Node.js anyway** (defeats the purpose)

---

## Cheerio Usage Deep Dive

### Current State: 30 files use Cheerio

| Category | File Count | Complexity |
|----------|------------|------------|
| Simple selectors (title, meta) | 18 | LOW |
| Medium (iteration, attributes) | 8 | MEDIUM |
| Complex (`.parents()`, `.clone()`, `.nextUntil()`) | 4 | HIGH |

### The Complex Patterns That Block Migration

| Pattern | Files Using | Why It Matters |
|---------|-------------|----------------|
| `.parents()` | link-extractor.ts | Determines link position (nav/header/footer) |
| `.closest()` | link-extractor.ts | Finds containing element |
| `.nextUntil()` | content-structure.ts | Gets intro text between H1 and H2 |
| `.clone().remove()` | 9 files | Extracts text without scripts/styles |
| `.siblings()` | VerticalClassifier.ts | Pattern detection |

**These cannot be pre-extracted.** They depend on the specific DOM structure of each page.

---

## Parser Speed Benchmarks (2026)

| Parser | Speed (ms/page) | Language | Notes |
|--------|-----------------|----------|-------|
| **Scrapling (lxml)** | 2.02 | Python | Same as Parsel/Scrapy |
| **node-html-parser** | 2.04 | Node.js | 6x faster than Cheerio |
| **htmlparser2** | 2.38 | Node.js | Cheerio's backend |
| **Cheerio** | 12.21 | Node.js | Full jQuery API |
| **BeautifulSoup** | 1584.31 | Python | Do not use |

**Key insight:** Scrapling and node-html-parser are equally fast (2ms). The language doesn't matter for parse speed.

---

## What Scrapling's Auto-Parsing Actually Does

Scrapling's parsing layer provides:

```python
from scrapling.parser import Selector

page = Selector(html)
title = page.css('title::text').get()
links = page.css('a::attr(href)').getall()
```

**Features:**
- `::text` and `::attr()` pseudo-elements (Scrapy-compatible)
- XPath support (native lxml)
- Auto-matching (survives DOM changes)
- Similar element finding

**What's NOT useful for SEO:**
- **Auto-matching** - SEO selectors are stable (`title`, `meta[name="description"]`, `h1`)
- **Similar finding** - We know exactly what to extract
- **Adaptive** - No need to track elements across scrapes

---

## The Three Options Analyzed

### Option A: Keep Parsing in Node.js (RECOMMENDED)
```
TieredFetcher (TS) → HTML → Cheerio/node-html-parser (TS) → 109 checks
```

**Pros:**
- Zero migration (109 checks work as-is)
- Single language
- 10ms parse overhead is negligible vs 100-2000ms network latency

**Cons:**
- Need Python service for TLS impersonation anyway

### Option B: Scrapling for Fetch + Common Extraction
```
Scrapling (Python) → JSON {title, meta, h1s, links} → TS → 109 checks
```

**Pros:**
- Unified fetch + parse in Python
- Returns structured data

**Cons:**
- **Most checks need DOM, not JSON** - can't run `.nextUntil()` on JSON
- Need to return HTML for complex checks anyway
- IPC overhead for JSON serialization

### Option C: Full Python Migration
```
Scrapling (Python) → Scrapling Selector → Python checks → Results to TS
```

**Pros:**
- Truly unified
- lxml is fast

**Cons:**
- **3-4 weeks to port 109 checks to Python**
- **2 weeks to port tests**
- All future check development in Python
- 4,360 lines of check code to rewrite

---

## The Real Problem Is Not Parsing

From Agent 4's analysis:

| Bottleneck | Time Impact | Fix |
|------------|-------------|-----|
| `concurrency ?? 10` | 13.8 min | Change to 200 |
| TLS fingerprinting | 4-6 min retries | curl_cffi at T0-T2 |
| Cheerio parse time | 1.25 min | Marginal |

**Parsing is 1.25 minutes out of 15 minutes total.** The bottleneck is concurrency and TLS detection.

Even if we got parsing to 0ms, we'd save 1.25 minutes. But fixing concurrency saves 13.8 minutes.

---

## Hybrid Architecture (Best of Both Worlds)

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCRAPING FLOW                                │
│                                                                  │
│  curl_cffi Python (fetch with TLS impersonation)                │
│           │                                                      │
│           │ Returns HTML (not parsed)                           │
│           ↓                                                      │
│  Cheerio/node-html-parser (TS)                                  │
│           │                                                      │
│           │ DOM available for 109 checks                        │
│           ↓                                                      │
│  109 SEO checks (TS) — uses CheckContext.$                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Why this works:**
1. curl_cffi handles TLS impersonation (the actual problem)
2. Parsing stays in Node.js where checks live
3. IPC overhead is just HTML transfer (fast, cacheable)
4. No check rewriting needed

**Why NOT full Scrapling:**
1. Scrapling's parsing isn't faster than node-html-parser
2. Scrapling's special features (auto-match, adaptive) aren't useful for SEO
3. 109 checks would need rewriting

---

## Scrapling Auto-Match: Why It's Irrelevant

The auto-match feature is for e-commerce scraping where:
- Product divs change class names frequently
- Site redesigns break selectors
- Need to "relocate" elements automatically

For SEO, selectors are **standardized**:
```css
title                              /* never changes */
meta[name="description"]           /* HTML standard */
meta[property="og:title"]          /* Open Graph spec */
h1, h2, h3                         /* semantic HTML */
script[type="application/ld+json"] /* JSON-LD spec */
a[href]                            /* links */
img[src]                           /* images */
```

**These selectors never break.** Auto-matching adds overhead for zero benefit.

---

## Final Recommendation

| Layer | Technology | Reason |
|-------|------------|--------|
| **Fetching** | curl_cffi (Python sidecar) | TLS impersonation |
| **Parsing** | Cheerio → node-html-parser (10 files) | 109 checks need jQuery API |
| **Checks** | TypeScript (no change) | Already written, tested |

**Do NOT:**
- Move parsing to Python (checks can't use it)
- Use Scrapling's parser (no benefit over node-html-parser)
- Rewrite 109 checks (massive effort, no payoff)

**DO:**
1. Add curl_cffi for TLS impersonation at T0-T2
2. Keep parsing in Node.js
3. Optionally migrate 10 simple files to node-html-parser (6x faster)

---

## References

- Agent 1: Cheerio usage analysis (30 files)
- Agent 2: Scrapling parsing capabilities (lxml, 2.02ms)
- Agent 3: node-html-parser benchmarks (2.04ms)
- Agent 4: Architecture decision matrix (Option A: 9.5/10)
