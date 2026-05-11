# Agent 8: Prospect SEO Analysis Requirements

> **Date:** 2026-05-11
> **Agent:** Prospect Analysis Specialist
> **Purpose:** Define minimum viable scrape for prospect qualification and proposal generation

---

## Executive Summary: The Prospect Analysis MVP

**The core insight:** A prospect scrape is NOT an audit. It's a sales tool. Every byte scraped, every check run, every API call must answer one of two questions:

1. **Is this prospect worth pursuing?** (Qualification)
2. **What will make them sign?** (Proposal ammunition)

**Current state:** Running 138 SEO checks and a full-site crawl for prospects is overkill. Most prospects never convert. We're spending $0.07-$0.50 per prospect when $0.02 would suffice.

**Recommendation:** A purpose-built "Prospect Scrape Profile" that delivers qualification signals in 30 seconds and proposal-grade data in under 2 minutes, costing $0.015-0.025 per prospect.

---

## 1. What Makes a Prospect Worth Pursuing?

Not all prospects deserve attention. Before generating any proposal, we need binary qualification:

### 1.1 Budget Indicators (Can They Pay?)

| Signal | How to Detect | Weight |
|--------|---------------|--------|
| **Active paid ads** | Google Ads scripts, UTM parameters in internal links | High |
| **Premium CMS** | Shopify Plus, Magento, custom builds (not Wix/Squarespace) | High |
| **Custom development** | React/Vue/Next.js = engineering budget | Medium |
| **CDN usage** | Cloudflare Pro, Fastly, Akamai headers | Medium |
| **Multiple domains** | Links to sister sites, multi-brand signals | Medium |
| **E-commerce revenue indicators** | Product count, price ranges, shipping calculators | High |
| **Team size signals** | Multiple authors, about page team listings | Medium |

**Detection cost:** FREE (extracted from homepage HTML)

### 1.2 SEO Need Indicators (Do They Need Us?)

| Signal | How to Detect | Disqualify If |
|--------|---------------|---------------|
| **Existing SEO agency** | Footer credits, schema mentions of SEO providers | Yes |
| **SEO plugin active** | Yoast, RankMath, AIOSEO patterns in HTML | Reduces priority |
| **Catastrophic technical issues** | noindex, broken canonical, no HTTPS | High priority |
| **Traffic potential** | DataForSEO domain metrics (organic traffic) | <500 visits/mo = low priority |
| **Keyword opportunity** | Domain ranking for <50 keywords | High opportunity |
| **Competitor gap** | Top 3 competitors have 5x+ more keywords | High opportunity |

### 1.3 Qualification Score Formula

```typescript
interface ProspectQualification {
  budgetScore: number;      // 0-100 (can they pay?)
  needScore: number;        // 0-100 (do they need help?)
  opportunityScore: number; // 0-100 (can we deliver results?)
  urgencyScore: number;     // 0-100 (pain indicators)
  disqualifiers: string[];  // Reasons to skip
  
  // Composite
  priorityScore: number;    // 0-100 weighted average
  tier: 'hot' | 'warm' | 'cold' | 'disqualified';
}

const QUALIFICATION_WEIGHTS = {
  budget: 0.30,      // No budget = no deal
  need: 0.25,        // Must have gaps we can fill
  opportunity: 0.30, // Must be winnable keywords
  urgency: 0.15,     // Nice to have
};

// Tier thresholds
const TIER_THRESHOLDS = {
  hot: 75,        // Pursue immediately
  warm: 50,       // Worth a proposal
  cold: 25,       // Nurture sequence
  disqualified: 0 // Do not pursue
};
```

---

## 2. What Data Points Close Deals?

Proposals that close deals do four things:
1. **Demonstrate understanding** of the prospect's specific situation
2. **Quantify the problem** with concrete numbers
3. **Show achievable wins** that are believable
4. **Project ROI** in their language (traffic, leads, revenue)

### 2.1 Problem Quantification Data

| Data Point | Why It Closes | Source | Cost |
|------------|---------------|--------|------|
| **Current organic traffic** | "You get X visits; competitors get 10X" | DataForSEO Domain Metrics | $0.002 |
| **Ranking keyword count** | "You rank for 47 keywords; industry average is 300" | DataForSEO Labs | $0.003 |
| **Top 3 competitor traffic** | Creates envy, shows potential | DataForSEO Competitors | $0.004 |
| **Specific broken pages** | "Your /products page has no meta description" | Homepage scrape | FREE |
| **CWV scores** | Red/yellow/green = instant understanding | CrUX API | FREE |
| **Mobile usability** | Everyone searches on mobile | PageSpeed API | FREE |

### 2.2 Opportunity Showcase Data

| Data Point | Why It Closes | Source | Cost |
|------------|---------------|--------|------|
| **3-5 low-hanging keywords** | "These are within reach in 60 days" | DataForSEO Keyword Gap | $0.006 |
| **Striking distance keywords** | Position 11-30, easy wins | DataForSEO Labs | included |
| **Content gaps** | "Competitor has X, you don't" | Scrape comparison | $0.002 |
| **Quick technical wins** | "Fix these 5 things this week" | Tier 1 checks | FREE |

### 2.3 ROI Projection Data

| Data Point | Why It Closes | Source | Cost |
|------------|---------------|--------|------|
| **Traffic potential** | "Moving from position 15->5 = +X visits/mo" | CTR benchmarks + volume | Calculated |
| **Lead/revenue estimate** | "At 2% conversion = Y leads/mo" | Industry benchmarks | Calculated |
| **Competitor benchmark** | "Competitor generates $Z from organic" | Traffic x industry RPV | Estimated |

---

## 3. Minimum Page Set to Scrape

**The insight:** You don't need to scrape the whole site. Strategic pages tell the full story.

### 3.1 Required Pages (5 pages max)

| Page | Why | What to Extract |
|------|-----|-----------------|
| **Homepage** | First impression, tech stack, navigation | Title, meta, H1, links, scripts, Schema |
| **Top service/product page** | Best content indicator | Word count, heading structure, images, internal links |
| **Category/collection page** | E-commerce depth | Product count, facets, Schema |
| **About page** | E-E-A-T signals | Team info, credentials, history |
| **Blog/resource page** | Content investment | Post count, freshness, author info |

### 3.2 Page Selection Algorithm

```typescript
async function selectProspectPages(domain: string): Promise<string[]> {
  const homepage = `https://${domain}/`;
  const pages = [homepage];
  
  // Scrape homepage for navigation
  const { html, $ } = await lightFetch(homepage);
  
  // Find top service/product (biggest nav item or first featured)
  const serviceLink = findNavLink($, ['services', 'products', 'solutions']);
  if (serviceLink) pages.push(serviceLink);
  
  // Find category (for e-commerce)
  const categoryLink = findNavLink($, ['shop', 'collections', 'categories']);
  if (categoryLink) pages.push(categoryLink);
  
  // Find about page (E-E-A-T)
  const aboutLink = findNavLink($, ['about', 'about-us', 'company']);
  if (aboutLink) pages.push(aboutLink);
  
  // Find blog (content investment)
  const blogLink = findNavLink($, ['blog', 'news', 'resources', 'articles']);
  if (blogLink) pages.push(blogLink);
  
  return pages.slice(0, 5); // Max 5 pages
}
```

### 3.3 What NOT to Scrape for Prospects

| Skip | Why |
|------|-----|
| All product pages | One category sample is enough |
| Legal pages | Privacy policy tells us nothing |
| Contact page | Just need to know it exists |
| Full blog archive | One post sample is enough |
| XML sitemap | Trust nav structure for prospects |

---

## 4. Essential Checks (Subset of 138)

From 138 total checks, only 23 matter for prospect proposals:

### 4.1 Tier 1 Proposal Checks (15 checks, ~50ms total)

| Check ID | Name | Proposal Value |
|----------|------|----------------|
| T1-14 | Title present | "No title = invisible to Google" |
| T1-15 | Title length | "Title truncated in search results" |
| T1-16 | Meta description | "No description = Google writes it for you" |
| T1-17 | Meta description length | Show truncation |
| T1-42 | Mobile viewport | "Not mobile-friendly" |
| T1-50 | H1 presence | "No main heading" |
| T1-51 | Single H1 | "Multiple H1s confuse Google" |
| T1-55 | Internal links | "Orphan pages can't rank" |
| T1-60 | Canonical URL | "Duplicate content risk" |
| T1-67 | noindex check | **CRITICAL** - instant disqualifier |
| T1-23 | Schema.org presence | "No rich snippets" |
| T1-28 | Image alt text | "Images invisible to Google" |
| T1-45 | HTTPS | Security baseline |
| T1-63 | Language declaration | Internationalization signal |
| T1-81 | Author byline | E-E-A-T for YMYL |

### 4.2 Tier 2 Aggregates (5 checks, ~100ms total)

| Check ID | Name | Proposal Value |
|----------|------|----------------|
| T2-01 | Word count | "Thin content can't compete" |
| T2-03 | Heading hierarchy | "Poor structure hurts UX and SEO" |
| T2-09 | Internal link ratio | "Not enough internal linking" |
| T2-15 | External link ratio | "Citing sources = authority" |
| T2-17 | Page load estimate | "Slow pages lose visitors" |

### 4.3 Tier 3 External (3 checks, API-based)

| Check ID | Name | Proposal Value | Cost |
|----------|------|----------------|------|
| T3-01 | Core Web Vitals (LCP) | "Google's page experience signal" | FREE (CrUX) |
| T3-02 | Core Web Vitals (CLS) | Visual stability | FREE (CrUX) |
| T3-03 | Core Web Vitals (INP) | Interactivity | FREE (CrUX) |

### 4.4 Excluded from Prospect Profile

| Tier | Checks | Why Skip |
|------|--------|----------|
| T1 remaining | 69 checks | Diminishing returns for proposals |
| T2 remaining | 16 checks | Site-wide aggregation needs full crawl |
| T3 GSC-based | 4 checks | No GSC access for prospects |
| T4 all | 7 checks | Requires full site crawl |
| T5 all | 13 checks | LLM cost unjustified for prospects |

**Check execution cost:** FREE (local parsing) + $0 API (CrUX is free)

---

## 5. Keyword Data Requirements

### 5.1 Essential Keyword Metrics for Proposals

| Metric | Why Needed | Source |
|--------|------------|--------|
| **Total ranking keywords** | Baseline for "where you are" | DataForSEO Labs |
| **Top 10 ranking count** | "Only X keywords in top 10" | DataForSEO Labs |
| **Striking distance count** | Position 11-30, quick wins | DataForSEO Labs |
| **Search volume (top 20)** | Traffic potential | DataForSEO Labs |
| **Top 3 competitor keyword counts** | "They have more; you can too" | DataForSEO Labs |
| **Keyword gap (top 10)** | "These keywords are available" | DataForSEO Intersection |

### 5.2 DataForSEO API Strategy for Prospects

```typescript
interface ProspectKeywordFetch {
  // STEP 1: Domain overview ($0.002)
  domainMetrics: {
    organicTraffic: number;
    organicKeywords: number;
    domainRank: number;
  };
  
  // STEP 2: Top organic keywords ($0.003 for 100 keywords)
  topKeywords: Array<{
    keyword: string;
    position: number;
    searchVolume: number;
    url: string;
  }>;
  
  // STEP 3: Competitors discovery ($0.002)
  topCompetitors: Array<{
    domain: string;
    commonKeywords: number;
    organicTraffic: number;
  }>;
  
  // STEP 4: Keyword gap with #1 competitor ($0.004 for top 50)
  keywordGap: Array<{
    keyword: string;
    competitorPosition: number;
    prospectPosition: number | null;
    searchVolume: number;
    difficulty: number;
  }>;
}

// Total cost: $0.011 per prospect
```

### 5.3 Keyword Classification for Proposals

```typescript
interface ProposalKeywordTier {
  // Quick wins (highlight in proposal)
  quickWins: Array<{
    keyword: string;
    currentPosition: number; // 11-30
    volume: number;
    estimatedTimeToTop10: string; // "30-60 days"
  }>;
  
  // Strategic targets (medium-term)
  strategic: Array<{
    keyword: string;
    currentPosition: number | null; // 30+ or not ranking
    volume: number;
    estimatedTimeToTop10: string; // "90-180 days"
  }>;
  
  // Aspirational (long-term, builds credibility)
  aspirational: Array<{
    keyword: string;
    competitorPosition: number;
    volume: number;
    difficulty: number;
  }>;
}
```

---

## 6. Low-Hanging Fruit Identification Algorithm

The proposal's secret weapon: **specific, achievable wins** the prospect can visualize.

### 6.1 Quick Win Detection

```typescript
interface QuickWin {
  type: 'striking_distance' | 'easy_gap' | 'technical_fix' | 'content_gap';
  description: string;
  effort: 'low' | 'medium';
  timeframe: string;
  expectedImpact: string;
}

function identifyQuickWins(data: ProspectAnalysis): QuickWin[] {
  const wins: QuickWin[] = [];
  
  // 1. Striking distance keywords (position 11-30, volume 100+)
  for (const kw of data.keywords) {
    if (kw.position >= 11 && kw.position <= 30 && kw.volume >= 100) {
      wins.push({
        type: 'striking_distance',
        description: `"${kw.keyword}" is position ${kw.position} - small optimizations can push to page 1`,
        effort: 'low',
        timeframe: '30-60 days',
        expectedImpact: `+${estimateTrafficGain(kw.volume, kw.position, 8)} visits/month`
      });
    }
  }
  
  // 2. Easy keyword gaps (competitor ranks, we don't, difficulty <40)
  for (const gap of data.keywordGaps) {
    if (!gap.prospectPosition && gap.difficulty < 40 && gap.volume >= 200) {
      wins.push({
        type: 'easy_gap',
        description: `"${gap.keyword}" - competitor ranks #${gap.competitorPosition}, you're not visible`,
        effort: 'medium',
        timeframe: '60-90 days',
        expectedImpact: `${gap.volume} monthly searches available`
      });
    }
  }
  
  // 3. Technical fixes (from check failures)
  for (const failure of data.checkFailures) {
    if (isQuickFixable(failure)) {
      wins.push({
        type: 'technical_fix',
        description: failure.message,
        effort: 'low',
        timeframe: 'This week',
        expectedImpact: 'Improves crawlability and indexing'
      });
    }
  }
  
  // 4. Content gaps (competitor has page type we don't)
  for (const contentGap of data.contentGaps) {
    if (contentGap.searchVolume >= 500) {
      wins.push({
        type: 'content_gap',
        description: `Missing "${contentGap.pageType}" content that competitors leverage`,
        effort: 'medium',
        timeframe: '60-90 days',
        expectedImpact: `Capture share of ${contentGap.searchVolume} monthly searches`
      });
    }
  }
  
  // Return top 5 sorted by impact
  return wins
    .sort((a, b) => parseImpact(b.expectedImpact) - parseImpact(a.expectedImpact))
    .slice(0, 5);
}

function isQuickFixable(failure: CheckResult): boolean {
  const quickFixChecks = [
    'T1-14', 'T1-15', 'T1-16', 'T1-17', // Title/meta
    'T1-28', // Alt text
    'T1-50', 'T1-51', // Headings
    'T1-60', // Canonical
  ];
  return quickFixChecks.includes(failure.checkId) && failure.autoEditable;
}
```

### 6.2 Traffic Gain Estimation

```typescript
const CTR_BY_POSITION: Record<number, number> = {
  1: 0.319, 2: 0.246, 3: 0.185, 4: 0.133, 5: 0.095,
  6: 0.065, 7: 0.047, 8: 0.035, 9: 0.029, 10: 0.024,
  // Page 2
  11: 0.015, 12: 0.013, 13: 0.011, 14: 0.010, 15: 0.009,
  16: 0.008, 17: 0.007, 18: 0.006, 19: 0.006, 20: 0.005,
};

function estimateTrafficGain(
  volume: number,
  currentPosition: number,
  targetPosition: number
): number {
  const currentCTR = CTR_BY_POSITION[currentPosition] ?? 0.005;
  const targetCTR = CTR_BY_POSITION[targetPosition] ?? 0.03;
  const currentTraffic = volume * currentCTR;
  const targetTraffic = volume * targetCTR;
  return Math.round(targetTraffic - currentTraffic);
}
```

---

## 7. Competitor Comparison Data

Proposals are more compelling with competitor context. "You're behind, but here's how to catch up."

### 7.1 Essential Competitor Data

| Data Point | Why | Source | Cost |
|------------|-----|--------|------|
| **Top 3 competitor domains** | "These are your real competitors" | DataForSEO Competitors | $0.002 |
| **Competitor keyword counts** | "They rank for X, you rank for Y" | DataForSEO Labs | $0.003 |
| **Competitor traffic estimates** | "They get X visits; you get Y" | DataForSEO Metrics | included |
| **Common keywords** | "Battleground keywords" | DataForSEO Intersection | included |
| **Their unique keywords** | "Opportunities they have that you don't" | DataForSEO Gap | $0.004 |

### 7.2 Competitor Comparison Table (for Proposal)

```typescript
interface CompetitorComparison {
  prospect: DomainSummary;
  competitors: DomainSummary[];
  
  // Visual comparison data
  comparison: {
    metric: string;
    prospectValue: number;
    avgCompetitorValue: number;
    bestCompetitorValue: number;
    gap: number;
    gapPercent: number;
  }[];
}

// Example output:
{
  comparison: [
    { metric: 'Organic Keywords', prospectValue: 47, avgCompetitorValue: 320, gap: 273, gapPercent: -85 },
    { metric: 'Est. Traffic', prospectValue: 1200, avgCompetitorValue: 8500, gap: 7300, gapPercent: -86 },
    { metric: 'Backlinks', prospectValue: 89, avgCompetitorValue: 450, gap: 361, gapPercent: -80 },
  ]
}
```

### 7.3 "Can We Win" Analysis

```typescript
interface CompetitiveWinnability {
  overall: 'high' | 'medium' | 'low';
  factors: {
    // Positive signals
    keywordOpportunity: number;    // 0-100
    technicalGap: number;          // We can fix what they have
    contentGap: number;            // Catchable content depth
    
    // Negative signals
    domainAuthorityGap: number;    // Hard to overcome
    backlinksGap: number;          // Requires link building
    brandSearchDominance: number;  // Established brand
  };
  
  recommendation: string;
}

function assessWinnability(prospect: ProspectAnalysis): CompetitiveWinnability {
  const topCompetitor = prospect.competitors[0];
  
  const daGap = topCompetitor.domainRank - prospect.domainRank;
  const keywordGapRatio = prospect.organicKeywords / topCompetitor.organicKeywords;
  
  // High winnability: Gap is small, or competitor has technical weaknesses
  if (keywordGapRatio > 0.3 || daGap < 15) {
    return {
      overall: 'high',
      factors: { /* ... */ },
      recommendation: 'Strong potential to reach parity within 6-12 months with focused effort'
    };
  }
  
  // Medium: Achievable with sustained investment
  if (keywordGapRatio > 0.1 || daGap < 30) {
    return {
      overall: 'medium',
      factors: { /* ... */ },
      recommendation: 'Can close significant gap in 12-18 months; focus on low-competition niches first'
    };
  }
  
  // Low: Long road, need to set expectations
  return {
    overall: 'low',
    factors: { /* ... */ },
    recommendation: 'Significant investment required; recommend starting with long-tail and building authority'
  };
}
```

---

## 8. Time and Cost Targets

### 8.1 Prospect Scrape SLA

| Operation | Target Time | Current | Improvement |
|-----------|-------------|---------|-------------|
| **Qualification check** | <5 seconds | N/A | New |
| **Homepage analysis** | <3 seconds | ~5s | 40% |
| **5-page scrape** | <15 seconds | ~30s | 50% |
| **DataForSEO calls** | <10 seconds | ~8s | On target |
| **Check execution** | <2 seconds | ~5s | 60% |
| **Report generation** | <3 seconds | N/A | New |
| **TOTAL** | **<30 seconds** | ~60s | **50%** |

### 8.2 Cost Model Per Prospect

| Component | Cost | Notes |
|-----------|------|-------|
| Scraping (5 pages via proxy) | $0.0001 | ~20KB x 5 x $0.77/GB |
| DataForSEO Domain Metrics | $0.002 | Overview endpoint |
| DataForSEO Keywords (100) | $0.003 | Labs organic |
| DataForSEO Competitors | $0.002 | Discovery |
| DataForSEO Keyword Gap | $0.004 | Intersection |
| CrUX API (CWV) | $0.000 | FREE |
| Local check execution | $0.000 | CPU only |
| **TOTAL (cache miss)** | **$0.011** | |
| **TOTAL (cache hit)** | **$0.001** | 90%+ for repeat domains |

**vs current state:** $0.07 per prospect (6x savings)

### 8.3 Volume Economics

| Monthly Volume | Current Cost | Optimized Cost | Savings |
|----------------|--------------|----------------|---------|
| 100 prospects | $7.00 | $1.10 | $5.90 |
| 500 prospects | $35.00 | $5.50 | $29.50 |
| 2,000 prospects | $140.00 | $22.00 | $118.00 |
| 10,000 prospects | $700.00 | $110.00 | $590.00 |

---

## 9. Implementation: Prospect Scrape Profile Configuration

### 9.1 Profile Definition

```typescript
// /src/server/features/scraping/profiles/prospect-profile.ts

import type { ScrapeProfile } from '../types';

export const PROSPECT_PROFILE: ScrapeProfile = {
  name: 'prospect',
  description: 'Lightweight scrape for prospect qualification and proposals',
  
  // Page selection
  pages: {
    maxPages: 5,
    required: ['homepage'],
    optional: ['service', 'category', 'about', 'blog'],
    selectionStrategy: 'navigation_first',
  },
  
  // Scraping tier
  scraping: {
    defaultTier: 'T0', // Try direct first
    maxTier: 'T2',     // Don't escalate beyond Geonode
    timeout: 5000,     // Fast fail
    retries: 1,
  },
  
  // Content extraction
  extraction: {
    fullHtml: false,         // Only structured data
    selectors: PROSPECT_SELECTORS,
    maxContentSize: 100_000, // 100KB per page
  },
  
  // SEO checks
  checks: {
    tiers: [1, 2, 3],
    specific: PROSPECT_CHECK_IDS,
    skipOnFailure: true,     // Don't block on individual check failures
  },
  
  // DataForSEO
  dataForSeo: {
    endpoints: [
      'domain_metrics',
      'organic_keywords',
      'competitors_domain',
      'domain_intersection',
    ],
    keywordLimit: 100,
    competitorLimit: 3,
    gapLimit: 50,
    cacheHours: 168, // 7 days
  },
  
  // CrUX (free)
  crux: {
    enabled: true,
    formFactor: 'PHONE',
  },
  
  // Output
  output: {
    format: 'prospect_analysis',
    includeRawHtml: false,
    includeScreenshot: false,
  },
  
  // SLA
  sla: {
    maxDuration: 30_000, // 30 seconds
    warningThreshold: 20_000,
  },
  
  // Cost controls
  costs: {
    maxPerProspect: 0.03, // Circuit breaker
    billableEntity: 'prospect',
  },
};

const PROSPECT_CHECK_IDS = [
  // Tier 1 essentials (15)
  'T1-14', 'T1-15', 'T1-16', 'T1-17', // Title/meta
  'T1-42', // Mobile viewport
  'T1-50', 'T1-51', // Headings
  'T1-55', // Internal links
  'T1-60', // Canonical
  'T1-67', // noindex
  'T1-23', // Schema
  'T1-28', // Image alt
  'T1-45', // HTTPS
  'T1-63', // Language
  'T1-81', // Author
  
  // Tier 2 aggregates (5)
  'T2-01', 'T2-03', 'T2-09', 'T2-15', 'T2-17',
  
  // Tier 3 CWV (3)
  'T3-01', 'T3-02', 'T3-03',
];

const PROSPECT_SELECTORS = {
  // Business signals
  team: '[class*="team"], [id*="team"], [class*="about"] img[alt]',
  pricing: '[class*="pricing"], [class*="plans"], [id*="pricing"]',
  testimonials: '[class*="testimonial"], [class*="review"], [class*="quote"]',
  
  // Tech signals
  ecommerce: '[class*="cart"], [class*="product"], [data-product]',
  cms: 'meta[name="generator"], meta[content*="WordPress"]',
  
  // Content signals
  blogPosts: 'article, [class*="post"], [class*="blog-item"]',
  categories: 'nav a, [class*="category"], [class*="collection"]',
};
```

### 9.2 Prospect Analysis Service

```typescript
// /src/server/features/prospects/services/ProspectAnalyzer.ts

export class ProspectAnalyzer {
  constructor(
    private scraper: ScrapingService,
    private dataForSeo: DataForSeoClient,
    private checkRunner: CheckRunner,
  ) {}
  
  async analyzeProspect(domain: string): Promise<ProspectAnalysis> {
    const startTime = Date.now();
    
    // 1. Quick qualification (parallel)
    const [homepageData, domainMetrics] = await Promise.all([
      this.scraper.fetch(domain, { profile: 'prospect' }),
      this.dataForSeo.getDomainMetrics(domain),
    ]);
    
    // 2. Qualification check
    const qualification = this.qualify(homepageData, domainMetrics);
    if (qualification.tier === 'disqualified') {
      return { qualification, quickAnalysis: true };
    }
    
    // 3. Full prospect analysis (parallel where possible)
    const [
      strategicPages,
      keywords,
      competitors,
      cruxData,
    ] = await Promise.all([
      this.scrapeStrategicPages(domain, homepageData),
      this.dataForSeo.getOrganicKeywords(domain, { limit: 100 }),
      this.dataForSeo.getCompetitors(domain, { limit: 3 }),
      this.getCruxData(domain),
    ]);
    
    // 4. Keyword gap with top competitor
    const keywordGap = competitors.length > 0
      ? await this.dataForSeo.getKeywordGap(domain, competitors[0].domain, { limit: 50 })
      : [];
    
    // 5. Run SEO checks
    const checkResults = await this.runProspectChecks(strategicPages);
    
    // 6. Identify quick wins
    const quickWins = this.identifyQuickWins({ keywords, keywordGap, checkResults });
    
    // 7. Competitor comparison
    const competitorComparison = this.buildComparison(domainMetrics, competitors);
    
    // 8. Calculate costs
    const costs = this.calculateCosts(startTime);
    
    return {
      qualification,
      domainMetrics,
      keywords,
      competitors,
      keywordGap,
      cruxData,
      checkResults,
      quickWins,
      competitorComparison,
      analysisTime: Date.now() - startTime,
      costs,
    };
  }
  
  private qualify(homepage: PageData, metrics: DomainMetrics): ProspectQualification {
    const budgetScore = this.assessBudget(homepage);
    const needScore = this.assessNeed(homepage, metrics);
    const opportunityScore = this.assessOpportunity(metrics);
    
    const disqualifiers: string[] = [];
    
    // Check for existing SEO agency
    if (this.detectExistingSeoProvider(homepage)) {
      disqualifiers.push('Appears to have existing SEO provider');
    }
    
    // Check for noindex
    if (homepage.checkResults?.find(r => r.checkId === 'T1-67' && !r.passed)) {
      disqualifiers.push('Site has noindex directive');
    }
    
    const priorityScore = 
      budgetScore * 0.30 +
      needScore * 0.25 +
      opportunityScore * 0.30 +
      (disqualifiers.length === 0 ? 15 : 0); // Urgency bonus
    
    const tier = 
      disqualifiers.length > 0 ? 'disqualified' :
      priorityScore >= 75 ? 'hot' :
      priorityScore >= 50 ? 'warm' : 'cold';
    
    return { budgetScore, needScore, opportunityScore, priorityScore, tier, disqualifiers };
  }
  
  private assessBudget(homepage: PageData): number {
    let score = 50; // Base assumption
    
    // Paid ads indicator
    if (homepage.html.includes('googleads') || homepage.html.includes('gtag')) score += 15;
    
    // Premium CMS/framework
    if (homepage.html.includes('Shopify') && !homepage.html.includes('myshopify.com')) score += 10;
    if (homepage.html.includes('__NEXT_DATA__')) score += 10;
    
    // CDN usage
    const headers = homepage.headers;
    if (headers['cf-ray'] || headers['x-fastly-request-id']) score += 10;
    
    // E-commerce signals
    if (homepage.html.includes('add-to-cart') || homepage.html.includes('data-product')) score += 15;
    
    return Math.min(100, score);
  }
  
  private assessNeed(homepage: PageData, metrics: DomainMetrics): number {
    let score = 50;
    
    // Low traffic = high need
    if (metrics.organicTraffic < 1000) score += 20;
    else if (metrics.organicTraffic < 5000) score += 10;
    
    // Few keywords = high need
    if (metrics.organicKeywords < 50) score += 20;
    else if (metrics.organicKeywords < 200) score += 10;
    
    // Technical issues = high need
    const criticalFailures = homepage.checkResults?.filter(
      r => !r.passed && (r.severity === 'critical' || r.severity === 'high')
    ).length ?? 0;
    score += Math.min(30, criticalFailures * 10);
    
    return Math.min(100, score);
  }
}
```

### 9.3 Database Schema Extension

```typescript
// Extend prospect_analyses for optimized prospect data

export const prospectQuickAnalysis = pgTable('prospect_quick_analysis', {
  id: text('id').primaryKey(),
  prospectId: text('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  
  // Qualification
  qualificationTier: text('qualification_tier').notNull(), // hot/warm/cold/disqualified
  priorityScore: real('priority_score'),
  budgetScore: real('budget_score'),
  needScore: real('need_score'),
  opportunityScore: real('opportunity_score'),
  disqualifiers: jsonb('disqualifiers').$type<string[]>(),
  
  // Key metrics
  organicTraffic: integer('organic_traffic'),
  organicKeywords: integer('organic_keywords'),
  domainRank: real('domain_rank'),
  
  // Quick wins
  quickWins: jsonb('quick_wins').$type<QuickWin[]>(),
  strikingDistanceCount: integer('striking_distance_count'),
  keywordGapCount: integer('keyword_gap_count'),
  
  // Competitor summary
  topCompetitor: text('top_competitor'),
  competitorTrafficGap: integer('competitor_traffic_gap'),
  
  // Check summary
  criticalIssues: integer('critical_issues'),
  highIssues: integer('high_issues'),
  checksPassed: integer('checks_passed'),
  checksTotal: integer('checks_total'),
  
  // CWV
  lcpScore: text('lcp_score'), // good/needs-improvement/poor
  clsScore: text('cls_score'),
  inpScore: text('inp_score'),
  
  // Cost tracking
  analysisTimeMs: integer('analysis_time_ms'),
  costCents: integer('cost_cents'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // 7 days for cache
});
```

---

## 10. Summary: Prospect Analysis MVP

**What we're building:**
- A 30-second prospect qualification and analysis pipeline
- Costs $0.01-0.02 per prospect (vs $0.07 current)
- Delivers proposal-ready data without full site crawl
- Automatically identifies hot/warm/cold/disqualified tiers

**Key implementation decisions:**
1. **5 strategic pages max** - Homepage + nav-linked essentials
2. **23 targeted checks** - Only proposal-relevant SEO signals
3. **$0.011 DataForSEO budget** - Domain metrics + keywords + top competitor gap
4. **Free CrUX for CWV** - No need for Lighthouse
5. **7-day cache** - Prospects rarely need fresh data

**Success metrics:**
- Time to proposal data: <30 seconds
- Cost per prospect: <$0.025
- Qualification accuracy: >85% (vs human judgment)
- Proposal conversion lift: Track after implementation
