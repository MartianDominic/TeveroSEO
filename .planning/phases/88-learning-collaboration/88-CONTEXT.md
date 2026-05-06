# Phase 88: Learning & Collaboration — Context

> **Created:** 2026-05-05
> **Status:** Planning Complete, Ready for Execution
> **Total Effort:** 2-3 days
> **Dependencies:** Phase 87 (Client Portal), Phase 89 (Keyword Lock-in)
> **Spec Document:** [CLIENT-PORTAL-SPEC.md](../CLIENT-PORTAL-SPEC.md)

---

## Executive Summary

Phase 88 creates an internal learning loop that makes keyword recommendations smarter over time by tracking outcomes.

**Key Question Answered:** "What score threshold predicts top 10 ranking?"

This is **internal infrastructure** — clients don't see it. It powers better recommendations silently.

---

## Key Decisions (Locked)

### 1. Outcome-Based Learning (Not A/B Testing)

We track real-world outcomes:
- Keyword selected → content published → did it rank?
- Aggregate success rates by score threshold, funnel stage, industry

**Rationale:** Real outcomes are the ultimate ground truth. No synthetic metrics.

### 2. Privacy-First Cross-Client Analysis

| Analysis Type | Permitted | Example |
|---------------|-----------|---------|
| Aggregate success rates | Yes | "BOFU keywords rank 67% of the time in e-commerce" |
| Individual client data | Never | Never expose "Client X's keyword Y" to others |
| Industry benchmarks | Yes | "Beauty industry: 45 days average to rank" |

**Rationale:** Clients never see each other's data, but all benefit from collective learnings.

### 3. Simple Success Criteria

```typescript
success = (rankingAt90Days !== null && rankingAt90Days <= 10)
```

**Rationale:** Top 10 within 90 days is universally understood as "working."

---

## Sub-Phase Overview

| Sub-phase | Focus | Effort | Key Deliverable |
|-----------|-------|--------|-----------------|
| **88-01** | Outcome Tracking Schema | 0.5 day | `keyword_outcomes` table |
| **88-02** | GSC Position Ingestion | 0.5 day | Worker to pull 30/90 day positions |
| **88-03** | Learning Queries | 1 day | Score threshold analysis, funnel analysis |
| **88-04** | Benchmark Aggregation | 0.5 day | Industry vertical success rates |
| **88-05** | Recommendation Enhancement | 0.5 day | Feed learnings into scoring weights |

---

## Architecture

### Outcome Tracking Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OUTCOME TRACKING PIPELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. SELECTION EVENT                                                 │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Agency selects keyword for client                               ││
│  │ → Record: keywordId, clientId, selectedScore, selectedFunnel   ││
│  │ → Timestamp: selectedAt                                         ││
│  └────────────────────────────────────────────────────────────────┘│
│                                 │                                   │
│                                 ▼                                   │
│  2. PUBLICATION EVENT                                               │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Content published for keyword                                   ││
│  │ → Record: publishedAt                                           ││
│  │ → Start tracking window                                         ││
│  └────────────────────────────────────────────────────────────────┘│
│                                 │                                   │
│                                 ▼                                   │
│  3. POSITION TRACKING (GSC)                                         │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Worker runs daily:                                              ││
│  │ → 30 days post-publish: record rankingAt30Days                 ││
│  │ → 90 days post-publish: record rankingAt90Days, trafficAt90Days││
│  │ → Set success flag: rankingAt90Days <= 10                      ││
│  └────────────────────────────────────────────────────────────────┘│
│                                 │                                   │
│                                 ▼                                   │
│  4. LEARNING AGGREGATION                                            │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Weekly job aggregates:                                          ││
│  │ → Success rate by score threshold                               ││
│  │ → Success rate by funnel stage                                  ││
│  │ → Success rate by industry                                      ││
│  │ → Average time to rank                                          ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Keyword Outcomes

```sql
CREATE TABLE keyword_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id),
  
  -- Selection data (captured at selection time)
  selected_at TIMESTAMPTZ NOT NULL,
  selected_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
  selected_funnel TEXT NOT NULL, -- BOFU, MOFU, TOFU
  selected_difficulty INTEGER,
  selected_volume INTEGER,
  
  -- Publication data
  published_at TIMESTAMPTZ,
  content_id UUID, -- reference to published content
  
  -- Outcome data (tracked over time)
  ranking_at_30_days INTEGER, -- position 1-100, NULL if not ranking
  ranking_at_90_days INTEGER,
  traffic_at_90_days INTEGER, -- clicks from GSC
  
  -- Success flag (computed)
  success BOOLEAN, -- ranked top 10 within 90 days
  first_top_10_at TIMESTAMPTZ, -- when it first hit top 10
  
  -- Metadata
  industry TEXT, -- for cross-client analysis
  geo TEXT, -- for geo analysis
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX keyword_outcomes_client_id_idx ON keyword_outcomes(client_id);
CREATE INDEX keyword_outcomes_selected_at_idx ON keyword_outcomes(selected_at);
CREATE INDEX keyword_outcomes_success_idx ON keyword_outcomes(success) WHERE success IS NOT NULL;
CREATE INDEX keyword_outcomes_industry_idx ON keyword_outcomes(industry);
```

### Learning Aggregates

```sql
CREATE TABLE learning_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL, -- score_threshold, funnel_stage, industry
  aggregate_key TEXT NOT NULL, -- e.g., "0.85", "BOFU", "beauty"
  
  -- Metrics
  total_keywords INTEGER NOT NULL,
  successful_keywords INTEGER NOT NULL,
  success_rate DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
  avg_days_to_rank DECIMAL(6,2), -- average days to first top 10
  
  -- Time window
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT learning_aggregates_type_key_window UNIQUE (aggregate_type, aggregate_key, window_start)
);

CREATE INDEX learning_aggregates_type_idx ON learning_aggregates(aggregate_type);
```

---

## Learning Queries

### Score Threshold Analysis

```sql
-- What score threshold predicts top 10 ranking?
SELECT 
  FLOOR(selected_score * 10) / 10 AS score_bucket, -- 0.8, 0.9, etc.
  COUNT(*) AS total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful,
  ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 1) AS success_rate
FROM keyword_outcomes
WHERE 
  selected_at >= NOW() - INTERVAL '180 days'
  AND success IS NOT NULL
GROUP BY FLOOR(selected_score * 10)
ORDER BY score_bucket;
```

**Expected output:**
| score_bucket | total | successful | success_rate |
|--------------|-------|------------|--------------|
| 0.6 | 245 | 98 | 40.0% |
| 0.7 | 312 | 156 | 50.0% |
| 0.8 | 428 | 299 | 69.9% |
| 0.9 | 189 | 162 | 85.7% |

### Funnel Stage Analysis

```sql
-- Which funnel stages perform best?
SELECT 
  selected_funnel,
  industry,
  COUNT(*) AS total,
  ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 1) AS success_rate,
  ROUND(AVG(EXTRACT(EPOCH FROM (first_top_10_at - published_at)) / 86400), 1) AS avg_days_to_rank
FROM keyword_outcomes
WHERE 
  success IS NOT NULL
  AND published_at IS NOT NULL
GROUP BY selected_funnel, industry
ORDER BY industry, selected_funnel;
```

### Time to Rank Distribution

```sql
-- P50, P75, P90 time to rank
SELECT 
  industry,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_top_10_at - published_at)) / 86400) AS p50_days,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_top_10_at - published_at)) / 86400) AS p75_days,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_top_10_at - published_at)) / 86400) AS p90_days
FROM keyword_outcomes
WHERE 
  first_top_10_at IS NOT NULL
GROUP BY industry;
```

---

## Worker Implementation

### Position Tracking Worker

```typescript
// Runs daily at 3 AM UTC
const TRACKING_WINDOWS = [30, 90]; // days after publish

async function trackKeywordOutcomes() {
  // Find outcomes needing updates
  const outcomes = await db.query(`
    SELECT ko.*, c.gsc_site_url
    FROM keyword_outcomes ko
    JOIN clients c ON ko.client_id = c.id
    WHERE 
      ko.published_at IS NOT NULL
      AND ko.success IS NULL
      AND ko.published_at <= NOW() - INTERVAL '30 days'
  `);
  
  for (const outcome of outcomes) {
    const daysSincePublish = daysDiff(outcome.published_at, new Date());
    
    // Get current position from GSC
    const position = await getGSCPosition(
      outcome.gsc_site_url,
      outcome.keyword_text
    );
    
    // Update appropriate window
    if (daysSincePublish >= 30 && !outcome.ranking_at_30_days) {
      await updateOutcome(outcome.id, { ranking_at_30_days: position });
    }
    
    if (daysSincePublish >= 90) {
      const traffic = await getGSCTraffic(outcome.gsc_site_url, outcome.keyword_text);
      await updateOutcome(outcome.id, {
        ranking_at_90_days: position,
        traffic_at_90_days: traffic,
        success: position !== null && position <= 10,
        first_top_10_at: position <= 10 ? outcome.first_top_10_at || new Date() : null
      });
    }
  }
}
```

---

## Success Criteria

1. Outcome schema captures selection + publication + ranking data
2. GSC worker updates positions at 30/90 day windows
3. Learning queries return actionable insights
4. Aggregation job runs weekly without errors
5. No individual client data exposed in cross-client analysis
6. Learnings feed into scoring weight adjustments

---

## Business Impact

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| **Recommendation accuracy** | ~60% | 75-80% | +25-33% |
| **Refund rate** | 15% | 5% | -67% |
| **Score threshold confidence** | Guessed | Data-driven | Eliminates guesswork |

---

## References

- [CLIENT-PORTAL-SPEC.md](../CLIENT-PORTAL-SPEC.md) — Parent specification
- [PHASE-85-89-DEEP-DIVE.md](../PHASE-85-89-DEEP-DIVE.md) — Technical deep-dive
- `open-seo-main/src/server/features/keywords/filtering/scoring.ts` — Current scoring

---

*Context document completed: 2026-05-05*
