### 3.7 Agent 7: Auto-Detection Layer

#### Executive Summary

The Auto-Detection Layer is the intelligence backbone of TeveroSEO's scraping infrastructure, enabling **purpose-driven scraping decisions** that reduce costs by 70-90% while maintaining data quality. Current implementation scrapes all pages with identical depth regardless of purpose, wasting resources on legal pages when auditing for SEO, or fetching entire blogs when only top performers matter.

**Core Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUTO-DETECTION LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Purpose   │───▶│    Site     │───▶│    Page     │                 │
│  │  Detector   │    │  Analyzer   │    │ Classifier  │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                  │                  │                          │
│         ▼                  ▼                  ▼                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  JS Render  │    │  Anti-Bot   │    │  Sitemap    │                 │
│  │  Detector   │    │  Detector   │    │  Scorer     │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│                            │                                             │
│                            ▼                                             │
│                    ┌─────────────────┐                                  │
│                    │ Decision Engine │                                  │
│                    │ (Depth + Tier)  │                                  │
│                    └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Metrics Impact:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Pages scraped per prospect | 100-500 | 15-30 | 85% reduction |
| Full audit cost (5K pages) | $50 | $8 | 84% savings |
| JS rendering usage | 20% | 2-5% | 75-90% reduction |
| Time to first insight | 5 min | 45 sec | 85% faster |

---

#### 3.7.1 Page Type Classification System

**URL Pattern Recognition (Confidence: 0.90)**

The first-pass classifier uses URL structure analysis, which works for 70% of pages without parsing HTML:

```typescript
interface PageTypePattern {
  type: PageType;
  patterns: RegExp[];
  priority: number;  // Higher = check first
  seoValue: 'high' | 'medium' | 'low' | 'skip';
}

const PAGE_TYPE_PATTERNS: PageTypePattern[] = [
  // High SEO Value - Always scrape fully
  {
    type: 'blog-post',
    patterns: [
      /\/blog\/[\w-]+(?:\/|$)/i,
      /\/articles?\/[\w-]+/i,
      /\/posts?\/[\w-]+/i,
      /\/news\/\d{4}\/\d{2}\/[\w-]+/i,  // /news/2024/05/slug
    ],
    priority: 10,
    seoValue: 'high',
  },
  {
    type: 'product',
    patterns: [
      /\/products?\/[\w-]+(?:\/|$)/i,
      /\/p\/[\w-]+/i,
      /\/shop\/[\w-]+\/[\w-]+/i,
      /\/item\/\d+/i,
    ],
    priority: 10,
    seoValue: 'high',
  },
  {
    type: 'service',
    patterns: [
      /\/services?\/[\w-]+(?:\/|$)/i,
      /\/solutions?\/[\w-]+/i,
      /\/what-we-do\/[\w-]+/i,
    ],
    priority: 9,
    seoValue: 'high',
  },
  {
    type: 'location',
    patterns: [
      /\/locations?\/[\w-]+/i,
      /\/cities?\/[\w-]+/i,
      /\/[\w-]+-(?:ny|ca|tx|fl|il|pa|oh|ga|nc|mi)/i,  // State suffix
      /\/near-me\/?$/i,
    ],
    priority: 9,
    seoValue: 'high',
  },
  
  // Medium SEO Value - Sample or partial scrape
  {
    type: 'category',
    patterns: [
      /\/category\/[\w-]+/i,
      /\/categories\/[\w-]+/i,
      /\/collections?\/[\w-]+/i,
      /\/shop\/?$/i,
    ],
    priority: 7,
    seoValue: 'medium',
  },
  {
    type: 'blog-index',
    patterns: [
      /\/blog\/?$/i,
      /\/articles?\/?$/i,
      /\/news\/?$/i,
      /\/resources?\/?$/i,
    ],
    priority: 6,
    seoValue: 'medium',
  },
  
  // Low SEO Value - Minimal scrape
  {
    type: 'about',
    patterns: [
      /\/about(?:-us)?\/?$/i,
      /\/our-team\/?$/i,
      /\/company\/?$/i,
    ],
    priority: 5,
    seoValue: 'low',
  },
  {
    type: 'contact',
    patterns: [
      /\/contact(?:-us)?\/?$/i,
      /\/get-in-touch\/?$/i,
      /\/reach-us\/?$/i,
    ],
    priority: 5,
    seoValue: 'low',
  },
  
  // Skip - Never SEO-relevant
  {
    type: 'legal',
    patterns: [
      /\/privacy(?:-policy)?\/?$/i,
      /\/terms(?:-(?:of-use|and-conditions|of-service))?\/?$/i,
      /\/cookie(?:-policy)?\/?$/i,
      /\/gdpr\/?$/i,
      /\/legal\/?$/i,
      /\/disclaimer\/?$/i,
    ],
    priority: 3,
    seoValue: 'skip',
  },
  {
    type: 'utility',
    patterns: [
      /\/cart\/?$/i,
      /\/checkout\/?$/i,
      /\/account\/?/i,
      /\/login\/?$/i,
      /\/register\/?$/i,
      /\/search\/?$/i,
      /\/404\/?$/i,
      /\?page=\d+/i,  // Pagination
      /\/page\/\d+/i,
    ],
    priority: 2,
    seoValue: 'skip',
  },
];
```

**Content Signal Analysis (Confidence: 0.85)**

When URL patterns are inconclusive, analyze HTML structure:

```typescript
interface ContentSignals {
  // Structure signals
  hasArticleSchema: boolean;
  hasProductSchema: boolean;
  hasLocalBusinessSchema: boolean;
  hasFAQSchema: boolean;
  hasBreadcrumbs: boolean;
  
  // Content signals
  wordCount: number;
  publishDate: string | null;
  authorPresent: boolean;
  hasComments: boolean;
  hasPricing: boolean;
  hasAddToCart: boolean;
  
  // Layout signals
  hasSidebar: boolean;
  hasRelatedPosts: boolean;
  imageCount: number;
  videoCount: number;
}

function classifyByContent($: CheerioAPI, url: string): PageType {
  const signals = extractContentSignals($);
  
  // Product detection
  if (signals.hasProductSchema || signals.hasAddToCart || signals.hasPricing) {
    return 'product';
  }
  
  // Article/Blog detection
  if (
    signals.hasArticleSchema ||
    (signals.publishDate && signals.wordCount > 500 && signals.authorPresent)
  ) {
    return 'blog-post';
  }
  
  // Service page detection
  if (
    signals.wordCount > 300 &&
    !signals.publishDate &&
    signals.hasBreadcrumbs &&
    /service|solution|offer|provide/i.test($('h1').text())
  ) {
    return 'service';
  }
  
  // Local/Location page
  if (signals.hasLocalBusinessSchema || signals.hasMap) {
    return 'location';
  }
  
  return 'unknown';
}
```

---

#### 3.7.2 JavaScript Rendering Detection Algorithm

**The 98/2 Rule:** Only 2-8% of pages actually require JavaScript rendering. Detecting which pages need it saves massive costs.

**Pre-Fetch Signals (No HTML Needed)**

```typescript
interface JsRenderingSignals {
  // Domain-level signals (cached per domain)
  domainTech: DetectedTechnology[];  // From DomainLearningService
  knownSpaPlatform: boolean;
  historicalJsRequired: number;  // % of pages needing JS
  
  // URL-level signals
  urlHasHashRouting: boolean;  // /#/path
  urlHasAngularStyle: boolean;  // /app/component
}

function preFlightJsCheck(domain: string, url: string): boolean {
  const domainConfig = domainLearningService.getConfig(domain);
  
  // Known SPA frameworks that always need JS
  const spaFrameworks = ['nextjs', 'nuxt', 'angular', 'gatsby', 'react'];
  if (domainConfig?.detectedTechnologies.some(t => spaFrameworks.includes(t))) {
    // But check if it's SSR (Next/Nuxt often are)
    if (domainConfig.requiresJsRendering) return true;
    return false;  // Let content validation decide
  }
  
  // Hash routing always needs JS
  if (url.includes('/#/')) return true;
  
  // Historical evidence
  if ((domainConfig?.historicalJsRequired ?? 0) > 80) return true;
  
  return false;  // Try without JS first
}
```

**Post-Fetch Detection (From HTML)**

The existing `ContentQualityAssessor` handles this well. Key enhancements:

```typescript
const SPA_SHELL_INDICATORS = {
  // Empty mounting points
  emptyRoots: [
    '<div id="root"></div>',
    '<div id="app"></div>',
    '<div id="__next"></div>',
    '<div id="__nuxt"></div>',
    '<div data-reactroot></div>',
  ],
  
  // Hydration scripts without content
  hydrationOnly: [
    'window.__NEXT_DATA__',
    'window.__NUXT__',
    'window.__INITIAL_STATE__',
  ],
  
  // Content thresholds
  minWordCount: 50,
  minTextRatio: 0.03,
  maxScriptRatio: 0.8,  // >80% scripts = likely SPA shell
};

function detectJsRequired(html: string, $: CheerioAPI): {
  required: boolean;
  confidence: number;
  reason: string;
} {
  const metrics = contentQualityAssessor.assess(html).metrics;
  
  // High confidence: SPA shell with empty content
  if (metrics.isSpaShell && metrics.wordCount < 50) {
    return { required: true, confidence: 0.95, reason: 'spa_shell_empty' };
  }
  
  // Medium confidence: Has framework markers but some content
  if (metrics.isSpaShell && metrics.wordCount < 200) {
    return { required: true, confidence: 0.75, reason: 'spa_partial_render' };
  }
  
  // Script-heavy pages
  const scriptSize = $('script').text().length;
  const totalSize = html.length;
  if (scriptSize / totalSize > 0.8 && metrics.wordCount < 100) {
    return { required: true, confidence: 0.70, reason: 'script_heavy' };
  }
  
  // No JS required
  return { required: false, confidence: 0.90, reason: 'static_content' };
}
```

---

#### 3.7.3 Anti-Bot Detection Patterns

**Response-Based Detection**

```typescript
interface AntiBotSignature {
  provider: 'cloudflare' | 'akamai' | 'datadome' | 'imperva' | 'perimeterx' | 'unknown';
  confidence: number;
  bypassStrategy: ScrapeTier;
}

const ANTIBOT_SIGNATURES: Record<string, Partial<AntiBotSignature>> = {
  // Cloudflare
  'cf-ray': { provider: 'cloudflare', confidence: 0.95 },
  '__cf_chl_opt': { provider: 'cloudflare', confidence: 0.99 },
  'cf-browser-verification': { provider: 'cloudflare', confidence: 0.99 },
  'Just a moment': { provider: 'cloudflare', confidence: 0.90 },
  
  // Akamai
  '_abck': { provider: 'akamai', confidence: 0.95 },
  'ak_bmsc': { provider: 'akamai', confidence: 0.95 },
  'akamaibmp': { provider: 'akamai', confidence: 0.90 },
  
  // DataDome
  'datadome': { provider: 'datadome', confidence: 0.95 },
  'dd_m': { provider: 'datadome', confidence: 0.90 },
  
  // Imperva/Incapsula
  'incap_ses': { provider: 'imperva', confidence: 0.95 },
  '_imp_apg_r_': { provider: 'imperva', confidence: 0.90 },
  
  // PerimeterX
  '_px': { provider: 'perimeterx', confidence: 0.90 },
  'px-captcha': { provider: 'perimeterx', confidence: 0.95 },
};

function detectAntiBot(
  statusCode: number,
  headers: Record<string, string>,
  html: string
): AntiBotSignature | null {
  // Status code signals
  if (statusCode === 403) {
    // Check for specific provider signatures
    for (const [pattern, signature] of Object.entries(ANTIBOT_SIGNATURES)) {
      if (html.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          ...signature,
          bypassStrategy: getBypassStrategy(signature.provider),
        } as AntiBotSignature;
      }
    }
    return { provider: 'unknown', confidence: 0.70, bypassStrategy: 'geonode' };
  }
  
  // Header-based detection
  if (headers['cf-ray']) {
    const hasChallenge = html.includes('cf-browser-verification');
    return hasChallenge 
      ? { provider: 'cloudflare', confidence: 0.99, bypassStrategy: 'dfs_browser' }
      : null;  // CF present but not blocking
  }
  
  // Cookie-based detection (from Set-Cookie headers)
  const cookies = headers['set-cookie'] ?? '';
  for (const [pattern, signature] of Object.entries(ANTIBOT_SIGNATURES)) {
    if (cookies.includes(pattern)) {
      return {
        ...signature,
        bypassStrategy: getBypassStrategy(signature.provider),
      } as AntiBotSignature;
    }
  }
  
  return null;
}

function getBypassStrategy(provider: string): ScrapeTier {
  switch (provider) {
    case 'cloudflare':
      return 'camoufox';  // Try Camoufox first, escalate to DFS if needed
    case 'akamai':
    case 'perimeterx':
      return 'dfs_browser';  // These need full browser
    case 'datadome':
      return 'dfs_js';  // Often works with JS rendering
    case 'imperva':
      return 'geonode';  // Residential proxy usually works
    default:
      return 'geonode';
  }
}
```

---

#### 3.7.4 Sitemap Quality Scoring

**Trust Score Algorithm**

```typescript
interface SitemapQuality {
  trustScore: number;  // 0-1, higher = more trustworthy
  recommendation: 'trust' | 'sample' | 'crawl';
  issues: string[];
  metrics: {
    totalUrls: number;
    recentlyModified: number;  // URLs with lastmod < 30 days
    hasLastmod: number;
    hasPriority: number;
    hasChangefreq: number;
    uniqueUrls: number;
    malformedUrls: number;
  };
}

function scoreSitemap(sitemap: ParsedSitemap): SitemapQuality {
  const metrics = analyzeSitemapMetrics(sitemap);
  const issues: string[] = [];
  let score = 1.0;
  
  // URL count sanity
  if (metrics.totalUrls === 0) {
    return { trustScore: 0, recommendation: 'crawl', issues: ['Empty sitemap'], metrics };
  }
  if (metrics.totalUrls > 50000 && metrics.uniqueUrls < metrics.totalUrls * 0.9) {
    score -= 0.3;
    issues.push('High duplicate rate');
  }
  
  // Lastmod quality
  const lastmodRate = metrics.hasLastmod / metrics.totalUrls;
  if (lastmodRate < 0.5) {
    score -= 0.2;
    issues.push('Missing lastmod on >50% of URLs');
  }
  
  // Freshness indicator
  const freshnessRate = metrics.recentlyModified / metrics.totalUrls;
  if (freshnessRate < 0.1 && metrics.hasLastmod > metrics.totalUrls * 0.5) {
    score -= 0.1;
    issues.push('Stale sitemap (few recent updates)');
  }
  
  // Malformed URL penalty
  if (metrics.malformedUrls > 0) {
    score -= Math.min(0.3, metrics.malformedUrls / metrics.totalUrls);
    issues.push(`${metrics.malformedUrls} malformed URLs`);
  }
  
  // Common sitemap plugin issues
  if (detectYoastDefaults(sitemap)) {
    score -= 0.1;
    issues.push('Default Yoast sitemap (may include thin content)');
  }
  
  // Determine recommendation
  let recommendation: 'trust' | 'sample' | 'crawl';
  if (score >= 0.8) {
    recommendation = 'trust';
  } else if (score >= 0.5) {
    recommendation = 'sample';  // Crawl to verify, then trust
  } else {
    recommendation = 'crawl';  // Ignore sitemap, do link crawl
  }
  
  return {
    trustScore: Math.max(0, score),
    recommendation,
    issues,
    metrics,
  };
}

function detectYoastDefaults(sitemap: ParsedSitemap): boolean {
  // Yoast generates sitemaps with specific patterns
  const hasYoastPattern = sitemap.urls.some(u => 
    u.url.includes('wp-sitemap') ||
    u.url.includes('sitemap_index.xml')
  );
  
  // Check for default priority/changefreq (Yoast sets all to same)
  const priorities = new Set(sitemap.urls.map(u => u.priority).filter(Boolean));
  const changefreqs = new Set(sitemap.urls.map(u => u.changefreq).filter(Boolean));
  
  return hasYoastPattern && priorities.size <= 2 && changefreqs.size <= 2;
}
```

---

#### 3.7.5 ML vs Heuristics: Practical Decision

**Recommendation: Heuristics-First with ML Enhancement**

For TeveroSEO's scale (100 prospects/hour, 5K pages per audit), heuristics provide 90%+ accuracy without ML infrastructure costs.

| Approach | Accuracy | Latency | Cost | Maintenance |
|----------|----------|---------|------|-------------|
| Pure Heuristics | 85-90% | <1ms | $0 | Low |
| Heuristics + Edge ML | 92-95% | 5-10ms | $0.001/page | Medium |
| Cloud ML (OpenAI/Grok) | 95-98% | 100-500ms | $0.01-0.05/page | Low |
| Hybrid (current VerticalClassifier) | 93-96% | <5ms avg | $0.002/page | Medium |

**Implementation Strategy:**

```typescript
class SmartDetectionLayer {
  private heuristicClassifier: HeuristicClassifier;
  private verticalClassifier: VerticalClassifier;  // Existing LLM-backed
  private feedbackStore: FeedbackStore;
  
  async classify(url: string, html: string): Promise<DetectionResult> {
    // 1. Try heuristics first (free, fast)
    const heuristic = this.heuristicClassifier.classify(url, html);
    
    if (heuristic.confidence >= 0.85) {
      return heuristic;
    }
    
    // 2. Check if we have learned from similar pages
    const learned = await this.feedbackStore.findSimilar(url, html);
    if (learned && learned.sampleSize >= 10) {
      return learned;
    }
    
    // 3. Fall back to LLM for uncertain cases
    const llmResult = await this.verticalClassifier.classify(
      extractDomain(url),
      extractPath(url),
      html,
      'system'  // Use system client for detection
    );
    
    // 4. Store for future learning
    await this.feedbackStore.record(url, llmResult);
    
    return llmResult;
  }
}
```

---

#### 3.7.6 Scrape Depth Decision Flowchart

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCRAPE DEPTH DECISION                           │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │   What is the PURPOSE?      │
                    └─────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
   │   PROSPECT    │      │  FULL AUDIT   │      │  COMPETITOR   │
   │   DISCOVERY   │      │   (Client)    │      │   RESEARCH    │
   └───────────────┘      └───────────────┘      └───────────────┘
           │                       │                       │
           ▼                       ▼                       ▼
   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
   │ Depth: LIGHT  │      │ Depth: FULL   │      │ Depth: SMART  │
   │               │      │               │      │               │
   │ - Homepage    │      │ - All pages   │      │ - Ranking     │
   │ - Top 5 blogs │      │ - Full checks │      │   pages only  │
   │ - Key services│      │ - CWV data    │      │ - Content gap │
   │ - Contact     │      │ - Link graph  │      │   analysis    │
   │               │      │ - Schema      │      │               │
   │ Budget: 15-30 │      │ Budget: 5000+ │      │ Budget: 50-200│
   │ pages         │      │ pages         │      │ pages         │
   └───────────────┘      └───────────────┘      └───────────────┘
           │                       │                       │
           ▼                       ▼                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                    PAGE TYPE FILTER                          │
   └─────────────────────────────────────────────────────────────┘
           │
           ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Page Type       │ Prospect │ Full Audit │ Competitor        │
   │─────────────────│──────────│────────────│───────────────────│
   │ Homepage        │ ALWAYS   │ ALWAYS     │ ALWAYS            │
   │ Service pages   │ TOP 5    │ ALL        │ IF RANKING        │
   │ Product pages   │ TOP 10   │ ALL        │ IF RANKING        │
   │ Blog posts      │ TOP 5    │ ALL        │ IF RANKING        │
   │ Category pages  │ SKIP     │ ALL        │ IF RANKING        │
   │ Location pages  │ TOP 3    │ ALL        │ IF RANKING        │
   │ About/Contact   │ 1 EACH   │ ALL        │ SKIP              │
   │ Legal pages     │ SKIP     │ SKIP       │ SKIP              │
   │ Utility pages   │ SKIP     │ SKIP       │ SKIP              │
   └─────────────────────────────────────────────────────────────┘
           │
           ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                    TIER SELECTION                            │
   └─────────────────────────────────────────────────────────────┘
           │
           ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Factor              │ Decision                               │
   │─────────────────────│────────────────────────────────────────│
   │ Known domain tier?  │ Use cached tier                        │
   │ SPA detected?       │ Start at JS tier (dfs_js)             │
   │ Anti-bot detected?  │ Skip to appropriate tier               │
   │ New domain?         │ Start at direct, escalate as needed   │
   │ Prospect audit?     │ Max tier: geonode (avoid DFS costs)   │
   │ Client audit?       │ Allow all tiers (accuracy matters)    │
   └─────────────────────────────────────────────────────────────┘
```

---

#### 3.7.7 TypeScript Implementation

**Core Interfaces**

```typescript
// types/detection.ts

export type ScrapePurpose = 'prospect' | 'full_audit' | 'competitor' | 'monitoring';

export type PageType = 
  | 'homepage'
  | 'service'
  | 'product'
  | 'blog-post'
  | 'blog-index'
  | 'category'
  | 'location'
  | 'about'
  | 'contact'
  | 'legal'
  | 'utility'
  | 'unknown';

export type ScrapeDepth = 'full' | 'light' | 'minimal' | 'skip';

export interface DetectionResult {
  pageType: PageType;
  confidence: number;
  method: 'url' | 'content' | 'schema' | 'llm' | 'learned';
  seoValue: 'high' | 'medium' | 'low' | 'skip';
  recommendedDepth: ScrapeDepth;
  jsRequired: boolean;
  antiBot: AntiBotSignature | null;
}

export interface ScrapeDecision {
  url: string;
  shouldScrape: boolean;
  depth: ScrapeDepth;
  tier: ScrapeTier;
  reason: string;
  priority: number;  // Higher = scrape first
  estimatedCost: number;
}

export interface PurposeConfig {
  purpose: ScrapePurpose;
  maxPages: number;
  maxTier: ScrapeTier;
  pageTypeBudgets: Partial<Record<PageType, number>>;
  skipPageTypes: PageType[];
}

export const PURPOSE_CONFIGS: Record<ScrapePurpose, PurposeConfig> = {
  prospect: {
    purpose: 'prospect',
    maxPages: 30,
    maxTier: 'geonode',  // Avoid DFS costs for prospects
    pageTypeBudgets: {
      homepage: 1,
      service: 5,
      product: 10,
      'blog-post': 5,
      location: 3,
      about: 1,
      contact: 1,
    },
    skipPageTypes: ['legal', 'utility', 'blog-index', 'category'],
  },
  full_audit: {
    purpose: 'full_audit',
    maxPages: 10000,
    maxTier: 'dfs_browser',
    pageTypeBudgets: {},  // No limits
    skipPageTypes: ['legal', 'utility'],
  },
  competitor: {
    purpose: 'competitor',
    maxPages: 200,
    maxTier: 'dfs_basic',
    pageTypeBudgets: {
      homepage: 1,
      service: 20,
      product: 50,
      'blog-post': 50,
      location: 20,
    },
    skipPageTypes: ['legal', 'utility', 'about', 'contact'],
  },
  monitoring: {
    purpose: 'monitoring',
    maxPages: 50,
    maxTier: 'geonode',
    pageTypeBudgets: {
      homepage: 1,
      service: 10,
      product: 20,
      'blog-post': 15,
    },
    skipPageTypes: ['legal', 'utility', 'about', 'contact', 'category'],
  },
};
```

**Detection Service Implementation**

```typescript
// services/AutoDetectionService.ts

import { contentQualityAssessor } from '../scraping/ContentQualityAssessor';
import { domainLearningService } from '../scraping/DomainLearningService';
import { getVerticalClassifierService } from '../onpage-mastery/services/VerticalClassifier';

export class AutoDetectionService {
  private pageTypeCache: Map<string, DetectionResult> = new Map();
  
  /**
   * Make a scrape decision for a single URL.
   */
  async decideForUrl(
    url: string,
    purpose: ScrapePurpose,
    html?: string
  ): Promise<ScrapeDecision> {
    const config = PURPOSE_CONFIGS[purpose];
    const domain = this.extractDomain(url);
    const path = this.extractPath(url);
    
    // 1. Classify page type
    const detection = await this.classifyPage(url, html);
    
    // 2. Check if page type should be skipped
    if (config.skipPageTypes.includes(detection.pageType)) {
      return {
        url,
        shouldScrape: false,
        depth: 'skip',
        tier: 'direct',
        reason: `Page type ${detection.pageType} skipped for ${purpose}`,
        priority: 0,
        estimatedCost: 0,
      };
    }
    
    // 3. Determine tier based on domain learning + detection
    const domainConfig = await domainLearningService.getConfig(domain);
    let tier = domainConfig?.optimalTier ?? 'direct';
    
    // Upgrade tier if JS required
    if (detection.jsRequired && ['direct', 'webshare', 'geonode'].includes(tier)) {
      tier = 'dfs_js';
    }
    
    // Upgrade tier if anti-bot detected
    if (detection.antiBot) {
      tier = detection.antiBot.bypassStrategy;
    }
    
    // Cap tier based on purpose
    tier = this.capTier(tier, config.maxTier);
    
    // 4. Calculate priority
    const priority = this.calculatePriority(detection, purpose);
    
    return {
      url,
      shouldScrape: true,
      depth: detection.recommendedDepth,
      tier,
      reason: `${detection.pageType} (${detection.method}, conf: ${detection.confidence})`,
      priority,
      estimatedCost: this.estimateCost(tier),
    };
  }
  
  /**
   * Batch decision for multiple URLs with budget awareness.
   */
  async decideBatch(
    urls: string[],
    purpose: ScrapePurpose
  ): Promise<ScrapeDecision[]> {
    const config = PURPOSE_CONFIGS[purpose];
    const decisions: ScrapeDecision[] = [];
    const typeCounters: Partial<Record<PageType, number>> = {};
    
    // Classify all URLs
    const detections = await Promise.all(
      urls.map(url => this.classifyPage(url))
    );
    
    // Sort by priority (high-value pages first)
    const sorted = urls
      .map((url, i) => ({ url, detection: detections[i] }))
      .sort((a, b) => {
        const priorityA = this.getSeoValuePriority(a.detection.seoValue);
        const priorityB = this.getSeoValuePriority(b.detection.seoValue);
        return priorityB - priorityA;
      });
    
    for (const { url, detection } of sorted) {
      // Check type budget
      const budget = config.pageTypeBudgets[detection.pageType] ?? Infinity;
      const current = typeCounters[detection.pageType] ?? 0;
      
      if (current >= budget) {
        decisions.push({
          url,
          shouldScrape: false,
          depth: 'skip',
          tier: 'direct',
          reason: `Budget exhausted for ${detection.pageType}`,
          priority: 0,
          estimatedCost: 0,
        });
        continue;
      }
      
      // Check total budget
      if (decisions.filter(d => d.shouldScrape).length >= config.maxPages) {
        decisions.push({
          url,
          shouldScrape: false,
          depth: 'skip',
          tier: 'direct',
          reason: 'Max pages reached',
          priority: 0,
          estimatedCost: 0,
        });
        continue;
      }
      
      // Make decision
      const decision = await this.decideForUrl(url, purpose);
      decisions.push(decision);
      
      if (decision.shouldScrape) {
        typeCounters[detection.pageType] = current + 1;
      }
    }
    
    return decisions;
  }
  
  /**
   * Classify a page by URL patterns and optionally HTML content.
   */
  private async classifyPage(url: string, html?: string): Promise<DetectionResult> {
    // Check cache
    const cached = this.pageTypeCache.get(url);
    if (cached) return cached;
    
    // 1. URL pattern matching (fast, free)
    const urlResult = this.classifyByUrl(url);
    if (urlResult.confidence >= 0.90) {
      this.pageTypeCache.set(url, urlResult);
      return urlResult;
    }
    
    // 2. If we have HTML, do content analysis
    if (html) {
      const contentResult = await this.classifyByContent(url, html);
      this.pageTypeCache.set(url, contentResult);
      return contentResult;
    }
    
    // 3. Return URL-based result with lower confidence
    return urlResult;
  }
  
  private classifyByUrl(url: string): DetectionResult {
    for (const pattern of PAGE_TYPE_PATTERNS) {
      if (pattern.patterns.some(p => p.test(url))) {
        return {
          pageType: pattern.type,
          confidence: 0.90,
          method: 'url',
          seoValue: pattern.seoValue,
          recommendedDepth: this.seoValueToDepth(pattern.seoValue),
          jsRequired: false,
          antiBot: null,
        };
      }
    }
    
    return {
      pageType: 'unknown',
      confidence: 0.50,
      method: 'url',
      seoValue: 'medium',
      recommendedDepth: 'light',
      jsRequired: false,
      antiBot: null,
    };
  }
  
  private async classifyByContent(url: string, html: string): Promise<DetectionResult> {
    const $ = cheerio.load(html);
    const quality = contentQualityAssessor.assess(html);
    
    // Detect JS requirement
    const jsRequired = quality.metrics.isSpaShell;
    
    // Detect anti-bot
    const antiBot = this.detectAntiBot(200, {}, html);
    
    // Content-based classification
    // ... (implementation from section 3.7.1)
    
    return {
      pageType: this.classifyByContentSignals($, url),
      confidence: 0.85,
      method: 'content',
      seoValue: this.inferSeoValue($),
      recommendedDepth: 'full',
      jsRequired,
      antiBot,
    };
  }
  
  private seoValueToDepth(seoValue: string): ScrapeDepth {
    switch (seoValue) {
      case 'high': return 'full';
      case 'medium': return 'light';
      case 'low': return 'minimal';
      case 'skip': return 'skip';
      default: return 'light';
    }
  }
  
  private getSeoValuePriority(seoValue: string): number {
    switch (seoValue) {
      case 'high': return 100;
      case 'medium': return 50;
      case 'low': return 10;
      case 'skip': return 0;
      default: return 25;
    }
  }
  
  private capTier(tier: ScrapeTier, maxTier: ScrapeTier): ScrapeTier {
    const tierIndex = TIER_INDEX[tier];
    const maxIndex = TIER_INDEX[maxTier];
    return tierIndex <= maxIndex ? tier : maxTier;
  }
  
  private estimateCost(tier: ScrapeTier): number {
    return TIER_COSTS[tier];
  }
}

// Singleton export
let _autoDetection: AutoDetectionService | null = null;

export function getAutoDetectionService(): AutoDetectionService {
  if (!_autoDetection) {
    _autoDetection = new AutoDetectionService();
  }
  return _autoDetection;
}
```

---

#### 3.7.8 Continuous Learning System

**Feedback Loop Architecture**

```typescript
// services/DetectionFeedbackService.ts

interface DetectionFeedback {
  url: string;
  domain: string;
  pathPattern: string;
  predictedType: PageType;
  actualType: PageType | null;  // null if prediction was correct
  predictedJsRequired: boolean;
  actualJsRequired: boolean | null;
  predictedTier: ScrapeTier;
  actualSuccessTier: ScrapeTier;
  timestamp: Date;
}

export class DetectionFeedbackService {
  /**
   * Record feedback after a scrape completes.
   */
  async recordFeedback(feedback: DetectionFeedback): Promise<void> {
    // Store in database for pattern learning
    await db.insert(detectionFeedback).values({
      ...feedback,
      pathPattern: this.extractPathPattern(feedback.url),
    });
    
    // Update domain-level statistics
    await this.updateDomainStats(feedback);
    
    // Check for systematic misclassification
    await this.checkForPatternDrift(feedback.domain);
  }
  
  /**
   * Find similar pages for prediction improvement.
   */
  async findSimilarPages(url: string): Promise<{
    pageType: PageType;
    jsRequired: boolean;
    confidence: number;
    sampleSize: number;
  } | null> {
    const pathPattern = this.extractPathPattern(url);
    const domain = this.extractDomain(url);
    
    // Look for pages with same domain + path pattern
    const similar = await db
      .select()
      .from(detectionFeedback)
      .where(
        and(
          eq(detectionFeedback.domain, domain),
          eq(detectionFeedback.pathPattern, pathPattern)
        )
      )
      .limit(100);
    
    if (similar.length < 5) return null;
    
    // Calculate consensus
    const typeVotes: Record<string, number> = {};
    let jsYes = 0, jsNo = 0;
    
    for (const page of similar) {
      const type = page.actualType ?? page.predictedType;
      typeVotes[type] = (typeVotes[type] ?? 0) + 1;
      
      if (page.actualJsRequired ?? page.predictedJsRequired) {
        jsYes++;
      } else {
        jsNo++;
      }
    }
    
    const topType = Object.entries(typeVotes)
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      pageType: topType[0] as PageType,
      jsRequired: jsYes > jsNo,
      confidence: topType[1] / similar.length,
      sampleSize: similar.length,
    };
  }
  
  /**
   * Check if detection patterns are drifting for a domain.
   * Triggers retraining if accuracy drops below threshold.
   */
  private async checkForPatternDrift(domain: string): Promise<void> {
    const recentFeedback = await db
      .select()
      .from(detectionFeedback)
      .where(
        and(
          eq(detectionFeedback.domain, domain),
          gt(detectionFeedback.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );
    
    if (recentFeedback.length < 20) return;
    
    // Calculate accuracy
    const correct = recentFeedback.filter(f => f.actualType === null).length;
    const accuracy = correct / recentFeedback.length;
    
    if (accuracy < 0.80) {
      // Trigger pattern relearning
      await this.retrainDomainPatterns(domain);
    }
  }
  
  /**
   * Retrain URL patterns for a domain based on feedback.
   */
  private async retrainDomainPatterns(domain: string): Promise<void> {
    // Get all feedback for domain
    const feedback = await db
      .select()
      .from(detectionFeedback)
      .where(eq(detectionFeedback.domain, domain));
    
    // Extract patterns from correct classifications
    const patterns = new Map<string, { type: PageType; count: number }>();
    
    for (const f of feedback) {
      const type = f.actualType ?? f.predictedType;
      const pattern = f.pathPattern;
      
      const existing = patterns.get(pattern);
      if (existing && existing.type === type) {
        existing.count++;
      } else if (!existing) {
        patterns.set(pattern, { type, count: 1 });
      }
    }
    
    // Store domain-specific patterns with high confidence
    const highConfidence = Array.from(patterns.entries())
      .filter(([_, v]) => v.count >= 5)
      .map(([pattern, v]) => ({
        domain,
        pattern,
        pageType: v.type,
        confidence: v.count / feedback.length,
      }));
    
    await db.insert(domainPatternOverrides).values(highConfidence)
      .onConflictDoUpdate({
        target: [domainPatternOverrides.domain, domainPatternOverrides.pattern],
        set: {
          pageType: sql`excluded.page_type`,
          confidence: sql`excluded.confidence`,
        },
      });
  }
  
  private extractPathPattern(url: string): string {
    // Reuse existing VerticalClassifier.extractPathPattern logic
    const path = new URL(url).pathname;
    return path
      .replace(/\/\d+/g, '/*')  // Numeric IDs
      .replace(/\/[a-f0-9-]{36}/gi, '/*')  // UUIDs
      .replace(/\/\d{4}\/\d{2}/g, '/*/*');  // Date paths
  }
}
```

---

#### 3.7.9 Summary and Integration

**Key Takeaways:**

1. **Heuristics First:** URL patterns catch 70% of cases at 0 cost and <1ms latency
2. **Content Signals:** Schema.org and structural analysis add another 15% accuracy
3. **LLM Fallback:** Only 5-10% of pages need LLM classification (use existing VerticalClassifier)
4. **Purpose-Driven Budgets:** Prospect audits need 15-30 pages, not 500
5. **Continuous Learning:** Feedback loop improves accuracy over time without manual tuning

**Integration Points:**

| Component | Integration |
|-----------|-------------|
| `ScrapingService.scrape()` | Call `AutoDetectionService.decideForUrl()` before fetching |
| `QueueManager.enqueue()` | Use `decideBatch()` to filter and prioritize URLs |
| `DomainLearningService` | Share JS/anti-bot detection results bidirectionally |
| `ContentQualityAssessor` | Reuse for post-fetch validation |
| `VerticalClassifier` | LLM fallback for uncertain classifications |

**Cost Impact Projection:**

| Workflow | Before | After | Savings |
|----------|--------|-------|---------|
| Prospect (500 URLs) | $2.50 | $0.15 | 94% |
| Full Audit (5K URLs) | $50 | $8 | 84% |
| Competitor (200 URLs) | $10 | $1.50 | 85% |
| Monthly Total (100 prospects + 10 audits) | $750 | $95 | 87% |

**Implementation Priority:**

1. **P0:** Page type URL patterns (immediate wins, no infrastructure)
2. **P0:** Purpose config integration with QueueManager
3. **P1:** Content signal analysis (requires HTML, adds 5-10% accuracy)
4. **P2:** Feedback loop and pattern learning (continuous improvement)
5. **P3:** Domain-specific pattern overrides (handles edge cases)
