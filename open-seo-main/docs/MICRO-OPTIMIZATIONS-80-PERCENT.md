# The Remaining 30-40%: 100+ Micro-Optimizations to Reach 80%+

> **Premise:** Kyle Roof proved that URL + Title + H1 + Body = 60-70% of on-page SEO.
> 
> **Our Differentiator:** Run 100+ cheap, automated checks that compound to push sites from 60-70% to 80%+. Most tools stop at the basics. We don't.

---

## Table of Contents

1. [Tier 1: DOM/Regex Checks (Instant, ~40 items)](#tier-1-domregex-checks-instant)
2. [Tier 2: Light Calculation (~25 items)](#tier-2-light-calculation)
3. [Tier 3: API-Required (~25 items)](#tier-3-api-required)
4. [Tier 4: Crawl-Required (~15 items)](#tier-4-crawl-required)
5. [Implementation Matrix](#implementation-matrix)

---

## Tier 1: DOM/Regex Checks (Instant)

These run in milliseconds on raw HTML. No external calls.

### A. Secondary HTML Signals (Kyle Roof Group B/C)

| # | Check | How | Why |
|---|-------|-----|-----|
| 1 | **Keyword in `<strong>`/`<b>`** | `querySelectorAll('strong, b')` + regex | Group C factor, "ranks well for secondary keywords" |
| 2 | **Keyword in `<em>`/`<i>`** | `querySelectorAll('em, i')` + regex | Group C factor, confirmed additive |
| 3 | **Keyword in `<a title="">`** | `querySelectorAll('a[title]')` | Roof confirmed: "minor signal" |
| 4 | **Keyword in `<noscript>`** | Parse noscript tags | Roof: "confirmed it counts" |
| 5 | **Keyword in first `<p>` tag** | First paragraph element | Must be in `<p>`, not div/span |

### B. Heading Structure

| # | Check | How | Why |
|---|-------|-----|-----|
| 6 | **Single H1** | `querySelectorAll('h1').length === 1` | Multiple H1s dilute signal |
| 7 | **H1 under 65 chars** | H1 text length | Matt Diggity spec |
| 8 | **H1 matches Title** | Compare title vs H1 | Roof: "identical always wins" |
| 9 | **H3 nesting under H2** | Parse heading tree | No orphan H3s |
| 10 | **H4 nesting under H3** | Parse heading tree | Semantic hierarchy |
| 11 | **Keyword in first H2** | First H2 text | Structural importance |
| 12 | **Keyword in last H2** | Last H2 text | Reinforcement signal |
| 13 | **H2 count vs benchmark** | Count H2s, compare to 5-12 range | Competitor alignment |

### C. Title/Meta

| # | Check | How | Why |
|---|-------|-----|-----|
| 14 | **Title 50-60 chars** | Character count | Prevents truncation |
| 15 | **Keyword in first 30 chars of title** | indexOf check | Front-loading matters |
| 16 | **Brackets/parentheses in title** | Regex `[\[\]\(\)]` | +40% CTR (HubSpot) |
| 17 | **Year in title** | Regex for current year | Freshness signal |
| 18 | **Meta description 140-160 chars** | Character count | Optimal display length |
| 19 | **Meta description has keyword** | Regex match | Google bolds matches |
| 20 | **Meta description has CTA verb** | Pattern match | CTR improvement |

### D. URL Structure

| # | Check | How | Why |
|---|-------|-----|-----|
| 21 | **Hyphens not underscores** | URL parsing | Word separation |
| 22 | **All lowercase** | URL parsing | Consistency |
| 23 | **3-5 words in slug** | Path segment count | Short URLs rank better |
| 24 | **No keyword repetition in path** | Check segments | Avoids over-optimization |
| 25 | **Max 2 subfolder depth** | Count slashes | Crawl priority |

### E. Content Structure

| # | Check | How | Why |
|---|-------|-----|-----|
| 26 | **Keyword in first 100 words** | Extract first 100 words | Core signal, often missed |
| 27 | **Keyword 2x in first 100 words** | Count occurrences | Compounds boost |
| 28 | **Short intro (5-8 sentences)** | Count before first H2 | Brian Dean spec |
| 29 | **1-2 sentence paragraphs** | Sentence count per `<p>` | Skyscraper 2.0 |
| 30 | **TOC on pages >1,500 words** | Detect nav/TOC element | Jump links, engagement |
| 31 | **TOC anchors resolve** | Verify `#id` elements exist | UX signal |
| 32 | **30-40 word answer after H2** | Word count after each H2 | Featured snippet pattern |

### F. Image Basics

| # | Check | How | Why |
|---|-------|-----|-----|
| 33 | **All images have alt** | `img:not([alt])` | Accessibility + signal |
| 34 | **Alt text descriptive** | Not empty, not "image" | Quality alt text |
| 35 | **Explicit width/height** | `img:not([width])` | CLS prevention |
| 36 | **loading="lazy" on images** | Attribute check | LCP optimization |
| 37 | **WebP/AVIF format** | Check extension/type | Performance |
| 38 | **Lowercase hyphenated filename** | Parse src | Minor signal |

### G. Internal Links

| # | Check | How | Why |
|---|-------|-----|-----|
| 39 | **3-10 internal links in body** | Count, exclude nav/footer | Surfer: >10 = no extra lift |
| 40 | **First link in first 2 paragraphs** | Position check | "Link high and tight" |
| 41 | **No duplicate anchors to same URL** | Group by href | First-link-priority rule |
| 42 | **At least one exact-match anchor** | Anchor text analysis | ~5x traffic (Shepard) |
| 43 | **No empty anchor links** | `a:empty` check | Wasted opportunity |

### H. External Links

| # | Check | How | Why |
|---|-------|-----|-----|
| 44 | **2-5 outbound links per 1,500 words** | Count external links | Citation density |
| 45 | **No nofollow on citations** | Check rel attribute | Trust signal |
| 46 | **target="_blank" on external** | Attribute check | UX - prevents pogo-stick |
| 47 | **rel="noopener" on external** | Security check | Best practice |

### I. Schema Basics

| # | Check | How | Why |
|---|-------|-----|-----|
| 48 | **JSON-LD present** | Parse script[type="application/ld+json"] | Structured data |
| 49 | **Article schema has author** | Check author property | E-E-A-T |
| 50 | **datePublished in ISO 8601** | Regex validate | Freshness triangulation |
| 51 | **dateModified present** | Check property | Freshness signal |
| 52 | **BreadcrumbList present** | Schema type check | 40% CTR impact |
| 53 | **No HowTo schema** | Flag for removal | Deprecated Sep 2023 |
| 54 | **FAQPage only for gov/health** | Flag if present on other | Restricted Aug 2023 |

### J. Technical Basics

| # | Check | How | Why |
|---|-------|-----|-----|
| 55 | **Self-referencing canonical** | Compare canonical to URL | Prevents duplicates |
| 56 | **Canonical is absolute URL** | Check for protocol | Best practice |
| 57 | **HTTPS** | Protocol check | Minor ranking factor |
| 58 | **No mixed content** | Check for http:// resources | Security signal |
| 59 | **Viewport meta present** | Check for viewport tag | Mobile-first |

### K. E-E-A-T Signals

| # | Check | How | Why |
|---|-------|-----|-----|
| 60 | **Author byline present** | DOM pattern for author | E-E-A-T signal |
| 61 | **Author links to author page** | Check byline href | Verification depth |
| 62 | **Author bio >=150 words** | Word count | Substance signal |
| 63 | **Author bio >=300 words (YMYL)** | Word count for sensitive topics | YMYL requirement |
| 64 | **Credentials in bio** | Regex for MD, PhD, CPA, etc. | Expertise signal |
| 65 | **About page exists** | Check /about 200 | Trust signal |
| 66 | **Contact page exists** | Check /contact 200 | Trust signal |

---

## Tier 2: Light Calculation

Requires some computation but no external APIs.

### L. Content Quality Metrics

| # | Check | How | Why |
|---|-------|-----|-----|
| 67 | **Reading level <= Grade 9** | Flesch-Kincaid calculation | AEO readability |
| 68 | **Keyword density < 3%** | (count/words)*100 | Over-optimization risk |
| 69 | **Word count by query type** | Compare to benchmark ranges | Alignment signal |
| 70 | **Statistics every 150-200 words** | Regex for numbers, calculate density | +37% AI visibility |
| 71 | **Section word count 167-278** | Split by H2, count | Roof's LSI development spec |

### M. Anchor Text Analysis

| # | Check | How | Why |
|---|-------|-----|-----|
| 72 | **>=10 unique anchor variations** | Count unique per target | Diversity signal |
| 73 | **50% exact / 25% branded / 25% misc** | Categorize and calculate | Natural ratio |
| 74 | **Links evenly distributed** | Calculate position percentiles | Not bunched |

### N. Schema Completeness

| # | Check | How | Why |
|---|-------|-----|-----|
| 75 | **author.url to author page** | Validate URL exists | E-E-A-T |
| 76 | **author.sameAs has 3+ links** | Count sameAs array | Cross-platform verification |
| 77 | **author.sameAs includes LinkedIn** | Check for linkedin.com | Required per doc |
| 78 | **Organization sameAs array** | Check for Wikipedia, LinkedIn, Twitter | Brand verification |
| 79 | **publisher.logo >= 112x112px** | Image dimension check | Google requirement |
| 80 | **citation array on YMYL** | Check for citation property | Trust signal |

### O. Freshness Signals

| # | Check | How | Why |
|---|-------|-----|-----|
| 81 | **Visible date matches schema date** | Compare byline to dateModified | Triangulation |
| 82 | **sitemap lastmod matches schema** | Compare sources | Consistency |
| 83 | **No date-only updates** | Track content diffs | Gaming detection |

### P. Mobile Checks

| # | Check | How | Why |
|---|-------|-----|-----|
| 84 | **H1 above fold on mobile** | Viewport simulation | UX signal |
| 85 | **No interstitials on load** | Overlay detection | Page Experience |
| 86 | **Tap targets >= 48px** | Element size check | Mobile usability |
| 87 | **Text >= 16px on mobile** | Font size check | Readability |

---

## Tier 3: API-Required

Requires external API calls.

### Q. Core Web Vitals

| # | Check | How | Why |
|---|-------|-----|-----|
| 88 | **LCP <= 2.5s** | CrUX API | LCP >3s = -23% traffic |
| 89 | **INP <= 200ms** | CrUX API | 43% of sites fail this |
| 90 | **CLS <= 0.1** | CrUX API | Layout shift penalty |

### R. Entity/NLP Analysis

| # | Check | How | Why |
|---|-------|-----|-----|
| 91 | **Entity coverage >= 60%** | Google NLP API | Topical completeness |
| 92 | **Central entity in every section** | Entity extraction per section | Cohesion signal |
| 93 | **No term > 2x competitor max** | TF-IDF comparison | Over-optimization |
| 94 | **Semantic gap identification** | Term difference analysis | Content gaps |

### S. Backlink Analysis

| # | Check | How | Why |
|---|-------|-----|-----|
| 95 | **Link velocity 5-10/month (new)** | Backlink API | Natural growth |
| 96 | **Anchor text ratio natural** | Categorize backlinks | Spam detection |
| 97 | **Outbound link DR 50+** | Check linked domain DR | Citation quality |

### T. Engagement Proxies

| # | Check | How | Why |
|---|-------|-----|-----|
| 98 | **CTR vs position expectation** | GSC API | NavBoost signal |
| 99 | **Scroll depth >= 60%** | GA4 data | Engagement quality |
| 100 | **Bounce rate vs benchmark** | GA4 data | Bad clicks signal |

---

## Tier 4: Crawl-Required

Requires full site crawl.

### U. Site Architecture

| # | Check | How | Why |
|---|-------|-----|-----|
| 101 | **Click depth <= 3** | BFS from homepage | Crawl priority |
| 102 | **No orphan pages** | Inbound link count = 0 | Discovery failure |
| 103 | **Pillar links to all spokes** | Hub-spoke mapping | Cluster architecture |
| 104 | **Spokes link back to pillar** | Bidirectional check | Authority flow |
| 105 | **15-25 spokes per cluster** | Count per pillar | Topical authority |

### V. Content Differentiation

| # | Check | How | Why |
|---|-------|-----|-----|
| 106 | **30-40% unique between similar pages** | Similarity scoring | Thin content prevention |
| 107 | **No scaled content patterns** | Sequence matching | Spam detection |

---

## Implementation Matrix

### By Cost to Implement

| Tier | Count | Implementation | Run Time |
|------|-------|----------------|----------|
| **Tier 1** | 66 | Pure HTML parsing | <100ms |
| **Tier 2** | 21 | Light computation | <500ms |
| **Tier 3** | 13 | API calls | 2-5s |
| **Tier 4** | 7 | Site crawl | Minutes |
| **TOTAL** | **107** | | |

### By Category

| Category | Count | Impact |
|----------|-------|--------|
| HTML Signals | 13 | Low-Medium each, compounds |
| Heading Structure | 8 | Medium |
| Title/Meta | 7 | High (CTR) |
| URL Structure | 5 | Medium |
| Content Structure | 7 | High |
| Image Optimization | 6 | Medium |
| Internal Links | 5 | High |
| External Links | 4 | Medium |
| Schema | 14 | Medium-High |
| Technical | 5 | High (gating) |
| E-E-A-T | 7 | High (YMYL critical) |
| Content Quality | 5 | High |
| Anchor Text | 3 | Medium |
| Freshness | 3 | Medium |
| Mobile | 4 | High (gating) |
| CWV | 3 | High (gating) |
| NLP/Entity | 4 | High |
| Backlinks | 3 | Medium |
| Engagement | 3 | High |
| Architecture | 5 | High |
| Differentiation | 2 | High |

---

## Scoring System

### Calculation

```
Base Score: 60 points (URL + Title + H1 + Body present)

Tier 1 Checks: +0.3 points each (max +20)
Tier 2 Checks: +0.5 points each (max +10)
Tier 3 Checks: +0.8 points each (max +10)

Total Possible: 100 points
```

### Thresholds

| Score | Rating | Meaning |
|-------|--------|---------|
| 90+ | Excellent | Outranks most competitors |
| 80-89 | Good | Competitive for medium KD |
| 70-79 | Average | Basic optimization only |
| <70 | Poor | Missing fundamentals |

### Hard Gates (Instant Fails)

These cap your score regardless of other optimizations:

1. **CWV "Poor" on any metric** → Max 75/100
2. **noindex or robots block** → Max 0/100
3. **No author signal on YMYL** → Max 60/100
4. **Duplicate content >60%** → Max 50/100

---

## Quick Start: First 20 Checks to Implement

These give the highest ROI for implementation effort:

1. Single H1 under 65 chars
2. H1 matches Title
3. Title 50-60 chars with keyword front-loaded
4. Keyword in first 100 words (2x)
5. Meta description 140-160 chars with CTA
6. 3-10 internal links with one exact-match anchor
7. Self-referencing canonical
8. BreadcrumbList schema
9. Author byline linking to author page
10. Article schema with dateModified
11. Keyword in at least one `<strong>` tag
12. 30-40 word answer after first H2
13. All images have alt and dimensions
14. TOC on long content
15. Reading level <= Grade 9
16. Keyword density < 3%
17. No orphan H3s (proper nesting)
18. Hyphens in URL, max 2 depth
19. Outbound links to DR 50+ sources
20. LCP <= 2.5s

---

## Competitive Advantage

**What most SEO tools check:**
- Title present ✓
- Meta description present ✓
- H1 present ✓
- Alt text present ✓
- Basic CWV ✓

**What we check that they don't:**
- 107 specific, countable signals
- Roof's Group B/C factors
- Schema completeness scoring
- Anchor text distribution
- Entity coverage
- Freshness triangulation
- Click depth analysis
- Content differentiation scoring

**Result:** While competitors stop at 60-70%, we push clients to 80%+.

---

## Appendix: Evidence Sources

| Source | Contribution |
|--------|-------------|
| Kyle Roof (US Patent #10,540,263 B1) | Factor groupings, testing methodology |
| Zyppy 23M Internal Links Study | Anchor text, link count signals |
| Koray Gubur (Getwordly) | Entity optimization, semantic structure |
| Brian Dean (Backlinko) | Content structure, CTR signals |
| Matt Diggity | Anchor ratios, topic clusters |
| Google Leak (DOJ) | NavBoost, freshness triangulation |
| Dec 2025 Core Update | CWV impact data, E-E-A-T expansion |
| Princeton/IIT GEO Research | AI visibility signals |

---

*Document Version: 1.0*
*Created: 2026-04-22*
*Based on: 6 parallel Opus agent analysis of research corpus*
