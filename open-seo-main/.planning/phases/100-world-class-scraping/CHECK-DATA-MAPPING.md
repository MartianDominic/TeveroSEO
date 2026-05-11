# SEO Check to SEOExtractionResult Mapping

Phase 100 Week 2: Adapting 52 SEO checks from Cheerio/HTML to JSON data from Scrapling Python service.

## SEOExtractionResult Interface (Source of Truth)

From `src/server/features/scraping/ScraplingClient.ts`:

```typescript
interface SEOExtractionResult {
  url: string;
  title: string | null;
  meta_description: string | null;
  h1_text: string | null;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  h4_count: number;
  h5_count: number;
  h6_count: number;
  headings: Array<{ level: number; text: string }>;
  internal_links: Array<{ href: string; text: string; is_navigation?: boolean }>;
  external_links: Array<{ href: string; text: string; rel?: string }>;
  images: Array<{ src: string; alt: string | null; width?: number; height?: number }>;
  images_without_alt: number;
  schemas: any[];
  schema_types: string[];
  og_data: Record<string, string>;
  twitter_data: Record<string, string>;
  canonical: string | null;
  hreflang_tags: Array<{ lang: string; href: string }>;
  word_count: number;
  body_text: string;
  keyword_in_title: boolean;
  keyword_in_h1: boolean;
  keyword_in_first_paragraph: boolean;
  keyword_density: number;
  meta_robots: string | null;
  is_noindex: boolean;
  has_viewport: boolean;
  html_lang: string | null;
  has_author: boolean;
  extraction_time_ms: number;
}
```

---

## Tier 1 Checks (27 checks)

### T1-01 to T1-05: HTML Signals (`html-signals.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-01 | `$("strong, b")` containing keyword | - | **GAP** | Need `keyword_in_strong: boolean` |
| T1-02 | `$("em, i")` containing keyword | - | **GAP** | Need `keyword_in_emphasis: boolean` |
| T1-03 | `$("noscript")` containing keyword | - | **GAP** | Need `keyword_in_noscript: boolean` |
| T1-04 | `$("strong, b")` count | - | **GAP** | Need `strong_count: number` |
| T1-05 | `$("noscript")` existence | - | **GAP** | Need `has_noscript: boolean` |

### T1-06 to T1-13: Heading Structure (`heading-structure.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-06 | `$("h1")` existence | `h1_count` | OK | Use `h1_count > 0` |
| T1-07 | `$("h1")` count (expect 1) | `h1_count` | OK | Check `h1_count === 1` |
| T1-08 | `$("h1").text()` | `h1_text` | OK | Direct mapping |
| T1-09 | `$("h2")` existence | `h2_count` | OK | Use `h2_count > 0` |
| T1-10 | `$("h2")` count | `h2_count` | OK | Direct mapping |
| T1-11 | `$("h3")` count | `h3_count` | OK | Direct mapping |
| T1-12 | Heading hierarchy | `headings[]` | OK | Iterate `headings` array |
| T1-13 | Keyword in headings | `keyword_in_h1` | PARTIAL | Only H1 tracked; need full heading keyword scan |

### T1-14 to T1-20: Title & Meta (`title-meta.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-14 | `$("title")` existence | `title` | OK | Check `title !== null` |
| T1-15 | `$("title").text()` length | `title` | OK | Check `title.length` |
| T1-16 | `$("title").text()` keyword | `keyword_in_title` | OK | Direct mapping |
| T1-17 | `$('meta[name="description"]')` existence | `meta_description` | OK | Check `meta_description !== null` |
| T1-18 | `$('meta[name="description"]')` length | `meta_description` | OK | Check `meta_description.length` |
| T1-19 | `$('meta[name="description"]')` keyword | - | **GAP** | Need `keyword_in_meta_description: boolean` |
| T1-20 | Title uniqueness (site-wide) | N/A - SiteContext | OK | Uses SiteContext, not DOM |

### T1-26 to T1-32: Content Structure (`content-structure.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-26 | `$("body").text()` word count | `word_count` | OK | Direct mapping |
| T1-27 | `$("nav a"), $('[role="navigation"]')` for TOC | - | **GAP** | Need `has_toc: boolean` |
| T1-28 | `$("p")` analysis | `body_text` | PARTIAL | Paragraph count not extracted |
| T1-29 | `$("ul, ol")` list elements | - | **GAP** | Need `list_count: number` |
| T1-30 | `$("table")` elements | - | **GAP** | Need `table_count: number` |
| T1-31 | First paragraph keyword | `keyword_in_first_paragraph` | OK | Direct mapping |
| T1-32 | `$("blockquote")` elements | - | **GAP** | Need `blockquote_count: number` |

### T1-33 to T1-38: Image Basics (`image-basics.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-33 | `$("img")` count | `images.length` | OK | Direct mapping |
| T1-34 | `$("img[alt]")` presence | `images[].alt` | OK | Filter where `alt !== null` |
| T1-35 | `$("img[alt]")` missing | `images_without_alt` | OK | Direct mapping |
| T1-36 | `$("img[loading='lazy']")` | `images[]` | **GAP** | Need `loading` attribute in image objects |
| T1-37 | `$("img[width][height]")` | `images[].width/height` | OK | Already extracted |
| T1-38 | Image alt keyword | `images[].alt` | OK | Search alt text for keyword |

### T1-39 to T1-43: Internal Links (`internal-links.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-39 | `$("a[href]")` internal filter | `internal_links` | OK | Direct mapping |
| T1-40 | Internal link count | `internal_links.length` | OK | Direct mapping |
| T1-41 | Internal link anchor text | `internal_links[].text` | OK | Direct mapping |
| T1-42 | Navigation vs content links | `internal_links[].is_navigation` | OK | Already extracted |
| T1-43 | Orphan page detection | N/A - SiteContext | OK | Uses SiteContext |

### T1-44 to T1-47: External Links (`external-links.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-44 | `$("a[href]")` external filter | `external_links` | OK | Direct mapping |
| T1-45 | External link count | `external_links.length` | OK | Direct mapping |
| T1-46 | `$("a[rel='nofollow']")` | `external_links[].rel` | OK | Check for `nofollow` in rel |
| T1-47 | External link anchor text | `external_links[].text` | OK | Direct mapping |

### T1-48 to T1-54: Schema Basics (`schema-basics.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-48 | `$('script[type="application/ld+json"]')` | `schemas` | OK | Pre-parsed JSON-LD |
| T1-49 | Schema types present | `schema_types` | OK | Direct mapping |
| T1-50 | Organization schema | `schema_types` | OK | Check for "Organization" |
| T1-51 | Article schema | `schema_types` | OK | Check for "Article" |
| T1-52 | BreadcrumbList schema | `schema_types` | OK | Check for "BreadcrumbList" |
| T1-53 | FAQ schema | `schema_types` | OK | Check for "FAQPage" |
| T1-54 | Schema validation | `schemas` | OK | Validate parsed objects |

### T1-55 to T1-67: Technical Basics (`technical-basics.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-55 | `$('link[rel="canonical"]')` | `canonical` | OK | Direct mapping |
| T1-56 | Canonical self-referencing | `canonical`, `url` | OK | Compare canonical vs url |
| T1-57 | `$('meta[name="robots"]')` | `meta_robots` | OK | Direct mapping |
| T1-58 | noindex detection | `is_noindex` | OK | Direct mapping |
| T1-59 | `$('meta[name="viewport"]')` | `has_viewport` | OK | Direct mapping |
| T1-60 | `$('html').attr('lang')` | `html_lang` | OK | Direct mapping |
| T1-61 | `$('link[rel="alternate"][hreflang]')` | `hreflang_tags` | OK | Direct mapping |
| T1-62 | `$('meta[property^="og:"]')` | `og_data` | OK | Direct mapping |
| T1-63 | `$('meta[name^="twitter:"]')` | `twitter_data` | OK | Direct mapping |
| T1-64 | og:title presence | `og_data.og:title` | OK | Direct mapping |
| T1-65 | og:description presence | `og_data.og:description` | OK | Direct mapping |
| T1-66 | og:image presence | `og_data.og:image` | OK | Direct mapping |
| T1-67 | twitter:card presence | `twitter_data.twitter:card` | OK | Direct mapping |

### T1-68: E-E-A-T Signals (`eeat-signals.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-68 | Author detection patterns | `has_author` | PARTIAL | Basic detection; no author name/bio |

### T1-70 to T1-85: Page Type & Intent Checks

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T1-70 | Page type classification | `body_text`, `schemas` | OK | NLP on body_text + schema hints |
| T1-75 | Value proposition | `body_text` | OK | Text analysis |
| T1-80 | CTA detection | - | **GAP** | Need `has_cta: boolean`, `cta_count: number` |
| T1-82 | Comparison tables | - | **GAP** | Need `has_comparison_table: boolean` |
| T1-85 | Local SEO signals | `schemas` | PARTIAL | Check for LocalBusiness schema |

---

## Tier 2 Checks (17 checks)

### T2-01 to T2-05: Content Quality (`content-quality.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T2-01 | `$("body").text()` for readability | `body_text` | OK | Calculate Flesch-Kincaid on body_text |
| T2-02 | Sentence count | `body_text` | OK | Parse sentences from body_text |
| T2-03 | Avg sentence length | `body_text` | OK | Calculate from body_text |
| T2-04 | Passive voice detection | `body_text` | OK | NLP on body_text |
| T2-05 | Transition words | `body_text` | OK | Pattern matching on body_text |

### T2-06 to T2-08: Anchor Analysis (`anchor-analysis.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T2-06 | Anchor text diversity | `internal_links[].text` | OK | Analyze text distribution |
| T2-07 | Generic anchor text | `internal_links[].text` | OK | Check for "click here", "read more" |
| T2-08 | Exact match anchors | `internal_links[].text` | OK | Compare to keyword |

### T2-09 to T2-14: Schema Completeness (`schema-completeness.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T2-09 | Article schema fields | `schemas` | OK | Validate required fields |
| T2-10 | Product schema fields | `schemas` | OK | Validate required fields |
| T2-11 | Review schema fields | `schemas` | OK | Validate required fields |
| T2-12 | Event schema fields | `schemas` | OK | Validate required fields |
| T2-13 | HowTo schema fields | `schemas` | OK | Validate required fields |
| T2-14 | Recipe schema fields | `schemas` | OK | Validate required fields |

### T2-15 to T2-17: Freshness (`freshness.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T2-15 | Last modified date | `schemas` (dateModified) | PARTIAL | May need HTTP header |
| T2-16 | Published date | `schemas` (datePublished) | OK | Extract from Article schema |
| T2-17 | Date triangulation | `schemas`, `body_text` | OK | Cross-reference schema + visible dates |

### T2-18 to T2-21: Mobile (`mobile.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T2-18 | DOM element position | - | **GAP** | Need element bounding boxes |
| T2-19 | Interstitial detection | - | **GAP** | Need `has_interstitial: boolean` |
| T2-20 | Tap target size | - | **GAP** | Need element dimensions |
| T2-21 | Font size analysis | - | **GAP** | Need computed font sizes |

---

## Tier 3 Checks (13 checks)

### T3-01 to T3-03: Core Web Vitals (`cwv.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T3-01 | LCP | N/A - CrUX API | OK | No DOM needed |
| T3-02 | FID/INP | N/A - CrUX API | OK | No DOM needed |
| T3-03 | CLS | N/A - CrUX API | OK | No DOM needed |

### T3-04 to T3-07: Entity NLP (`entity-nlp.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T3-04 | Named entity extraction | `body_text` | OK | NLP on body_text |
| T3-05 | Topic clustering | `body_text` | OK | NLP on body_text |
| T3-06 | Semantic relevance | `body_text` | OK | NLP on body_text |
| T3-07 | Entity salience | `body_text` | OK | NLP on body_text |

### T3-08 to T3-10: Backlinks (`backlinks.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T3-08 | Backlink count | N/A - DataForSEO | OK | External API |
| T3-09 | Domain authority | N/A - DataForSEO | OK | External API |
| T3-10 | Anchor text profile | N/A - DataForSEO | OK | External API |

### T3-11 to T3-13: Engagement (`engagement.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T3-11 | Bounce rate | N/A - GA4 | OK | Analytics API |
| T3-12 | Time on page | N/A - GA4 | OK | Analytics API |
| T3-13 | Pages per session | N/A - GA4 | OK | Analytics API |

---

## Tier 4 Checks (11 checks)

### T4-01 to T4-05: Architecture (`architecture.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T4-01 | Site depth | N/A - SiteContext | OK | Crawl-level metric |
| T4-02 | URL structure | `url` | OK | Parse URL directly |
| T4-03 | Internal link distribution | N/A - SiteContext | OK | Site-wide analysis |
| T4-04 | Orphan pages | N/A - SiteContext | OK | Site-wide analysis |
| T4-05 | Crawl budget | N/A - SiteContext | OK | Site-wide analysis |

### T4-06 to T4-07: Differentiation (`differentiation.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T4-06 | Content fingerprint | `body_text` | OK | Hash body_text |
| T4-07 | Duplicate detection | `body_text` | OK | Compare fingerprints |

### T4-08 to T4-11: Analytics (`analytics.ts`)

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T4-08 | Traffic trends | N/A - GA4 | OK | Analytics API |
| T4-09 | Conversion rate | N/A - GA4 | OK | Analytics API |
| T4-10 | Top landing pages | N/A - GA4 | OK | Analytics API |
| T4-11 | Search queries | N/A - GSC | OK | Search Console API |

---

## Tier 5 Checks (12 checks)

All Tier 5 checks use `$("body").text()` which maps directly to `body_text`.

### T5-01 to T5-07: Content Quality Signals

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T5-01 | Keyword stuffing | `body_text`, `keyword_density` | OK | Use keyword_density |
| T5-02 | Thin content | `word_count`, `body_text` | OK | Direct mapping |
| T5-03 | Duplicate phrases | `body_text` | OK | NLP on body_text |
| T5-04 | Content depth | `body_text`, `word_count` | OK | Direct mapping |
| T5-05 | Topic coverage | `body_text` | OK | NLP on body_text |
| T5-06 | Reading level | `body_text` | OK | Calculate from body_text |
| T5-07 | Sentiment analysis | `body_text` | OK | NLP on body_text |

### T5-08 to T5-13: Writing Quality

| Check ID | Cheerio Selector | SEOExtractionResult Field | Status | Notes |
|----------|-----------------|---------------------------|--------|-------|
| T5-08 | AI slop detection | `body_text` | OK | Pattern matching |
| T5-09 | Voice consistency | `body_text` | OK | POV marker analysis |
| T5-10 | Filler word ratio | `body_text` | OK | Pattern matching |
| T5-11 | Hedging language | `body_text` | OK | Pattern matching |
| T5-12 | Sentence length | `body_text` | OK | Parse and analyze |
| T5-13 | Paragraph length | `$("p")` | **GAP** | Need `paragraphs: string[]` |

---

## Missing Fields Summary

Fields that need to be added to SEOExtractionResult:

| Field | Type | Used By | Priority |
|-------|------|---------|----------|
| `keyword_in_strong` | `boolean` | T1-01 | Medium |
| `keyword_in_emphasis` | `boolean` | T1-02 | Medium |
| `keyword_in_noscript` | `boolean` | T1-03 | Low |
| `strong_count` | `number` | T1-04 | Low |
| `has_noscript` | `boolean` | T1-05 | Low |
| `keyword_in_meta_description` | `boolean` | T1-19 | **High** |
| `has_toc` | `boolean` | T1-27 | Medium |
| `paragraph_count` | `number` | T1-28 | Medium |
| `list_count` | `number` | T1-29 | Low |
| `table_count` | `number` | T1-30 | Low |
| `blockquote_count` | `number` | T1-32 | Low |
| `images[].loading` | `string` | T1-36 | Medium |
| `has_cta` | `boolean` | T1-80 | Medium |
| `cta_count` | `number` | T1-80 | Low |
| `has_comparison_table` | `boolean` | T1-82 | Low |
| `has_interstitial` | `boolean` | T2-19 | Low |
| `paragraphs` | `string[]` | T5-13 | Medium |

### High Priority Gaps (Block core SEO checks)

1. **`keyword_in_meta_description`** - Critical for on-page SEO scoring

### Medium Priority Gaps (Enhance check quality)

2. **`keyword_in_strong`** - Traditional SEO signal
3. **`keyword_in_emphasis`** - Traditional SEO signal
4. **`has_toc`** - Content structure signal
5. **`paragraph_count`** - Content structure signal
6. **`images[].loading`** - Performance signal
7. **`has_cta`** - Conversion signal
8. **`paragraphs`** - Needed for T5-13 paragraph analysis

### Low Priority Gaps (Nice to have)

- `keyword_in_noscript`, `strong_count`, `has_noscript`
- `list_count`, `table_count`, `blockquote_count`
- `cta_count`, `has_comparison_table`, `has_interstitial`

---

## Adapter Layer Strategy

For checks that can't map directly, create adapter functions:

```typescript
// Example: T5-13 paragraph length needs DOM
function extractParagraphsFromBody(bodyText: string): string[] {
  // Split on double newlines (common paragraph separator)
  return bodyText.split(/\n\n+/).filter(p => p.trim().length > 20);
}

// Example: T2 mobile checks need external measurement
function getMobileMetrics(url: string): Promise<MobileMetrics> {
  // Use Lighthouse or PSI API
  return lighthouseService.analyze(url);
}
```

---

## Implementation Checklist

- [ ] Add high-priority missing fields to Python extractor
- [ ] Add medium-priority missing fields to Python extractor  
- [ ] Create TypeScript adapter layer for SEOExtractionResult
- [ ] Update CheckContext type to accept JSON data
- [ ] Migrate Tier 1 checks (27 checks)
- [ ] Migrate Tier 2 checks (17 checks)
- [ ] Migrate Tier 3 checks (13 checks) - mostly API-based, minimal changes
- [ ] Migrate Tier 4 checks (11 checks) - mostly SiteContext-based
- [ ] Migrate Tier 5 checks (12 checks) - all use body_text
- [ ] Update unit tests for JSON-based checks
- [ ] Performance benchmark: JSON vs Cheerio parsing
