# Research 06: Content Priority Queue System

> **Phase:** 99 - Unified SEO Content Pipeline  
> **Status:** Research Complete  
> **Created:** 2026-05-11  
> **Focus:** Opportunity scoring algorithms, quick win detection, schedule optimization, queue visualization (v6 compliant)

---

## Executive Summary

The Content Priority Queue System determines **what content to create next** and **when to publish it**. It combines keyword opportunity scoring, quick win detection, client priorities, and intelligent scheduling into a unified queue that feeds the content generation pipeline.

---

## 1. Opportunity Scoring Algorithms

### 1.1 Composite Score Formula

Based on the keyword intelligence architecture, the composite score combines multiple signals:

```typescript
interface OpportunityScore {
  keyword: string;
  compositeScore: number;      // 0-100 final priority
  components: {
    volumeScore: number;       // 0-1 weighted by log(volume)
    difficultyScore: number;   // 0-1 inverted (lower KD = higher score)
    intentScore: number;       // 0-1 based on commercial value
    priorityBoost: number;     // 1.0-2.0 from client priorities
    quickWinBonus: number;     // 0-0.3 bonus for striking distance
    freshnessPenalty: number;  // 0-0.2 penalty for recently published
  };
  tier: 'must_do' | 'should_do' | 'nice_to_have' | 'ignore';
}

function calculateCompositeScore(keyword: EnrichedKeyword, context: ScoringContext): number {
  // Volume score (log scale, normalized)
  const volumeScore = Math.min(1, Math.log10(keyword.searchVolume + 1) / 4);
  
  // Difficulty score (inverted, easier = better)
  const difficultyScore = 1 - (keyword.keywordDifficulty / 100);
  
  // Intent multiplier (BOFU > MOFU > TOFU)
  const intentMultiplier = {
    bofu: 2.0,
    mofu: 1.5,
    tofu: 1.0,
  }[keyword.funnelStage] ?? 1.0;
  
  // CPC commercial signal
  const cpcScore = Math.min(1, keyword.cpc / 5);
  
  // Priority boost from client priorities
  const priorityBoost = context.clientPriorities
    .find(p => p.categoryId === keyword.primaryCategoryId)?.weightModifier ?? 1.0;
  
  // Quick win bonus (positions 11-30)
  const quickWinBonus = isQuickWin(keyword) ? 0.3 : 0;
  
  // Freshness penalty (avoid republishing same topic)
  const freshnessPenalty = context.recentlyPublished
    .some(p => p.targetKeyword === keyword.keyword) ? 0.2 : 0;
  
  // Weighted combination
  const raw = (
    volumeScore * 0.25 +
    difficultyScore * 0.20 +
    cpcScore * 0.15 +
    (intentMultiplier / 2) * 0.20 +
    quickWinBonus +
    (priorityBoost - 1) * 0.20
  ) - freshnessPenalty;
  
  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}
```

### 1.2 Tier Assignment

```typescript
function assignTier(score: number, context: TierContext): Tier {
  // Dynamic thresholds based on keyword distribution
  const thresholds = calculateDynamicThresholds(context.allScores);
  
  if (score >= thresholds.mustDo) return 'must_do';      // Top 10%
  if (score >= thresholds.shouldDo) return 'should_do';  // Top 30%
  if (score >= thresholds.niceTo) return 'nice_to_have'; // Top 60%
  return 'ignore';
}

// Default thresholds (adjusted per client)
const DEFAULT_THRESHOLDS = {
  mustDo: 75,      // Score >= 75
  shouldDo: 50,    // Score >= 50
  niceTo: 25,      // Score >= 25
};
```

### 1.3 Category-Level Aggregation

For content calendar planning, aggregate keyword scores to category level:

```typescript
interface CategoryOpportunity {
  categoryId: string;
  categoryName: string;
  totalVolume: number;
  avgDifficulty: number;
  keywordCount: number;
  topKeywords: EnrichedKeyword[];
  aggregateScore: number;
  recommendedContentPieces: number;  // How many articles needed
  estimatedTrafficPotential: number;
}

function aggregateCategoryOpportunity(keywords: EnrichedKeyword[]): CategoryOpportunity {
  const totalVolume = sum(keywords.map(k => k.searchVolume));
  const avgDifficulty = avg(keywords.map(k => k.keywordDifficulty));
  
  // Cluster keywords to estimate content pieces needed
  const clusters = clusterByIntent(keywords);
  
  return {
    categoryId: keywords[0].primaryCategoryId,
    categoryName: keywords[0].categoryName,
    totalVolume,
    avgDifficulty,
    keywordCount: keywords.length,
    topKeywords: keywords.slice(0, 10),
    aggregateScore: avg(keywords.map(k => k.compositeScore)),
    recommendedContentPieces: clusters.length,
    estimatedTrafficPotential: estimateTraffic(keywords, avgDifficulty),
  };
}
```

---

## 2. Quick Win Detection

### 2.1 Quick Win Criteria

Keywords in "striking distance" that can reach page 1 with minimal effort:

```typescript
interface QuickWinCriteria {
  // Position-based
  currentPosition: { min: 11, max: 30 };  // Page 2-3
  
  // Effort indicators
  maxDifficulty: 40;                       // KD <= 40
  minVolume: 100;                          // Worth the effort
  
  // Content gap indicators
  hasExistingPage: boolean;                // Already ranking
  pageNeedsUpdate: boolean;                // Content older than 6 months
  
  // SERP opportunity
  serpFeatures: string[];                  // Featured snippet available
}

function detectQuickWins(keywords: EnrichedKeyword[]): QuickWin[] {
  return keywords
    .filter(kw => 
      kw.currentPosition >= 11 &&
      kw.currentPosition <= 30 &&
      kw.keywordDifficulty <= 40 &&
      kw.searchVolume >= 100
    )
    .map(kw => ({
      keyword: kw.keyword,
      currentPosition: kw.currentPosition,
      targetPosition: Math.min(10, kw.currentPosition - 5),
      difficulty: kw.keywordDifficulty,
      volume: kw.searchVolume,
      action: determineQuickWinAction(kw),
      estimatedEffort: estimateEffort(kw),
      estimatedImpact: estimateImpact(kw),
    }))
    .sort((a, b) => b.estimatedImpact - a.estimatedImpact);
}

function determineQuickWinAction(kw: EnrichedKeyword): QuickWinAction {
  if (!kw.currentUrl) return 'create_content';
  if (kw.pageAge > 180) return 'refresh_content';  // 6 months
  if (kw.wordCount < 1500) return 'expand_content';
  if (kw.missingInternalLinks) return 'add_internal_links';
  return 'optimize_on_page';
}
```

### 2.2 Quick Win Effort/Impact Matrix

```
                    LOW EFFORT                    HIGH EFFORT
              +-------------------+-------------------+
              |                   |                   |
   HIGH      |   QUICK WINS      |   STRATEGIC       |
   IMPACT    |   (Do First)      |   (Plan Ahead)    |
              |   Pos 11-20       |   Pos 21-30       |
              |   KD < 30         |   KD 30-50        |
              +-------------------+-------------------+
              |                   |                   |
   LOW       |   MAINTENANCE     |   DEPRIORITIZE    |
   IMPACT    |   (Batch Later)   |   (Skip)          |
              |   Vol < 200       |   Vol < 100       |
              |                   |   KD > 50         |
              +-------------------+-------------------+
```

### 2.3 Quick Win Scoring

```typescript
interface QuickWinScore {
  keyword: string;
  effortScore: number;    // 1-10 (lower = easier)
  impactScore: number;    // 1-10 (higher = better)
  priorityScore: number;  // impact / effort ratio
}

function scoreQuickWin(kw: QuickWin): QuickWinScore {
  // Effort factors
  const positionEffort = (kw.currentPosition - 10) / 20;  // 0-1
  const difficultyEffort = kw.difficulty / 100;
  const actionEffort = {
    'add_internal_links': 0.2,
    'optimize_on_page': 0.4,
    'refresh_content': 0.6,
    'expand_content': 0.7,
    'create_content': 1.0,
  }[kw.action];
  
  const effortScore = (positionEffort + difficultyEffort + actionEffort) / 3 * 10;
  
  // Impact factors
  const volumeImpact = Math.log10(kw.volume) / 4;
  const positionGain = (kw.currentPosition - kw.targetPosition) / 20;
  const impactScore = (volumeImpact + positionGain) / 2 * 10;
  
  return {
    keyword: kw.keyword,
    effortScore: Math.round(effortScore * 10) / 10,
    impactScore: Math.round(impactScore * 10) / 10,
    priorityScore: impactScore / Math.max(1, effortScore),
  };
}
```

---

## 3. Schedule Optimization

### 3.1 Publishing Cadence Algorithm

```typescript
interface PublishingSchedule {
  clientId: string;
  weeklyTarget: number;           // Articles per week
  optimalDays: DayOfWeek[];       // Best days to publish
  optimalHours: number[];         // Best hours (24h format)
  bufferDays: number;             // Days between same-category posts
}

function optimizeSchedule(
  queue: QueueItem[],
  constraints: ScheduleConstraints
): ScheduledItem[] {
  const scheduled: ScheduledItem[] = [];
  const categoryLastPublished = new Map<string, Date>();
  
  // Sort queue by priority
  const sortedQueue = queue.sort((a, b) => b.priorityScore - a.priorityScore);
  
  let currentSlot = getNextPublishSlot(constraints);
  
  for (const item of sortedQueue) {
    // Check category buffer
    const lastPublished = categoryLastPublished.get(item.categoryId);
    if (lastPublished && daysBetween(lastPublished, currentSlot) < constraints.bufferDays) {
      // Push to next available slot
      currentSlot = addDays(currentSlot, constraints.bufferDays);
    }
    
    // Check funnel stage distribution (avoid all BOFU in one week)
    if (shouldBalanceFunnel(scheduled, item, constraints)) {
      currentSlot = findBalancedSlot(scheduled, item, currentSlot);
    }
    
    scheduled.push({
      ...item,
      scheduledDate: currentSlot,
      scheduledTime: getOptimalTime(constraints.optimalHours),
    });
    
    categoryLastPublished.set(item.categoryId, currentSlot);
    currentSlot = getNextPublishSlot(constraints, currentSlot);
  }
  
  return scheduled;
}
```

### 3.2 Funnel Stage Distribution

Balance content across funnel stages per week:

```typescript
interface FunnelDistribution {
  bofu: number;   // 30% - Decision stage
  mofu: number;   // 40% - Consideration stage  
  tofu: number;   // 30% - Awareness stage
}

const OPTIMAL_WEEKLY_DISTRIBUTION: FunnelDistribution = {
  bofu: 0.30,
  mofu: 0.40,
  tofu: 0.30,
};

function balanceFunnelDistribution(
  scheduled: ScheduledItem[],
  weekStart: Date
): ScheduledItem[] {
  const weekItems = scheduled.filter(s => 
    isWithinWeek(s.scheduledDate, weekStart)
  );
  
  const currentDistribution = {
    bofu: weekItems.filter(i => i.funnelStage === 'bofu').length,
    mofu: weekItems.filter(i => i.funnelStage === 'mofu').length,
    tofu: weekItems.filter(i => i.funnelStage === 'tofu').length,
  };
  
  // Reorder if distribution is skewed
  return reorderForBalance(weekItems, OPTIMAL_WEEKLY_DISTRIBUTION);
}
```

### 3.3 Seasonality Adjustment

```typescript
function adjustForSeasonality(
  item: QueueItem,
  publishDate: Date
): number {
  // Check if keyword has seasonal pattern
  if (!item.seasonalityData) return 1.0;
  
  const month = publishDate.getMonth();
  const seasonalIndex = item.seasonalityData[month];
  const avgIndex = avg(item.seasonalityData);
  
  // Boost if publishing during peak season
  if (seasonalIndex > avgIndex * 1.3) {
    return 1.2;  // 20% boost
  }
  
  // Penalize if publishing during low season
  if (seasonalIndex < avgIndex * 0.7) {
    return 0.8;  // 20% penalty
  }
  
  return 1.0;
}
```

---

## 4. Queue Visualization (v6 Design System Compliant)

### 4.1 Priority Queue Card (Editorial Moment)

Following v6 design system - one editorial moment per page:

```
+------------------------------------------------------------------+
|  CONTENT QUEUE                                    [+ Add] [...]  |
|  ----------------------------------------------------------------|
|                                                                   |
|       12 / 20                              ON TRACK               |
|       articles                             ETA Jul 18             |
|                                            13 days ahead          |
|                                                                   |
|  [===============================.........] 60%                   |
|                                                                   |
|  60% to goal  |  8 to publish  |  +3 last 7d  |  +12 last 30d    |
+------------------------------------------------------------------+
```

**Key v6 Elements:**
- Newsreader serif for "12 / 20" (--num-mega)
- Ghost-edge shadows on card
- Status pill "ON TRACK" with success-soft background
- Progress bar with target marker

### 4.2 Queue Table (Hover-to-Reveal)

```
+------------------------------------------------------------------+
|  KEYWORD            | VOL  | KD | STAGE | SCORE | STATUS    | -> |
|------------------------------------------------------------------+
|  veido serumai      | 2.4K | 32 | BOFU  |  87   | Scheduled |    |
|    <- sparkline ->                        Jul 15             |    |
|------------------------------------------------------------------+
|  kaip pasirinkti... | 890  | 28 | TOFU  |  72   | Draft     |    |
|    <- sparkline ->                        Jul 18             |    |
|------------------------------------------------------------------+
|  geriausi sampunai  | 1.2K | 45 | MOFU  |  68   | Queued    |    |
|    <- sparkline ->                        Jul 22             |    |
+------------------------------------------------------------------+
```

**v6 Patterns:**
- Hover-to-reveal sparklines and arrows
- Status as pills (accent-soft for scheduled, warning-soft for draft)
- Tabular-nums for all data columns
- Priority indicator: 2px accent left bar for must_do items

### 4.3 Calendar View (Monthly Grid)

```
+------------------------------------------------------------------+
|  JULY 2026                                    [< Prev] [Next >]  |
|------------------------------------------------------------------+
|  Mon    Tue    Wed    Thu    Fri    Sat    Sun                   |
|------------------------------------------------------------------+
|         1      2      3      4      5      6                     |
|               [B]    [M]                                         |
|                                                                   |
|   7      8      9     10     11     12     13                    |
|  [T]    [B]           [M]                                        |
|                                                                   |
|  14     15     16     17     18     19     20                    |
|  [M]    [B]    [T]                                               |
+------------------------------------------------------------------+

Legend: [B] BOFU  [M] MOFU  [T] TOFU
```

**v6 Patterns:**
- Semantic color coding (accent for BOFU, info for MOFU, text-3 for TOFU)
- Card lifts on hover with shadow expansion
- Container queries for responsive calendar

### 4.4 Pipeline Stages Strip

Following v6 pipeline pattern with volume bars:

```
+------------------------------------------------------------------+
|  PIPELINE                                                         |
|------------------------------------------------------------------+
|                                                                   |
|  QUEUED        DRAFTING       REVIEW        SCHEDULED    PUBLISHED|
|    24             8             3              5            12    |
|  [====]        [===]          [=]           [==]         [====]  |
|                                                                   |
+------------------------------------------------------------------+
```

**v6 Elements:**
- Small-caps labels (12px, 0.1em tracking)
- Newsreader numerals (--num-row)
- 3px relative volume bars under counts
- Active stage with accent fill

### 4.5 Quick Wins Dashboard Card

```
+------------------------------------------------------------------+
|  QUICK WINS                                   [View All ->]      |
|------------------------------------------------------------------+
|                                                                   |
|    8                                                              |
|  opportunities                                                    |
|  in striking distance                                             |
|                                                                   |
|  +--------------------------------------------------------------+|
|  | # | Keyword               | Pos | Target | Effort | Impact   ||
|  |---|----------------------|-----|--------|--------|----------|  |
|  | 1 | veido serumai        | 12  |   7    | LOW    | HIGH     ||
|  | 2 | organinis sampunas   | 15  |  10    | LOW    | MED      ||
|  | 3 | plauku kaukes        | 18  |  10    | MED    | HIGH     ||
|  +--------------------------------------------------------------+|
|                                                                   |
|  [Optimize All] [Export]                                          |
+------------------------------------------------------------------+
```

**v6 Elements:**
- Effort/impact pills with semantic colors
- Position as Newsreader numerals
- Ghost-edge shadow on inner table
- Primary CTA with gradient + glow

---

## 5. Data Model

### 5.1 Queue Item Schema

```typescript
export const contentQueue = pgTable('content_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  
  // Target keyword/topic
  keywordId: uuid('keyword_id').references(() => keywords.id),
  topicClusterId: uuid('topic_cluster_id'),
  
  // Scoring
  priorityScore: integer('priority_score').notNull(),
  tier: text('tier').$type<'must_do' | 'should_do' | 'nice_to_have'>(),
  isQuickWin: boolean('is_quick_win').default(false),
  
  // Classification
  funnelStage: text('funnel_stage').$type<'bofu' | 'mofu' | 'tofu'>(),
  contentType: text('content_type').$type<'blog' | 'landing' | 'product' | 'comparison'>(),
  
  // Scheduling
  scheduledDate: timestamp('scheduled_date'),
  scheduledTime: text('scheduled_time'),  // HH:MM
  publishedAt: timestamp('published_at'),
  
  // Status
  status: text('status').$type<'queued' | 'drafting' | 'review' | 'scheduled' | 'published'>().default('queued'),
  
  // Effort tracking
  estimatedEffort: text('estimated_effort').$type<'low' | 'medium' | 'high'>(),
  estimatedImpact: text('estimated_impact').$type<'low' | 'medium' | 'high'>(),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 5.2 Queue Operations

```typescript
interface QueueService {
  // Core operations
  addToQueue(item: QueueItemInput): Promise<QueueItem>;
  removeFromQueue(id: string): Promise<void>;
  updatePriority(id: string, score: number): Promise<void>;
  
  // Scheduling
  scheduleItem(id: string, date: Date, time: string): Promise<void>;
  reschedule(id: string, newDate: Date): Promise<void>;
  autoSchedule(items: QueueItem[]): Promise<ScheduledItem[]>;
  
  // Status transitions
  moveToStatus(id: string, status: QueueStatus): Promise<void>;
  
  // Queries
  getQueue(clientId: string, filters: QueueFilters): Promise<QueueItem[]>;
  getQuickWins(clientId: string): Promise<QuickWin[]>;
  getSchedule(clientId: string, dateRange: DateRange): Promise<ScheduledItem[]>;
  
  // Analytics
  getQueueMetrics(clientId: string): Promise<QueueMetrics>;
  getFunnelDistribution(clientId: string): Promise<FunnelDistribution>;
}
```

---

## 6. Implementation Gaps

### 6.1 What Exists (from keyword intelligence)
- Composite score calculation
- Tier assignment
- Category-keyword mapping
- Funnel stage classification
- Client priority system

### 6.2 What Needs Building
1. **Queue Table + Service** - content_queue schema and CRUD operations
2. **Schedule Optimizer** - Cadence algorithm, funnel balancing
3. **Quick Win Detector** - Position-based filtering, effort/impact scoring
4. **Calendar UI** - Monthly view, drag-drop scheduling
5. **Pipeline Visualization** - Stage strip with volume bars
6. **Queue Dashboard** - Editorial moment card, metrics

### 6.3 Integration Points
- Keyword Intelligence System (scoring input)
- Content Generation Pipeline (queue consumer)
- GSC Integration (position tracking for quick wins)
- Publishing Automation (scheduled item execution)

---

## 7. Cost Considerations

| Component | Cost Driver | Estimated Cost |
|-----------|-------------|----------------|
| Score calculation | CPU only | $0 |
| Quick win detection | GSC API + CPU | ~$0.001/check |
| Schedule optimization | CPU only | $0 |
| Queue storage | PostgreSQL | Negligible |
| Real-time updates | WebSocket/Redis | ~$5/mo |

**Total incremental cost:** ~$5-10/month for queue system

---

## Summary

The Content Priority Queue System is the bridge between keyword intelligence and content execution:

1. **Opportunity Scoring** - Composite score from volume, difficulty, intent, client priority
2. **Quick Win Detection** - Striking distance keywords (pos 11-30, KD < 40)
3. **Schedule Optimization** - Balanced funnel distribution, category buffers, seasonality
4. **v6 Visualization** - Editorial moment hero, hover-to-reveal tables, pipeline strips

The system feeds the content generation pipeline with prioritized, scheduled items while maintaining the design system's calm-at-rest, hover-to-reveal aesthetic.
