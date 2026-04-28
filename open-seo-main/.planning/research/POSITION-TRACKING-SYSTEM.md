# Position Tracking System Design

**Domain:** SEO Rank Monitoring, GSC Integration, Alerting
**Researched:** 2026-04-22
**Overall Confidence:** HIGH - based on existing codebase patterns and GSC API constraints

---

## Executive Summary

Design an optimal position tracking system that:
1. Tracks rank positions for approved keywords per client
2. Provides historical position data for trend analysis
3. Alerts clients on significant rank drops
4. Identifies "striking distance" keywords for optimization

---

## 1. Data Storage Strategy

### 1.1 What Data to Store

**Recommendation: Filtered to approved keywords only, NOT full GSC dump**

| Approach | Pros | Cons |
|----------|------|------|
| Full GSC dump | Complete data, discover new opportunities | 10-50x storage, slow queries, expensive syncs |
| Approved keywords only | Fast queries, predictable costs, focused alerts | Miss emerging keywords |
| **Hybrid (recommended)** | Best of both - focused tracking + opportunity discovery | Slightly more complexity |

**Hybrid approach details:**
- **Primary storage**: Daily positions for approved keywords (high fidelity)
- **Secondary storage**: Top 50 queries per day from GSC (already implemented in `gscQuerySnapshots`)
- **Discovery layer**: Compare GSC top queries against approved list to surface suggestions

### 1.2 Position Snapshots vs Deltas

**Recommendation: Store snapshots, NOT deltas**

Rationale:
- Deltas require complete history to reconstruct current state (fragile)
- Snapshots enable direct queries: "What was position on date X?"
- Storage overhead is minimal (one integer per keyword per day)
- Existing `keywordRankings` table already uses snapshot pattern

### 1.3 Historical Depth

| Use Case | Required Depth | Storage Impact |
|----------|---------------|----------------|
| Weekly trends | 7 days | Minimal |
| Monthly trends | 30 days | Low |
| Seasonal analysis | 90 days | Moderate |
| YoY comparison | 365 days | High |

**Recommendation: 90 days active, 365 days cold storage**

- Active (hot): Last 90 days in PostgreSQL for fast queries
- Cold archive: 90-365 days in compressed JSONB or R2 for occasional access
- Purge: Beyond 365 days, aggregate to weekly averages

---

## 2. Sync Strategy

### 2.1 GSC Data Lag Handling

GSC has a 2-3 day data lag. The existing `gsc-client.ts` already handles this:

```typescript
// From src/server/services/analytics/gsc-client.ts
export function getGSCDateRange(mode: "incremental" | "backfill") {
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 3); // Account for lag
  // ...
}
```

### 2.2 Optimal Fetch Frequency

| Frequency | Pros | Cons | Recommendation |
|-----------|------|------|----------------|
| Hourly | Fastest detection | GSC lag makes it pointless | No |
| 4x daily | Good for real-time SERP | DataForSEO costs add up | Maybe (for VIP) |
| **Daily** | Aligns with GSC rhythm | Slight delay | **Yes (default)** |
| Weekly | Low cost | Too slow for alerts | No |

**Recommended schedule:**
- GSC sync: Once daily at 04:00 UTC (after GSC data finalizes)
- DataForSEO SERP: Once daily at 06:00 UTC (for real-time position)
- Comparison: Merge GSC clicks/impressions with DataForSEO position

### 2.3 Fetch All Keywords vs Approved Set

**Recommendation: Fetch approved set only from DataForSEO, all from GSC**

Rationale:
- DataForSEO charges per query - only fetch approved keywords
- GSC is free (API quota) - fetch top queries for discovery
- Compare GSC queries against approved list to suggest additions

### 2.4 New Keyword Discovery Flow

```
GSC Top 50 Queries → Filter (not in approved) → Rank by clicks → Surface as "Suggested Keywords"
                                                                         ↓
                                              Client clicks "Track" → Add to approved list
```

**Implementation:**
```sql
-- Find GSC queries not in approved keywords
SELECT DISTINCT gqs.query, gqs.clicks, gqs.impressions, gqs.position
FROM gsc_query_snapshots gqs
WHERE gqs.client_id = $1
  AND gqs.date >= NOW() - INTERVAL '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM client_approved_keywords cak
    WHERE cak.client_id = $1 AND cak.keyword = gqs.query
  )
ORDER BY gqs.clicks DESC
LIMIT 20;
```

---

## 3. Alerting System

### 3.1 Position Drop Thresholds

The existing system uses a simple threshold (default 5). More sophisticated approach:

| Position Range | Significant Drop | Critical Drop |
|---------------|------------------|---------------|
| 1-3 (Top 3) | 2+ positions | 5+ positions |
| 4-10 (Page 1) | 5+ positions | 10+ positions |
| 11-20 (Page 2) | 7+ positions | 15+ positions |
| 21-50 | 10+ positions | 20+ positions |
| 50+ | 15+ positions | Not relevant |

**Formula for dynamic threshold:**
```typescript
function getDropThreshold(previousPosition: number): { warning: number; critical: number } {
  if (previousPosition <= 3) return { warning: 2, critical: 5 };
  if (previousPosition <= 10) return { warning: 5, critical: 10 };
  if (previousPosition <= 20) return { warning: 7, critical: 15 };
  if (previousPosition <= 50) return { warning: 10, critical: 20 };
  return { warning: 15, critical: 30 };
}
```

### 3.2 Avoiding False Positives

**Problem**: Daily SERP fluctuations cause noise (1-3 position swings are normal).

**Solution: Rolling Average Comparison**

Instead of comparing today vs yesterday:
```typescript
// BAD: High noise
const drop = todayPosition - yesterdayPosition;

// GOOD: Compare 3-day rolling averages
const avg3DayOld = (day7 + day6 + day5) / 3;
const avg3DayNew = (day2 + day1 + today) / 3;
const drop = avg3DayNew - avg3DayOld;
```

**Implementation:**
```sql
-- 3-day rolling average comparison
WITH recent_positions AS (
  SELECT 
    keyword_id,
    date,
    position,
    AVG(position) OVER (
      PARTITION BY keyword_id 
      ORDER BY date 
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as rolling_avg
  FROM keyword_rankings
  WHERE date >= NOW() - INTERVAL '10 days'
)
SELECT 
  keyword_id,
  MAX(CASE WHEN date = NOW()::date - 5 THEN rolling_avg END) as old_avg,
  MAX(CASE WHEN date = NOW()::date THEN rolling_avg END) as new_avg,
  MAX(CASE WHEN date = NOW()::date THEN rolling_avg END) - 
  MAX(CASE WHEN date = NOW()::date - 5 THEN rolling_avg END) as avg_change
FROM recent_positions
GROUP BY keyword_id
HAVING MAX(CASE WHEN date = NOW()::date THEN rolling_avg END) - 
       MAX(CASE WHEN date = NOW()::date - 5 THEN rolling_avg END) > 5;
```

### 3.3 Alert Deduplication

Prevent alert fatigue:
- Same keyword: Max 1 alert per 7 days
- Same client: Max 10 alerts per day
- Batch alerts: Group multiple drops into single notification

---

## 4. Database Schema

### 4.1 Approved Keywords Table (New)

```sql
CREATE TABLE client_approved_keywords (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  target_url TEXT,                    -- Expected landing page
  target_position INTEGER,            -- Goal position (e.g., 3)
  priority TEXT DEFAULT 'medium',     -- 'high', 'medium', 'low'
  location_code INTEGER DEFAULT 2840, -- DataForSEO location
  language_code TEXT DEFAULT 'en',
  
  -- Alert configuration (overrides client defaults)
  alert_on_drop BOOLEAN DEFAULT TRUE,
  drop_threshold INTEGER,             -- NULL = use dynamic threshold
  
  -- Discovery tracking
  source TEXT DEFAULT 'manual',       -- 'manual', 'gsc_suggestion', 'competitor_gap'
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, keyword, location_code)
);

CREATE INDEX ix_cak_client_keyword ON client_approved_keywords(client_id, keyword);
CREATE INDEX ix_cak_client_priority ON client_approved_keywords(client_id, priority);
```

### 4.2 Position History Table (Enhanced)

Extend existing `keywordRankings` for client-level tracking:

```sql
-- Option A: Extend existing table (add client_id)
ALTER TABLE keyword_rankings ADD COLUMN client_id TEXT;
CREATE INDEX ix_kr_client_date ON keyword_rankings(client_id, date);

-- Option B: New table for client position tracking (recommended - separation of concerns)
CREATE TABLE client_keyword_positions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  approved_keyword_id TEXT NOT NULL REFERENCES client_approved_keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Position data
  position INTEGER NOT NULL,           -- 1-100, 0 = not ranking
  previous_position INTEGER,
  ranking_url TEXT,                    -- Which URL ranked
  
  -- GSC metrics (merged from GSC sync)
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0,
  
  -- SERP features
  serp_features JSONB,                 -- ["featured_snippet", "local_pack", etc.]
  
  -- Rolling averages (precomputed)
  avg_3_day REAL,
  avg_7_day REAL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(approved_keyword_id, date)
);

-- Indexes for efficient queries
CREATE INDEX ix_ckp_client_date ON client_keyword_positions(client_id, date);
CREATE INDEX ix_ckp_keyword_date ON client_keyword_positions(approved_keyword_id, date DESC);
CREATE INDEX ix_ckp_position_range ON client_keyword_positions(client_id, position) WHERE position BETWEEN 5 AND 20;
```

### 4.3 Position Alerts Table (Enhanced)

```sql
CREATE TABLE position_alerts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  approved_keyword_id TEXT NOT NULL REFERENCES client_approved_keywords(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type TEXT NOT NULL,            -- 'drop', 'recovery', 'new_ranking', 'lost_ranking'
  severity TEXT NOT NULL,              -- 'info', 'warning', 'critical'
  
  -- Position change
  old_position INTEGER NOT NULL,
  new_position INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,      -- Positive = dropped, Negative = improved
  
  -- Context
  old_avg_3_day REAL,
  new_avg_3_day REAL,
  
  -- Processing
  status TEXT DEFAULT 'pending',       -- 'pending', 'sent', 'acknowledged', 'resolved'
  notified_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Deduplication
  UNIQUE(approved_keyword_id, alert_type, DATE(created_at))
);

CREATE INDEX ix_pa_client_status ON position_alerts(client_id, status);
CREATE INDEX ix_pa_created ON position_alerts(created_at);
```

### 4.4 Weekly/Monthly Aggregates Table

```sql
CREATE TABLE position_aggregates (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  approved_keyword_id TEXT NOT NULL,
  
  period_type TEXT NOT NULL,           -- 'week', 'month'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Aggregated metrics
  avg_position REAL NOT NULL,
  min_position INTEGER NOT NULL,       -- Best ranking
  max_position INTEGER NOT NULL,       -- Worst ranking
  position_variance REAL,
  
  total_clicks INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  avg_ctr REAL DEFAULT 0,
  
  days_in_top_3 INTEGER DEFAULT 0,
  days_in_top_10 INTEGER DEFAULT 0,
  days_in_top_20 INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(approved_keyword_id, period_type, period_start)
);

CREATE INDEX ix_pa_client_period ON position_aggregates(client_id, period_type, period_start);
```

---

## 5. Striking Distance Detection

### 5.1 Definition

"Striking distance" keywords: Keywords ranking positions 5-20 that have potential to move into top 3 with optimization effort.

### 5.2 Scoring Model

**Striking Distance Score = Opportunity * Feasibility * Impact**

```typescript
interface StrikingDistanceScore {
  keyword: string;
  position: number;
  score: number;           // 0-100
  opportunity: number;     // How close to top 3
  feasibility: number;     // How stable/trending
  impact: number;          // Search volume * CTR potential
}

function calculateStrikingScore(
  position: number,
  searchVolume: number,
  positionHistory: number[],  // Last 30 days
): StrikingDistanceScore {
  // Opportunity: Closer to top 3 = higher score
  // Position 5 = 100, Position 20 = 0
  const opportunity = Math.max(0, (20 - position) / 15 * 100);
  
  // Feasibility: Stable or improving trend
  const trend = calculateTrend(positionHistory);
  const stability = calculateStability(positionHistory);
  const feasibility = (trend >= 0 ? 70 : 30) + (stability * 30);
  
  // Impact: Volume * CTR gain potential
  // Moving from position 10 to 3 = ~20% CTR gain
  const currentCTR = estimateCTR(position);
  const potentialCTR = estimateCTR(3);
  const ctrGain = potentialCTR - currentCTR;
  const impact = Math.min(100, (searchVolume * ctrGain) / 10);
  
  return {
    keyword,
    position,
    score: (opportunity * 0.3 + feasibility * 0.3 + impact * 0.4),
    opportunity,
    feasibility,
    impact,
  };
}

// Estimated CTR by position (industry averages)
function estimateCTR(position: number): number {
  const ctrByPosition: Record<number, number> = {
    1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.07,
    6: 0.05, 7: 0.04, 8: 0.03, 9: 0.03, 10: 0.025,
  };
  return ctrByPosition[position] ?? 0.02;
}
```

### 5.3 Striking Distance Query

```sql
-- Find striking distance keywords
WITH recent_positions AS (
  SELECT 
    ckp.approved_keyword_id,
    cak.keyword,
    cak.target_position,
    ckp.position,
    ckp.clicks,
    ckp.impressions,
    AVG(ckp.position) OVER (
      PARTITION BY ckp.approved_keyword_id 
      ORDER BY ckp.date 
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as avg_7_day,
    -- Trend: compare first 7 days vs last 7 days
    LAG(ckp.position, 7) OVER (
      PARTITION BY ckp.approved_keyword_id 
      ORDER BY ckp.date
    ) as position_7_days_ago
  FROM client_keyword_positions ckp
  JOIN client_approved_keywords cak ON cak.id = ckp.approved_keyword_id
  WHERE ckp.client_id = $1
    AND ckp.date >= NOW() - INTERVAL '14 days'
)
SELECT 
  keyword,
  position as current_position,
  avg_7_day,
  position_7_days_ago,
  (position_7_days_ago - position) as improvement,  -- Positive = getting better
  clicks,
  impressions,
  -- Simple opportunity score
  CASE 
    WHEN position BETWEEN 5 AND 10 THEN 90 - (position - 5) * 10
    WHEN position BETWEEN 11 AND 15 THEN 50 - (position - 11) * 5
    WHEN position BETWEEN 16 AND 20 THEN 30 - (position - 16) * 5
    ELSE 0
  END as opportunity_score
FROM recent_positions
WHERE position BETWEEN 5 AND 20
  AND date = (SELECT MAX(date) FROM client_keyword_positions WHERE client_id = $1)
ORDER BY opportunity_score DESC, position ASC
LIMIT 20;
```

### 5.4 Auto-Prioritization Rules

```typescript
interface StrikingDistanceRule {
  name: string;
  condition: (kw: KeywordData) => boolean;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

const rules: StrikingDistanceRule[] = [
  {
    name: 'Almost there',
    condition: (kw) => kw.position >= 4 && kw.position <= 6 && kw.trend >= 0,
    priority: 'high',
    action: 'Content refresh + internal linking boost',
  },
  {
    name: 'High volume opportunity',
    condition: (kw) => kw.position >= 7 && kw.position <= 15 && kw.volume > 1000,
    priority: 'high',
    action: 'Full content optimization + backlink outreach',
  },
  {
    name: 'Improving trend',
    condition: (kw) => kw.position >= 10 && kw.position <= 20 && kw.trendImprovement > 3,
    priority: 'medium',
    action: 'Continue current strategy, monitor closely',
  },
  {
    name: 'Stable mid-range',
    condition: (kw) => kw.position >= 11 && kw.position <= 20 && kw.variance < 2,
    priority: 'medium',
    action: 'On-page optimization + competitor analysis',
  },
];
```

---

## 6. Worker Architecture

### 6.1 Position Sync Worker

```typescript
// src/server/workers/position-sync-processor.ts

interface PositionSyncJobData {
  clientId: string;
  triggeredAt: string;
  mode: 'scheduled' | 'manual';
}

export default async function processor(job: Job<PositionSyncJobData>): Promise<void> {
  const { clientId } = job.data;
  
  // Step 1: Get approved keywords for client
  const keywords = await db
    .select()
    .from(clientApprovedKeywords)
    .where(eq(clientApprovedKeywords.clientId, clientId));
  
  if (keywords.length === 0) {
    log.info('No approved keywords', { clientId });
    return;
  }
  
  // Step 2: Fetch positions from DataForSEO (batch API)
  const positions = await fetchBatchPositions(
    keywords.map(k => ({
      keyword: k.keyword,
      locationCode: k.locationCode,
      languageCode: k.languageCode,
    }))
  );
  
  // Step 3: Get yesterday's positions for comparison
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const previousPositions = await db
    .select()
    .from(clientKeywordPositions)
    .where(
      and(
        eq(clientKeywordPositions.clientId, clientId),
        eq(clientKeywordPositions.date, yesterday)
      )
    );
  
  const prevPosMap = new Map(previousPositions.map(p => [p.approvedKeywordId, p]));
  
  // Step 4: Insert today's positions
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const positionRecords = [];
  const alertCandidates = [];
  
  for (const kw of keywords) {
    const pos = positions.get(kw.keyword);
    const prevPos = prevPosMap.get(kw.id);
    
    const record = {
      id: crypto.randomUUID(),
      clientId,
      approvedKeywordId: kw.id,
      date: today,
      position: pos?.position ?? 0,
      previousPosition: prevPos?.position ?? null,
      rankingUrl: pos?.url ?? null,
      serpFeatures: pos?.serpFeatures ?? [],
    };
    
    positionRecords.push(record);
    
    // Check for significant change
    if (prevPos && record.position > 0 && prevPos.position > 0) {
      const drop = record.position - prevPos.position;
      const threshold = kw.dropThreshold ?? getDropThreshold(prevPos.position).warning;
      
      if (drop >= threshold) {
        alertCandidates.push({
          keyword: kw,
          oldPosition: prevPos.position,
          newPosition: record.position,
          drop,
        });
      }
    }
  }
  
  // Step 5: Batch insert positions
  await db.insert(clientKeywordPositions).values(positionRecords);
  
  // Step 6: Create alerts (with deduplication)
  for (const candidate of alertCandidates) {
    await createPositionAlert(candidate);
  }
  
  // Step 7: Update rolling averages
  await updateRollingAverages(clientId, today);
  
  log.info('Position sync completed', {
    clientId,
    keywordsProcessed: keywords.length,
    alertsCreated: alertCandidates.length,
  });
}
```

### 6.2 Alert Processing Worker

```typescript
// src/server/workers/position-alert-processor.ts

export default async function processor(job: Job<AlertJobData>): Promise<void> {
  const pendingAlerts = await db
    .select()
    .from(positionAlerts)
    .where(eq(positionAlerts.status, 'pending'))
    .limit(100);
  
  // Group by client for batch notification
  const alertsByClient = groupBy(pendingAlerts, 'clientId');
  
  for (const [clientId, alerts] of Object.entries(alertsByClient)) {
    // Get client preferences
    const client = await getClientWithAlertPrefs(clientId);
    
    if (!client.emailNotifications) continue;
    
    // Batch alerts into single email
    await sendAlertDigest(client, alerts);
    
    // Mark as sent
    await db
      .update(positionAlerts)
      .set({ status: 'sent', notifiedAt: new Date() })
      .where(inArray(positionAlerts.id, alerts.map(a => a.id)));
  }
}
```

### 6.3 Aggregation Worker (Weekly)

```typescript
// src/server/workers/position-aggregation-processor.ts

export default async function processor(job: Job): Promise<void> {
  const lastWeek = getLastWeekRange();
  
  // Generate weekly aggregates for all clients
  await db.execute(sql`
    INSERT INTO position_aggregates (
      id, client_id, approved_keyword_id,
      period_type, period_start, period_end,
      avg_position, min_position, max_position, position_variance,
      total_clicks, total_impressions, avg_ctr,
      days_in_top_3, days_in_top_10, days_in_top_20
    )
    SELECT 
      gen_random_uuid(),
      client_id,
      approved_keyword_id,
      'week',
      ${lastWeek.start},
      ${lastWeek.end},
      AVG(position),
      MIN(position),
      MAX(position),
      VARIANCE(position),
      SUM(clicks),
      SUM(impressions),
      AVG(ctr),
      COUNT(*) FILTER (WHERE position <= 3),
      COUNT(*) FILTER (WHERE position <= 10),
      COUNT(*) FILTER (WHERE position <= 20)
    FROM client_keyword_positions
    WHERE date >= ${lastWeek.start} AND date <= ${lastWeek.end}
    GROUP BY client_id, approved_keyword_id
    ON CONFLICT (approved_keyword_id, period_type, period_start) DO UPDATE SET
      avg_position = EXCLUDED.avg_position,
      min_position = EXCLUDED.min_position,
      max_position = EXCLUDED.max_position,
      position_variance = EXCLUDED.position_variance,
      total_clicks = EXCLUDED.total_clicks,
      total_impressions = EXCLUDED.total_impressions,
      avg_ctr = EXCLUDED.avg_ctr,
      days_in_top_3 = EXCLUDED.days_in_top_3,
      days_in_top_10 = EXCLUDED.days_in_top_10,
      days_in_top_20 = EXCLUDED.days_in_top_20
  `);
}
```

---

## 7. API Endpoints

### 7.1 Position History

```typescript
// GET /api/clients/:clientId/keywords/:keywordId/positions
interface PositionHistoryResponse {
  keyword: string;
  currentPosition: number;
  change7Day: number;
  change30Day: number;
  history: Array<{
    date: string;
    position: number;
    clicks: number;
    impressions: number;
  }>;
  aggregates: {
    weekly: Array<{ week: string; avgPosition: number }>;
    monthly: Array<{ month: string; avgPosition: number }>;
  };
}
```

### 7.2 Striking Distance

```typescript
// GET /api/clients/:clientId/striking-distance
interface StrikingDistanceResponse {
  keywords: Array<{
    keyword: string;
    position: number;
    trend: 'improving' | 'stable' | 'declining';
    score: number;
    searchVolume: number;
    difficulty: number;
    recommendation: string;
  }>;
  summary: {
    totalStrikingDistance: number;
    potentialTrafficGain: number;
    topOpportunity: string;
  };
}
```

### 7.3 Position Alerts

```typescript
// GET /api/clients/:clientId/alerts?type=position
interface PositionAlertsResponse {
  alerts: Array<{
    id: string;
    keyword: string;
    type: 'drop' | 'recovery' | 'new' | 'lost';
    severity: 'info' | 'warning' | 'critical';
    oldPosition: number;
    newPosition: number;
    change: number;
    createdAt: string;
    status: 'pending' | 'sent' | 'acknowledged';
  }>;
  unacknowledgedCount: number;
}
```

---

## 8. Query Performance Optimization

### 8.1 Materialized Views

For expensive dashboard queries, use materialized views refreshed daily:

```sql
-- Client dashboard summary
CREATE MATERIALIZED VIEW client_position_summary AS
SELECT 
  client_id,
  COUNT(DISTINCT approved_keyword_id) as total_keywords,
  COUNT(*) FILTER (WHERE position <= 3) as in_top_3,
  COUNT(*) FILTER (WHERE position <= 10) as in_top_10,
  COUNT(*) FILTER (WHERE position BETWEEN 5 AND 20) as striking_distance,
  AVG(position) as avg_position,
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions
FROM client_keyword_positions
WHERE date = CURRENT_DATE - 1  -- Yesterday (most recent complete day)
GROUP BY client_id;

CREATE UNIQUE INDEX ON client_position_summary(client_id);

-- Refresh daily after position sync
REFRESH MATERIALIZED VIEW CONCURRENTLY client_position_summary;
```

### 8.2 Partitioning Strategy

For high-volume deployments, partition by date:

```sql
CREATE TABLE client_keyword_positions (
  -- columns...
) PARTITION BY RANGE (date);

-- Create partitions per month
CREATE TABLE client_keyword_positions_2026_04 
  PARTITION OF client_keyword_positions
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

### 8.3 Index Strategy

```sql
-- Covering index for position history queries
CREATE INDEX ix_ckp_history_covering ON client_keyword_positions 
  (approved_keyword_id, date DESC) 
  INCLUDE (position, clicks, impressions, ctr);

-- BRIN index for date-range scans (efficient for time-series)
CREATE INDEX ix_ckp_date_brin ON client_keyword_positions USING BRIN (date);
```

---

## 9. Cost Analysis

### 9.1 DataForSEO Costs

| Keyword Count | Daily Cost | Monthly Cost |
|--------------|-----------|--------------|
| 50 | $0.75 | $22.50 |
| 200 | $3.00 | $90.00 |
| 500 | $7.50 | $225.00 |

*Based on $0.015 per SERP check*

### 9.2 Storage Estimates

| Clients | Keywords/Client | Daily Rows | Monthly Storage |
|---------|----------------|------------|-----------------|
| 10 | 100 | 1,000 | ~5 MB |
| 50 | 200 | 10,000 | ~50 MB |
| 200 | 500 | 100,000 | ~500 MB |

### 9.3 Optimization Recommendations

1. **Batch SERP requests**: DataForSEO supports batch endpoint (up to 100 keywords)
2. **Cache SERP features**: SERP features rarely change daily - cache in Redis
3. **Skip unchanged positions**: If position unchanged for 3+ days, reduce check frequency
4. **Prioritize by value**: Check high-priority keywords more frequently

---

## 10. Implementation Phases

### Phase 1: Core Schema (Week 1)
- [ ] Create `client_approved_keywords` table
- [ ] Create `client_keyword_positions` table
- [ ] Create `position_alerts` table
- [ ] Migration script

### Phase 2: Position Sync (Week 2)
- [ ] Position sync worker with DataForSEO batch API
- [ ] GSC merge for clicks/impressions
- [ ] Rolling average computation

### Phase 3: Alerting (Week 3)
- [ ] Alert detection with dynamic thresholds
- [ ] Deduplication logic
- [ ] Email notification integration

### Phase 4: Striking Distance (Week 4)
- [ ] Scoring algorithm implementation
- [ ] Striking distance API endpoint
- [ ] Dashboard UI component

### Phase 5: Reporting (Week 5)
- [ ] Weekly/monthly aggregation worker
- [ ] Position history API
- [ ] Export functionality

---

## Sources

- Existing codebase: `src/db/ranking-schema.ts`, `src/db/analytics-schema.ts`
- GSC API documentation: https://developers.google.com/webmaster-tools/search-console-api-original
- DataForSEO SERP API: https://docs.dataforseo.com/v3/serp/live/regular/
- Industry CTR studies: https://www.advancedwebranking.com/ctrstudy/
- PostgreSQL partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
