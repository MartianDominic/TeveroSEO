# Cheerio-Based Scraping and Parsing System Analysis

> **Phase 92: On-Page SEO Mastery**
> Analysis Date: 2026-05-07
> Focus: Understanding the current HTML parsing architecture for integration with On-Page SEO Mastery

## Executive Summary

The TeveroSEO open-seo-main codebase uses Cheerio extensively as its primary HTML parsing engine. The system follows a layered architecture where HTML flows through: **Fetch -> Parse -> Extract -> Analyze -> Score**. Cheerio instances are typically created per-document, with the check runner creating a shared instance for efficiency.

**Key Statistics:**
- 26+ files import cheerio directly
- 2 distinct check systems: 109 Tier 1-4 SEO checks + 41-point On-Page Mastery scorecard
- 5 major extraction domains: SEO metadata, links, content chunks, platform detection, vertical classification

---

## 1. Core HTML Fetching Layer

### 1.1 HybridCrawler (`/src/server/lib/crawler/hybrid-crawler.ts`)

**Purpose:** High-performance site crawler with HTTP-first approach and Playwright fallback.

**Key Functions:**
```typescript
crawlSite(tenantId: string, sitemapUrl: string, onProgress?: Function): Promise<{results: CrawlResult[], summary: CrawlSummary}>
fetchPage(url: string): Promise<CrawlResult>
fetchWithPlaywright(url: string, fetchStart: number): Promise<CrawlResult>
```

**Input:** Sitemap URL
**Output:** `CrawlResult[]` containing:
- `url: string` - final URL after redirects
- `html: string` - raw HTML content
- `statusCode: number` - HTTP status
- `fetchMethod: "http" | "playwright"` - method used
- `changeType: ChangeType` - delta sync classification
- `fetchTimeMs: number` - fetch duration

**Features:**
- Concurrency control via semaphore (default: 50 concurrent requests)
- Redirect loop detection with visited URL tracking (max 10 redirects)
- Playwright fallback for JS-heavy or consent-blocked pages
- Delta sync integration via lastmod filtering

**Dependencies:**
- `sitemap-parser.ts` for sitemap URL extraction
- `delta-sync.ts` for change detection
- `lightrag/extraction-pipeline.ts` for page validation

---

### 1.2 Sitemap Parser (`/src/server/lib/crawler/sitemap-parser.ts`)

**Purpose:** Parse XML sitemaps with metadata extraction.

**Key Functions:**
```typescript
parseSitemap(sitemapUrl: string): Promise<SitemapParseResult>
fetchAllSitemapUrls(sitemapUrl: string, maxDepth?: number): Promise<SitemapUrl[]>
filterByLastmod(urls: SitemapUrl[], sinceDate: Date, maxAgeDays?: number): FilterResult
```

**Input:** Sitemap URL
**Output:** `SitemapUrl[]`:
- `loc: string` - page URL
- `lastmod: Date | null` - last modification date
- `changefreq: string | null` - change frequency
- `priority: number | null` - sitemap priority

**Notes:**
- Uses `fast-xml-parser` (NOT cheerio) for XML parsing
- Handles sitemap indexes recursively (max depth: 2)
- Platform-aware lastmod handling (Magento garbage timestamps filtered)

---

### 1.3 Discovery Module (`/src/server/lib/audit/discovery.ts`)

**Purpose:** Discover page URLs via robots.txt and sitemaps.

**Key Functions:**
```typescript
fetchRobotsTxt(origin: string): Promise<RobotsResult>
discoverUrls(origin: string, maxPages?: number): Promise<DiscoveryResult>
```

**Output:** `{ urls: string[], robots: RobotsResult, sitemapFetchResult: SitemapFetchResult }`

**Features:**
- Parses robots.txt using `robots-parser` library
- Tries default `/sitemap.xml` if not in robots.txt
- Concurrent sitemap fetching (5 parallel)
- Max 300 sitemap documents, 50k URLs

---

## 2. Page Analysis Layer (Cheerio-Based)

### 2.1 Page Analyzer (`/src/server/lib/audit/page-analyzer.ts`)

**Purpose:** Extract all SEO-relevant data from HTML using Cheerio.

**Key Function:**
```typescript
analyzeHtml(
  html: string,
  pageUrl: string,
  statusCode: number,
  responseTimeMs: number,
  redirectUrl?: string | null
): PageAnalysis
```

**Input:**
- `html: string` - raw HTML content
- `pageUrl: string` - canonical URL
- `statusCode: number` - HTTP response code
- `responseTimeMs: number` - fetch latency

**Output:** `PageAnalysis` interface:
```typescript
interface PageAnalysis {
  url: string;
  statusCode: number;
  redirectUrl: string | null;
  responseTimeMs: number;
  
  // Head metadata
  title: string;
  metaDescription: string;
  canonical: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  
  // Headings
  h1s: string[];
  headingOrder: number[];
  
  // Content
  wordCount: number;
  
  // Images
  images: Array<{ src: string | null; alt: string | null }>;
  
  // Links
  internalLinks: string[];
  externalLinks: string[];
  
  // Structured data
  hasStructuredData: boolean;
  
  // Hreflang
  hreflangTags: string[];
}
```

**Cheerio Usage Pattern:**
```typescript
const $ = cheerio.load(html);

// Title extraction
const title = $("title").first().text().trim();

// Meta description
const metaDescription = $('meta[name="description"]').first().attr("content")?.trim() ?? "";

// Word count (clean body text)
const bodyClone = $("body").clone();
bodyClone.find("script, style, noscript, svg").remove();
const bodyText = bodyClone.text().replace(/\s+/g, " ").trim();
const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

// Links with normalization
$("a[href]").each((_, el) => {
  const href = $(el).attr("href");
  // Skip javascript:, mailto:, tel:, #anchors
  if (/^(javascript:|mailto:|tel:|#)/.test(href)) return;
  // Normalize and classify as internal/external
});
```

---

### 2.2 Template-Aware Hash (`/src/server/lib/crawler/template-hash.ts`)

**Purpose:** Compute stable SEO content hashes by removing dynamic blocks.

**Key Functions:**
```typescript
computeTemplateAwareHash(html: string): TemplateHashResult
hasSemanticChanges(oldHtml: string, newHtml: string): boolean
```

**Dynamic Blocks Removed:**
- Price/inventory: `.price`, `.stock`, `[itemprop="price"]`
- Social proof: `.product-reviews-count`, `.recently-viewed`
- Personalized content: `.recommended`, `.related-products`
- Cookie banners: `.cookie-banner`, `#onetrust-banner`
- Scripts/styles: `script`, `style`, `noscript`, `iframe`

**SEO-Relevant Content Extracted:**
- Meta tags: `title`, `meta[name="description"]`, OG tags
- Headings: `h1`, `h2`, `h3`
- Schema: `[itemprop="description"]`, `[itemprop="name"]`
- Main content: `main`, `article`, `.product-description`, `.content`

**Cheerio Pattern:**
```typescript
const $ = cheerio.load(html);

// Step 1: Remove dynamic blocks
for (const selector of DYNAMIC_BLOCKS) {
  $(selector).remove();
}

// Step 2: Extract SEO content
for (const selector of SEO_RELEVANT) {
  $(selector).each((_, el) => {
    let content = el.name === "meta" ? $(el).attr("content") : $(el).text();
    // Normalize and accumulate
  });
}

// Step 3: SHA256 hash
const hash = createHash("sha256").update(canonicalContent).digest("hex");
```

---

## 3. SEO Check System (Tier 1-4)

### 3.1 Check Runner (`/src/server/lib/audit/checks/runner.ts`)

**Purpose:** Execute all SEO checks against HTML with shared Cheerio instance.

**Key Functions:**
```typescript
runChecks(html: string, url: string, options?: ExtendedRunChecksOptions): Promise<CheckResult[]>
runTier1Checks(html: string, url: string, keyword?: string): Promise<CheckResult[]>
runLocalChecks(html: string, url: string, keyword?: string): Promise<CheckResult[]>
```

**Input:**
- `html: string` - page HTML (max 5MB for DoS mitigation)
- `url: string` - validated URL (http/https only)
- `options`: tiers to run, keyword, pageAnalysis, siteContext, responseHeaders

**Output:** `CheckResult[]`:
```typescript
interface CheckResult {
  checkId: string;
  passed: boolean;
  severity: CheckSeverity;
  message: string;
  details?: Record<string, unknown>;
  autoEditable: boolean;
  editRecipe?: string;
}
```

**Shared Cheerio Pattern:**
```typescript
// Parse HTML ONCE, share across all checks
const $ = cheerio.load(html);

const ctx: CheckContext = {
  $,           // Shared Cheerio instance
  html,        // Raw HTML backup
  url,         // Page URL
  keyword,     // Target keyword
  pageAnalysis,
  siteContext,
  responseHeaders,
};

// Run checks with shared context
for (const check of checks) {
  const result = await check.run(ctx);
}
```

**Timeout Protection:**
- Per-check timeout: 30 seconds
- Total timeout: 5 minutes
- Deduplication by checkId + element

---

### 3.2 Check Registry (`/src/server/lib/audit/checks/registry.ts`)

**Purpose:** Central storage for all 109 SEO checks.

**Key Functions:**
```typescript
registerCheck(check: CheckDefinition): void
getChecksByTier(tier: CheckTier): CheckDefinition[]
getChecksByCategory(category: CheckCategory): CheckDefinition[]
getAllChecks(): CheckDefinition[]
```

**Check Definition Interface:**
```typescript
interface CheckDefinition {
  id: string;              // e.g., "T1-01"
  name: string;
  tier: CheckTier;         // 1, 2, 3, 4, or 5
  category: CheckCategory;
  severity: CheckSeverity;
  autoEditable: boolean;
  editRecipe?: string;
  run: (ctx: CheckContext) => CheckResult | Promise<CheckResult>;
}
```

---

### 3.3 Example Tier 1 Checks (`/src/server/lib/audit/checks/tier1/`)

**Content Structure Checks (T1-26 to T1-32):**

```typescript
// T1-26: Keyword in first 100 words
registerCheck({
  id: "T1-26",
  name: "Keyword in first 100 words",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    
    // Clean body text
    const body = $("body").clone();
    body.find("script, style, nav, header, footer, aside").remove();
    const text = body.text().replace(/\s+/g, " ").trim();
    
    // Check first 100 words
    const first100 = text.split(/\s+/).slice(0, 100).join(" ");
    const passed = new RegExp(`\\b${keyword}\\b`, "gi").test(first100);
    
    return { checkId: "T1-26", passed, ... };
  },
});

// T1-30: TOC on pages >1500 words
run: (ctx) => {
  const $ = ctx.$;
  const wordCount = getWords(getBodyText($)).length;
  
  if (wordCount < 1500) return { passed: true, ... };
  
  // Detect TOC patterns
  const hasToc = $('[class*="toc"], [id*="toc"], nav[aria-label*="contents"]').length > 0;
  return { passed: hasToc, ... };
};
```

**Check Categories:**
- `html-signals` - basic meta tags, robots, OG
- `heading-structure` - H1 count, hierarchy
- `title-meta` - title length, description
- `content-structure` - keyword placement, TOC
- `image-basics` - alt text, dimensions
- `internal-links` - link count, anchors
- `external-links` - outbound links
- `schema-basics` - JSON-LD presence
- `technical-basics` - canonical, hreflang

---

## 4. On-Page Mastery Rule System

### 4.1 RuleEngineService (`/src/server/features/onpage-mastery/services/RuleEngineService.ts`)

**Purpose:** 41-point SEO-AGI scorecard with vertical-specific rules and client overrides.

**Key Functions:**
```typescript
evaluateScorecard(ctx: OnPageMasteryContext): Promise<ScorecardResult>
getRulesForVertical(vertical: Vertical, clientId?: string): Promise<RuleWithOverride[]>
setRuleOverride(clientId: string, ruleId: string, weight: number, enabled: boolean): Promise<void>
```

**Input Context:**
```typescript
interface OnPageMasteryContext {
  url: string;
  html: string;
  vertical: Vertical;
  isYmyl: boolean;
  clientId: string;
  pageId?: string;
}
```

**Output:**
```typescript
interface ScorecardResult {
  score: number;           // 0-100 weighted score
  passed: boolean;         // Above threshold (70% normal, 85% YMYL)
  passedRules: Array<{id, name, score, weight}>;
  failedRules: Array<{id, name, score, weight, message}>;
  vertical: Vertical;
  isYmyl: boolean;
  totalWeight: number;
  achievedWeight: number;
}
```

**Cheerio Pattern:**
```typescript
// Build rule context from HTML
const $ = cheerio.load(ctx.html);
const text = $("body").text().replace(/\s+/g, " ").trim();

const ruleContext: RuleContext = {
  html: ctx.html,
  $,                      // Shared Cheerio instance
  text,
  url: ctx.url,
  vertical: ctx.vertical,
  isYmyl: ctx.isYmyl,
  metadata: this.extractMetadata($, ctx.url),
};

// Metadata extraction
extractMetadata($, url) {
  return {
    wordCount: $("body").text().split(/\s+/).filter(Boolean).length,
    headings: $("h1, h2, h3, h4, h5, h6").map((_, el) => $(el).text().trim()).get(),
    schemas: $('script[type="application/ld+json"]').map((_, el) => $(el).html()).get(),
    images: $("img").length,
    links: {
      internal: $(`a[href^="/"], a[href^="${origin}"]`).length,
      external: $('a[href^="http"]').filter((_, el) => !$(el).attr("href")?.startsWith(origin)).length,
    },
  };
}
```

---

### 4.2 Rule Definitions (`/src/server/features/onpage-mastery/rules/`)

**Rule Hierarchy:** Universal < Vertical < Client Override

**Files:**
- `universal.ts` - 25 rules for all verticals
- `healthcare.ts` - YMYL-specific rules
- `legal.ts` - Legal compliance rules
- `financial.ts` - Financial advisory rules
- `ecommerce.ts` - Product page rules
- `saas.ts` - SaaS landing page rules

**Rule Definition Interface:**
```typescript
interface RuleDefinition {
  id: string;              // e.g., "R-01", "R-HC-01"
  name: string;
  description: string;
  category: RuleCategory;  // structure, content, trust, readability, schema, compliance
  weight: number;          // Default multiplier (1.0 = normal)
  severity: RuleSeverity;
  verticals: Vertical[] | "all";
  evaluate: (ctx: RuleContext) => RuleResult;
}
```

**Example Universal Rules:**
```typescript
// R-01: Single H1
{
  id: "R-01",
  evaluate: (ctx) => {
    const h1Count = ctx.$("h1").length;
    return {
      passed: h1Count === 1,
      score: h1Count === 1 ? 100 : 0,
      message: h1Count === 1 ? "Single H1 present" : `Found ${h1Count} H1s`,
    };
  },
}

// R-02: Heading hierarchy
{
  id: "R-02",
  evaluate: (ctx) => {
    const { valid, issues } = checkHeadingHierarchy(ctx.$);
    return {
      passed: valid,
      score: valid ? 100 : Math.max(0, 100 - issues.length * 25),
      message: valid ? "Logical hierarchy" : `Issues: ${issues.join(", ")}`,
    };
  },
}
```

---

## 5. Vertical Classification

### 5.1 VerticalClassifier (`/src/server/features/onpage-mastery/services/VerticalClassifier.ts`)

**Purpose:** Classify pages into 12 verticals using heuristics + LLM fallback.

**Classification Cascade:**
1. **Schema.org detection** (confidence: 0.95) - Parse JSON-LD `@type`
2. **URL patterns** (confidence: 0.90) - Regex matching
3. **YMYL keywords** (confidence: 0.70) - Body text analysis
4. **LLM fallback** - Grok 4.1 Fast for uncertain cases

**Key Functions:**
```typescript
classify(domain: string, path: string, html: string, clientId: string): Promise<Classification>
classifyHeuristic(html: string, url: string): Classification | null
classifyLLM(html: string, url: string): Promise<Classification>
```

**Cheerio Usage:**
```typescript
// Schema.org detection
detectSchemaOrg(html: string): Classification | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  
  for (let i = 0; i < scripts.length; i++) {
    const content = $(scripts[i]).html();
    const data = JSON.parse(content);
    const types = extractSchemaTypes(data);
    
    for (const type of types) {
      const vertical = SCHEMA_TO_VERTICAL[type];
      if (vertical) return { vertical, confidence: 0.95, ... };
    }
  }
}

// Body text extraction for keywords
extractBodyText($: CheerioAPI): string {
  const $clone = $.root().clone();
  const $body = cheerio.load($clone.html() ?? "");
  $body("script, style, noscript, nav, header, footer").remove();
  return $body("body").text().replace(/\s+/g, " ").trim();
}
```

**Verticals:** `healthcare`, `legal`, `financial`, `ecommerce`, `saas`, `real_estate`, `home_services`, `hospitality`, `education`, `professional`, `manufacturing`, `nonprofit`, `general`

**YMYL Verticals:** `healthcare`, `legal`, `financial` (require 85% threshold vs 70%)

---

## 6. Content Extraction

### 6.1 ChunkExtractor (`/src/server/features/onpage-mastery/utils/ChunkExtractor.ts`)

**Purpose:** Semantic chunking with heading boundary priority and token counting.

**Key Functions:**
```typescript
countTokens(text: string): number                    // tiktoken cl100k_base
batchCountTokens(texts: string[]): number[]         // Efficient batch counting
extractText($: CheerioAPI): string                  // Clean text from HTML
extractChunks(html: string, embedFn): Promise<ChunkExtractionResult>
extractSimpleChunks(html: string): SimpleChunk[]
extractPathPattern(path: string): string            // URL pattern normalization
```

**Output:** `SemanticChunk[]`:
```typescript
interface SemanticChunk {
  id: string;
  position: number;
  text: string;
  tokenCount: number;
  parentHeading: string | null;
  embedding: number[];
  metrics: {
    tokenScore: number;           // 1.0 for [400-600] tokens
    selfContainmentScore: number; // Penalize dangling references
    headingAlignmentScore: number;
    factDensity: number;
  };
}
```

**Content Block Extraction:**
```typescript
function extractContentBlocks($: CheerioAPI): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let currentHeading: string | null = null;
  
  // Clone to avoid mutation
  const $cloned = load($.root().clone().html() ?? "");
  $cloned("script, style, noscript, svg, iframe").remove();
  
  $cloned("body").children().each((_, element) => {
    const tagName = element.tagName?.toLowerCase();
    
    if (tagName?.match(/^h[1-6]$/)) {
      flushBlock(); // Save accumulated content
      if (parseInt(tagName.charAt(1)) <= 3) {
        currentHeading = $(element).text().trim();
      }
    } else {
      currentContent.push($(element).text().trim());
    }
  });
  
  return blocks;
}
```

**DoS Protection:**
- Max 100 chunks (T-92-04)
- Max 100KB content size

---

### 6.2 Link Extractor (`/src/server/lib/linking/link-extractor.ts`)

**Purpose:** Extract detailed internal links with position and context.

**Key Functions:**
```typescript
extractDetailedLinks(options: ExtractLinksOptions): ExtractLinksResult
classifyLinkPosition(html: string, linkSelector: string): LinkPosition
getParagraphIndex(html: string, linkSelector: string): number | null
extractContext(html: string, linkSelector: string): string
```

**Output:** `DetailedLink[]`:
```typescript
interface DetailedLink {
  targetUrl: string;
  targetPageId: string | null;
  anchorText: string;
  context: string;           // ~50 chars before/after
  position: LinkPosition;    // nav, header, footer, sidebar, body
  paragraphIndex: number | null;
  isDoFollow: boolean;
  linkType: LinkType;        // contextual, image
  hasTitle: boolean;
  hasNoOpener: boolean;
}
```

**Position Classification:**
```typescript
function classifyLinkPosition(html: string, linkSelector: string): LinkPosition {
  const $ = cheerio.load(html);
  const $link = $(linkSelector);
  const ancestors = $link.parents().toArray();
  
  for (const ancestor of ancestors) {
    const tagName = ancestor.tagName?.toLowerCase();
    const className = $(ancestor).attr("class")?.toLowerCase() || "";
    
    if (tagName === "nav" || className.includes("navigation")) return "nav";
    if (tagName === "header") return "header";
    if (tagName === "footer") return "footer";
    if (tagName === "aside" || className.includes("sidebar")) return "sidebar";
  }
  
  return "body";
}
```

---

## 7. Custom Extraction System

### 7.1 CustomExtractor (`/src/server/features/scraping/services/CustomExtractor.ts`)

**Purpose:** Rule-based data extraction using user-defined CSS selectors.

**Key Functions:**
```typescript
extract(html: string, url: string): ExtractedData | null
testRule(rule: ExtractionRule, html: string, url: string): TestResult
```

**Input:** Extraction rules with URL patterns and field selectors
```typescript
interface ExtractionRule {
  name: string;
  urlPattern: string;      // Glob pattern for URL matching
  pageType: string;        // e.g., "product", "category"
  enabled: boolean;
  fields: ExtractionField[];
}

interface ExtractionField {
  name: string;
  selectors: string[];     // CSS selectors with fallbacks
  type: "text" | "attribute" | "html";
  attribute?: string;      // For attribute type
  transform?: "trim" | "lowercase" | "number" | "price";
}
```

**Cheerio Pattern:**
```typescript
extract(html: string, url: string): ExtractedData | null {
  const pathname = new URL(url).pathname;
  const matchingRule = this.rules.find(rule => minimatch(pathname, rule.urlPattern));
  
  if (!matchingRule) return null;
  
  const $ = cheerio.load(html);
  const fields: Record<string, string | null> = {};
  
  for (const field of matchingRule.fields) {
    for (const selector of field.selectors) {
      const element = $(selector).first();
      if (element.length === 0) continue;
      
      let value = field.type === "attribute" 
        ? element.attr(field.attribute || "href")
        : field.type === "html" 
          ? element.html()
          : element.text();
      
      fields[field.name] = applyTransform(value, field.transform);
      break; // Use first matching selector
    }
  }
  
  return { url, pageType, fields, matchedRule: matchingRule.name };
}
```

---

### 7.2 SelectorDiscoveryService (`/src/server/features/scraping/services/SelectorDiscoveryService.ts`)

**Purpose:** AI-powered CSS selector discovery for e-commerce sites.

**Key Functions:**
```typescript
discoverSelectors(html: string, url: string): Promise<SelectorDiscoveryResult>
detectPlatform(html: string): Promise<{platform: DetectedPlatform, confidence: number}>
```

**Platform Detection (heuristic):**
```typescript
async detectPlatform(html: string) {
  const $ = cheerio.load(html);
  
  // Shopify
  if (html.includes("cdn.shopify.com") || 
      $('meta[name="shopify-checkout-api-token"]').length > 0) {
    return { platform: "shopify", confidence: 0.95 };
  }
  
  // WooCommerce
  if (html.includes("woocommerce") || $(".woocommerce").length > 0) {
    return { platform: "woocommerce", confidence: 0.95 };
  }
  
  // ... more platform checks
}
```

---

### 7.3 PlatformDetector (`/src/server/features/connections/services/PlatformDetector.ts`)

**Purpose:** Multi-probe website platform fingerprinting.

**Detection Probes:**
- WordPress: `/wp-json/` API (100), `/wp-content/` paths (80), generator meta (90)
- Shopify: `cdn.shopify.com` (100), `.myshopify.com` (100)
- Wix: `wixstatic.com` (100), `parastorage.com` (90)
- Squarespace: `static.squarespace.com` (100)
- Webflow: `webflow.io` (100)

**Cheerio Pattern:**
```typescript
const DETECTION_PROBES = [
  {
    type: "meta",
    platform: "wordpress",
    weight: 90,
    check: (d) => {
      const $ = cheerio.load(d.html);
      const gen = $('meta[name="generator"]').attr("content");
      return gen?.includes("WordPress") ? gen : null;
    },
  },
  // ... more probes
];
```

---

## 8. SERP Content Analysis

### 8.1 SerpContentAnalyzer (`/src/server/features/briefs/services/SerpContentAnalyzer.ts`)

**Purpose:** Analyze competitor content for content brief generation.

**Key Functions:**
```typescript
analyzeSerpContent(urls: string[]): Promise<SerpContentAnalysis>
extractCommonH2s(urls: string[]): Promise<H2Frequency[]>
calculateWordCountStats(urls: string[]): Promise<WordCountStats>
```

**Output:**
```typescript
interface SerpContentAnalysis {
  commonH2s: Array<{heading: string, frequency: number}>;
  wordCountStats: {min: number, max: number, avg: number};
  wordCounts: number[];
  analyzedUrls: number;
}
```

**Cheerio Pattern:**
```typescript
for (const result of results) {
  const $ = cheerio.load(result.fetch_html);
  
  // Extract H2s
  $("h2").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.length >= 5 && text.length <= 100) {
      h2Counts.set(text, (h2Counts.get(text) || 0) + 1);
    }
  });
  
  // Word count from main content
  $("script, style, nav, footer, header, aside, .sidebar, .comments").remove();
  const content = $("article, main, .content, [role='main']").first().text() || $("body").text();
  const words = content.split(/\s+/).filter(w => w.length > 0);
  wordCounts.push(words.length);
}
```

---

## 9. Architecture Flow Diagram

```
                    +-----------------+
                    |   User Request  |
                    +--------+--------+
                             |
                    +--------v--------+
                    |  HybridCrawler  |
                    |  (HTTP/Playwright)|
                    +--------+--------+
                             |
               +-------------+-------------+
               |                           |
    +----------v----------+     +----------v----------+
    | Sitemap Parser      |     | Discovery Module    |
    | (fast-xml-parser)   |     | (robots.txt + URLs) |
    +---------+-----------+     +---------+-----------+
               |                           |
               +-----------+---------------+
                           |
                  +--------v--------+
                  |   Raw HTML      |
                  |   CrawlResult   |
                  +--------+--------+
                           |
          +----------------+----------------+
          |                |                |
+---------v---------+  +---v---+  +---------v---------+
|  Page Analyzer    |  |       |  |  Template Hash    |
|  (PageAnalysis)   |  |       |  |  (Delta Detect)   |
+---------+---------+  |       |  +---------+---------+
          |            |       |            |
          +------------+ Cheerio +----------+
                       | .load() |
          +------------+--------+-----------+
          |            |        |           |
+---------v----+ +-----v-----+ +v----------+ +v-----------+
| Check Runner | | Rule      | | Vertical  | | Custom     |
| (109 checks) | | Engine    | | Classifier| | Extractor  |
| Tier 1-4     | | (41 rules)| | (12 types)| | (CSS rules)|
+---------+----+ +-----+-----+ +-----+-----+ +-----+------+
          |            |             |             |
          +------------+-------------+-------------+
                       |
              +--------v--------+
              |   Results       |
              |   - CheckResult |
              |   - ScorecardResult |
              |   - Classification |
              |   - ExtractedData |
              +-----------------+
```

---

## 10. Best Practices Observed

### 10.1 Shared Cheerio Instance
The check runner creates a single Cheerio instance and passes it to all checks via `CheckContext.$`, avoiding redundant parsing.

### 10.2 Clone Before Mutation
When removing elements (scripts, styles), always clone first:
```typescript
const bodyClone = $("body").clone();
bodyClone.find("script, style").remove();
```

### 10.3 Content Normalization
Consistent whitespace normalization across all extractors:
```typescript
.text().replace(/\s+/g, " ").trim()
```

### 10.4 DoS Protection
- Max HTML size: 5MB (`runner.ts`)
- Max chunks: 100 (`ChunkExtractor.ts`)
- Max content size: 100KB (`ChunkExtractor.ts`)
- Timeout protection: 30s per check, 5min total

### 10.5 Safe Attribute Access
Always use optional chaining with fallback:
```typescript
const href = $(el).attr("href") ?? null;
const content = $('meta[name="description"]').attr("content")?.trim() ?? "";
```

---

## 11. Integration Points for On-Page Mastery

The Phase 92 On-Page SEO Mastery system can leverage:

1. **Shared Cheerio Context** - Extend `CheckContext` / `RuleContext` for new Tier 5 checks
2. **ChunkExtractor** - Already integrates tiktoken for token-aware chunking
3. **VerticalClassifier** - Classification informs rule selection and YMYL thresholds
4. **RuleEngineService** - 41-point scorecard can be extended with new rule packs
5. **Template Hash** - Delta detection for efficient re-scoring

**Key Files for Extension:**
- `/src/server/lib/audit/checks/types.ts` - Add Tier 5 definitions
- `/src/server/features/onpage-mastery/rules/index.ts` - Register new verticals
- `/src/server/features/onpage-mastery/utils/index.ts` - Export new extractors
