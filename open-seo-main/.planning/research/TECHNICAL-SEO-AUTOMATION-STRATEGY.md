# Technical SEO Automation Strategy

**Domain:** Automated Technical SEO Auditing and Remediation System
**Researched:** 2026-04-21
**Overall confidence:** HIGH (verified against current tools, APIs, and 2026 best practices)

---

## Executive Summary

This document outlines a comprehensive strategy for building an automated technical SEO system that finds, prioritizes, and fixes issues at scale. The system leverages the existing open-seo-main infrastructure (BullMQ workers, PostgreSQL, Redis, DataForSEO integration) while adding new capabilities for continuous monitoring, automated remediation, and AI-powered recommendations.

**Core Philosophy:** Most technical SEO issues are discoverable through automated crawling and can be categorized into two buckets:
1. **Auto-fixable via pixel/edge** - Issues that can be remediated without developer intervention
2. **Dev-required** - Issues needing code changes, with auto-generated tickets and impact estimates

---

## 1. Crawl Intelligence System

### 1.1 Continuous vs Periodic Crawling Strategy

| Mode | Use Case | Frequency | Resource Cost |
|------|----------|-----------|---------------|
| **Continuous Delta Crawling** | Large sites (10K+ pages), e-commerce | Real-time on content change | High (webhook-triggered) |
| **Scheduled Full Crawl** | Small-medium sites | Weekly/Monthly | Medium |
| **Event-Triggered Crawl** | Post-deployment, after migrations | On-demand | Low |
| **Sample-Based Monitoring** | CWV monitoring, spot checks | Daily (random 5% sample) | Low |

**Recommended Hybrid Approach:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    CRAWL INTELLIGENCE LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  Sitemap Monitor (hourly)                                       │
│    └── Detects new/changed URLs via lastmod comparison          │
│    └── Queues changed URLs for immediate re-crawl               │
│                                                                  │
│  Full Crawl Scheduler (weekly)                                  │
│    └── Breadth-first from homepage                              │
│    └── Respects robots.txt crawl-delay                          │
│    └── Discovers orphan pages via sitemap diff                  │
│                                                                  │
│  Log File Analyzer (daily)                                      │
│    └── Identifies Googlebot crawl patterns                      │
│    └── Flags pages heavily crawled but not ranking              │
│    └── Detects crawl budget waste                               │
│                                                                  │
│  Real-Time Webhook Listener                                     │
│    └── CMS publish events → immediate crawl                     │
│    └── Deploy events → site-wide validation                     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Crawl Budget Optimization Engine

**Data Points to Track:**
- Googlebot crawl frequency per URL (from log files)
- Time-to-index for new content
- Crawl vs index ratio (crawled URLs / indexed URLs)
- Wasted crawl budget (crawled non-indexable pages)

**Automated Recommendations:**

| Issue Detected | Auto-Fix Possible | Recommendation |
|----------------|-------------------|----------------|
| Faceted navigation creating infinite crawl paths | YES (via noindex) | Add `noindex` to filter combination pages |
| Paginated archives being over-crawled | YES (via robots meta) | Implement `noindex, follow` on page 2+ |
| Parameter URLs duplicating content | NO (requires redirect config) | Generate .htaccess/Nginx rules |
| Orphan pages with high PageRank | YES (via internal linking) | Auto-insert contextual links |
| Soft 404s wasting crawl budget | NO (requires content decision) | Flag for human review with traffic data |

### 1.3 Indexability Issue Detection

**Detection Matrix:**

```typescript
interface IndexabilityAnalysis {
  url: string;
  isIndexable: boolean;
  indexabilitySignals: {
    robotsMeta: 'index' | 'noindex' | null;
    xRobotsTag: string | null;
    canonicalUrl: string | null;
    canonicalStatus: 'self' | 'cross-domain' | 'chain' | 'missing';
    robotsTxtStatus: 'allowed' | 'disallowed';
    httpStatus: number;
    redirectChainLength: number;
    inSitemap: boolean;
    hasInternalLinks: boolean;
    internalLinkCount: number;
  };
  indexabilityIssues: IndexabilityIssue[];
  priorityScore: number; // 0-100 based on traffic potential
}

type IndexabilityIssue =
  | 'noindex_but_in_sitemap'
  | 'canonicalized_but_in_sitemap'
  | 'orphan_page'
  | 'redirect_chain_too_long'
  | 'redirect_loop'
  | 'blocked_by_robots_txt'
  | 'conflicting_signals'
  | 'soft_404'
  | 'mixed_content_canonical';
```

### 1.4 JavaScript Rendering Analysis

**Challenge:** Googlebot's WRS executes JavaScript, but many AI crawlers (Claude, ChatGPT) do not.

**Detection Approach:**
1. Fetch raw HTML (no JS execution)
2. Fetch rendered HTML (via Puppeteer/Playwright or DataForSEO)
3. Diff content between raw and rendered versions
4. Flag pages where critical content only appears after JS execution

**Automated Alerts:**
- LCP element loaded via JavaScript (delays rendering)
- Navigation links generated client-side (crawlability risk)
- Structured data injected via JS (AI crawlers miss it)
- Content length difference > 50% between raw/rendered

```typescript
interface JSRenderingAnalysis {
  url: string;
  rawHtml: {
    wordCount: number;
    linkCount: number;
    hasStructuredData: boolean;
    title: string | null;
    metaDescription: string | null;
  };
  renderedHtml: {
    wordCount: number;
    linkCount: number;
    hasStructuredData: boolean;
    title: string | null;
    metaDescription: string | null;
  };
  jsRenderingIssues: {
    contentDependsOnJS: boolean;
    criticalContentMissing: string[]; // e.g., ['main_heading', 'product_price']
    linksOnlyInJS: number;
    schemaOnlyInJS: boolean;
    renderTimeMs: number;
  };
}
```

### 1.5 Orphan Page Detection

**Multi-Source Detection:**
```
┌─────────────────────────────────────────────────────────────┐
│                  ORPHAN PAGE DETECTION                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   XML Sitemap URLs ──┐                                      │
│                      ├──► COMPARE ──► Sitemap-only URLs     │
│   Crawled URLs ──────┘              (Orphan candidates)     │
│                                                              │
│   Google Search Console ──┐                                 │
│   (Indexed URLs)          ├──► COMPARE ──► GSC-only URLs    │
│   Crawled URLs ───────────┘              (Orphan candidates)│
│                                                              │
│   Analytics (traffic URLs) ──┐                              │
│                              ├──► COMPARE ──► Traffic to    │
│   Crawled URLs ──────────────┘              unlinked pages  │
│                                                              │
│   Server Access Logs ──┐                                    │
│   (Googlebot requests) ├──► COMPARE ──► Googlebot crawling  │
│   Crawled URLs ────────┘              but not linked        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Priority Scoring for Orphan Pages:**
- Traffic > 100 visits/month: HIGH priority
- In Google index: MEDIUM priority  
- In sitemap but no traffic: LOW priority
- Not indexed, no traffic: REVIEW (may be intentional)

### 1.6 Sitemap vs Actual Structure Comparison

**Automated Sitemap Audit:**

| Check | Detection Method | Auto-Fix |
|-------|------------------|----------|
| URLs in sitemap but 404 | Crawl + HTTP check | Remove from sitemap |
| URLs in sitemap but noindex | Crawl + robots meta | Remove from sitemap |
| URLs in sitemap but redirected | Crawl + redirect check | Update sitemap URL |
| Indexed URLs not in sitemap | GSC + sitemap diff | Add to sitemap |
| Sitemap > 50MB or > 50K URLs | Parse sitemap | Split into index |
| lastmod dates never updated | Track over time | Flag for review |
| Sitemap not referenced in robots.txt | Check robots.txt | Add sitemap directive |

---

## 2. Core Web Vitals Automation

### 2.1 Real-Time CWV Monitoring Architecture

**Lab Data vs Field Data:**
- Lab data (Lighthouse, PageSpeed Insights): Controlled, reproducible, but synthetic
- Field data (CrUX, RUM): Real user experience, 28-day rolling average

**Recommended Monitoring Stack:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    CWV MONITORING SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LAYER 1: Real User Monitoring (RUM)                            │
│    ├── Web Vitals JS library on all pages                       │
│    ├── Beacon to analytics endpoint                             │
│    ├── Store: LCP, CLS, INP per page/device/connection          │
│    └── Alert when 75th percentile crosses threshold             │
│                                                                  │
│  LAYER 2: Synthetic Monitoring (Lab)                            │
│    ├── Daily Lighthouse via DataForSEO API                      │
│    ├── Sample: Top 100 pages by traffic                         │
│    ├── Compare to previous day's baseline                       │
│    └── Alert on regression > 10%                                │
│                                                                  │
│  LAYER 3: CrUX API Integration                                  │
│    ├── Weekly pull of origin-level data                         │
│    ├── Track month-over-month trends                            │
│    ├── Compare to competitors                                   │
│    └── Predict ranking impact                                   │
│                                                                  │
│  LAYER 4: Deploy-Triggered Checks                               │
│    ├── CI/CD webhook triggers Lighthouse                        │
│    ├── Block deploy if LCP > 4s or CLS > 0.25                   │
│    └── Auto-rollback on critical regression                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 LCP Bottleneck Identification

**Root Cause Detection Algorithm:**

```typescript
interface LCPAnalysis {
  url: string;
  lcpMs: number;
  lcpElement: {
    tagName: string;
    selector: string;
    type: 'image' | 'text' | 'video' | 'background-image';
    resourceUrl?: string;
  };
  bottlenecks: LCPBottleneck[];
  recommendations: LCPRecommendation[];
}

type LCPBottleneck = {
  category: 'server' | 'resource' | 'render-blocking' | 'client-side';
  metric: string;
  value: number;
  threshold: number;
  impact: 'high' | 'medium' | 'low';
};

// Detection Rules
const LCP_RULES = {
  ttfbHigh: (ttfb: number) => ttfb > 800, // Server response slow
  resourceLarge: (bytes: number) => bytes > 200_000, // Image too large
  lazyLoadingLCP: (element: Element) => element.hasAttribute('loading') && element.getAttribute('loading') === 'lazy',
  missingPreload: (lcpUrl: string, preloads: string[]) => !preloads.includes(lcpUrl),
  renderBlockingCSS: (cssBytes: number) => cssBytes > 100_000,
  noFetchPriority: (element: Element) => !element.hasAttribute('fetchpriority'),
};
```

**Auto-Fix Opportunities for LCP:**

| Issue | Auto-Fix via Pixel | Implementation |
|-------|-------------------|----------------|
| LCP image has `loading="lazy"` | YES | Remove attribute via DOM injection |
| LCP image missing `fetchpriority="high"` | YES | Add attribute via DOM injection |
| LCP image not preloaded | YES | Inject `<link rel="preload">` |
| LCP image is PNG/JPEG | PARTIAL | Rewrite src to CDN with WebP conversion |
| LCP image too large | NO | Generate optimized version, update CMS |
| Render-blocking CSS | PARTIAL | Inject critical CSS inline |
| TTFB too high | NO | Server/CDN optimization required |

### 2.3 CLS Issue Detection and Fixes

**CLS Source Detection:**

```typescript
interface CLSAnalysis {
  url: string;
  clsScore: number;
  layoutShifts: LayoutShift[];
  sourceAttribution: CLSSource[];
}

interface CLSSource {
  element: string; // CSS selector
  shiftValue: number;
  cause: CLSCause;
  autoFixable: boolean;
  fix?: string;
}

type CLSCause =
  | 'image_no_dimensions'
  | 'ad_slot_no_reserved_space'
  | 'dynamic_content_injection'
  | 'font_swap'
  | 'cookie_banner_push'
  | 'lazy_loaded_content_above_fold'
  | 'iframe_no_dimensions';
```

**Auto-Fix Matrix for CLS:**

| CLS Cause | Auto-Fix | Implementation |
|-----------|----------|----------------|
| Images without width/height | YES | Inject dimensions from image metadata |
| Iframes without dimensions | YES | Inject standard dimensions or aspect-ratio |
| Font swap causing layout shift | YES | Add `font-display: optional` or preload fonts |
| Cookie banner pushes content | PARTIAL | Override CSS to use fixed positioning |
| Ad slots without reserved space | PARTIAL | Inject placeholder div with min-height |
| Dynamic content injection | NO | Requires code change |

### 2.4 INP Optimization Analysis

**INP is the hardest CWV to auto-fix** because it requires JavaScript architecture changes.

**Detection and Recommendations:**

```typescript
interface INPAnalysis {
  url: string;
  inpMs: number;
  longTasks: LongTask[];
  eventHandlers: SlowEventHandler[];
  recommendations: INPRecommendation[];
}

interface LongTask {
  duration: number;
  scriptUrl: string;
  functionName?: string;
  startTime: number;
}

interface SlowEventHandler {
  eventType: string; // 'click', 'keydown', etc.
  targetSelector: string;
  processingTime: number;
  delayTime: number;
}
```

**INP Recommendations (Dev-Required):**

| Issue | Detection | Recommendation |
|-------|-----------|----------------|
| Long tasks > 50ms | Performance API | Break into smaller chunks with `scheduler.yield()` |
| Large DOM (> 1500 nodes) | DOM analysis | Virtualize lists, lazy render |
| Heavy event handlers | Event timing | Debounce/throttle, move to Web Worker |
| Third-party scripts blocking | Script analysis | Load async/defer, use facade pattern |
| Synchronous XHR | Network analysis | Convert to async fetch |

### 2.5 Image Optimization Pipeline

**Automated Image Audit:**

```typescript
interface ImageAudit {
  url: string;
  images: ImageAnalysis[];
  totalSavingsBytes: number;
  cwvImpact: 'high' | 'medium' | 'low';
}

interface ImageAnalysis {
  src: string;
  originalFormat: 'jpeg' | 'png' | 'gif' | 'webp' | 'avif' | 'svg';
  originalSizeBytes: number;
  displayWidth: number;
  displayHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  isLCP: boolean;
  issues: ImageIssue[];
  optimizedUrl?: string; // CDN URL with transformations
  savingsBytes?: number;
}

type ImageIssue =
  | 'oversized_for_display'
  | 'not_webp_or_avif'
  | 'missing_alt_text'
  | 'missing_dimensions'
  | 'lazy_loading_above_fold'
  | 'not_lazy_loading_below_fold'
  | 'missing_srcset'
  | 'decorative_image_not_aria_hidden';
```

**Auto-Fix via Image CDN Integration:**

```
┌─────────────────────────────────────────────────────────────────┐
│                  IMAGE OPTIMIZATION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DETECT ──────────────────────────────────────────────────── │
│     Crawl identifies all <img> tags                             │
│     Analyze: format, size, dimensions, LCP status               │
│                                                                  │
│  2. TRANSFORM (via CDN like Cloudflare Images, imgix) ───────── │
│     Original: /images/hero.png (2.4MB, 4000x3000)               │
│     Optimized: /cdn-cgi/image/width=1200,format=webp/hero.png   │
│                                                                  │
│  3. INJECT (via Edge Worker or Pixel) ───────────────────────── │
│     Rewrite <img src> to CDN URL                                │
│     Add srcset for responsive images                            │
│     Add width/height attributes                                 │
│     Add loading="lazy" for below-fold                           │
│     Add fetchpriority="high" for LCP                            │
│                                                                  │
│  4. VERIFY ──────────────────────────────────────────────────── │
│     Re-run Lighthouse                                           │
│     Compare before/after LCP, total bytes                       │
│     Alert if regression                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Structured Data Management

### 3.1 Schema Audit System

**Schema Detection and Validation:**

```typescript
interface SchemaAudit {
  url: string;
  schemas: DetectedSchema[];
  validationErrors: SchemaError[];
  richResultEligibility: RichResultStatus[];
  recommendations: SchemaRecommendation[];
}

interface DetectedSchema {
  type: string; // e.g., 'Product', 'Article', 'LocalBusiness'
  format: 'json-ld' | 'microdata' | 'rdfa';
  raw: string;
  parsed: object;
  isValid: boolean;
  completeness: number; // 0-100%
  requiredFields: FieldStatus[];
  recommendedFields: FieldStatus[];
}

interface SchemaError {
  severity: 'error' | 'warning';
  message: string;
  path: string; // JSON path to the error
  value?: unknown;
  expectedType?: string;
}

interface RichResultStatus {
  type: string; // 'FAQ', 'HowTo', 'Product', 'Review', etc.
  eligible: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
}
```

**Page-Type to Schema Mapping:**

| Page Type | Required Schemas | Recommended Schemas |
|-----------|------------------|---------------------|
| Homepage | Organization, WebSite, SearchAction | SiteNavigationElement |
| Product page | Product, Offer, AggregateRating | BreadcrumbList, Review |
| Article/Blog | Article, Author, Publisher | BreadcrumbList, FAQPage |
| Local business | LocalBusiness, PostalAddress | OpeningHoursSpecification |
| Service page | Service, Provider | BreadcrumbList, FAQPage |
| FAQ page | FAQPage | BreadcrumbList |
| Recipe | Recipe | Video, NutritionInformation |
| Event | Event, Location | Performer, Offer |

### 3.2 Missing Schema Opportunity Detection

**AI-Powered Schema Recommendation:**

```typescript
interface SchemaOpportunity {
  url: string;
  pageType: string; // Detected via content analysis
  currentSchemas: string[];
  missingSchemas: SchemaRecommendation[];
  competitorSchemas: string[]; // What competitors have on similar pages
  richResultPotential: string[]; // Which rich results could be earned
}

async function detectSchemaOpportunities(page: PageAnalysis): Promise<SchemaOpportunity> {
  // 1. Classify page type using content analysis
  const pageType = await classifyPageType(page);
  
  // 2. Get required schemas for this page type
  const requiredSchemas = SCHEMA_REQUIREMENTS[pageType];
  
  // 3. Compare to what's currently implemented
  const missingSchemas = requiredSchemas.filter(
    schema => !page.detectedSchemas.includes(schema)
  );
  
  // 4. Analyze competitors for this page type/keyword
  const competitorSchemas = await getCompetitorSchemas(page.keyword);
  
  // 5. Calculate rich result potential
  const richResultPotential = calculateRichResultPotential(
    pageType, 
    page.keyword,
    missingSchemas
  );
  
  return {
    url: page.url,
    pageType,
    currentSchemas: page.detectedSchemas,
    missingSchemas,
    competitorSchemas,
    richResultPotential,
  };
}
```

### 3.3 Automated Schema Generation

**AI-Powered Schema Generation Pipeline:**

```
┌─────────────────────────────────────────────────────────────────┐
│                  SCHEMA GENERATION PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. EXTRACT ENTITIES ────────────────────────────────────────── │
│     Input: Raw HTML + rendered content                          │
│     Process: LLM extracts entities (product name, price,        │
│              author, dates, addresses, etc.)                    │
│     Output: Structured entity map                               │
│                                                                  │
│  2. MAP TO SCHEMA.ORG ───────────────────────────────────────── │
│     Input: Entity map + page type classification                │
│     Process: Match entities to schema.org properties            │
│     Output: Draft JSON-LD                                       │
│                                                                  │
│  3. VALIDATE ────────────────────────────────────────────────── │
│     Input: Draft JSON-LD                                        │
│     Process: Schema.org validator + Google Rich Results Test    │
│     Output: Validated JSON-LD or error list                     │
│                                                                  │
│  4. HUMAN REVIEW (optional) ─────────────────────────────────── │
│     Flag schemas that require human verification:               │
│     - Price/availability for products                           │
│     - Medical/legal claims                                      │
│     - Dates for events                                          │
│                                                                  │
│  5. INJECT ──────────────────────────────────────────────────── │
│     Via pixel: Inject <script type="application/ld+json">       │
│     Or generate code snippet for CMS integration                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Safety Guardrails for AI-Generated Schema:**

```typescript
// Schema Validation Pipeline
async function generateAndValidateSchema(
  page: PageAnalysis,
  entities: ExtractedEntities
): Promise<SchemaResult> {
  // 1. Generate schema via LLM
  const draftSchema = await llm.generateSchema(page, entities);
  
  // 2. Syntax validation (Pydantic-style)
  const syntaxResult = validateSchemaSyntax(draftSchema);
  if (!syntaxResult.valid) {
    return { success: false, errors: syntaxResult.errors };
  }
  
  // 3. Schema.org vocabulary validation
  const vocabResult = await validateAgainstSchemaOrg(draftSchema);
  if (!vocabResult.valid) {
    return { success: false, errors: vocabResult.errors };
  }
  
  // 4. Google Rich Results Test
  const richResultsResult = await testRichResults(draftSchema);
  
  // 5. Security check (no script injection, no external URLs in untrusted fields)
  const securityResult = securityScanSchema(draftSchema);
  if (!securityResult.safe) {
    return { success: false, errors: ['Schema failed security scan'] };
  }
  
  // 6. Flag for human review if contains sensitive data
  const requiresReview = checkIfRequiresHumanReview(draftSchema);
  
  return {
    success: true,
    schema: draftSchema,
    richResultsEligible: richResultsResult.eligible,
    requiresHumanReview: requiresReview,
  };
}
```

### 3.4 Rich Result Eligibility Tracking

**Dashboard Metrics:**

| Metric | Source | Update Frequency |
|--------|--------|------------------|
| Rich results in SERP | GSC Performance API | Daily |
| Schema validation status | Site crawl | Per crawl |
| Rich result CTR vs non-rich | GSC + A/B test | Weekly |
| Competitor rich result coverage | SERP monitoring | Weekly |
| Schema completeness score | Site crawl | Per crawl |

---

## 4. Site Architecture Analysis

### 4.1 Internal Link Graph Visualization

**Graph Data Model:**

```typescript
interface LinkGraph {
  nodes: PageNode[];
  edges: LinkEdge[];
  metrics: GraphMetrics;
}

interface PageNode {
  id: string;
  url: string;
  pageType: string;
  depth: number; // Clicks from homepage
  internalPageRank: number;
  inboundLinkCount: number;
  outboundLinkCount: number;
  isOrphan: boolean;
  isIndexable: boolean;
  traffic: number; // Monthly sessions
}

interface LinkEdge {
  source: string;
  target: string;
  anchorText: string;
  isFollow: boolean;
  isNavigation: boolean;
  isBreadcrumb: boolean;
  isContent: boolean;
}

interface GraphMetrics {
  totalNodes: number;
  totalEdges: number;
  averageDepth: number;
  maxDepth: number;
  orphanCount: number;
  avgInternalPageRank: number;
  pageRankDistribution: number[]; // Histogram buckets
  clusterCount: number;
}
```

### 4.2 PageRank Flow Simulation

**Internal PageRank Algorithm:**

```typescript
// Simplified PageRank implementation for internal links
function calculateInternalPageRank(
  graph: LinkGraph,
  dampingFactor: number = 0.85,
  iterations: number = 100
): Map<string, number> {
  const n = graph.nodes.length;
  const pageRank = new Map<string, number>();
  
  // Initialize with equal PageRank
  graph.nodes.forEach(node => {
    pageRank.set(node.id, 1 / n);
  });
  
  // Build adjacency list
  const outboundLinks = new Map<string, string[]>();
  graph.edges.forEach(edge => {
    if (edge.isFollow) {
      const links = outboundLinks.get(edge.source) || [];
      links.push(edge.target);
      outboundLinks.set(edge.source, links);
    }
  });
  
  // Iterate
  for (let i = 0; i < iterations; i++) {
    const newPageRank = new Map<string, number>();
    
    graph.nodes.forEach(node => {
      let incomingRank = 0;
      
      // Sum PageRank from all incoming links
      graph.edges
        .filter(e => e.target === node.id && e.isFollow)
        .forEach(edge => {
          const sourceLinks = outboundLinks.get(edge.source) || [];
          const sourceRank = pageRank.get(edge.source) || 0;
          incomingRank += sourceRank / sourceLinks.length;
        });
      
      newPageRank.set(
        node.id,
        (1 - dampingFactor) / n + dampingFactor * incomingRank
      );
    });
    
    pageRank.clear();
    newPageRank.forEach((value, key) => pageRank.set(key, value));
  }
  
  return pageRank;
}
```

**Visualization Recommendations:**
- Force-directed graph for overall structure
- Treemap for PageRank distribution
- Sankey diagram for authority flow between sections
- Heatmap overlay on sitemap for depth analysis

### 4.3 Topical Cluster Identification

**Cluster Detection Algorithm:**

```typescript
interface TopicalCluster {
  id: string;
  pillarPage: PageNode;
  clusterPages: PageNode[];
  topic: string;
  topicKeywords: string[];
  internalCohesion: number; // How well-linked internally
  externalAuthority: number; // Backlinks to cluster
  coverageScore: number; // Topic completeness
  gaps: string[]; // Missing subtopics
}

async function identifyTopicalClusters(
  graph: LinkGraph,
  pages: PageAnalysis[]
): Promise<TopicalCluster[]> {
  // 1. Extract topics from page content
  const pageTopics = await Promise.all(
    pages.map(page => extractTopics(page.content))
  );
  
  // 2. Group pages by primary topic
  const topicGroups = groupByTopic(pages, pageTopics);
  
  // 3. Identify pillar pages (highest PageRank in group)
  const clusters = topicGroups.map(group => {
    const pillar = group.reduce((max, page) => 
      page.internalPageRank > max.internalPageRank ? page : max
    );
    
    return {
      pillarPage: pillar,
      clusterPages: group.filter(p => p.id !== pillar.id),
      topic: group[0].primaryTopic,
    };
  });
  
  // 4. Analyze cluster health
  return clusters.map(cluster => ({
    ...cluster,
    internalCohesion: calculateClusterCohesion(cluster, graph),
    externalAuthority: sumBacklinks(cluster),
    coverageScore: calculateTopicCoverage(cluster),
    gaps: identifyMissingSubtopics(cluster),
  }));
}
```

### 4.4 Click Depth Optimization

**Click Depth Analysis:**

| Depth | SEO Impact | Recommendation |
|-------|------------|----------------|
| 1 (homepage-linked) | Highest crawl priority | Reserve for top 10-20 pages |
| 2 | High crawl priority | Category pages, main services |
| 3 | Medium priority | Product pages, blog posts |
| 4+ | Low priority, may not be crawled frequently | Move important content higher |

**Auto-Fix Opportunities:**

```typescript
interface ClickDepthOptimization {
  url: string;
  currentDepth: number;
  recommendedDepth: number;
  monthlyTraffic: number;
  conversionValue: number;
  suggestedLinks: {
    fromPage: string;
    anchorText: string;
    position: 'navigation' | 'content' | 'footer' | 'sidebar';
  }[];
}

// Pages with high traffic/value but deep depth should be elevated
function identifyDepthOptimizations(
  graph: LinkGraph,
  analytics: AnalyticsData
): ClickDepthOptimization[] {
  return graph.nodes
    .filter(node => {
      const traffic = analytics.getTraffic(node.url);
      const depth = node.depth;
      // High traffic but deep = optimization opportunity
      return traffic > 1000 && depth > 3;
    })
    .map(node => ({
      url: node.url,
      currentDepth: node.depth,
      recommendedDepth: calculateOptimalDepth(node, analytics),
      monthlyTraffic: analytics.getTraffic(node.url),
      conversionValue: analytics.getConversionValue(node.url),
      suggestedLinks: generateLinkSuggestions(node, graph),
    }));
}
```

### 4.5 Faceted Navigation Handling

**Faceted Navigation Audit:**

```typescript
interface FacetedNavigationAudit {
  basePage: string;
  facetCombinations: FacetCombination[];
  totalCombinations: number;
  indexableCombinations: number;
  recommendedStrategy: FacetStrategy;
}

interface FacetCombination {
  url: string;
  facets: { name: string; value: string }[];
  hasUniqueContent: boolean;
  searchVolume: number; // For the facet combination
  isIndexable: boolean;
  recommendation: 'index' | 'noindex' | 'canonicalize' | 'block';
}

type FacetStrategy = {
  approach: 'whitelist' | 'blacklist' | 'rules-based';
  rules: FacetRule[];
};

// Example rules
const FACET_RULES: FacetRule[] = [
  { facet: 'sort', action: 'noindex' }, // Sorting never creates unique content
  { facet: 'page', action: 'noindex_after_page_1' }, // Pagination
  { facet: 'price', action: 'noindex' }, // Price filters rarely searched
  { facet: 'color', action: 'index_if_volume_above_100' }, // Color may be searched
  { facet: 'size', action: 'index_if_volume_above_100' },
  { facet: 'brand', action: 'index' }, // Brand filters often searched
];
```

### 4.6 Pagination Best Practices

**Pagination Audit:**

| Pattern | Status 2026 | Recommendation |
|---------|-------------|----------------|
| `rel="next/prev"` | Deprecated by Google | Still useful for users, not SEO signal |
| Self-canonicalizing pages | Recommended | Each page canonicals to itself |
| "View All" page | Good if performant | Canonical all pages to "View All" |
| Infinite scroll | Crawlability risk | Ensure crawlable links exist |
| Load more button | Crawlability risk | Ensure crawlable pagination fallback |

---

## 5. International SEO

### 5.1 Hreflang Audit System

**Comprehensive Hreflang Validation:**

```typescript
interface HreflangAudit {
  url: string;
  declaredHreflang: HreflangTag[];
  validationErrors: HreflangError[];
  missingReciprocals: string[];
  recommendations: string[];
}

interface HreflangTag {
  hreflang: string; // e.g., 'en-US', 'de', 'x-default'
  href: string;
  isValid: boolean;
  reciprocalExists: boolean;
  targetPageExists: boolean;
  targetPageReturnsHreflang: boolean;
}

type HreflangError =
  | { type: 'missing_self_reference'; url: string }
  | { type: 'missing_x_default'; url: string }
  | { type: 'missing_reciprocal'; source: string; target: string }
  | { type: 'invalid_language_code'; code: string }
  | { type: 'invalid_region_code'; code: string }
  | { type: 'target_not_found'; href: string }
  | { type: 'target_noindex'; href: string }
  | { type: 'target_redirects'; href: string; redirectsTo: string }
  | { type: 'canonical_conflict'; url: string; canonical: string }
  | { type: 'inconsistent_implementation'; method: 'html' | 'sitemap' | 'header' };
```

**Validation Rules:**

```typescript
const HREFLANG_VALIDATION_RULES = [
  // Every page must reference itself
  (page: PageWithHreflang) => {
    const selfRef = page.hreflangTags.find(t => t.href === page.url);
    return selfRef ? null : { type: 'missing_self_reference', url: page.url };
  },
  
  // x-default should exist for language selector pages
  (page: PageWithHreflang) => {
    const hasXDefault = page.hreflangTags.some(t => t.hreflang === 'x-default');
    return hasXDefault ? null : { type: 'missing_x_default', url: page.url };
  },
  
  // All hreflang targets must reciprocate
  async (page: PageWithHreflang) => {
    const errors = [];
    for (const tag of page.hreflangTags) {
      const targetPage = await fetchPage(tag.href);
      const reciprocal = targetPage?.hreflangTags?.find(t => t.href === page.url);
      if (!reciprocal) {
        errors.push({ type: 'missing_reciprocal', source: page.url, target: tag.href });
      }
    }
    return errors;
  },
  
  // Language codes must be valid ISO 639-1
  (page: PageWithHreflang) => {
    const errors = [];
    for (const tag of page.hreflangTags) {
      const [lang, region] = tag.hreflang.split('-');
      if (!ISO_639_1_CODES.includes(lang)) {
        errors.push({ type: 'invalid_language_code', code: lang });
      }
      if (region && !ISO_3166_1_CODES.includes(region)) {
        errors.push({ type: 'invalid_region_code', code: region });
      }
    }
    return errors;
  },
];
```

### 5.2 Hreflang Generation

**Auto-Generate Hreflang for Consistent URL Patterns:**

```typescript
interface HreflangGenerator {
  pattern: URLPattern; // e.g., /{lang}/{path}
  locales: Locale[];
  strategy: 'subdomain' | 'subdirectory' | 'ccTLD' | 'parameter';
}

function generateHreflangTags(
  url: string,
  generator: HreflangGenerator
): HreflangTag[] {
  const path = extractPath(url, generator.pattern);
  
  return generator.locales.map(locale => ({
    hreflang: locale.hreflang, // e.g., 'en-US'
    href: buildLocalizedUrl(path, locale, generator.strategy),
  }));
}

// Auto-inject via pixel or generate sitemap
function generateHreflangSitemap(
  pages: string[],
  generator: HreflangGenerator
): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  
  for (const page of pages) {
    const hreflangTags = generateHreflangTags(page, generator);
    xml += '  <url>\n';
    xml += `    <loc>${page}</loc>\n`;
    for (const tag of hreflangTags) {
      xml += `    <xhtml:link rel="alternate" hreflang="${tag.hreflang}" href="${tag.href}"/>\n`;
    }
    xml += '  </url>\n';
  }
  
  xml += '</urlset>';
  return xml;
}
```

### 5.3 Content Parity Analysis

**Cross-Locale Content Comparison:**

```typescript
interface ContentParityAnalysis {
  defaultLocale: string;
  comparisons: LocaleComparison[];
  parityScore: number; // 0-100%
  criticalGaps: ContentGap[];
}

interface LocaleComparison {
  locale: string;
  pagesInDefault: number;
  pagesInLocale: number;
  missingPages: string[];
  outdatedPages: OutdatedPage[];
  contentLengthRatio: number; // e.g., 0.8 = 80% as long
  schemaParityScore: number;
}

interface ContentGap {
  defaultUrl: string;
  missingLocales: string[];
  pageImportance: 'critical' | 'high' | 'medium' | 'low';
  monthlyTraffic: number;
}

// Detection
async function analyzeContentParity(
  locales: Locale[],
  defaultLocale: string
): Promise<ContentParityAnalysis> {
  const defaultPages = await crawlLocale(defaultLocale);
  
  const comparisons = await Promise.all(
    locales
      .filter(l => l.code !== defaultLocale)
      .map(async locale => {
        const localePages = await crawlLocale(locale.code);
        
        return {
          locale: locale.code,
          pagesInDefault: defaultPages.length,
          pagesInLocale: localePages.length,
          missingPages: findMissingPages(defaultPages, localePages),
          outdatedPages: findOutdatedPages(defaultPages, localePages),
          contentLengthRatio: calculateContentRatio(defaultPages, localePages),
          schemaParityScore: compareSchemas(defaultPages, localePages),
        };
      })
  );
  
  return {
    defaultLocale,
    comparisons,
    parityScore: calculateOverallParity(comparisons),
    criticalGaps: identifyCriticalGaps(comparisons, analytics),
  };
}
```

### 5.4 URL Structure Recommendations

**International URL Strategy Comparison:**

| Strategy | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| ccTLD (example.de) | Strong geo-targeting, trust signals | Expensive, separate link equity | Large enterprises only |
| Subdomain (de.example.com) | Easy setup, separate hosting possible | Weak geo-signal, split authority | Not recommended |
| Subdirectory (example.com/de/) | Single domain authority, easy management | Requires server-side routing | **Recommended for most** |
| Parameters (example.com?lang=de) | Easiest implementation | Worst for SEO, hard to index | Never use |

---

## 6. Automated Remediation System

### 6.1 Fix Categories and Automation Levels

```
┌─────────────────────────────────────────────────────────────────┐
│              REMEDIATION AUTOMATION MATRIX                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LEVEL 1: FULLY AUTOMATED (No human intervention)               │
│  ──────────────────────────────────────────────────────────────│
│  • Add missing meta descriptions (AI-generated)                 │
│  • Add missing alt text to images (AI-generated)                │
│  • Inject missing structured data (template-based)              │
│  • Add canonical tags where missing                             │
│  • Fix broken internal links (redirect to closest match)        │
│  • Add hreflang tags (pattern-based)                            │
│  • Inject preload hints for LCP resources                       │
│  • Add width/height to images                                   │
│  • Remove lazy loading from LCP images                          │
│                                                                  │
│  LEVEL 2: AUTOMATED WITH REVIEW (Human approves batch)          │
│  ──────────────────────────────────────────────────────────────│
│  • Title tag optimization (AI-generated, human review)          │
│  • Internal link insertion (AI-suggested, human review)         │
│  • Redirect mapping after URL changes                           │
│  • Schema markup for complex page types                         │
│  • noindex recommendations for thin content                     │
│                                                                  │
│  LEVEL 3: DEV TICKET GENERATION (Requires code changes)         │
│  ──────────────────────────────────────────────────────────────│
│  • Server-side rendering implementation                         │
│  • INP/long task optimization                                   │
│  • Database query optimization (TTFB)                           │
│  • CDN configuration changes                                    │
│  • CMS architecture changes                                     │
│  • Mobile template fixes                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Pixel-Based Fix Implementation

**How the SEO Pixel Works:**

```javascript
// Injected via <script> tag in <head>
(function() {
  // 1. Fetch fix instructions from API
  const fixes = await fetch(`/api/seo-fixes?url=${encodeURIComponent(location.href)}`);
  
  // 2. Apply DOM modifications
  for (const fix of fixes) {
    switch (fix.type) {
      case 'inject_meta':
        const meta = document.createElement('meta');
        meta.name = fix.name;
        meta.content = fix.content;
        document.head.appendChild(meta);
        break;
        
      case 'inject_schema':
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(fix.schema);
        document.head.appendChild(script);
        break;
        
      case 'modify_image':
        const img = document.querySelector(fix.selector);
        if (img) {
          if (fix.width) img.width = fix.width;
          if (fix.height) img.height = fix.height;
          if (fix.loading) img.loading = fix.loading;
          if (fix.fetchpriority) img.fetchPriority = fix.fetchpriority;
          if (fix.src) img.src = fix.src; // CDN URL
        }
        break;
        
      case 'inject_link':
        // Find anchor point and insert link
        const anchor = document.querySelector(fix.anchorSelector);
        if (anchor) {
          const link = document.createElement('a');
          link.href = fix.href;
          link.textContent = fix.anchorText;
          anchor.appendChild(link);
        }
        break;
    }
  }
})();
```

**Edge Worker Alternative (Better Performance):**

```typescript
// Cloudflare Worker / Vercel Edge Middleware
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Fetch original response
    const response = await fetch(request);
    
    // Get SEO fixes for this URL
    const fixes = await getSEOFixes(url.pathname);
    if (fixes.length === 0) return response;
    
    // Transform HTML
    return new HTMLRewriter()
      .on('head', new HeadHandler(fixes))
      .on('img', new ImageHandler(fixes))
      .on('body', new BodyHandler(fixes))
      .transform(response);
  }
};

class HeadHandler {
  constructor(private fixes: SEOFix[]) {}
  
  element(element: Element) {
    for (const fix of this.fixes) {
      if (fix.type === 'inject_meta') {
        element.append(`<meta name="${fix.name}" content="${fix.content}">`, { html: true });
      }
      if (fix.type === 'inject_schema') {
        element.append(`<script type="application/ld+json">${JSON.stringify(fix.schema)}</script>`, { html: true });
      }
      if (fix.type === 'inject_canonical') {
        element.append(`<link rel="canonical" href="${fix.href}">`, { html: true });
      }
    }
  }
}
```

### 6.3 Priority Scoring for Fixes

**Impact-Based Prioritization:**

```typescript
interface SEOIssue {
  id: string;
  type: string;
  url: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFixable: boolean;
  estimatedImpact: ImpactEstimate;
  priorityScore: number;
}

interface ImpactEstimate {
  trafficImpact: number; // Estimated monthly sessions gained
  conversionImpact: number; // Estimated revenue impact
  crawlBudgetSaved: number; // Crawl requests saved
  cwvImprovement: number; // Expected CWV score improvement
}

function calculatePriorityScore(issue: SEOIssue, analytics: AnalyticsData): number {
  const weights = {
    trafficPotential: 0.3,
    conversionValue: 0.25,
    competitorGap: 0.2,
    implementationEase: 0.15,
    cwvImpact: 0.1,
  };
  
  const scores = {
    trafficPotential: normalizeTraffic(issue.estimatedImpact.trafficImpact),
    conversionValue: normalizeRevenue(issue.estimatedImpact.conversionImpact),
    competitorGap: getCompetitorGapScore(issue),
    implementationEase: issue.autoFixable ? 1 : 0.5,
    cwvImpact: normalizeCWV(issue.estimatedImpact.cwvImprovement),
  };
  
  return Object.entries(weights).reduce(
    (total, [key, weight]) => total + scores[key] * weight,
    0
  ) * 100;
}
```

**Priority Matrix:**

| Issue Type | Traffic Impact | Effort | Priority |
|------------|---------------|--------|----------|
| Broken internal links (high-traffic pages) | High | Low (auto-fix) | **P0** |
| Missing structured data (product pages) | High | Low (auto-generate) | **P0** |
| LCP > 4s on landing pages | High | Medium | **P1** |
| Orphan pages with traffic | Medium | Low (add links) | **P1** |
| Missing meta descriptions | Medium | Low (auto-generate) | **P2** |
| CLS > 0.25 | Medium | Medium | **P2** |
| Hreflang errors | Medium | Medium | **P2** |
| INP > 500ms | Low | High | **P3** |
| Missing alt text | Low | Low (auto-generate) | **P3** |

### 6.4 Post-Fix Verification

**Verification Pipeline:**

```
┌─────────────────────────────────────────────────────────────────┐
│                   POST-FIX VERIFICATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. IMMEDIATE (within 1 hour)                                   │
│     ├── Re-crawl affected URLs                                  │
│     ├── Verify fix is applied in rendered HTML                  │
│     ├── Run Lighthouse to confirm CWV improvement               │
│     └── Check for regressions on other metrics                  │
│                                                                  │
│  2. SHORT-TERM (24-48 hours)                                    │
│     ├── Monitor GSC for indexing status changes                 │
│     ├── Check Google cache for updated content                  │
│     ├── Monitor RUM data for CWV improvements                   │
│     └── Track impressions for affected URLs                     │
│                                                                  │
│  3. MEDIUM-TERM (7-14 days)                                     │
│     ├── Analyze ranking changes for target keywords             │
│     ├── Compare traffic before/after fix                        │
│     ├── Monitor rich result appearance in SERPs                 │
│     └── Calculate ROI of fix implementation                     │
│                                                                  │
│  4. LONG-TERM (30+ days)                                        │
│     ├── Verify fix persistence (no regression)                  │
│     ├── Aggregate impact across all similar fixes               │
│     └── Update priority model based on actual results           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Dev Ticket Generation

**Auto-Generated Ticket Template:**

```typescript
interface SEODevTicket {
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  type: 'bug' | 'improvement' | 'feature';
  affectedUrls: string[];
  issue: {
    description: string;
    currentState: string;
    expectedState: string;
    screenshot?: string;
  };
  businessImpact: {
    estimatedTrafficLoss: number;
    estimatedRevenueLoss: number;
    competitorComparison: string;
  };
  technicalDetails: {
    rootCause: string;
    suggestedFix: string;
    codeSnippet?: string;
    relatedFiles?: string[];
    estimatedEffort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  };
  verification: {
    howToTest: string;
    acceptanceCriteria: string[];
  };
  references: {
    googleDocumentation: string[];
    relatedTickets: string[];
    seoToolReport: string;
  };
}

// Example auto-generated ticket
const exampleTicket: SEODevTicket = {
  title: '[SEO] Fix INP > 500ms on product detail pages',
  priority: 'P1',
  type: 'improvement',
  affectedUrls: ['/products/widget-123', '/products/gadget-456', '...42 more'],
  issue: {
    description: 'Product detail pages have Interaction to Next Paint (INP) scores exceeding 500ms, failing Core Web Vitals thresholds.',
    currentState: 'Average INP: 650ms (75th percentile)',
    expectedState: 'INP < 200ms (Google "good" threshold)',
  },
  businessImpact: {
    estimatedTrafficLoss: 15000, // monthly sessions
    estimatedRevenueLoss: 45000, // monthly revenue
    competitorComparison: 'Top 3 competitors have INP < 150ms',
  },
  technicalDetails: {
    rootCause: 'Add-to-cart button click handler executes synchronous API call and DOM manipulation taking 400ms+',
    suggestedFix: 'Move API call to async, use optimistic UI update, defer DOM manipulation to next frame',
    codeSnippet: `
// Before
function handleAddToCart() {
  const result = syncApiCall('/api/cart/add'); // Blocking
  updateDOM(result); // Main thread blocked
}

// After
async function handleAddToCart() {
  updateDOMOptimistic(); // Immediate feedback
  await scheduler.yield(); // Yield to browser
  const result = await asyncApiCall('/api/cart/add');
  updateDOMConfirmed(result);
}
    `,
    relatedFiles: ['src/components/ProductDetail.tsx', 'src/hooks/useCart.ts'],
    estimatedEffort: 'M',
  },
  verification: {
    howToTest: 'Run Lighthouse on product pages, verify INP < 200ms. Test add-to-cart interaction with Chrome DevTools Performance panel.',
    acceptanceCriteria: [
      'INP 75th percentile < 200ms on all product pages',
      'Add-to-cart button responds in < 100ms',
      'No functional regression in cart functionality',
    ],
  },
  references: {
    googleDocumentation: [
      'https://web.dev/inp/',
      'https://web.dev/optimize-inp/',
    ],
    relatedTickets: ['SEO-123', 'PERF-456'],
    seoToolReport: 'https://app.openseo.so/audit/abc123',
  },
};
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Existing + Enhancements)

**Already Implemented in open-seo-main:**
- Basic crawling with robots.txt respect
- Sitemap discovery and parsing
- Page analysis (title, meta, headings, images, links)
- Lighthouse integration via DataForSEO
- Indexability detection (noindex, canonical, robots)
- Hreflang tag extraction
- Structured data presence detection
- BullMQ job queue for async processing

**Enhancements Needed:**
- [ ] Add JavaScript rendering comparison (raw vs rendered)
- [ ] Implement orphan page detection (sitemap diff)
- [ ] Add internal PageRank calculation
- [ ] Build link graph visualization data structure
- [ ] Implement click depth analysis

### Phase 2: Monitoring & Alerting

- [ ] Real User Monitoring (RUM) integration for CWV
- [ ] Scheduled crawl jobs (daily sample, weekly full)
- [ ] Regression detection with alerting
- [ ] GSC API integration for index status
- [ ] CrUX API integration for field data

### Phase 3: AI-Powered Analysis

- [ ] Page type classification
- [ ] Schema opportunity detection
- [ ] AI-generated meta descriptions
- [ ] AI-generated alt text
- [ ] AI-generated schema markup
- [ ] Topical cluster identification

### Phase 4: Automated Remediation

- [ ] SEO pixel/edge worker infrastructure
- [ ] Auto-fix: canonical tag injection
- [ ] Auto-fix: schema injection
- [ ] Auto-fix: image optimization (CDN rewrite)
- [ ] Auto-fix: internal link injection
- [ ] Human review queue for risky fixes

### Phase 5: Reporting & ROI

- [ ] Before/after comparison dashboards
- [ ] Traffic impact attribution
- [ ] Dev ticket generation
- [ ] Priority scoring model
- [ ] Competitor benchmarking

---

## 8. Data Model Extensions

**New Tables Required:**

```sql
-- Crawl job history
CREATE TABLE crawl_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL, -- 'full', 'delta', 'sample'
  status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  pages_crawled INTEGER DEFAULT 0,
  pages_total INTEGER DEFAULT 0,
  config JSONB NOT NULL
);

-- Link graph edges
CREATE TABLE link_graph (
  id TEXT PRIMARY KEY,
  crawl_job_id TEXT NOT NULL REFERENCES crawl_jobs(id),
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  is_follow BOOLEAN DEFAULT true,
  link_type TEXT, -- 'navigation', 'content', 'footer', 'breadcrumb'
  UNIQUE(crawl_job_id, source_url, target_url)
);

-- Internal PageRank snapshots
CREATE TABLE pagerank_snapshots (
  id TEXT PRIMARY KEY,
  crawl_job_id TEXT NOT NULL REFERENCES crawl_jobs(id),
  url TEXT NOT NULL,
  pagerank REAL NOT NULL,
  depth INTEGER NOT NULL,
  inbound_links INTEGER NOT NULL,
  outbound_links INTEGER NOT NULL,
  UNIQUE(crawl_job_id, url)
);

-- SEO issues detected
CREATE TABLE seo_issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  crawl_job_id TEXT REFERENCES crawl_jobs(id),
  url TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  details JSONB,
  auto_fixable BOOLEAN DEFAULT false,
  fix_status TEXT DEFAULT 'open', -- 'open', 'fixed', 'ignored', 'wont_fix'
  fixed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO fixes applied
CREATE TABLE seo_fixes (
  id TEXT PRIMARY KEY,
  issue_id TEXT REFERENCES seo_issues(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  url TEXT NOT NULL,
  fix_type TEXT NOT NULL,
  fix_payload JSONB NOT NULL,
  applied_via TEXT NOT NULL, -- 'pixel', 'edge', 'manual', 'cms'
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verification_status TEXT -- 'pending', 'success', 'failed', 'regressed'
);

-- Schema markup inventory
CREATE TABLE schema_inventory (
  id TEXT PRIMARY KEY,
  crawl_job_id TEXT NOT NULL REFERENCES crawl_jobs(id),
  url TEXT NOT NULL,
  schema_type TEXT NOT NULL,
  schema_format TEXT NOT NULL, -- 'json-ld', 'microdata', 'rdfa'
  schema_content JSONB NOT NULL,
  is_valid BOOLEAN NOT NULL,
  validation_errors JSONB,
  rich_result_eligible TEXT[], -- ['Product', 'FAQ', etc.]
  UNIQUE(crawl_job_id, url, schema_type)
);

-- CWV monitoring
CREATE TABLE cwv_measurements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  url TEXT NOT NULL,
  source TEXT NOT NULL, -- 'lighthouse', 'rum', 'crux'
  device TEXT NOT NULL, -- 'mobile', 'desktop'
  lcp_ms REAL,
  cls REAL,
  inp_ms REAL,
  ttfb_ms REAL,
  measured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX cwv_measurements_lookup ON cwv_measurements(project_id, url, measured_at DESC);

-- Hreflang mapping
CREATE TABLE hreflang_map (
  id TEXT PRIMARY KEY,
  crawl_job_id TEXT NOT NULL REFERENCES crawl_jobs(id),
  url TEXT NOT NULL,
  hreflang TEXT NOT NULL, -- 'en-US', 'de-DE', 'x-default'
  target_url TEXT NOT NULL,
  has_reciprocal BOOLEAN,
  target_exists BOOLEAN,
  validation_errors JSONB
);
```

---

## 9. API Design

**New Endpoints:**

```typescript
// Crawl Management
POST   /api/crawl/start           // Start new crawl job
GET    /api/crawl/:id/status      // Get crawl status
GET    /api/crawl/:id/results     // Get crawl results
DELETE /api/crawl/:id             // Cancel/delete crawl

// SEO Issues
GET    /api/issues                // List issues with filters
GET    /api/issues/:id            // Get issue details
PATCH  /api/issues/:id            // Update issue status
POST   /api/issues/:id/fix        // Apply auto-fix

// Link Graph
GET    /api/linkgraph             // Get link graph data
GET    /api/linkgraph/pagerank    // Get PageRank scores
GET    /api/linkgraph/orphans     // Get orphan pages
GET    /api/linkgraph/depth       // Get click depth analysis

// Schema Management
GET    /api/schema/audit          // Get schema audit
POST   /api/schema/generate       // Generate schema for URL
POST   /api/schema/validate       // Validate schema

// CWV Monitoring
GET    /api/cwv/overview          // CWV summary
GET    /api/cwv/:url/history      // CWV history for URL
POST   /api/cwv/alert             // Configure CWV alerts

// Hreflang
GET    /api/hreflang/audit        // Hreflang audit
POST   /api/hreflang/generate     // Generate hreflang tags

// Fix Management
GET    /api/fixes                 // List applied fixes
GET    /api/fixes/:url            // Get fixes for URL (pixel endpoint)
POST   /api/fixes/deploy          // Deploy fix batch
GET    /api/fixes/:id/verify      // Verify fix was applied
```

---

## 10. Success Metrics

### Tool Effectiveness

| Metric | Target | Measurement |
|--------|--------|-------------|
| Issue detection accuracy | > 95% | Manual audit comparison |
| False positive rate | < 5% | Human review sampling |
| Auto-fix success rate | > 90% | Post-fix verification |
| Time to detection | < 24 hours | From issue creation to alert |
| Time to resolution | < 72 hours | For auto-fixable issues |

### SEO Impact

| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Pages passing CWV | 47% | 80% | 90 days |
| Orphan pages | N/A | < 5% of total | 30 days |
| Schema coverage | N/A | > 80% of eligible pages | 60 days |
| Hreflang errors | N/A | < 1% | 30 days |
| Avg click depth | N/A | < 3 for key pages | 60 days |

---

## Sources

### Core Web Vitals
- [Core Web Vitals Optimization Guide 2026 | Sky SEO Digital](https://skyseodigital.com/core-web-vitals-optimization-complete-guide-for-2026/)
- [Technical SEO Checklist: The Complete Guide For 2026 | DebugBear](https://www.debugbear.com/blog/technical-seo-checklist)
- [Core Web Vitals 2026: Fix LCP, CLS & INP Fast](https://www.w3era.com/blog/seo/core-web-vitals-guide/)
- [8 Best Tools for Core Web Vitals Testing and Performance Monitoring](https://wp-rocket.me/blog/core-web-vitals-testing-performance-monitoring-tools/)

### Structured Data
- [Schema Markup AI Generation: Complete Guide 2026](https://www.digitalapplied.com/blog/schema-markup-ai-generation-guide-2026)
- [5 Essential Testing Tools to Validate Schema Markup in 2026](https://woonyb.com/blog/seo-marketing/5-essential-testing-tools-you-need-to-validate-schema-markup/)
- [Structured Data: SEO and GEO Optimization for AI in 2026](https://www.digidop.com/blog/structured-data-secret-weapon-seo)

### JavaScript SEO
- [Inside Googlebot: Demystifying Crawling, Fetching, and the Bytes We Process | Google](https://developers.google.com/search/blog/2026/03/crawler-blog-post)
- [JavaScript Rendering in SEO: The Ultimate 2026 Guide](https://www.clickrank.ai/javascript-rendering-affect-seo/)
- [Google Explains How Crawling Works in 2026 | Search Engine Land](https://searchengineland.com/google-explains-how-crawling-works-in-2026-473110)

### Internal Linking & Site Architecture
- [Internal Linking Audit: Key Checks and Metrics (2026) | Incremys](https://www.incremys.com/en/resources/blog/internal-linking-audit)
- [Internal Linking Strategy Guide 2026](https://topicalmap.ai/blog/auto/internal-linking-strategy-guide-2026)
- [Website Structure Visualization | Link-Assistant](https://www.link-assistant.com/website-auditor/site-visualizations.html)

### Orphan Pages
- [How to Find Orphan Pages On Your Site (Advanced Guide 2026)](https://bloggerspassion.com/orphan-pages/)
- [Are Orphan Pages the Hidden SEO Problem to Fix in 2026?](https://www.clickrank.ai/orphan-pages-how-to-fix/)

### International SEO
- [Hreflang Tags: Ultimate 2026 Guide for International SEO](https://www.clickrank.ai/hreflang-tags-complete-guide/)
- [International SEO Audit: A 2026 Checklist](https://www.buriedagency.com/post/international-seo-audit)
- [Hreflang Implementation Guide: Complete Technical Reference | LinkGraph](https://www.linkgraph.com/blog/hreflang-implementation-guide/)

### Automated Remediation
- [OTTO SEO Pixel | Search Atlas](https://searchatlas.com/otto-pixel/)
- [Automated SEO Remediation Guide: Fix Search Issues in 2026](https://www.clickrank.ai/automated-seo-remediation/)
- [SEO Automation: The Ultimate Guide for 2026](https://www.seos7.com/blog/seo-automation-the-ultimate-guide-for-2026/)
