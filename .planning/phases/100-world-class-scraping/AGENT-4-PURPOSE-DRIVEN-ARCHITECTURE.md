### 3.4 Agent 4: Purpose-Driven Architecture

#### Executive Summary: Purpose-Driven Depth Matrix

The fundamental insight: **running a full 109-check audit for every use case is architectural waste.** An agency's scraping needs vary dramatically by purpose, and our architecture should reflect this reality. This analysis introduces six distinct scrape profiles mapped to actual agency workflows.

| Use Case | Scrape Depth | Checks | Est. Time | Est. Cost | Data Freshness |
|----------|--------------|--------|-----------|-----------|----------------|
| **Prospect Discovery** | Minimal | 8-12 | <30s | $0.001 | 7 days OK |
| **Proposal Generation** | Light | 25-35 | <2min | $0.005 | 24h OK |
| **Client Onboarding** | Full | 109+ | <15min | $0.05 | Real-time |
| **Client Monitoring** | Delta | 15-20 | <1min | $0.002 | 4-24h |
| **Competitor Analysis** | Focused | 30-45 | <5min | $0.02 | 7 days OK |
| **"Can We Win" SERP** | SERP-heavy | 20+SERP | <3min | $0.03 | Real-time |

**Bottom line:** Purpose-driven depth reduces average scrape cost by 75-85% while improving user experience through faster results.

---

#### 3.4.1 Prospect Discovery: Minimal Viable Scrape

**Goal:** Qualify a lead in under 30 seconds. Answer: "Is this worth pursuing?"

**Minimal Data Requirements:**

| Signal | Source | Why It Matters |
|--------|--------|----------------|
| Domain resolvability | DNS/HTTP | Site must exist |
| HTTPS status | T0 Direct | Basic competence signal |
| Title tag presence | T0/T1 HTML | Has basic SEO awareness |
| Homepage word count | T0/T1 HTML | Content investment level |
| CMS detection | T0/T1 patterns | WordPress = opportunity |
| Organic traffic estimate | DataForSEO domain overview | Business scale indicator |
| Domain authority | Open PageRank API | Competitive baseline |
| Core Web Vitals | CrUX API (FREE) | Technical opportunity |

**Recommended Check Subset (8-12 checks):**

```typescript
const PROSPECT_DISCOVERY_CHECKS = [
  // T1 - DOM (instant, local)
  'T1-01', // Title exists
  'T1-08', // H1 present
  'T1-13', // Meta description
  'T1-26', // HTTPS canonical
  'T1-67', // Not noindexed
  
  // T2 - Quick calculations
  'T2-01', // Word count (< 300 = thin)
  
  // T3 - FREE APIs only
  'T3-01', // CrUX LCP
  'T3-02', // CrUX INP
  'T3-03', // CrUX CLS
];
```

**Data to Extract (Beyond Checks):**

```typescript
interface ProspectSnapshot {
  domain: string;
  title: string;
  metaDescription: string | null;
  wordCount: number;
  cmsDetected: 'wordpress' | 'shopify' | 'wix' | 'squarespace' | 'custom' | 'unknown';
  httpsEnabled: boolean;
  cwvStatus: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  organicTrafficEstimate: number; // Monthly, from DFS domain overview
  domainAuthority: number; // Open PageRank 0-10
  topKeywords: string[]; // Top 5 from cached SERP data
  qualificationScore: number; // 0-100
}
```

**Scrape Profile:**

```typescript
const PROFILE_PROSPECT_DISCOVERY: ScrapeProfile = {
  name: 'prospect_discovery',
  maxPages: 1, // Homepage only
  tiersAllowed: ['T0', 'T1'], // Direct and DC proxy only
  fallbackToDataForSEO: false, // No paid scraping for unqualified leads
  freeApisEnabled: ['crux', 'open_pagerank'],
  checksToRun: PROSPECT_DISCOVERY_CHECKS,
  cacheStrategy: {
    useSharedCache: true,
    ttl: '7d', // Stale data acceptable
    acceptStale: true,
  },
  timeout: 30000, // 30 second SLA
};
```

**Qualification Scoring Algorithm:**

```typescript
function calculateQualificationScore(data: ProspectSnapshot): number {
  let score = 50; // Base score
  
  // Traffic signals (0-25 points)
  if (data.organicTrafficEstimate > 10000) score += 25;
  else if (data.organicTrafficEstimate > 1000) score += 15;
  else if (data.organicTrafficEstimate > 100) score += 5;
  
  // Technical opportunity (0-20 points)
  if (data.cwvStatus === 'poor') score += 20; // Big opportunity
  else if (data.cwvStatus === 'needs-improvement') score += 10;
  
  // CMS opportunity (0-15 points)
  if (data.cmsDetected === 'wordpress') score += 10; // Easy to optimize
  if (data.cmsDetected === 'wix' || data.cmsDetected === 'squarespace') score += 15; // Migration opportunity
  
  // Content signals (-20 to +10 points)
  if (data.wordCount < 300) score += 10; // Content opportunity
  if (!data.metaDescription) score += 5;
  if (!data.title || data.title.length < 30) score -= 10; // Red flag
  
  return Math.max(0, Math.min(100, score));
}
```

---

#### 3.4.2 Proposal Generation: What Sells

**Goal:** Generate compelling proposal data in under 2 minutes. Answer: "Here's what's broken and what we can fix."

**Proposal-Critical Signals:**

| Signal Category | Specific Data | Why It Sells |
|-----------------|---------------|--------------|
| **Quick Wins** | Missing meta descriptions, duplicate titles | Easy wins to demonstrate |
| **Traffic Potential** | Keyword gaps vs competitors | "You're missing $X/mo" |
| **Technical Health** | CWV scores, mobile issues | Visual, easy to explain |
| **Competitive Gap** | Ranking positions vs top 3 | Creates urgency |
| **Authority Gap** | Backlink count vs competitors | Establishes credibility |

**Recommended Check Subset (25-35 checks):**

```typescript
const PROPOSAL_GENERATION_CHECKS = [
  // T1 - All title/meta checks (7)
  'T1-01', 'T1-02', 'T1-03', 'T1-04', 'T1-05', 'T1-06', 'T1-07',
  
  // T1 - All heading checks (8)
  'T1-08', 'T1-09', 'T1-10', 'T1-11', 'T1-12', 'T1-13', 'T1-14', 'T1-15',
  
  // T1 - Key technical checks (6)
  'T1-26', // Canonical
  'T1-27', // Robots
  'T1-31', // Image alt
  'T1-32', // Image size
  'T1-45', // Schema presence
  'T1-67', // Noindex check
  
  // T2 - Content quality (5)
  'T2-01', // Word count / reading level
  'T2-02', // Keyword density
  'T2-07', // Schema completeness
  'T2-11', // Mobile tap targets
  'T2-15', // Freshness (dateModified)
  
  // T3 - CWV (3) - FREE
  'T3-01', 'T3-02', 'T3-03',
  
  // T3 - Authority (2)
  'T3-07', // Backlink profile
  'T3-08', // Referring domains
];
```

**Proposal-Specific Data Extraction:**

```typescript
interface ProposalData {
  // Health Scores (for charts)
  overallScore: number;
  technicalHealthScore: number;
  contentQualityScore: number;
  authorityScore: number;
  
  // Quick Win Opportunities (for bullet points)
  quickWins: Array<{
    issue: string;
    impact: 'high' | 'medium' | 'low';
    fixDifficulty: 'easy' | 'medium' | 'hard';
    example: string; // Specific URL/page
  }>;
  
  // Traffic Opportunity (for ROI calculator)
  currentEstimatedTraffic: number;
  competitorAverageTraffic: number;
  keywordGaps: Array<{
    keyword: string;
    volume: number;
    currentPosition: number | null;
    topCompetitorPosition: number;
    difficultyScore: number;
  }>;
  
  // CWV Visualization (for before/after mockup)
  cwvMetrics: {
    lcp: { value: number; status: 'good' | 'needs-improvement' | 'poor' };
    inp: { value: number; status: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; status: 'good' | 'needs-improvement' | 'poor' };
  };
  
  // Competitive Context
  competitorBenchmarks: Array<{
    domain: string;
    traffic: number;
    keywords: number;
    backlinks: number;
  }>;
}
```

**Scrape Profile:**

```typescript
const PROFILE_PROPOSAL_GENERATION: ScrapeProfile = {
  name: 'proposal_generation',
  maxPages: 10, // Homepage + 9 key pages (auto-detected)
  pageSelection: 'strategic', // Homepage, top traffic, key services
  tiersAllowed: ['T0', 'T1', 'T2'], // Include residential for reliability
  fallbackToDataForSEO: true, // Pay for reliability on proposal data
  dfsMode: 'basic', // No JS/browser needed
  freeApisEnabled: ['crux', 'open_pagerank', 'gsc_if_connected'],
  checksToRun: PROPOSAL_GENERATION_CHECKS,
  additionalData: ['competitor_keywords', 'backlink_summary'],
  cacheStrategy: {
    useSharedCache: true,
    ttl: '24h',
    acceptStale: false, // Proposals need fresh data
  },
  timeout: 120000, // 2 minute SLA
};
```

---

#### 3.4.3 Client Onboarding: Full Baseline Audit

**Goal:** Establish comprehensive baseline within 15 minutes. Answer: "Here's everything about your site."

**Full Audit Requirements:**

- All 109 checks across Tiers 1-4
- 41-point On-Page Mastery scorecard (Tier 5, if enabled)
- YMYL detection and vertical classification
- Full site crawl (up to configured page limit)
- Backlink profile analysis
- Competitor keyword gap analysis
- Internal linking graph construction

**What Makes Onboarding Different:**

| Aspect | Proposal | Onboarding |
|--------|----------|------------|
| Pages crawled | 1-10 | 100-5000 |
| Check depth | 25-35 | 109-150 |
| Data retention | 30 days | Permanent baseline |
| Competitor depth | Summary | Full keyword gap |
| Link analysis | Count only | Full graph |
| Cost tolerance | $0.005 | $0.05-0.50 |

**Scrape Profile:**

```typescript
const PROFILE_CLIENT_ONBOARDING: ScrapeProfile = {
  name: 'client_onboarding',
  maxPages: 5000, // Configurable per plan
  pageSelection: 'sitemap_priority', // Respect sitemap priority
  tiersAllowed: ['T0', 'T1', 'T2', 'T2.5', 'T3', 'T4'], // All tiers
  fallbackToDataForSEO: true,
  dfsMode: 'adaptive', // Start basic, escalate as needed
  freeApisEnabled: ['crux', 'gsc', 'open_pagerank', 'common_crawl'],
  checksToRun: 'ALL_TIERS', // All 109 checks
  tier5Enabled: true, // Quality gates if client has feature
  additionalData: [
    'full_backlink_profile',
    'competitor_keyword_gap',
    'internal_link_graph',
    'vertical_classification',
    'ymyl_detection',
  ],
  cacheStrategy: {
    useSharedCache: true,
    ttl: '1h', // Fresh for onboarding
    acceptStale: false,
    storeAsBaseline: true, // Save for historical comparison
  },
  timeout: 900000, // 15 minute SLA
};
```

**Baseline Data Model:**

```typescript
interface ClientBaseline {
  capturedAt: Date;
  totalPagesAudited: number;
  
  // Aggregate Scores
  overallScore: number;
  tierBreakdown: {
    tier1: { passed: number; total: number; score: number };
    tier2: { passed: number; total: number; score: number };
    tier3: { passed: number; total: number; score: number };
    tier4: { passed: number; total: number; score: number };
    tier5?: { passed: number; total: number; score: number };
  };
  
  // Per-Page Details (stored in separate table)
  pageResults: PageAuditResult[];
  
  // Site-Wide Metrics
  siteMetrics: {
    totalPages: number;
    indexedPages: number;
    avgWordCount: number;
    avgLoadTime: number;
    mobileScore: number;
    desktopScore: number;
    cwvPassRate: number;
    schemaAdoptionRate: number;
    internalLinkDensity: number;
    orphanPageCount: number;
    duplicateContentCount: number;
  };
  
  // Authority Snapshot
  authoritySnapshot: {
    domainAuthority: number;
    backlinks: number;
    referringDomains: number;
    topAnchors: string[];
  };
  
  // Competitive Position
  competitivePosition: {
    avgPositionTop10Keywords: number;
    keywordsInTop3: number;
    keywordsInTop10: number;
    keywordsInTop100: number;
    estimatedTrafficValue: number;
  };
}
```

---

#### 3.4.4 Competitor Analysis: Focused Data Model

**Goal:** Understand what competitors are doing better. Answer: "Here's their playbook."

**Competitor Analysis Data Needs:**

| Data Point | Purpose | Source |
|------------|---------|--------|
| Ranking keywords | Know their traffic sources | DataForSEO SERP |
| Content structure | Understand winning patterns | T1/T2 scrape |
| Page count by type | Content strategy | Sitemap analysis |
| Backlink profile | Authority source | DFS Backlinks |
| CWV comparison | Technical advantage | CrUX API (FREE) |
| Schema adoption | Rich result eligibility | T1 scrape |
| Internal linking | Hub/authority structure | T4 crawl |

**Competitor Scrape Strategy:**

```typescript
const PROFILE_COMPETITOR_ANALYSIS: ScrapeProfile = {
  name: 'competitor_analysis',
  maxPages: 50, // Strategic sample
  pageSelection: 'top_performing', // Based on SERP positions
  tiersAllowed: ['T0', 'T1', 'T2'], // No need for expensive tiers
  fallbackToDataForSEO: true,
  dfsMode: 'basic',
  freeApisEnabled: ['crux', 'open_pagerank', 'common_crawl'],
  checksToRun: COMPETITOR_CHECKS, // Subset focused on comparison
  additionalData: [
    'ranking_keywords',
    'content_structure_patterns',
    'schema_types_used',
    'backlink_top_sources',
  ],
  cacheStrategy: {
    useSharedCache: true, // Competitors are shared across clients
    ttl: '7d', // Weekly refresh acceptable
    acceptStale: true,
  },
  timeout: 300000, // 5 minute SLA
};

const COMPETITOR_CHECKS = [
  // Content structure
  'T1-08', 'T1-09', 'T1-10', // Heading analysis
  'T1-25', // Content structure
  'T2-01', // Word count
  'T2-03', // Content depth
  
  // Schema
  'T1-45', 'T1-46', 'T1-47', // Schema detection
  'T2-07', 'T2-08', // Schema completeness
  
  // Technical
  'T3-01', 'T3-02', 'T3-03', // CWV
  'T1-26', 'T1-27', // Technical basics
  
  // Authority signals
  'T3-07', 'T3-08', // Backlinks
  'T1-35', 'T1-36', // External links (outbound)
];
```

**Competitor Comparison Model:**

```typescript
interface CompetitorComparison {
  clientDomain: string;
  competitors: Array<{
    domain: string;
    
    // Traffic comparison
    estimatedTraffic: number;
    trafficTrend: 'growing' | 'stable' | 'declining';
    topKeywords: KeywordPosition[];
    
    // Content comparison
    avgWordCount: number;
    contentTypes: Map<ContentType, number>; // e.g., { blog: 45, product: 120 }
    publishingFrequency: number; // Articles per month
    
    // Technical comparison
    cwvScore: number;
    mobileScore: number;
    schemaTypes: string[];
    
    // Authority comparison
    domainAuthority: number;
    backlinks: number;
    referringDomains: number;
    
    // Calculated gaps
    keywordGap: number; // Keywords they rank for, you don't
    contentGap: number; // Topics they cover, you don't
    authorityGap: number; // DA difference
  }>;
  
  // Aggregated insights
  insights: {
    biggestThreat: string; // Domain
    biggestOpportunity: string; // Keyword/topic
    quickestWin: string; // Specific action
    competitiveMoat: string[]; // What client does better
  };
}
```

---

#### 3.4.5 "Can We Win" SERP Displacement Analysis

**Goal:** Assess feasibility of outranking current top results. Answer: "Yes/No, and here's why."

**SERP Displacement Factors:**

| Factor | Weight | Data Source |
|--------|--------|-------------|
| Domain Authority gap | 25% | Open PageRank |
| Content depth gap | 20% | Word count comparison |
| Backlink gap | 20% | DFS Backlinks |
| Technical edge | 15% | CWV comparison |
| Content freshness | 10% | dateModified analysis |
| SERP feature opportunity | 10% | Featured snippet analysis |

**"Can We Win" Scoring Algorithm:**

```typescript
interface CanWeWinAnalysis {
  keyword: string;
  searchVolume: number;
  currentPosition: number | null;
  
  // SERP analysis
  serpFeatures: string[]; // ['featured_snippet', 'people_also_ask', etc.]
  topResults: Array<{
    position: number;
    domain: string;
    url: string;
    domainAuthority: number;
    pageWordCount: number;
    backlinksToPage: number;
    contentAge: number; // Days since last update
    cwvStatus: 'good' | 'needs-improvement' | 'poor';
  }>;
  
  // Client position
  clientMetrics: {
    domainAuthority: number;
    existingContent: string | null; // URL if exists
    relevantBacklinks: number;
  };
  
  // Displacement analysis
  displacementScore: number; // 0-100
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  estimatedTimeToRank: string; // "3-6 months"
  
  // Recommendations
  requirements: Array<{
    type: 'content' | 'backlinks' | 'technical' | 'time';
    description: string;
    effort: 'low' | 'medium' | 'high';
  }>;
  
  verdict: {
    canWin: boolean;
    confidence: number; // 0-1
    rationale: string;
  };
}

function calculateDisplacementScore(
  client: ClientMetrics,
  target: SerpPosition
): number {
  let score = 50; // Base assumption: 50/50
  
  // Domain Authority comparison (25% weight)
  const daGap = client.domainAuthority - target.domainAuthority;
  if (daGap >= 10) score += 25;
  else if (daGap >= 0) score += 15;
  else if (daGap >= -10) score += 5;
  else if (daGap >= -20) score -= 10;
  else score -= 25;
  
  // Content depth comparison (20% weight)
  const wordCountGap = client.potentialWordCount - target.pageWordCount;
  if (wordCountGap >= 1000) score += 20;
  else if (wordCountGap >= 500) score += 10;
  else if (wordCountGap >= 0) score += 5;
  else score -= 10;
  
  // Backlink comparison (20% weight)
  const backlinkRatio = client.relevantBacklinks / Math.max(1, target.backlinksToPage);
  if (backlinkRatio >= 2) score += 20;
  else if (backlinkRatio >= 1) score += 10;
  else if (backlinkRatio >= 0.5) score -= 5;
  else score -= 15;
  
  // Technical edge (15% weight)
  if (client.cwvStatus === 'good' && target.cwvStatus !== 'good') score += 15;
  else if (client.cwvStatus === target.cwvStatus) score += 5;
  else score -= 10;
  
  // Content freshness opportunity (10% weight)
  if (target.contentAge > 365) score += 10; // Stale content opportunity
  else if (target.contentAge > 180) score += 5;
  
  // SERP feature opportunity (10% weight)
  if (!target.hasFeaturedSnippet && client.canCreateSnippetContent) score += 10;
  
  return Math.max(0, Math.min(100, score));
}
```

**Scrape Profile:**

```typescript
const PROFILE_CAN_WE_WIN: ScrapeProfile = {
  name: 'can_we_win',
  maxPages: 30, // Top 10 SERP results x 3 keywords
  pageSelection: 'serp_results', // Scrape what ranks
  tiersAllowed: ['T0', 'T1', 'T2', 'T3'], // Need reliable data
  fallbackToDataForSEO: true,
  dfsMode: 'serp_first', // SERP API is primary
  freeApisEnabled: ['crux', 'open_pagerank'],
  checksToRun: CAN_WE_WIN_CHECKS,
  additionalData: [
    'serp_analysis',
    'serp_features',
    'page_backlinks',
    'content_freshness',
  ],
  cacheStrategy: {
    useSharedCache: true,
    ttl: '24h', // SERP positions change daily
    acceptStale: false,
  },
  timeout: 180000, // 3 minute SLA
};
```

---

#### 3.4.6 Depth Escalation Triggers

**When to Go Deeper:**

| Trigger | From Profile | To Profile | Rationale |
|---------|--------------|------------|-----------|
| Qualification score > 70 | Prospect Discovery | Proposal Generation | Worth investing in |
| Proposal accepted | Proposal Generation | Client Onboarding | Now a paying client |
| Monthly monitoring anomaly | Client Monitoring | Targeted Deep Dive | Something changed |
| New competitor detected | Competitor Analysis | Can We Win | Assess threat |
| Position drop > 10 | Client Monitoring | SERP Displacement | Need to diagnose |

**Automatic Escalation Logic:**

```typescript
interface EscalationRule {
  from: ScrapeProfileName;
  to: ScrapeProfileName;
  trigger: EscalationTrigger;
  autoExecute: boolean; // vs require user confirmation
}

const ESCALATION_RULES: EscalationRule[] = [
  {
    from: 'prospect_discovery',
    to: 'proposal_generation',
    trigger: { type: 'qualification_score', threshold: 70 },
    autoExecute: false, // Requires sales decision
  },
  {
    from: 'proposal_generation',
    to: 'client_onboarding',
    trigger: { type: 'proposal_status', value: 'accepted' },
    autoExecute: true, // Automatic on conversion
  },
  {
    from: 'client_monitoring',
    to: 'focused_deep_dive',
    trigger: { type: 'score_delta', threshold: -15 },
    autoExecute: true, // Auto-investigate drops
  },
  {
    from: 'client_monitoring',
    to: 'can_we_win',
    trigger: { type: 'position_drop', threshold: 10 },
    autoExecute: false, // Requires analyst review
  },
];
```

---

#### 3.4.7 Data Reuse Strategy

**What Can Be Shared:**

| Data Type | Shareable? | TTL | Rationale |
|-----------|------------|-----|-----------|
| Raw HTML | Yes | 24h | Public content |
| CWV metrics | Yes | 1d | Same for everyone |
| Domain authority | Yes | 30d | Public metric |
| Backlink counts | Yes | 7d | Public data |
| SERP positions | Yes | 4h | Same for everyone |
| Competitor pages | Yes | 7d | Public content |
| Client-specific analysis | No | N/A | Tenant data |
| Custom check results | No | N/A | May vary by settings |

**Cache Key Strategy:**

```typescript
const cacheKeyStrategies = {
  // Shared across all tenants
  html: (url: string) => `html:${sha256(normalizeUrl(url)).slice(0, 16)}`,
  cwv: (origin: string) => `cwv:${sha256(origin).slice(0, 16)}`,
  domainAuthority: (domain: string) => `da:${domain}`,
  serp: (keyword: string, location: string) => `serp:${sha256(`${keyword}:${location}`).slice(0, 16)}`,
  
  // Tenant-specific
  auditResult: (tenantId: string, url: string) => `audit:${tenantId}:${sha256(url).slice(0, 16)}`,
  clientBaseline: (clientId: string, capturedAt: string) => `baseline:${clientId}:${capturedAt}`,
};
```

**Reuse During Profile Escalation:**

When escalating from Prospect Discovery to Proposal Generation:
1. Reuse cached HTML (if < 24h old)
2. Reuse CWV data (always reuse)
3. Reuse domain authority (always reuse)
4. Run additional checks on cached HTML
5. Fetch only new data (competitor keywords, backlink summary)

```typescript
async function escalateWithReuse(
  prospectData: ProspectSnapshot,
  targetProfile: ScrapeProfile
): Promise<ProposalData> {
  const reusableData = {
    html: await cache.get(cacheKeyStrategies.html(prospectData.url)),
    cwv: await cache.get(cacheKeyStrategies.cwv(prospectData.origin)),
    da: await cache.get(cacheKeyStrategies.domainAuthority(prospectData.domain)),
  };
  
  // Calculate what's already done vs what's needed
  const alreadyComplete = PROSPECT_DISCOVERY_CHECKS;
  const stillNeeded = PROPOSAL_GENERATION_CHECKS.filter(
    c => !alreadyComplete.includes(c)
  );
  
  // Run incremental checks on cached HTML
  if (reusableData.html) {
    const incrementalResults = await runChecks(reusableData.html, stillNeeded);
    // ... merge with existing data
  }
  
  // Fetch only truly new data
  const newData = await fetchAdditionalData(targetProfile.additionalData);
  
  return mergeToProposalData(prospectData, incrementalResults, newData);
}
```

---

#### 3.4.8 Recommended Implementation Roadmap

**Phase 1: Profile Infrastructure (Week 1)**
- [ ] Define `ScrapeProfile` type and 6 profile configurations
- [ ] Implement profile-aware ScrapingService.scrape(url, profile)
- [ ] Add profile parameter to BullMQ job options
- [ ] Create escalation rule engine

**Phase 2: Check Subsetting (Week 2)**
- [ ] Refactor check runner to accept check subset arrays
- [ ] Optimize partial check execution (no unused check loading)
- [ ] Add profile-specific timeout enforcement
- [ ] Implement per-profile cost tracking

**Phase 3: Data Extraction (Week 3)**
- [ ] Create ProspectSnapshot extractor
- [ ] Create ProposalData extractor
- [ ] Create CompetitorComparison builder
- [ ] Create CanWeWinAnalysis scorer

**Phase 4: Reuse Optimization (Week 4)**
- [ ] Implement escalation-aware cache lookup
- [ ] Add incremental check execution
- [ ] Build profile-to-profile data migration
- [ ] Add cost savings metrics

---

#### 3.4.9 Cost Projections

**Monthly Cost at 1000 Prospects Processed:**

| Workflow Stage | Volume | Profile | Unit Cost | Total |
|----------------|--------|---------|-----------|-------|
| Discovery | 1000 | Prospect Discovery | $0.001 | $1.00 |
| Qualified | 300 | Proposal Generation | $0.005 | $1.50 |
| Converted | 30 | Client Onboarding | $0.050 | $1.50 |
| Monitoring | 30 clients x 10 pages | Client Monitoring | $0.002 | $0.60 |
| Competitors | 30 clients x 5 competitors | Competitor Analysis | $0.020 | $3.00 |
| **Total** | | | | **$7.60** |

**vs Current Architecture (Full Audit Everything):**

| Workflow Stage | Volume | Full Audit Cost | Total |
|----------------|--------|-----------------|-------|
| Discovery | 1000 | $0.050 | $50.00 |
| Qualified | 300 | $0.050 | $15.00 |
| Converted | 30 | $0.050 | $1.50 |
| Monitoring | 300 | $0.050 | $15.00 |
| Competitors | 150 | $0.050 | $7.50 |
| **Total** | | | **$89.00** |

**Savings: 91% ($81.40/month at 1000 prospects)**

---

**Note:** This content should be merged into WORLD-CLASS-SCRAPING-DEEP-DIVE.md at section 3.4.
