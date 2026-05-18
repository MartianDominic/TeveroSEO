# Research 16: Technical SEO Automation

> **Agent:** 16 of 20  
> **Stream:** D - Technical SEO & Monitoring  
> **Focus:** Schema validation, Core Web Vitals, robots.txt, sitemaps, canonicals  
> **Date:** 2026-05-11

---

## 1. Schema Markup Validation

### 1.1 Target Schema Types

| Schema Type | Use Case | Priority | Validation Focus |
|-------------|----------|----------|------------------|
| **FAQPage** | Service pages, support content | HIGH | Question/answer pairs, unique content |
| **HowTo** | Tutorials, guides, DIY content | HIGH | Step ordering, images, time estimates |
| **Product** | E-commerce, SaaS pricing | HIGH | Price, availability, reviews, SKU |
| **Article** | Blog posts, news | HIGH | Author, datePublished, dateModified |
| **LocalBusiness** | Client location pages | MEDIUM | NAP consistency, hours, geo |
| **BreadcrumbList** | All pages | MEDIUM | Hierarchy matches URL structure |
| **Organization** | About pages | MEDIUM | Logo, social profiles, contact |
| **VideoObject** | Video embeds | LOW | Duration, thumbnail, uploadDate |

### 1.2 Validation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   SCHEMA VALIDATION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   EXTRACT    │───►│   VALIDATE   │───►│   REPORT     │      │
│  │   JSON-LD    │    │   AGAINST    │    │   ISSUES     │      │
│  │   FROM HTML  │    │   SPEC       │    │   & FIXES    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│        │                   │                    │                │
│        ▼                   ▼                    ▼                │
│  cheerio parse       schema.org spec      severity levels       │
│  script[type=ld+json] required fields     auto-fix suggestions  │
│  microdata fallback   recommended fields  rich result preview   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Schema Validation Rules

#### FAQPage Schema

```typescript
interface FAQPageValidation {
  required: {
    '@type': 'FAQPage';
    mainEntity: FAQItem[]; // min 2 items
  };
  rules: [
    'Each question must be unique',
    'Answers must be 50-1000 chars',
    'No duplicate questions across pages',
    'Questions must match page H2/H3 headings',
    'Visible FAQ section must exist on page'
  ];
  errors: {
    MISSING_MAIN_ENTITY: 'critical',
    SINGLE_QUESTION: 'warning',
    INVISIBLE_FAQ: 'critical', // Google penalty risk
    DUPLICATE_QUESTIONS: 'warning'
  };
}
```

#### HowTo Schema

```typescript
interface HowToValidation {
  required: {
    '@type': 'HowTo';
    name: string;
    step: HowToStep[]; // min 2 steps
  };
  recommended: {
    image: ImageObject;
    totalTime: Duration;
    estimatedCost: MonetaryAmount;
    supply: HowToSupply[];
    tool: HowToTool[];
  };
  rules: [
    'Steps must be in logical order',
    'Each step needs name + text OR itemListElement',
    'Images should match step content',
    'totalTime = sum of step times',
    'Page must have visible step-by-step content'
  ];
}
```

#### Product Schema

```typescript
interface ProductValidation {
  required: {
    '@type': 'Product';
    name: string;
    offers: Offer | Offer[];
  };
  offers_required: {
    price: number;
    priceCurrency: string; // ISO 4217
    availability: AvailabilityEnum;
  };
  recommended: {
    image: string[];
    description: string;
    sku: string;
    brand: Brand;
    aggregateRating: AggregateRating;
    review: Review[];
  };
  rules: [
    'Price must match visible price on page',
    'Availability must reflect real stock status',
    'Reviews must be real (not fabricated)',
    'SKU should be unique identifier',
    'Brand should link to Organization schema'
  ];
}
```

### 1.4 Implementation: Schema Validator Service

```typescript
// Location: open-seo-main/src/services/schema-validator.ts

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

interface SchemaValidationResult {
  valid: boolean;
  schemaType: string;
  errors: SchemaError[];
  warnings: SchemaWarning[];
  richResultEligible: boolean;
  fixes: AutoFix[];
}

const SCHEMA_SPECS = {
  FAQPage: {
    required: ['@type', 'mainEntity'],
    mainEntityMin: 2,
    mainEntityMax: 10,
    answerMinLength: 50,
    answerMaxLength: 1000
  },
  HowTo: {
    required: ['@type', 'name', 'step'],
    stepMin: 2,
    stepMax: 20,
    requiresVisibleContent: true
  },
  Product: {
    required: ['@type', 'name', 'offers'],
    offersRequired: ['price', 'priceCurrency', 'availability'],
    priceMatch: true // validate against visible price
  }
};

export async function validateSchema(
  html: string,
  url: string
): Promise<SchemaValidationResult[]> {
  const schemas = extractJsonLd(html);
  const results: SchemaValidationResult[] = [];
  
  for (const schema of schemas) {
    const type = schema['@type'];
    const spec = SCHEMA_SPECS[type];
    
    if (!spec) continue;
    
    const result = validateAgainstSpec(schema, spec, html);
    result.richResultEligible = checkRichResultEligibility(result);
    results.push(result);
  }
  
  return results;
}
```

### 1.5 Google Rich Results Test API Integration

```typescript
// Use Google's Rich Results Test programmatically
// Note: No official API - use Puppeteer to automate

interface RichResultsTestResult {
  url: string;
  richResultsDetected: string[];
  issues: {
    severity: 'error' | 'warning';
    message: string;
    line?: number;
  }[];
  screenshot?: Buffer;
}

async function testRichResults(url: string): Promise<RichResultsTestResult> {
  // Automate https://search.google.com/test/rich-results
  // Or use structured-data-testing-tool npm package
}
```

---

## 2. Core Web Vitals Monitoring via CrUX API

### 2.1 CrUX API Overview

| Metric | Good | Needs Improvement | Poor | Weight |
|--------|------|-------------------|------|--------|
| **LCP** (Largest Contentful Paint) | ≤2.5s | 2.5-4.0s | >4.0s | 25% |
| **INP** (Interaction to Next Paint) | ≤200ms | 200-500ms | >500ms | 25% |
| **CLS** (Cumulative Layout Shift) | ≤0.1 | 0.1-0.25 | >0.25 | 25% |
| **FCP** (First Contentful Paint) | ≤1.8s | 1.8-3.0s | >3.0s | - |
| **TTFB** (Time to First Byte) | ≤800ms | 800-1800ms | >1800ms | - |

### 2.2 CrUX API Integration

```typescript
// Location: open-seo-main/src/services/crux-service.ts

interface CrUXRequest {
  url?: string;        // Page-level data
  origin?: string;     // Origin-level data
  formFactor?: 'PHONE' | 'DESKTOP' | 'ALL_FORM_FACTORS';
  metrics?: CrUXMetric[];
}

interface CrUXResponse {
  record: {
    key: { url?: string; origin?: string; formFactor?: string };
    metrics: {
      largest_contentful_paint?: MetricData;
      interaction_to_next_paint?: MetricData;
      cumulative_layout_shift?: MetricData;
      first_contentful_paint?: MetricData;
      experimental_time_to_first_byte?: MetricData;
    };
    collectionPeriod: { firstDate: string; lastDate: string };
  };
  urlNormalizationDetails?: { originalUrl: string; normalizedUrl: string };
}

interface MetricData {
  histogram: { start: number; end?: number; density: number }[];
  percentiles: { p75: number };
}

const CRUX_API_URL = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

export async function getCrUXData(
  urlOrOrigin: string,
  apiKey: string,
  options: { formFactor?: 'PHONE' | 'DESKTOP' } = {}
): Promise<CrUXResponse> {
  const isOrigin = !urlOrOrigin.includes('/', 8); // After https://
  
  const response = await fetch(`${CRUX_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      [isOrigin ? 'origin' : 'url']: urlOrOrigin,
      formFactor: options.formFactor || 'ALL_FORM_FACTORS',
      metrics: [
        'largest_contentful_paint',
        'interaction_to_next_paint',
        'cumulative_layout_shift',
        'first_contentful_paint',
        'experimental_time_to_first_byte'
      ]
    })
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('NO_DATA'); // URL not in CrUX dataset
    }
    throw new Error(`CrUX API error: ${response.status}`);
  }
  
  return response.json();
}
```

### 2.3 CWV Score Calculator

```typescript
interface CoreWebVitalsScore {
  overall: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
  metrics: {
    lcp: { value: number; rating: string; percentile: number };
    inp: { value: number; rating: string; percentile: number };
    cls: { value: number; rating: string; percentile: number };
  };
  passesAllThresholds: boolean;
  recommendations: string[];
}

function calculateCWVScore(cruxData: CrUXResponse): CoreWebVitalsScore {
  const metrics = cruxData.record.metrics;
  
  const lcp = metrics.largest_contentful_paint?.percentiles.p75;
  const inp = metrics.interaction_to_next_paint?.percentiles.p75;
  const cls = metrics.cumulative_layout_shift?.percentiles.p75;
  
  const ratings = {
    lcp: lcp <= 2500 ? 'GOOD' : lcp <= 4000 ? 'NEEDS_IMPROVEMENT' : 'POOR',
    inp: inp <= 200 ? 'GOOD' : inp <= 500 ? 'NEEDS_IMPROVEMENT' : 'POOR',
    cls: cls <= 0.1 ? 'GOOD' : cls <= 0.25 ? 'NEEDS_IMPROVEMENT' : 'POOR'
  };
  
  const passesAll = ratings.lcp === 'GOOD' && 
                    ratings.inp === 'GOOD' && 
                    ratings.cls === 'GOOD';
  
  return {
    overall: passesAll ? 'GOOD' : 
             Object.values(ratings).includes('POOR') ? 'POOR' : 'NEEDS_IMPROVEMENT',
    metrics: {
      lcp: { value: lcp, rating: ratings.lcp, percentile: 75 },
      inp: { value: inp, rating: ratings.inp, percentile: 75 },
      cls: { value: cls, rating: ratings.cls, percentile: 75 }
    },
    passesAllThresholds: passesAll,
    recommendations: generateCWVRecommendations(ratings, { lcp, inp, cls })
  };
}
```

### 2.4 CrUX Monitoring Schedule

```typescript
// BullMQ job for scheduled CWV monitoring
interface CWVMonitoringJob {
  clientId: string;
  urls: string[];      // Up to 100 URLs per job
  frequency: 'daily' | 'weekly';
  alertThresholds: {
    lcpMax: number;    // Alert if LCP exceeds
    inpMax: number;
    clsMax: number;
  };
}

// Store historical data for trend analysis
interface CWVHistoryRecord {
  url: string;
  date: Date;
  formFactor: 'PHONE' | 'DESKTOP';
  lcp: number;
  inp: number;
  cls: number;
  overall: 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
}
```

---

## 3. Robots.txt Analysis

### 3.1 Robots.txt Parser

```typescript
// Location: open-seo-main/src/services/robots-analyzer.ts

interface RobotsDirective {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
  sitemap?: string[];
}

interface RobotsAnalysis {
  valid: boolean;
  parseErrors: string[];
  directives: RobotsDirective[];
  issues: RobotsIssue[];
  recommendations: string[];
  affectedUrls: { url: string; blocked: boolean; rule: string }[];
}

interface RobotsIssue {
  severity: 'critical' | 'warning' | 'info';
  type: RobotsIssueType;
  message: string;
  line?: number;
}

type RobotsIssueType = 
  | 'BLOCKS_GOOGLEBOT'
  | 'BLOCKS_IMPORTANT_PAGES'
  | 'MISSING_SITEMAP'
  | 'EXCESSIVE_CRAWL_DELAY'
  | 'CONFLICTING_RULES'
  | 'WILDCARD_ABUSE'
  | 'CASE_SENSITIVITY'
  | 'SYNTAX_ERROR';

export async function analyzeRobotsTxt(
  robotsUrl: string,
  testUrls: string[]
): Promise<RobotsAnalysis> {
  const response = await fetch(robotsUrl);
  const content = await response.text();
  
  const directives = parseRobotsTxt(content);
  const issues: RobotsIssue[] = [];
  
  // Check for Googlebot blocking
  const googlebotRules = directives.find(d => 
    d.userAgent.toLowerCase() === 'googlebot' || 
    d.userAgent === '*'
  );
  
  if (googlebotRules?.disallow.includes('/')) {
    issues.push({
      severity: 'critical',
      type: 'BLOCKS_GOOGLEBOT',
      message: 'Site completely blocked from Googlebot crawling'
    });
  }
  
  // Check for blocked important paths
  const importantPaths = ['/', '/blog/', '/products/', '/services/'];
  for (const path of importantPaths) {
    if (isBlocked(path, directives)) {
      issues.push({
        severity: 'warning',
        type: 'BLOCKS_IMPORTANT_PAGES',
        message: `Important path ${path} is blocked`
      });
    }
  }
  
  // Check for missing sitemap
  const hasSitemap = directives.some(d => d.sitemap && d.sitemap.length > 0);
  if (!hasSitemap) {
    issues.push({
      severity: 'warning',
      type: 'MISSING_SITEMAP',
      message: 'No sitemap directive in robots.txt'
    });
  }
  
  // Test provided URLs
  const affectedUrls = testUrls.map(url => ({
    url,
    blocked: isBlocked(new URL(url).pathname, directives),
    rule: getMatchingRule(new URL(url).pathname, directives)
  }));
  
  return {
    valid: issues.filter(i => i.type === 'SYNTAX_ERROR').length === 0,
    parseErrors: [],
    directives,
    issues,
    recommendations: generateRobotsRecommendations(issues),
    affectedUrls
  };
}
```

### 3.2 Common Robots.txt Issues

| Issue | Severity | Detection | Recommendation |
|-------|----------|-----------|----------------|
| Blocks all bots | CRITICAL | `Disallow: /` for `*` | Remove or add Allow exceptions |
| Blocks Googlebot | CRITICAL | Googlebot-specific Disallow | Review and fix rules |
| No sitemap | WARNING | Missing `Sitemap:` | Add sitemap reference |
| High crawl-delay | WARNING | `Crawl-delay: >10` | Reduce or remove |
| Blocks /api/ | INFO | API paths blocked | Usually intentional |
| Conflicting rules | WARNING | Allow + Disallow same path | Use more specific rules |

---

## 4. Sitemap Generation & Validation

### 4.1 Sitemap Generator

```typescript
// Location: open-seo-main/src/services/sitemap-generator.ts

interface SitemapEntry {
  loc: string;
  lastmod?: string;     // ISO 8601 date
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;    // 0.0 - 1.0
  images?: SitemapImage[];
  videos?: SitemapVideo[];
  news?: SitemapNews;
}

interface SitemapGeneratorOptions {
  baseUrl: string;
  maxUrlsPerSitemap: number;  // 50,000 max per spec
  includeImages: boolean;
  includeVideos: boolean;
  includeNews: boolean;
  excludePatterns: RegExp[];
  priorityRules: PriorityRule[];
}

export async function generateSitemap(
  urls: string[],
  options: SitemapGeneratorOptions
): Promise<{ sitemaps: string[]; index?: string }> {
  const filteredUrls = urls.filter(url => 
    !options.excludePatterns.some(p => p.test(url))
  );
  
  const entries: SitemapEntry[] = filteredUrls.map(url => ({
    loc: url,
    lastmod: new Date().toISOString().split('T')[0],
    priority: calculatePriority(url, options.priorityRules),
    changefreq: inferChangeFreq(url)
  }));
  
  // Split into chunks of 50,000
  const chunks = chunkArray(entries, options.maxUrlsPerSitemap);
  
  const sitemaps = chunks.map((chunk, i) => 
    generateSitemapXml(chunk, i)
  );
  
  // Generate sitemap index if multiple sitemaps
  const index = chunks.length > 1 
    ? generateSitemapIndex(sitemaps.length, options.baseUrl)
    : undefined;
  
  return { sitemaps, index };
}

function generateSitemapXml(entries: SitemapEntry[], index: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map(e => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    ${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}
    ${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ''}
    ${e.priority ? `<priority>${e.priority.toFixed(1)}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`;
}
```

### 4.2 Sitemap Validator

```typescript
interface SitemapValidation {
  valid: boolean;
  urlCount: number;
  errors: SitemapError[];
  warnings: SitemapWarning[];
  stats: {
    averagePriority: number;
    lastmodCoverage: number;  // % of URLs with lastmod
    httpUrls: number;         // Should be 0 (use HTTPS)
    duplicateUrls: number;
  };
}

interface SitemapError {
  type: 'URL_NOT_FOUND' | 'INVALID_XML' | 'TOO_MANY_URLS' | 'INVALID_URL';
  url?: string;
  message: string;
}

async function validateSitemap(sitemapUrl: string): Promise<SitemapValidation> {
  const response = await fetch(sitemapUrl);
  const xml = await response.text();
  
  const parsed = await parseXml(xml);
  const urls = extractUrls(parsed);
  
  const errors: SitemapError[] = [];
  const warnings: SitemapWarning[] = [];
  
  // Validate URL count
  if (urls.length > 50000) {
    errors.push({
      type: 'TOO_MANY_URLS',
      message: `Sitemap has ${urls.length} URLs, max is 50,000`
    });
  }
  
  // Check for HTTP URLs
  const httpUrls = urls.filter(u => u.loc.startsWith('http://'));
  if (httpUrls.length > 0) {
    warnings.push({
      type: 'HTTP_URLS',
      message: `${httpUrls.length} URLs use HTTP instead of HTTPS`
    });
  }
  
  // Check for duplicates
  const uniqueUrls = new Set(urls.map(u => u.loc));
  if (uniqueUrls.size < urls.length) {
    warnings.push({
      type: 'DUPLICATE_URLS',
      message: `${urls.length - uniqueUrls.size} duplicate URLs found`
    });
  }
  
  // Spot-check URL accessibility (sample 10%)
  const sample = urls.slice(0, Math.ceil(urls.length * 0.1));
  for (const url of sample) {
    const status = await checkUrl(url.loc);
    if (status === 404) {
      errors.push({
        type: 'URL_NOT_FOUND',
        url: url.loc,
        message: '404 Not Found'
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    urlCount: urls.length,
    errors,
    warnings,
    stats: {
      averagePriority: calculateAveragePriority(urls),
      lastmodCoverage: urls.filter(u => u.lastmod).length / urls.length,
      httpUrls: httpUrls.length,
      duplicateUrls: urls.length - uniqueUrls.size
    }
  };
}
```

---

## 5. Canonical Tag Verification

### 5.1 Canonical Analysis

```typescript
// Location: open-seo-main/src/services/canonical-analyzer.ts

interface CanonicalAnalysis {
  url: string;
  canonical: string | null;
  issues: CanonicalIssue[];
  status: 'CORRECT' | 'MISSING' | 'SELF_REFERENCING' | 'CROSS_DOMAIN' | 'REDIRECT_CHAIN';
}

type CanonicalIssue = 
  | { type: 'MISSING'; severity: 'warning' }
  | { type: 'POINTS_TO_404'; canonical: string; severity: 'critical' }
  | { type: 'REDIRECT_CHAIN'; chain: string[]; severity: 'warning' }
  | { type: 'CROSS_DOMAIN'; canonical: string; severity: 'info' }
  | { type: 'HTTP_HTTPS_MISMATCH'; severity: 'warning' }
  | { type: 'TRAILING_SLASH_MISMATCH'; severity: 'info' }
  | { type: 'CASE_MISMATCH'; severity: 'info' }
  | { type: 'QUERY_PARAMS_INCLUDED'; severity: 'info' }
  | { type: 'CANONICAL_CHAIN'; chain: string[]; severity: 'warning' };

export async function analyzeCanonical(url: string): Promise<CanonicalAnalysis> {
  const response = await fetch(url);
  const html = await response.text();
  
  const canonical = extractCanonical(html);
  const issues: CanonicalIssue[] = [];
  
  if (!canonical) {
    issues.push({ type: 'MISSING', severity: 'warning' });
    return { url, canonical: null, issues, status: 'MISSING' };
  }
  
  // Check if canonical URL exists
  const canonicalResponse = await fetch(canonical, { method: 'HEAD' });
  if (canonicalResponse.status === 404) {
    issues.push({ type: 'POINTS_TO_404', canonical, severity: 'critical' });
  }
  
  // Check for redirect chains
  if (canonicalResponse.redirected) {
    const chain = await traceRedirects(canonical);
    issues.push({ type: 'REDIRECT_CHAIN', chain, severity: 'warning' });
  }
  
  // Check for HTTP/HTTPS mismatch
  const urlProtocol = new URL(url).protocol;
  const canonicalProtocol = new URL(canonical).protocol;
  if (urlProtocol !== canonicalProtocol) {
    issues.push({ type: 'HTTP_HTTPS_MISMATCH', severity: 'warning' });
  }
  
  // Check for canonical chains (canonical points to page with different canonical)
  if (canonical !== url) {
    const canonicalHtml = await (await fetch(canonical)).text();
    const canonicalOfCanonical = extractCanonical(canonicalHtml);
    if (canonicalOfCanonical && canonicalOfCanonical !== canonical) {
      issues.push({
        type: 'CANONICAL_CHAIN',
        chain: [url, canonical, canonicalOfCanonical],
        severity: 'warning'
      });
    }
  }
  
  const status = determineCanonicalStatus(url, canonical, issues);
  
  return { url, canonical, issues, status };
}

function extractCanonical(html: string): string | null {
  // Check <link rel="canonical">
  const linkMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (linkMatch) return linkMatch[1];
  
  // Check HTTP header (would need response headers)
  return null;
}
```

### 5.2 Bulk Canonical Audit

```typescript
interface CanonicalAuditResult {
  totalUrls: number;
  correct: number;
  missing: number;
  issues: {
    critical: CanonicalAnalysis[];
    warning: CanonicalAnalysis[];
    info: CanonicalAnalysis[];
  };
  recommendations: string[];
}

async function bulkCanonicalAudit(urls: string[]): Promise<CanonicalAuditResult> {
  const results = await Promise.all(
    urls.map(url => analyzeCanonical(url))
  );
  
  return {
    totalUrls: urls.length,
    correct: results.filter(r => r.status === 'CORRECT' || r.status === 'SELF_REFERENCING').length,
    missing: results.filter(r => r.status === 'MISSING').length,
    issues: {
      critical: results.filter(r => r.issues.some(i => i.severity === 'critical')),
      warning: results.filter(r => r.issues.some(i => i.severity === 'warning')),
      info: results.filter(r => r.issues.some(i => i.severity === 'info'))
    },
    recommendations: generateCanonicalRecommendations(results)
  };
}
```

---

## 6. Unified Technical SEO Service

### 6.1 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TECHNICAL SEO AUTOMATION SERVICE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   SCHEMA    │  │    CrUX     │  │   ROBOTS    │  │   SITEMAP   │        │
│  │  VALIDATOR  │  │   MONITOR   │  │  ANALYZER   │  │  GENERATOR  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌──────────────────────────────┐                         │
│                    │  TECHNICAL SEO ORCHESTRATOR  │                         │
│                    │                              │                         │
│                    │  - Scheduled audits          │                         │
│                    │  - On-demand checks          │                         │
│                    │  - Issue aggregation         │                         │
│                    │  - Alert generation          │                         │
│                    └──────────────────────────────┘                         │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌──────────────────────────────┐                         │
│                    │     TECHNICAL SEO REPORT     │                         │
│                    │                              │                         │
│                    │  Score: 87/100               │                         │
│                    │  Schema: 12 valid, 2 issues  │                         │
│                    │  CWV: 3 GOOD, 1 NEEDS WORK   │                         │
│                    │  Robots: OK                  │                         │
│                    │  Sitemap: 3 warnings         │                         │
│                    │  Canonicals: 98% correct     │                         │
│                    └──────────────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Technical SEO Score Calculation

```typescript
interface TechnicalSEOScore {
  overall: number;  // 0-100
  breakdown: {
    schema: { score: number; weight: 20; issues: number };
    coreWebVitals: { score: number; weight: 30; status: string };
    robotsTxt: { score: number; weight: 10; issues: number };
    sitemap: { score: number; weight: 15; coverage: number };
    canonicals: { score: number; weight: 15; correctPct: number };
    other: { score: number; weight: 10 };
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

function calculateTechnicalSEOScore(audit: TechnicalSEOAudit): TechnicalSEOScore {
  const breakdown = {
    schema: {
      score: audit.schema.validCount / audit.schema.totalCount * 100,
      weight: 20,
      issues: audit.schema.issues.length
    },
    coreWebVitals: {
      score: audit.cwv.passesAllThresholds ? 100 : 
             audit.cwv.overall === 'NEEDS_IMPROVEMENT' ? 60 : 30,
      weight: 30,
      status: audit.cwv.overall
    },
    robotsTxt: {
      score: audit.robots.valid ? 100 : 50,
      weight: 10,
      issues: audit.robots.issues.length
    },
    sitemap: {
      score: audit.sitemap.valid ? 
             (1 - audit.sitemap.errors.length / audit.sitemap.urlCount) * 100 : 0,
      weight: 15,
      coverage: audit.sitemap.urlCount
    },
    canonicals: {
      score: audit.canonicals.correct / audit.canonicals.totalUrls * 100,
      weight: 15,
      correctPct: audit.canonicals.correct / audit.canonicals.totalUrls
    },
    other: { score: 80, weight: 10 }  // hreflang, meta tags, etc.
  };
  
  const overall = Object.values(breakdown).reduce(
    (sum, cat) => sum + (cat.score * cat.weight / 100), 0
  );
  
  return {
    overall: Math.round(overall),
    breakdown,
    grade: overall >= 90 ? 'A' : overall >= 80 ? 'B' : 
           overall >= 70 ? 'C' : overall >= 60 ? 'D' : 'F'
  };
}
```

---

## 7. Database Schema

```typescript
// Location: open-seo-main/src/db/technical-seo-schema.ts

import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

// Schema validation records
export const schemaValidations = pgTable('schema_validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull(),
  url: text('url').notNull(),
  schemaType: text('schema_type').notNull(),  // FAQPage, HowTo, Product
  valid: boolean('valid').notNull(),
  issues: jsonb('issues').$type<SchemaError[]>(),
  richResultEligible: boolean('rich_result_eligible'),
  checkedAt: timestamp('checked_at').defaultNow()
});

// Core Web Vitals history
export const cwvHistory = pgTable('cwv_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull(),
  url: text('url').notNull(),
  formFactor: text('form_factor').notNull(),  // PHONE, DESKTOP
  lcp: integer('lcp'),  // milliseconds
  inp: integer('inp'),  // milliseconds
  cls: integer('cls'),  // scaled by 1000 (0.1 = 100)
  overall: text('overall').notNull(),  // GOOD, NEEDS_IMPROVEMENT, POOR
  collectedAt: timestamp('collected_at').defaultNow()
});

// Canonical audit results
export const canonicalAudits = pgTable('canonical_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull(),
  url: text('url').notNull(),
  canonical: text('canonical'),
  status: text('status').notNull(),
  issues: jsonb('issues').$type<CanonicalIssue[]>(),
  checkedAt: timestamp('checked_at').defaultNow()
});

// Sitemap records
export const sitemapAudits = pgTable('sitemap_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull(),
  sitemapUrl: text('sitemap_url').notNull(),
  urlCount: integer('url_count').notNull(),
  valid: boolean('valid').notNull(),
  errors: jsonb('errors').$type<SitemapError[]>(),
  warnings: jsonb('warnings').$type<SitemapWarning[]>(),
  lastChecked: timestamp('last_checked').defaultNow()
});
```

---

## 8. API Costs & Rate Limits

| API | Cost | Rate Limit | Notes |
|-----|------|------------|-------|
| **CrUX API** | FREE | 150 req/min | Requires Google Cloud API key |
| **PageSpeed Insights** | FREE | 400 req/day | Alternative to CrUX with lab data |
| **Google Rich Results Test** | FREE | No official API | Automate via Puppeteer |
| **schema-dts** (npm) | FREE | N/A | TypeScript types for schema.org |
| **Ajv** (npm) | FREE | N/A | JSON Schema validation |

---

## 9. Implementation Priorities

| Priority | Component | Effort | Impact |
|----------|-----------|--------|--------|
| P0 | CrUX API integration | 2 days | HIGH - CWV is ranking factor |
| P0 | Schema validation (FAQPage, HowTo, Product) | 3 days | HIGH - Rich results |
| P1 | Canonical verification | 2 days | MEDIUM - Duplicate content |
| P1 | Sitemap generator/validator | 2 days | MEDIUM - Crawl efficiency |
| P2 | Robots.txt analyzer | 1 day | LOW - Usually static |
| P2 | Technical SEO dashboard | 3 days | MEDIUM - Visibility |

---

## 10. Integration with Phase 99 Pipeline

```
Content Published
       │
       ▼
┌──────────────────┐
│  TECHNICAL SEO   │
│  AUTOMATION      │
├──────────────────┤
│                  │
│  1. Validate schema markup auto-generated
│  2. Check CWV for new page (via PSI initially)
│  3. Update sitemap with new URL
│  4. Verify canonical is correct
│  5. Submit to IndexNow
│                  │
└──────────────────┘
       │
       ▼
  GSC Monitoring
```

The Technical SEO Automation layer sits between content publishing and GSC monitoring, ensuring every new page meets technical SEO requirements before indexing is requested.
