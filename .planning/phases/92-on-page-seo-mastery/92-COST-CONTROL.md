# Phase 92: Cost Control Architecture

**Status:** Research Complete
**Created:** 2026-05-06
**Goal:** Control LLM costs for on-page mastery at scale without sacrificing quality

---

## Executive Summary

At $0.011/page for full Tier 5 quality audits, large sites face significant costs. This document defines the cost control architecture that reduces effective costs to $0.003-0.005/page through smart sampling, aggressive caching, and plan-based limits.

**Key Savings:**
- 55-73% cost reduction through smart sampling
- 90%+ vertical classifications skip LLM via heuristics
- 30-90 day caching for stable content

---

## 1. Plan Tier Limits

### 1.1 Plan Structure

| Plan | Monthly Price | Page Limit | Tier 5 Audits | Quality Gates |
|------|--------------|------------|---------------|---------------|
| **Free** | $0 | 500 | Basic only (T5-06, T5-07) | No blocking |
| **Starter** | $49 | 2,000 | Full except T5-02 (SERP) | 50/month |
| **Pro** | $149 | 10,000 | Full suite | 500/month |
| **Agency** | $399 | 50,000 | Full + priority | 2,000/month |
| **Enterprise** | Custom | Custom | Full + custom rules | Unlimited |

### 1.2 Per-Plan Cost Exposure

| Plan | Max Pages | Full Audit Cost | With Sampling | Effective $/page |
|------|-----------|-----------------|---------------|------------------|
| Free | 500 | $5.50 | $2.50 | $0.005 |
| Starter | 2,000 | $22.00 | $8.00 | $0.004 |
| Pro | 10,000 | $110.00 | $35.00 | $0.0035 |
| Agency | 50,000 | $550.00 | $150.00 | $0.003 |

---

## 2. Smart Sampling Strategies

### 2.1 Template-Based Sampling

**Principle:** Audit 1 representative page per template type, apply findings to all.

```typescript
interface TemplateSampling {
  // Group pages by URL pattern/template
  templates: Map<string, {
    pattern: string;           // e.g., "/product/*", "/blog/*"
    sampleSize: number;        // Default: 1-3 per template
    representativePageId: string;
    pageCount: number;
  }>;
  
  // Sample selection criteria
  selectRepresentative(template: string): string {
    // Pick page with: highest traffic, most recent, or most content
  }
}
```

**Savings:** 70-90% for sites with consistent templates

### 2.2 Priority-Based Sampling

**Principle:** Only audit pages that matter for SEO.

```typescript
interface PrioritySampling {
  // Audit criteria
  minTrafficThreshold: number;     // Default: 100 sessions/month
  minImpressionsThreshold: number; // Default: 500 impressions/month
  includeNewPages: boolean;        // Last 30 days
  includeLandingPages: boolean;    // GSC landing pages
  
  // Priority scoring
  calculatePriority(page: Page): number {
    return (
      page.traffic * 0.3 +
      page.impressions * 0.3 +
      page.conversionValue * 0.2 +
      page.recency * 0.2
    );
  }
}
```

**Savings:** 60-80% for sites with long-tail content

### 2.3 Delta-Based Sampling

**Principle:** Only re-audit pages that changed.

```typescript
interface DeltaSampling {
  // Change detection
  changeDetectionMethod: 'content-hash' | 'last-modified' | 'sitemap-date';
  changeThreshold: number;         // Default: 5% content change
  
  // Skip if unchanged since last audit
  shouldReaudit(page: Page): boolean {
    const lastAudit = getLastAuditDate(page.id);
    const lastChange = getLastChangeDate(page.id);
    return lastChange > lastAudit;
  }
}
```

**Savings:** 50-70% for established sites with stable content

### 2.4 Random Statistical Sampling

**Principle:** For very large sites, use statistical sampling with confidence intervals.

```typescript
interface StatisticalSampling {
  totalPages: number;
  confidenceLevel: 0.95;           // 95% confidence
  marginOfError: 0.05;             // ±5%
  
  // Sample size calculation (Cochran's formula)
  calculateSampleSize(): number {
    const z = 1.96; // 95% confidence
    const p = 0.5;  // Assumed proportion
    const e = 0.05; // Margin of error
    
    const n0 = (z * z * p * (1 - p)) / (e * e);
    const n = n0 / (1 + ((n0 - 1) / this.totalPages));
    
    return Math.ceil(n);
  }
}

// Example: 50,000 pages → 381 sample size for 95% confidence, ±5%
```

**Savings:** 90%+ for sites with 10,000+ pages

### 2.5 Combined Sampling Strategy

```typescript
interface CombinedSamplingStrategy {
  // Apply in order of precedence
  strategies: [
    { type: 'priority', weight: 1.0 },     // Always audit high-priority
    { type: 'delta', weight: 0.8 },        // Changed pages
    { type: 'template', weight: 0.6 },     // Template representatives
    { type: 'statistical', weight: 0.4 },  // Random sample for coverage
  ];
  
  selectPagesToAudit(allPages: Page[]): Page[] {
    const selected = new Set<string>();
    
    // 1. All priority pages (traffic > threshold)
    const priorityPages = allPages.filter(p => p.priority > threshold);
    priorityPages.forEach(p => selected.add(p.id));
    
    // 2. Changed pages not in priority
    const changedPages = allPages.filter(p => 
      p.hasChanged && !selected.has(p.id)
    );
    changedPages.forEach(p => selected.add(p.id));
    
    // 3. Template representatives
    const templates = groupByTemplate(allPages);
    templates.forEach(t => {
      if (!selected.has(t.representative)) {
        selected.add(t.representative);
      }
    });
    
    // 4. Statistical sample for remaining coverage
    const remaining = allPages.filter(p => !selected.has(p.id));
    const sampleSize = calculateStatisticalSampleSize(remaining.length);
    const sample = randomSample(remaining, sampleSize);
    sample.forEach(p => selected.add(p.id));
    
    return allPages.filter(p => selected.has(p.id));
  }
}
```

---

## 3. Caching Strategy

### 3.1 Cache TTLs by Component

| Component | Cache Key | TTL | Invalidation Trigger |
|-----------|-----------|-----|---------------------|
| Vertical Classification | `domain + path-pattern` | 90 days | Manual override |
| Quality Gate Scores | `page-id + content-hash` | 30 days | Content change |
| Embeddings | `content-hash` | 30 days | Content change |
| SERP Data | `keyword + location` | 7 days | Time-based |
| Writing Rules Audit | `content-hash` | 30 days | Content change |

### 3.2 Cache Implementation

```typescript
interface CacheConfig {
  // Redis-based caching
  redisPrefix: 'tier5:';
  
  // Cache keys
  keys: {
    vertical: (domain: string, pathPattern: string) => 
      `tier5:vertical:${domain}:${pathPattern}`,
    qualityGate: (pageId: string, contentHash: string) => 
      `tier5:quality:${pageId}:${contentHash}`,
    embedding: (contentHash: string) => 
      `tier5:embedding:${contentHash}`,
    serpData: (keyword: string, location: string) => 
      `tier5:serp:${keyword}:${location}`,
    writingAudit: (contentHash: string) => 
      `tier5:writing:${contentHash}`,
  };
  
  // TTLs in seconds
  ttls: {
    vertical: 90 * 24 * 60 * 60,      // 90 days
    qualityGate: 30 * 24 * 60 * 60,   // 30 days
    embedding: 30 * 24 * 60 * 60,     // 30 days
    serpData: 7 * 24 * 60 * 60,       // 7 days
    writingAudit: 30 * 24 * 60 * 60,  // 30 days
  };
}
```

### 3.3 Content Hash Strategy

```typescript
function calculateContentHash(page: Page): string {
  // Include only content that affects quality scores
  const relevantContent = [
    page.title,
    page.h1,
    page.metaDescription,
    page.bodyText.substring(0, 5000), // First 5000 chars
    page.h2s.join('|'),
    page.wordCount.toString(),
  ].join('::');
  
  return crypto.createHash('sha256')
    .update(relevantContent)
    .digest('hex')
    .substring(0, 16); // Short hash is sufficient
}
```

---

## 4. Drip Scheduling

### 4.1 Spread Costs Across Billing Period

**Principle:** Don't audit all pages on day 1. Spread across the month.

```typescript
interface DripScheduler {
  billingCycleStart: Date;
  billingCycleEnd: Date;
  totalPagesToAudit: number;
  
  // Daily audit budget
  calculateDailyBudget(): number {
    const daysInCycle = differenceInDays(
      this.billingCycleEnd, 
      this.billingCycleStart
    );
    return Math.ceil(this.totalPagesToAudit / daysInCycle);
  }
  
  // Schedule audits across the month
  scheduleAudits(pages: Page[]): ScheduledAudit[] {
    const dailyBudget = this.calculateDailyBudget();
    const prioritized = sortByPriority(pages);
    
    return prioritized.map((page, idx) => ({
      pageId: page.id,
      scheduledDate: addDays(
        this.billingCycleStart, 
        Math.floor(idx / dailyBudget)
      ),
      priority: page.priority,
    }));
  }
}
```

### 4.2 BullMQ Job Configuration

```typescript
const tier5AuditQueue = new Queue('tier5-audit', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Rate limiting via BullMQ
const tier5Worker = new Worker('tier5-audit', processor, {
  limiter: {
    max: 100,           // Max 100 jobs
    duration: 60000,    // Per minute
  },
  concurrency: 5,       // 5 concurrent audits
});
```

---

## 5. Vertical Classification Cost Control

### 5.1 Heuristic-First Classification

**Principle:** 90%+ of pages can be classified without LLM.

```typescript
interface VerticalClassifier {
  // Fast path: Schema.org + URL patterns
  classifyHeuristic(page: Page): ClassificationResult | null {
    // 1. Check Schema.org types
    const schemaType = page.schemaTypes[0];
    if (schemaType) {
      const vertical = SCHEMA_TO_VERTICAL[schemaType];
      if (vertical) {
        return { vertical, confidence: 0.95, method: 'schema' };
      }
    }
    
    // 2. Check URL patterns
    for (const [pattern, vertical] of URL_PATTERNS) {
      if (pattern.test(page.url)) {
        return { vertical, confidence: 0.90, method: 'url-pattern' };
      }
    }
    
    // 3. Check domain industry (from client settings)
    if (page.clientVertical) {
      return { 
        vertical: page.clientVertical, 
        confidence: 0.85, 
        method: 'client-setting' 
      };
    }
    
    return null; // Fall back to LLM
  }
  
  // Slow path: LLM classification (~250 tokens, $0.00005)
  async classifyLLM(page: Page): Promise<ClassificationResult> {
    const prompt = `Classify this page into one of: ${VERTICALS.join(', ')}\n
      URL: ${page.url}\n
      Title: ${page.title}\n
      H1: ${page.h1}\n
      First 500 chars: ${page.bodyText.substring(0, 500)}`;
    
    const response = await grok.complete({
      model: 'grok-4.1-fast',
      prompt,
      maxTokens: 50,
    });
    
    return parseClassification(response);
  }
}

const SCHEMA_TO_VERTICAL: Record<string, string> = {
  'LocalBusiness': 'local',
  'MedicalBusiness': 'healthcare',
  'LegalService': 'legal',
  'FinancialService': 'financial',
  'Product': 'ecommerce',
  'SoftwareApplication': 'saas',
  'RealEstateAgent': 'real_estate',
  'Restaurant': 'hospitality',
  'EducationalOrganization': 'education',
};

const URL_PATTERNS: [RegExp, string][] = [
  [/\/products?\/|\/shop\/|\/cart/i, 'ecommerce'],
  [/\/pricing|\/plans|\/features/i, 'saas'],
  [/\/locations?\/|\/near-me/i, 'local'],
  [/\/doctors?\/|\/health\/|\/medical/i, 'healthcare'],
  [/\/attorneys?\/|\/lawyers?\/|\/legal/i, 'legal'],
  [/\/invest|\/finance|\/loans?/i, 'financial'],
];
```

### 5.2 Classification Cost Breakdown

| Method | Cost | Percentage of Classifications |
|--------|------|------------------------------|
| Schema.org detection | $0 | 40% |
| URL pattern matching | $0 | 35% |
| Client setting fallback | $0 | 15% |
| LLM classification | $0.00005 | 10% |
| **Weighted Average** | **$0.000005/page** | 100% |

---

## 6. Quality Gate Cost Control

### 6.1 Tiered Quality Gate Execution

**Principle:** Run cheap checks first, expensive checks only if needed.

```typescript
interface QualityGateTiers {
  // Tier A: Free (regex/rule-based)
  tierA: [
    'T5-04', // Not For You (pattern match)
    'T5-06', // Thin Content (word count)
    'T5-12', // Sentence Length (calculation)
    'T5-13', // Paragraph Length (calculation)
  ];
  
  // Tier B: Cheap ($0.0001-0.001)
  tierB: [
    'T5-07', // Fluff Detection (embeddings)
    'T5-09', // Voice Consistency (embeddings)
    'T5-10', // Tone Appropriateness (embeddings)
    'T5-11', // Audience Alignment (embeddings)
  ];
  
  // Tier C: Expensive ($0.002-0.003)
  tierC: [
    'T5-01', // Reddit Test (LLM)
    'T5-03', // Prove-It Details (LLM)
    'T5-08', // AI Slop Detection (LLM)
  ];
  
  // Tier D: Very Expensive ($0.005+)
  tierD: [
    'T5-02', // Information Gain (SERP fetch + LLM)
    'T5-05', // QDD Vulnerability (SERP analysis)
  ];
  
  async runGates(page: Page, plan: Plan): Promise<QualityResult> {
    // Always run Tier A (free)
    const tierAResults = await runTierA(page);
    
    // If Tier A fails critically, stop early
    if (tierAResults.hasCriticalFailure) {
      return { score: 0, blockers: tierAResults.blockers };
    }
    
    // Run Tier B if plan allows
    if (plan.tier >= 'starter') {
      const tierBResults = await runTierB(page);
    }
    
    // Run Tier C only for Pro+ plans
    if (plan.tier >= 'pro') {
      const tierCResults = await runTierC(page);
    }
    
    // Run Tier D only for Agency+ or explicit request
    if (plan.tier >= 'agency' || page.requestFullAudit) {
      const tierDResults = await runTierD(page);
    }
    
    return combineResults(tierAResults, tierBResults, tierCResults, tierDResults);
  }
}
```

### 6.2 Per-Check Cost Table

| Check ID | Name | Cost | Method |
|----------|------|------|--------|
| T5-01 | Reddit Test | $0.002 | LLM (Grok 4.1 Fast) |
| T5-02 | Information Gain | $0.005 | SERP + LLM |
| T5-03 | Prove-It Details | $0.003 | LLM |
| T5-04 | Not For You | $0 | Regex |
| T5-05 | QDD Vulnerability | $0.002 | SERP analysis |
| T5-06 | Thin Content | $0 | Word count |
| T5-07 | Fluff Detection | $0.001 | Embeddings |
| T5-08 | AI Slop Detection | $0.002 | LLM |
| T5-09 | Voice Consistency | $0.001 | Embeddings |
| T5-10 | Tone Appropriateness | $0.001 | Embeddings |
| T5-11 | Audience Alignment | $0.001 | Embeddings |
| T5-12 | Sentence Length | $0 | Calculation |
| T5-13 | Paragraph Length | $0 | Calculation |
| **Full Suite** | All 13 checks | **$0.018** | |
| **Optimized** | With caching | **$0.005** | |

---

## 7. UI Cost Controls

### 7.1 Audit Configuration UI

```typescript
interface AuditConfigForm {
  // Sampling strategy selection
  samplingStrategy: 'full' | 'priority' | 'template' | 'statistical';
  
  // Priority thresholds (if priority sampling)
  priorityThresholds?: {
    minTraffic: number;        // Default: 100
    minImpressions: number;    // Default: 500
    includeNewPages: boolean;  // Default: true
  };
  
  // Template sampling config
  templateConfig?: {
    pagesPerTemplate: number;  // Default: 1
    includeAll: string[];      // Templates to always audit fully
  };
  
  // Statistical sampling config
  statisticalConfig?: {
    confidenceLevel: 0.90 | 0.95 | 0.99;
    marginOfError: 0.03 | 0.05 | 0.10;
  };
  
  // Cost estimate display
  estimatedCost: {
    fullAudit: number;
    withSampling: number;
    savings: number;
    savingsPercent: number;
  };
  
  // Quality gate selection
  qualityGates: {
    tier: 'basic' | 'standard' | 'full';
    excludeChecks?: string[];  // Opt out of specific checks
  };
}
```

### 7.2 Cost Estimate Calculator

```typescript
function calculateAuditCostEstimate(
  pageCount: number,
  config: AuditConfigForm
): CostEstimate {
  // Calculate pages to audit based on sampling
  let pagesToAudit: number;
  
  switch (config.samplingStrategy) {
    case 'full':
      pagesToAudit = pageCount;
      break;
    case 'priority':
      pagesToAudit = Math.min(pageCount * 0.3, 5000); // ~30% or max 5k
      break;
    case 'template':
      pagesToAudit = Math.min(pageCount * 0.1, 1000); // ~10% or max 1k
      break;
    case 'statistical':
      pagesToAudit = calculateStatisticalSampleSize(
        pageCount,
        config.statisticalConfig.confidenceLevel,
        config.statisticalConfig.marginOfError
      );
      break;
  }
  
  // Calculate cost per page based on quality gate tier
  const costPerPage = {
    basic: 0.002,     // Tier A + B only
    standard: 0.005,  // Tier A + B + C
    full: 0.011,      // All tiers
  }[config.qualityGates.tier];
  
  // Apply caching discount (assume 50% cache hit rate)
  const cacheDiscount = 0.5;
  const effectiveCostPerPage = costPerPage * (1 - cacheDiscount);
  
  return {
    fullAudit: pageCount * costPerPage,
    withSampling: pagesToAudit * effectiveCostPerPage,
    savings: (pageCount * costPerPage) - (pagesToAudit * effectiveCostPerPage),
    savingsPercent: Math.round(
      (1 - (pagesToAudit * effectiveCostPerPage) / (pageCount * costPerPage)) * 100
    ),
    pagesAudited: pagesToAudit,
    estimatedCacheHits: Math.round(pagesToAudit * cacheDiscount),
  };
}
```

---

## 8. Cost Monitoring & Alerts

### 8.1 Usage Tracking

```typescript
interface UsageTracking {
  // Track per client per day
  async trackUsage(
    clientId: string,
    checkId: string,
    cost: number
  ): Promise<void> {
    const key = `usage:${clientId}:${format(new Date(), 'yyyy-MM-dd')}`;
    await redis.hIncrByFloat(key, checkId, cost);
    await redis.hIncrByFloat(key, 'total', cost);
    await redis.expire(key, 90 * 24 * 60 * 60); // 90 day retention
  }
  
  // Get usage summary
  async getUsageSummary(
    clientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageSummary> {
    // Aggregate daily usage
  }
}
```

### 8.2 Alert Thresholds

| Alert | Trigger | Action |
|-------|---------|--------|
| 80% of monthly budget | `daily_total > plan_limit * 0.8 / 30` | Email warning |
| 100% of monthly budget | `daily_total > plan_limit / 30` | Throttle to priority-only |
| Unusual spike | `daily_total > 3x rolling_avg` | Email + investigate |
| Approaching plan limit | `monthly_total > plan_limit * 0.9` | Upsell prompt |

---

## 9. Summary: Cost Optimization Matrix

| Optimization | Savings | Implementation Effort |
|--------------|---------|----------------------|
| Heuristic vertical classification | 90% of LLM calls | Low |
| Content hash caching | 50% of repeat audits | Low |
| Template-based sampling | 70-90% of pages | Medium |
| Priority-based sampling | 60-80% of pages | Medium |
| Tiered quality gate execution | 40% of check costs | Medium |
| Drip scheduling | Spreads costs, no direct savings | Low |
| **Combined Effect** | **55-73% total cost reduction** | |

### Effective Cost Per Page

| Scenario | Cost/Page | Monthly @ 10k pages |
|----------|-----------|---------------------|
| Naive (all checks, no sampling) | $0.011 | $110 |
| With caching only | $0.007 | $70 |
| With sampling only | $0.004 | $40 |
| With caching + sampling | $0.003 | $30 |
| **Recommended default** | **$0.0035** | **$35** |

---

## 10. Implementation Priority

1. **Phase 92-01:** Vertical classification with heuristics-first
2. **Phase 92-02:** Caching layer for all Tier 5 checks
3. **Phase 92-03:** Template-based sampling implementation
4. **Phase 92-04:** Priority-based sampling with GSC integration
5. **Phase 92-05:** UI cost estimate calculator
6. **Phase 92-06:** Usage tracking and alerts
7. **Phase 92-07:** Tiered quality gate execution
8. **Phase 92-08:** Drip scheduling via BullMQ
