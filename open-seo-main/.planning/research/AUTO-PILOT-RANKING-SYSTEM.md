# Auto-Pilot Client Ranking System

## Strategic Architecture for Automated SEO Agency Operations

**Version:** 1.0
**Date:** 2026-04-21
**Purpose:** Comprehensive blueprint for building an automated client ranking system that manages SEO portfolios with minimal human intervention

---

## Executive Summary

This document outlines the architecture for an auto-pilot ranking system designed for SEO agencies. The system leverages the existing open-seo-main infrastructure (BullMQ workers, DataForSEO integration, prospect analysis, health scoring) and extends it with intelligent prioritization, automated optimization queues, and portfolio management capabilities.

**Core Value Proposition:** Transform agency operations from reactive firefighting to proactive, data-driven optimization at scale.

---

## 1. Ranking Factor Prioritization Engine

### 1.1 Site Type Classification

Before prioritization, the system must classify each client's site type to apply the correct ranking factors.

```typescript
// Site type classification based on business characteristics
type SiteType = 'local' | 'ecommerce' | 'saas' | 'publisher' | 'hybrid';

interface SiteClassification {
  primaryType: SiteType;
  confidence: number;
  signals: {
    hasPhysicalLocations: boolean;
    hasProductCatalog: boolean;
    hasSubscriptionModel: boolean;
    contentVelocity: 'high' | 'medium' | 'low';
    transactionIntent: number; // 0-100
    localIntent: number; // 0-100
  };
}
```

**Classification Signals:**
- **Local Business:** NAP consistency, GMB presence, service area pages, location modifiers in keywords
- **E-commerce:** Product schema, category structure, transactional keywords, cart/checkout presence
- **SaaS:** Pricing page, feature pages, comparison content, branded search volume
- **Publisher:** High content velocity, topical clusters, ad presence, engagement metrics

### 1.2 Factor-ROI Matrix by Site Type

| Factor | Local | E-commerce | SaaS | Publisher |
|--------|-------|------------|------|-----------|
| **Google Business Profile** | CRITICAL | Low | None | None |
| **Technical SEO (CWV)** | Medium | HIGH | HIGH | HIGH |
| **Content Depth (siteFocusScore)** | Medium | HIGH | CRITICAL | CRITICAL |
| **Backlink Profile** | Medium | HIGH | HIGH | CRITICAL |
| **Local Citations** | CRITICAL | Low | None | None |
| **Schema Markup** | HIGH | CRITICAL | Medium | HIGH |
| **Internal Linking** | Medium | HIGH | CRITICAL | CRITICAL |
| **User Engagement (NavBoost)** | HIGH | CRITICAL | HIGH | CRITICAL |
| **E-E-A-T Signals** | Medium | HIGH | HIGH | CRITICAL |
| **Mobile Experience** | CRITICAL | CRITICAL | HIGH | HIGH |

### 1.3 Current State Assessment Engine

```typescript
interface CurrentStateAssessment {
  // Technical Foundation
  technical: {
    cwvScore: number; // 0-100
    crawlabilityScore: number;
    indexationRatio: number; // indexed/total pages
    mobileUsabilityScore: number;
    structuredDataCoverage: number;
    issues: TechnicalIssue[];
  };
  
  // Content Authority
  content: {
    siteFocusScore: number; // Topical authority measurement
    siteRadius: number; // Topic cluster tightness
    contentGapScore: number; // vs competitors
    contentFreshnessScore: number;
    wordCountAvg: number;
    topicClusters: TopicCluster[];
  };
  
  // Off-Page Authority
  authority: {
    domainRating: number;
    referringDomains: number;
    backlinkVelocity: number; // new links/month
    toxicLinkRatio: number;
    competitorAuthorityGap: number;
  };
  
  // Engagement Signals (NavBoost proxies)
  engagement: {
    avgSessionDuration: number;
    bounceRate: number;
    pagesPerSession: number;
    returnVisitorRate: number;
    organicCTR: number;
  };
  
  // Competitive Position
  competitive: {
    shareOfVoice: number; // % of target keywords ranking
    avgPosition: number;
    top3Ratio: number;
    top10Ratio: number;
    competitorGap: KeywordGap[];
  };
}
```

### 1.4 Opportunity Scoring Algorithm

The opportunity score identifies the "low effort + high impact" quadrant.

```typescript
interface OpportunityScore {
  keyword: string;
  
  // Impact factors
  searchVolume: number;
  cpc: number; // commercial value proxy
  currentPosition: number | null;
  competitorStrength: number; // avg authority of top 10
  
  // Effort factors
  contentGap: 'none' | 'partial' | 'full'; // existing content?
  technicalBlockers: number; // issues affecting this keyword
  requiredBacklinks: number; // estimated links needed
  
  // Calculated scores
  impactScore: number; // 0-100
  effortScore: number; // 0-100 (lower = easier)
  opportunityScore: number; // impact * (100 - effort) / 100
  
  // Categorization
  quadrant: 'quick_win' | 'major_project' | 'fill_in' | 'thankless';
}

// Quadrant mapping:
// HIGH impact + LOW effort = Quick Wins (prioritize)
// HIGH impact + HIGH effort = Major Projects (plan)
// LOW impact + LOW effort = Fill-Ins (automate)
// LOW impact + HIGH effort = Thankless Tasks (avoid)
```

### 1.5 Predictive Ranking Model

```typescript
interface RankingPrediction {
  keyword: string;
  currentPosition: number | null;
  
  // 30-day projection
  projectedPosition: number;
  confidence: number;
  
  // Key factors
  contentQualityDelta: number; // expected change
  authorityDelta: number;
  competitorActivity: 'aggressive' | 'stable' | 'declining';
  
  // Required actions for improvement
  actionsRequired: PredictedAction[];
  estimatedTimeToRank: number; // days
  
  // Risk assessment
  dropRisk: number; // probability of losing current position
  dropFactors: string[];
}

interface PredictedAction {
  type: 'content_update' | 'new_content' | 'technical_fix' | 'link_building' | 'internal_linking';
  target: string;
  expectedImpact: number;
  effort: 'low' | 'medium' | 'high';
  deadline: Date | null;
}
```

---

## 2. Automated Optimization Queues

### 2.1 Task Dependency Graph

Tasks must be processed in dependency order. The system uses a DAG (Directed Acyclic Graph) to manage dependencies.

```typescript
// Task dependency definitions
const TASK_DEPENDENCIES: Record<TaskType, TaskType[]> = {
  // Technical foundation (no dependencies - always first)
  'fix_crawl_errors': [],
  'fix_robots_txt': [],
  'submit_sitemap': [],
  
  // Core Web Vitals (after crawlability)
  'fix_lcp': ['fix_crawl_errors'],
  'fix_cls': ['fix_crawl_errors'],
  'fix_fid': ['fix_crawl_errors'],
  
  // Schema markup (after technical)
  'add_schema_organization': ['fix_crawl_errors'],
  'add_schema_product': ['fix_crawl_errors'],
  'add_schema_faq': ['fix_crawl_errors'],
  
  // Content optimization (after schema)
  'optimize_title_tags': ['add_schema_organization'],
  'optimize_meta_descriptions': ['optimize_title_tags'],
  'add_internal_links': ['optimize_title_tags'],
  
  // Content creation (after internal structure)
  'create_pillar_content': ['add_internal_links'],
  'create_supporting_content': ['create_pillar_content'],
  
  // Link building (after content exists)
  'build_foundational_links': ['create_supporting_content'],
  'build_authority_links': ['build_foundational_links'],
  
  // Ongoing optimization
  'content_refresh': ['optimize_title_tags'],
  'link_acquisition': ['build_authority_links'],
};
```

### 2.2 Expected Ranking Lift Model

```typescript
interface TaskRankingLift {
  taskType: TaskType;
  
  // Base impact by site type
  impactBySiteType: Record<SiteType, number>;
  
  // Modifiers
  urgencyMultiplier: number; // time-sensitive tasks
  compoundingEffect: number; // tasks that unlock other gains
  
  // Historical performance
  avgLiftObserved: number;
  successRate: number;
  timeToImpact: number; // days
}

// Example lift estimates (0-10 scale)
const TASK_LIFT_ESTIMATES: TaskRankingLift[] = [
  {
    taskType: 'fix_crawl_errors',
    impactBySiteType: { local: 3, ecommerce: 8, saas: 6, publisher: 9 },
    urgencyMultiplier: 2.0, // critical blocker
    compoundingEffect: 1.5, // unlocks other fixes
    avgLiftObserved: 5.2,
    successRate: 0.95,
    timeToImpact: 7,
  },
  {
    taskType: 'optimize_title_tags',
    impactBySiteType: { local: 5, ecommerce: 7, saas: 8, publisher: 9 },
    urgencyMultiplier: 1.0,
    compoundingEffect: 1.2, // improves CTR
    avgLiftObserved: 4.1,
    successRate: 0.88,
    timeToImpact: 14,
  },
  // ... more tasks
];
```

### 2.3 Multi-Client Resource Allocation

```typescript
interface ResourceAllocation {
  clientId: string;
  
  // Allocated resources this period
  hoursAllocated: number;
  tasksAllocated: OptimizationTask[];
  
  // Priority factors
  priorityScore: number; // from existing priority-score.ts
  mrr: number; // monthly recurring revenue
  contractStatus: 'new' | 'renewing' | 'at_risk';
  lastTouchDays: number;
  
  // Constraints
  maxHoursPerWeek: number;
  blockedTaskTypes: TaskType[]; // requires client approval
}

// Allocation algorithm
function allocateResources(
  clients: Client[],
  availableHours: number,
  period: 'day' | 'week',
): ResourceAllocation[] {
  // 1. Calculate weighted priority for each client
  const weightedClients = clients.map(c => ({
    client: c,
    weight: calculateClientWeight(c),
  }));
  
  // 2. Proportionally allocate hours
  const totalWeight = weightedClients.reduce((sum, wc) => sum + wc.weight, 0);
  
  return weightedClients.map(wc => ({
    clientId: wc.client.id,
    hoursAllocated: (wc.weight / totalWeight) * availableHours,
    tasksAllocated: selectTasksForBudget(wc.client, wc.hoursAllocated),
    priorityScore: wc.client.priorityScore,
    mrr: wc.client.mrr,
    contractStatus: wc.client.contractStatus,
    lastTouchDays: wc.client.lastTouchDays,
    maxHoursPerWeek: wc.client.slaHoursPerWeek,
    blockedTaskTypes: wc.client.blockedTaskTypes,
  }));
}

function calculateClientWeight(client: Client): number {
  let weight = 1.0;
  
  // Priority score impact (0-2x multiplier)
  weight *= Math.min(2.0, 1 + client.priorityScore / 1000);
  
  // MRR impact (higher paying clients get more attention)
  weight *= Math.log10(client.mrr / 100 + 1);
  
  // Contract status urgency
  if (client.contractStatus === 'at_risk') weight *= 1.5;
  if (client.contractStatus === 'renewing') weight *= 1.2;
  
  // Neglect penalty (diminishing returns)
  if (client.lastTouchDays > 7) weight *= 1.1;
  if (client.lastTouchDays > 14) weight *= 1.2;
  
  return weight;
}
```

### 2.4 Low-Traffic Period Scheduling

```typescript
interface SchedulingConfig {
  clientId: string;
  timezone: string;
  
  // Low-traffic windows (from GA4 data)
  lowTrafficWindows: TimeWindow[];
  
  // Task scheduling preferences
  preferredMaintenanceWindow: TimeWindow;
  avoidWindows: TimeWindow[]; // e.g., sales events
  
  // Auto-detected patterns
  peakTrafficHours: number[];
  weekendTrafficRatio: number;
}

interface TimeWindow {
  dayOfWeek: number[]; // 0-6
  startHour: number; // 0-23
  endHour: number;
}

// Schedule optimization tasks during low-traffic periods
async function scheduleOptimizationTasks(
  client: Client,
  tasks: OptimizationTask[],
): Promise<ScheduledTask[]> {
  const config = await getSchedulingConfig(client.id);
  
  return tasks.map(task => {
    // High-impact tasks during low traffic
    if (task.riskLevel === 'high') {
      return {
        ...task,
        scheduledFor: findNextLowTrafficWindow(config),
        requiresReview: true,
      };
    }
    
    // Low-risk tasks can run anytime
    return {
      ...task,
      scheduledFor: new Date(),
      requiresReview: false,
    };
  });
}
```

---

## 3. Client Health Scoring

### 3.1 Enhanced Health Score Algorithm

Extends the existing `computeHealthScore` with additional signals.

```typescript
interface EnhancedHealthInputs extends HealthInputs {
  // Existing (from health-score.ts)
  trafficTrend: number;
  alertsCritical: number;
  alertsWarning: number;
  keywordsTop10Pct: number;
  backlinksLostPct: number;
  lastReportDaysAgo: number;
  connectionStale: boolean;
  
  // New engagement signals (NavBoost proxies)
  bounceRateTrend: number;
  avgSessionDurationTrend: number;
  returnVisitorRateTrend: number;
  
  // Competitive signals
  shareOfVoiceTrend: number;
  competitorActivityLevel: 'aggressive' | 'normal' | 'declining';
  
  // Content health
  contentFreshnessScore: number;
  topicalAuthorityCoverage: number;
  
  // Technical debt
  crawlErrorsNew: number;
  schemaValidationErrors: number;
}

function computeEnhancedHealthScore(inputs: EnhancedHealthInputs): HealthResult {
  // Start with base score
  const baseResult = computeHealthScore(inputs);
  let adjustedScore = baseResult.score;
  
  // Engagement adjustments (+/- 10 points)
  if (inputs.bounceRateTrend > 0.1) adjustedScore -= 5;
  if (inputs.avgSessionDurationTrend < -0.1) adjustedScore -= 5;
  if (inputs.returnVisitorRateTrend > 0.05) adjustedScore += 5;
  
  // Competitive pressure adjustments
  if (inputs.competitorActivityLevel === 'aggressive') {
    adjustedScore -= 10;
  }
  if (inputs.shareOfVoiceTrend < -0.1) adjustedScore -= 5;
  
  // Content freshness
  if (inputs.contentFreshnessScore < 50) adjustedScore -= 5;
  if (inputs.topicalAuthorityCoverage < 0.6) adjustedScore -= 5;
  
  // Technical debt
  adjustedScore -= Math.min(10, inputs.crawlErrorsNew * 2);
  adjustedScore -= Math.min(5, inputs.schemaValidationErrors);
  
  return {
    score: Math.max(0, Math.min(100, adjustedScore)),
    breakdown: {
      ...baseResult.breakdown,
      engagement: calculateEngagementScore(inputs),
      competitive: calculateCompetitiveScore(inputs),
    },
  };
}
```

### 3.2 Early Warning System

```typescript
interface EarlyWarningSignal {
  type: 'ranking_decline' | 'traffic_anomaly' | 'competitor_surge' | 
        'engagement_drop' | 'backlink_loss' | 'technical_regression';
  severity: 'watch' | 'warning' | 'critical';
  clientId: string;
  
  // Detection details
  detectedAt: Date;
  metric: string;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  
  // Trend analysis
  trendDirection: 'declining' | 'stable' | 'improving';
  daysInTrend: number;
  predictedValueIn7Days: number;
  
  // Context
  affectedKeywords: string[];
  affectedPages: string[];
  potentialCauses: string[];
  
  // Recommended actions
  recommendedActions: RecommendedAction[];
  autoActionTriggered: boolean;
}

// Detection thresholds
const WARNING_THRESHOLDS = {
  ranking_decline: {
    watch: 3, // positions
    warning: 5,
    critical: 10,
  },
  traffic_anomaly: {
    watch: -0.10, // -10%
    warning: -0.20,
    critical: -0.35,
  },
  engagement_drop: {
    watch: -0.15,
    warning: -0.25,
    critical: -0.40,
  },
  backlink_loss: {
    watch: 0.05, // 5% lost
    warning: 0.10,
    critical: 0.20,
  },
};

// Anomaly detection using statistical methods
function detectAnomalies(
  clientId: string,
  metricHistory: MetricDataPoint[],
): EarlyWarningSignal[] {
  const warnings: EarlyWarningSignal[] = [];
  
  // Calculate baseline (30-day rolling average)
  const baseline = calculateRollingAverage(metricHistory, 30);
  const stdDev = calculateStdDev(metricHistory, 30);
  const current = metricHistory[metricHistory.length - 1].value;
  
  // Z-score anomaly detection
  const zScore = (current - baseline) / stdDev;
  
  if (zScore < -2) {
    // 2+ standard deviations below mean
    warnings.push({
      type: determineWarningType(metricHistory),
      severity: zScore < -3 ? 'critical' : 'warning',
      clientId,
      currentValue: current,
      baselineValue: baseline,
      changePercent: (current - baseline) / baseline,
      // ... additional fields
    });
  }
  
  return warnings;
}
```

### 3.3 Share of Voice Tracking

```typescript
interface ShareOfVoiceMetrics {
  clientId: string;
  period: 'daily' | 'weekly' | 'monthly';
  
  // Overall SOV
  totalTargetKeywords: number;
  keywordsRanking: number;
  shareOfVoice: number; // percentage
  
  // Position distribution
  position1Count: number;
  top3Count: number;
  top10Count: number;
  top20Count: number;
  top100Count: number;
  
  // Visibility score (weighted by search volume)
  visibilityScore: number;
  
  // Competitive comparison
  competitorSoV: Array<{
    domain: string;
    shareOfVoice: number;
    visibilityScore: number;
  }>;
  
  // Trend
  sovTrend7d: number;
  sovTrend30d: number;
  visibilityTrend7d: number;
}

// Calculate visibility score (search volume weighted)
function calculateVisibilityScore(
  rankings: KeywordRanking[],
): number {
  let totalPotentialVisibility = 0;
  let actualVisibility = 0;
  
  for (const ranking of rankings) {
    totalPotentialVisibility += ranking.searchVolume;
    
    // CTR curve approximation by position
    const ctr = estimateCTR(ranking.position);
    actualVisibility += ranking.searchVolume * ctr;
  }
  
  return totalPotentialVisibility > 0
    ? (actualVisibility / totalPotentialVisibility) * 100
    : 0;
}

// CTR estimates by position (based on industry studies)
function estimateCTR(position: number): number {
  if (position === 0) return 0;
  if (position === 1) return 0.285;
  if (position === 2) return 0.157;
  if (position === 3) return 0.110;
  if (position <= 5) return 0.065;
  if (position <= 10) return 0.035;
  if (position <= 20) return 0.015;
  return 0.005;
}
```

### 3.4 Trend Analysis and Forecasting

```typescript
interface TrendForecast {
  metric: string;
  clientId: string;
  
  // Historical data
  dataPoints: DataPoint[];
  trendLine: TrendLineParams;
  
  // Forecast
  forecast7d: number;
  forecast30d: number;
  forecast90d: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number;
  };
  
  // Trend classification
  trendType: 'strong_growth' | 'growth' | 'stable' | 'decline' | 'strong_decline';
  seasonalityDetected: boolean;
  seasonalPattern?: 'weekly' | 'monthly' | 'quarterly';
  
  // Key inflection points
  inflectionPoints: Array<{
    date: Date;
    type: 'peak' | 'trough' | 'acceleration' | 'deceleration';
    possibleCause?: string;
  }>;
}

// Simple linear regression for forecasting
function forecastMetric(
  dataPoints: DataPoint[],
  daysAhead: number,
): TrendForecast {
  // Calculate trend line using least squares
  const { slope, intercept, rSquared } = linearRegression(dataPoints);
  
  // Forecast future values
  const lastX = dataPoints.length - 1;
  const forecast7d = slope * (lastX + 7) + intercept;
  const forecast30d = slope * (lastX + 30) + intercept;
  const forecast90d = slope * (lastX + 90) + intercept;
  
  // Calculate confidence interval
  const residuals = dataPoints.map((dp, i) => dp.value - (slope * i + intercept));
  const stdError = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length);
  
  return {
    // ... populate fields
    trendType: classifyTrend(slope, rSquared),
    confidenceInterval: {
      lower: forecast30d - 1.96 * stdError,
      upper: forecast30d + 1.96 * stdError,
      confidence: 0.95,
    },
  };
}
```

---

## 4. Auto-Pilot Optimization Loops

### 4.1 Automation Classification Matrix

| Optimization Type | Fully Automated | Review Required | Manual Only |
|-------------------|-----------------|-----------------|-------------|
| Crawl error fixes | Yes | - | - |
| XML sitemap updates | Yes | - | - |
| Schema validation fixes | Yes | - | - |
| Internal link suggestions | - | Yes | - |
| Title tag optimizations | - | Yes | - |
| Meta description updates | - | Yes | - |
| Content refresh recommendations | - | Yes | - |
| New content briefs | - | - | Yes |
| Link building outreach | - | - | Yes |
| Major technical changes | - | - | Yes |

### 4.2 A/B Testing Integration

```typescript
interface TitleTagTest {
  id: string;
  clientId: string;
  pageUrl: string;
  keyword: string;
  
  // Variants
  controlTitle: string;
  testTitle: string;
  
  // Test configuration
  testType: 'title_tag' | 'meta_description' | 'h1';
  startDate: Date;
  endDate: Date | null;
  minSampleSize: number;
  
  // Results
  controlClicks: number;
  controlImpressions: number;
  controlCTR: number;
  testClicks: number;
  testImpressions: number;
  testCTR: number;
  
  // Statistical analysis
  statisticalSignificance: number;
  confidenceLevel: number;
  lift: number;
  winner: 'control' | 'test' | 'inconclusive';
  
  // Auto-actions
  autoImplementWinner: boolean;
  implemented: boolean;
  implementedAt: Date | null;
}

// Generate title tag variants using AI
async function generateTitleVariants(
  currentTitle: string,
  keyword: string,
  pageContent: string,
): Promise<string[]> {
  const variants: string[] = [];
  
  // Variant 1: Keyword-first
  variants.push(`${keyword} - ${extractBrandName(currentTitle)}`);
  
  // Variant 2: Question format
  variants.push(`What is ${keyword}? | Complete Guide`);
  
  // Variant 3: Power words
  variants.push(`${keyword}: Ultimate Guide [2026]`);
  
  // Variant 4: AI-generated
  const aiVariant = await generateAITitle(keyword, pageContent);
  variants.push(aiVariant);
  
  return variants.filter(v => v.length <= 60);
}
```

### 4.3 Content Refresh Automation

```typescript
interface ContentDecaySignal {
  pageUrl: string;
  
  // Decay indicators
  trafficDecline30d: number;
  trafficDecline90d: number;
  rankingDecline: number;
  lastUpdated: Date;
  daysSinceUpdate: number;
  
  // Content analysis
  outdatedSections: string[];
  missingTopics: string[]; // vs competitors
  readabilityScore: number;
  wordCount: number;
  
  // Refresh recommendation
  refreshUrgency: 'low' | 'medium' | 'high' | 'critical';
  recommendedActions: ContentAction[];
  estimatedRecovery: number; // % traffic recovery expected
}

interface ContentAction {
  type: 'update_stats' | 'add_section' | 'remove_outdated' | 
        'improve_readability' | 'add_internal_links' | 'full_rewrite';
  description: string;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

// Content decay detection
async function detectContentDecay(
  clientId: string,
): Promise<ContentDecaySignal[]> {
  const pages = await getPagesWithDecay(clientId);
  
  return pages.map(page => ({
    pageUrl: page.url,
    trafficDecline30d: calculateDecline(page.traffic30d, page.traffic60d),
    trafficDecline90d: calculateDecline(page.traffic90d, page.traffic180d),
    rankingDecline: calculateRankingDecline(page.rankings),
    lastUpdated: page.lastModified,
    daysSinceUpdate: daysBetween(page.lastModified, new Date()),
    outdatedSections: detectOutdatedSections(page.content),
    missingTopics: await findMissingTopics(page.url, page.targetKeyword),
    readabilityScore: calculateReadability(page.content),
    wordCount: page.wordCount,
    refreshUrgency: calculateRefreshUrgency(page),
    recommendedActions: generateRefreshActions(page),
    estimatedRecovery: estimateRecovery(page),
  }));
}

// Automatic content refresh triggers
const CONTENT_REFRESH_TRIGGERS = {
  // Auto-refresh (no approval needed)
  auto: [
    { condition: 'daysSinceUpdate > 365 && trafficDecline90d > 0.3', action: 'flag_for_review' },
    { condition: 'brokenLinks > 0', action: 'fix_links' },
    { condition: 'outdatedStats', action: 'update_statistics' },
  ],
  
  // Requires review
  review: [
    { condition: 'trafficDecline90d > 0.5', action: 'content_refresh_brief' },
    { condition: 'missingTopics.length > 3', action: 'section_expansion_brief' },
    { condition: 'competitorGap > 500', action: 'comprehensive_update_brief' },
  ],
};
```

### 4.4 Link Building Opportunity Identification

```typescript
interface LinkBuildingOpportunity {
  id: string;
  clientId: string;
  
  // Opportunity details
  type: 'broken_link' | 'resource_page' | 'guest_post' | 
        'unlinked_mention' | 'competitor_backlink' | 'skyscraper';
  targetDomain: string;
  targetUrl: string;
  
  // Value assessment
  domainAuthority: number;
  trafficEstimate: number;
  relevanceScore: number; // 0-100
  difficultyScore: number; // 0-100
  
  // Priority calculation
  opportunityScore: number;
  
  // Status
  status: 'identified' | 'outreach_queued' | 'contacted' | 
          'responded' | 'negotiating' | 'secured' | 'rejected';
  
  // Outreach details
  contactEmail: string | null;
  contactName: string | null;
  outreachTemplate: string | null;
  
  // Tracking
  identifiedAt: Date;
  lastContactedAt: Date | null;
  responseReceivedAt: Date | null;
}

// Identify link opportunities from competitor analysis
async function identifyLinkOpportunities(
  clientId: string,
): Promise<LinkBuildingOpportunity[]> {
  const opportunities: LinkBuildingOpportunity[] = [];
  
  // 1. Competitor backlink analysis
  const competitorLinks = await analyzeCompetitorBacklinks(clientId);
  for (const link of competitorLinks) {
    if (!await clientHasLinkFrom(clientId, link.domain)) {
      opportunities.push({
        type: 'competitor_backlink',
        targetDomain: link.domain,
        targetUrl: link.url,
        domainAuthority: link.da,
        opportunityScore: calculateLinkOpportunityScore(link),
        // ...
      });
    }
  }
  
  // 2. Broken link opportunities
  const brokenLinks = await findBrokenLinkOpportunities(clientId);
  opportunities.push(...brokenLinks);
  
  // 3. Unlinked brand mentions
  const mentions = await findUnlinkedMentions(clientId);
  opportunities.push(...mentions.map(m => ({
    type: 'unlinked_mention' as const,
    // ...
  })));
  
  return opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
}
```

---

## 5. Multi-Client Portfolio Management

### 5.1 Resource Allocation Model

```typescript
interface PortfolioAllocation {
  workspaceId: string;
  period: 'week' | 'month';
  
  // Available resources
  totalHours: number;
  teamMembers: TeamMember[];
  
  // Client allocations
  allocations: ClientAllocation[];
  
  // Optimization metrics
  utilizationRate: number;
  priorityCoverage: number; // % of high-priority clients served
  
  // Constraints
  slaViolations: SLAViolation[];
  overallocatedClients: string[];
  underservedClients: string[];
}

interface ClientAllocation {
  clientId: string;
  clientName: string;
  
  // Allocation
  hoursAllocated: number;
  tasksAllocated: number;
  assignedTo: string | null;
  
  // Priority factors
  tier: 'enterprise' | 'professional' | 'starter';
  mrr: number;
  healthScore: number;
  priorityScore: number;
  
  // SLA status
  slaHoursRequired: number;
  slaTasksRequired: number;
  slaMet: boolean;
  
  // Recommendations
  recommendedActions: OptimizationTask[];
}

// Optimize allocation using linear programming principles
function optimizeAllocation(
  clients: Client[],
  resources: Resource[],
  constraints: AllocationConstraints,
): PortfolioAllocation {
  // Sort clients by weighted priority
  const sortedClients = clients.sort((a, b) => {
    const weightA = calculateClientWeight(a);
    const weightB = calculateClientWeight(b);
    return weightB - weightA;
  });
  
  // Allocate resources respecting constraints
  const allocations: ClientAllocation[] = [];
  let remainingHours = constraints.totalHours;
  
  for (const client of sortedClients) {
    // Minimum SLA hours first
    const minHours = client.slaHoursRequired;
    const maxHours = Math.min(
      client.maxHoursPerPeriod,
      remainingHours,
    );
    
    // Calculate optimal allocation
    const optimalHours = calculateOptimalHours(
      client,
      minHours,
      maxHours,
      remainingHours,
    );
    
    allocations.push({
      clientId: client.id,
      hoursAllocated: optimalHours,
      tasksAllocated: selectTasksForBudget(client, optimalHours).length,
      // ...
    });
    
    remainingHours -= optimalHours;
  }
  
  return {
    allocations,
    utilizationRate: (constraints.totalHours - remainingHours) / constraints.totalHours,
    // ...
  };
}
```

### 5.2 Workload Balancing

```typescript
interface WorkloadBalance {
  teamMemberId: string;
  
  // Current load
  assignedClients: number;
  assignedTasks: number;
  estimatedHours: number;
  
  // Capacity
  maxHoursPerWeek: number;
  availableHours: number;
  
  // Performance metrics
  avgTaskCompletionTime: number;
  taskCompletionRate: number;
  clientSatisfactionScore: number;
  
  // Specializations
  strengths: TaskType[];
  preferredClientTypes: SiteType[];
}

// Balance workload across team
function balanceWorkload(
  team: TeamMember[],
  tasks: OptimizationTask[],
): TaskAssignment[] {
  const assignments: TaskAssignment[] = [];
  
  // Group tasks by type
  const tasksByType = groupBy(tasks, t => t.type);
  
  for (const [taskType, typeTasks] of Object.entries(tasksByType)) {
    // Find team members with relevant expertise
    const qualifiedMembers = team.filter(m => 
      m.strengths.includes(taskType as TaskType)
    );
    
    // Distribute tasks based on available capacity
    const sorted = qualifiedMembers.sort((a, b) => 
      b.availableHours - a.availableHours
    );
    
    for (const task of typeTasks) {
      const assignee = sorted.find(m => 
        m.availableHours >= task.estimatedHours
      );
      
      if (assignee) {
        assignments.push({
          taskId: task.id,
          assigneeId: assignee.id,
          estimatedHours: task.estimatedHours,
        });
        assignee.availableHours -= task.estimatedHours;
      }
    }
  }
  
  return assignments;
}
```

### 5.3 Client Tiering and SLA Management

```typescript
// Client tier definitions with SLAs
const CLIENT_TIERS = {
  enterprise: {
    minMRR: 5000,
    slaResponseTime: 4, // hours
    slaReportFrequency: 'weekly',
    dedicatedManager: true,
    priorityMultiplier: 2.0,
    maxKeywordsTracked: 1000,
    auditFrequency: 'monthly',
    features: ['custom_reporting', 'api_access', 'white_label', 'priority_support'],
  },
  professional: {
    minMRR: 1500,
    slaResponseTime: 24,
    slaReportFrequency: 'bi-weekly',
    dedicatedManager: false,
    priorityMultiplier: 1.5,
    maxKeywordsTracked: 250,
    auditFrequency: 'quarterly',
    features: ['custom_reporting', 'api_access'],
  },
  starter: {
    minMRR: 0,
    slaResponseTime: 48,
    slaReportFrequency: 'monthly',
    dedicatedManager: false,
    priorityMultiplier: 1.0,
    maxKeywordsTracked: 50,
    auditFrequency: 'semi-annual',
    features: [],
  },
};

interface SLATracker {
  clientId: string;
  tier: keyof typeof CLIENT_TIERS;
  
  // SLA metrics
  responseTimeAvg: number;
  responseTimeTarget: number;
  responseTimeMet: boolean;
  
  reportsDue: number;
  reportsDelivered: number;
  reportingMet: boolean;
  
  tasksPromised: number;
  tasksCompleted: number;
  tasksMet: boolean;
  
  // Overall SLA status
  overallSLAMet: boolean;
  slaScore: number; // 0-100
  
  // Alerts
  slaRiskLevel: 'on_track' | 'at_risk' | 'breached';
  nextDeadline: Date;
  nextDeadlineType: string;
}

// SLA monitoring and alerting
async function monitorSLAs(): Promise<SLAAlert[]> {
  const alerts: SLAAlert[] = [];
  const clients = await getAllActiveClients();
  
  for (const client of clients) {
    const tracker = await calculateSLAStatus(client);
    
    if (tracker.slaRiskLevel === 'at_risk') {
      alerts.push({
        type: 'sla_at_risk',
        clientId: client.id,
        message: `SLA at risk for ${client.name}`,
        deadline: tracker.nextDeadline,
        // ...
      });
    }
    
    if (tracker.slaRiskLevel === 'breached') {
      alerts.push({
        type: 'sla_breached',
        clientId: client.id,
        severity: 'critical',
        message: `SLA breached for ${client.name}`,
        // ...
      });
    }
  }
  
  return alerts;
}
```

### 5.4 ROI Attribution and Reporting

```typescript
interface ROIAttribution {
  clientId: string;
  period: DateRange;
  
  // Input metrics
  hoursInvested: number;
  tasksCompleted: number;
  contentCreated: number;
  linksBuilt: number;
  
  // Output metrics
  trafficChange: number;
  trafficChangePercent: number;
  keywordImprovements: number;
  rankingGains: number;
  
  // Estimated value
  organicTrafficValue: number; // monthly
  newTrafficValue: number;
  roi: number; // (value - cost) / cost
  
  // Attribution breakdown
  attribution: {
    technical: number; // % of gains from technical fixes
    content: number;
    links: number;
    onPage: number;
  };
  
  // Client-facing report
  highlightMetrics: ReportHighlight[];
  recommendations: Recommendation[];
}

interface ReportHighlight {
  metric: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'flat';
  context: string;
}

// Calculate ROI for client
async function calculateClientROI(
  clientId: string,
  period: DateRange,
): Promise<ROIAttribution> {
  // Get all work performed
  const tasks = await getCompletedTasks(clientId, period);
  const hours = tasks.reduce((sum, t) => sum + t.hoursSpent, 0);
  
  // Get metric changes
  const trafficBefore = await getTraffic(clientId, period.start);
  const trafficAfter = await getTraffic(clientId, period.end);
  const trafficChange = trafficAfter - trafficBefore;
  
  // Estimate value of traffic (based on CPC)
  const avgCPC = await getAverageCPC(clientId);
  const trafficValue = trafficAfter * avgCPC * 0.4; // 40% conversion factor
  const newTrafficValue = trafficChange * avgCPC * 0.4;
  
  // Calculate ROI
  const cost = hours * 75; // $75/hour agency cost
  const roi = cost > 0 ? (newTrafficValue - cost) / cost : 0;
  
  // Attribution modeling (simplified last-touch)
  const attribution = await calculateAttribution(tasks, clientId, period);
  
  return {
    clientId,
    period,
    hoursInvested: hours,
    tasksCompleted: tasks.length,
    trafficChange,
    trafficChangePercent: trafficBefore > 0 ? trafficChange / trafficBefore : 0,
    organicTrafficValue: trafficValue,
    newTrafficValue,
    roi,
    attribution,
    // ...
  };
}
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Build on existing infrastructure:**

1. **Site Type Classifier**
   - Extend `businessExtractor.ts` to classify site types
   - Add classification to prospect and client schemas
   - UI for manual override

2. **Enhanced Health Scoring**
   - Extend `health-score.ts` with engagement signals
   - Add GA4 data integration for engagement metrics
   - Update dashboard metrics worker

3. **Opportunity Scoring**
   - Build on existing `OpportunityDiscoveryService`
   - Add quadrant classification
   - Integrate with keyword gap analysis

### Phase 2: Automation Engine (Weeks 5-8)

1. **Task Queue System**
   - Create `optimizationTaskQueue` (BullMQ)
   - Implement dependency DAG processor
   - Add scheduling logic for low-traffic periods

2. **Early Warning System**
   - Add anomaly detection to ranking processor
   - Create warning signal schema and UI
   - Implement alert escalation rules

3. **A/B Testing Framework**
   - Schema for test variants
   - GSC data collection for CTR
   - Auto-winner implementation

### Phase 3: Portfolio Intelligence (Weeks 9-12)

1. **Resource Allocation**
   - Client weighting algorithm
   - SLA tracking schema and UI
   - Team workload balancing

2. **ROI Attribution**
   - Attribution model implementation
   - Client-facing report generation
   - Automated monthly reports

3. **Predictive Models**
   - Ranking prediction using ML
   - Content decay detection
   - Competitor activity monitoring

### Phase 4: Auto-Pilot Features (Weeks 13-16)

1. **Fully Automated Tasks**
   - Crawl error fixes
   - Sitemap updates
   - Schema validation

2. **AI-Assisted Content**
   - Content refresh recommendations
   - Title tag suggestions
   - Internal link suggestions

3. **Link Building Pipeline**
   - Opportunity identification
   - Outreach queue management
   - Response tracking

---

## 7. Competitive Differentiation

### Why Agencies Would Choose This Over:

**vs. Manual Processes:**
- 80% reduction in routine tasks
- Consistent execution across all clients
- No missed opportunities due to oversight
- 24/7 monitoring and alerting

**vs. Standalone Tools (Ahrefs, SEMrush):**
- Unified workflow, not just data
- Action-oriented, not just reporting
- Multi-client portfolio view
- Integrated task management

**vs. Enterprise Platforms (Conductor, BrightEdge):**
- 10x lower cost
- Self-hosted option
- No black-box algorithms
- Lithuanian market optimization

**vs. Other Agency Platforms (AgencyAnalytics, SEOMonitor):**
- Actual optimization, not just reporting
- AI-powered recommendations
- True automation (not just alerts)
- End-to-end prospect-to-client pipeline

### Key Value Metrics:

| Metric | Without System | With System |
|--------|---------------|-------------|
| Hours per client/month | 8-12 | 2-4 |
| Missed ranking drops | 40% | <5% |
| Content refresh coverage | 60% | 95% |
| SLA compliance | 70% | 98% |
| Client churn (annual) | 25% | 12% |
| Revenue per employee | $150K | $300K |

---

## 8. Technical Integration Points

### Existing Infrastructure Leveraged:

1. **BullMQ Workers** - Already running for audits, rankings, analytics
2. **DataForSEO Integration** - Keyword data, SERP data, competitor data
3. **Health Scoring** - `computeHealthScore()` foundation
4. **Priority Scoring** - `computePriorityScore()` foundation
5. **Alert System** - Schema and processing already built
6. **Goal Tracking** - Client goals schema ready
7. **Proposal Pipeline** - Phase 30 automation patterns

### New Components Required:

1. **Site type classifier** - New service
2. **Optimization task queue** - New BullMQ queue
3. **A/B test framework** - New schema + GSC integration
4. **Content decay detector** - New service
5. **Link opportunity finder** - New DataForSEO integration
6. **Resource allocator** - New algorithm
7. **ROI calculator** - New service

---

## Appendix A: Data Flow Diagram

```
                     +------------------+
                     |   Data Sources   |
                     +------------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
   DataForSEO            GA4/GSC           Competitor
   (rankings,            (traffic,          Analysis
    keywords)            engagement)
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                  +-------------------+
                  |  Data Aggregation |
                  |     Workers       |
                  +-------------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
  Health Score        Early Warning      Opportunity
  Calculation         Detection          Scoring
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                  +-------------------+
                  | Prioritization    |
                  |    Engine         |
                  +-------------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
   Task Queue          A/B Tests          Resource
  Generation           Queue              Allocation
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                  +-------------------+
                  |   Execution       |
                  |   (Auto/Manual)   |
                  +-------------------+
                            |
                            v
                  +-------------------+
                  |   ROI Tracking    |
                  |   & Reporting     |
                  +-------------------+
```

---

## Appendix B: Schema Extensions

```sql
-- Site classification
ALTER TABLE clients ADD COLUMN site_type TEXT;
ALTER TABLE clients ADD COLUMN site_classification JSONB;

-- Optimization tasks
CREATE TABLE optimization_tasks (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority_score INTEGER,
  estimated_impact NUMERIC,
  estimated_effort TEXT,
  dependencies TEXT[], -- Array of task IDs
  scheduled_for TIMESTAMPTZ,
  assigned_to TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B tests
CREATE TABLE ab_tests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  test_type TEXT NOT NULL,
  page_url TEXT NOT NULL,
  control_value TEXT NOT NULL,
  test_value TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  control_impressions INTEGER DEFAULT 0,
  control_clicks INTEGER DEFAULT 0,
  test_impressions INTEGER DEFAULT 0,
  test_clicks INTEGER DEFAULT 0,
  winner TEXT,
  implemented BOOLEAN DEFAULT FALSE
);

-- Link opportunities
CREATE TABLE link_opportunities (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  target_url TEXT,
  domain_authority INTEGER,
  relevance_score INTEGER,
  opportunity_score INTEGER,
  status TEXT DEFAULT 'identified',
  contact_email TEXT,
  outreach_sent_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA tracking
CREATE TABLE sla_tracking (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours_promised INTEGER,
  hours_delivered INTEGER,
  tasks_promised INTEGER,
  tasks_completed INTEGER,
  reports_due INTEGER,
  reports_delivered INTEGER,
  sla_met BOOLEAN,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROI attribution
CREATE TABLE roi_attribution (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours_invested NUMERIC,
  tasks_completed INTEGER,
  traffic_change INTEGER,
  traffic_value NUMERIC,
  roi NUMERIC,
  attribution_breakdown JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

*Document created: 2026-04-21*
*Last updated: 2026-04-21*
