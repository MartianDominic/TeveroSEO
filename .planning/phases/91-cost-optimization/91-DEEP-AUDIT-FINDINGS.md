# Phase 91 Deep Audit Findings

**Date:** 2026-05-06
**Method:** 10 parallel Opus subagents analyzing codebase

---

## Executive Summary

The codebase is **generally well-designed** with most API calls being on-demand. However, there are **3 major wastes** and **several minor optimizations**.

### Major Wastes (Fix Immediately)

| Waste | Current | Impact | Fix |
|-------|---------|--------|-----|
| **Daily ranking checks** | ALL tracked keywords checked daily | $100-300/mo | On-demand + weekly for active clients |
| **Dashboard metrics worker** | Every 5 minutes | 288 runs/day (no one looking) | Event-driven after data sync |
| **Alert detection + Portfolio aggregates** | Every 5 minutes each | 576 runs/day combined | Chain after metrics |

### Minor Optimizations

| Item | Current | Recommended | Savings |
|------|---------|-------------|---------|
| Classification cache TTL | 7 days | 90+ days (permanent) | 90%+ on re-classifications |
| Backlinks cache TTL | 6 hours | 24 hours | 75% fewer API calls |
| Domain overview TTL | 12 hours | 7 days | 85% fewer API calls |
| SERP research TTL | 24 hours | 7 days | 85% fewer API calls |
| GSC Bridge TTL | 1 hour | 4-6 hours | 75% fewer Redis reads |

### Well-Designed (No Change Needed)

- Voice analysis (one-time, user-triggered, permanent cache)
- Prospect analysis (on-demand only, rate-limited)
- Content generation (user-scheduled)
- Most DataForSEO calls (on-demand with proper caching)
- AI-Writer backend (all user-triggered)

---

## Detailed Findings by Area

### 1. Daily Ranking Checks — ELIMINATE/MAKE ON-DEMAND

**Location:** `open-seo-main/src/server/queues/rankingQueue.ts`

**Current behavior:**
```typescript
repeat: {
  pattern: "0 3 * * *", // 03:00 UTC daily
}
```
- Queries ALL keywords with `trackingEnabled: true`
- Makes 1 SERP API call per keyword via DataForSEO
- Cost: $0.006/keyword × 1000 keywords = $6/day = $180/month

**Problem:** Daily ranking checks for ALL keywords regardless of whether anyone looks at them.

**Fix options:**
1. **On-demand only:** Remove scheduler, add "Refresh Rankings" button
2. **Tiered frequency:** Daily for active clients (viewed in 7 days), weekly for others
3. **GSC-first:** Use free GSC data, only call DataForSEO for keywords not in GSC

**Estimated savings:** $100-300/month (depending on keyword count)

---

### 2. Dashboard Metrics Worker — MAKE EVENT-DRIVEN

**Location:** `open-seo-main/src/server/workers/dashboard-metrics-worker.ts`

**Current behavior:**
- Runs every 5 minutes
- Pre-computes health scores for ALL clients
- 288 job executions per day

**Problem:** Metrics computed constantly even when no one is viewing dashboards.

**Fix:**
```typescript
// Remove scheduled job
// Compute on-demand when dashboard opened
async function getDashboardMetrics(clientId: string) {
  const cached = await redis.get(`dashboard:${clientId}`);
  if (cached) return JSON.parse(cached);
  
  const metrics = await computeMetrics(clientId);
  await redis.setex(`dashboard:${clientId}`, 300, JSON.stringify(metrics)); // 5-min cache
  return metrics;
}
```

**Better approach:** Chain jobs after data changes:
```
analytics_sync (02:00 UTC) 
  → compute_metrics 
    → detect_alerts 
      → compute_aggregates
```

---

### 3. Alert Detection + Portfolio Aggregates — CHAIN TOGETHER

**Locations:**
- `open-seo-main/src/server/queues/alertDetectionQueue.ts` (every 5 min)
- `open-seo-main/src/server/queues/portfolioAggregatesQueue.ts` (every 5 min)

**Problem:** Both run independently every 5 minutes. Alerts depend on metrics, aggregates depend on metrics. Neither needs to run this frequently.

**Current waste:** 576 unnecessary job executions per day

**Fix:** Remove independent schedules, trigger after metrics computation completes.

---

### 4. Classification Cache — EXTEND TTL

**Location:** `open-seo-main/src/server/features/keywords/services/ClassificationSingleflight.ts`

**Current:** `resultTTL: 604800` (7 days)

**Problem:** Classification is deterministic. Same keyword + same categories = same result FOREVER. 7-day expiry causes redundant LLM calls.

**Fix:** Extend to 90-180 days or permanent with version key.

**Savings:** 90%+ reduction in re-classification costs

---

### 5. Backlinks Cache — EXTEND TTL

**Location:** `open-seo-main/src/server/features/backlinks/services/backlinksServiceData.ts`

**Current:**
```typescript
const BACKLINKS_OVERVIEW_TTL_SECONDS = 6 * 60 * 60;  // 6 hours
const BACKLINKS_TAB_TTL_SECONDS = 6 * 60 * 60;       // 6 hours
```

**Problem:** Backlinks change over weeks/months, not hours.

**Fix:**
```typescript
const BACKLINKS_OVERVIEW_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const BACKLINKS_TAB_TTL_SECONDS = 24 * 60 * 60;      // 24 hours
```

**Savings:** 75% fewer API calls

---

### 6. Domain Overview Cache — EXTEND TTL

**Location:** `open-seo-main/src/server/features/domain/services/DomainService.ts`

**Current:** `DOMAIN_OVERVIEW_TTL_SECONDS = 12 * 60 * 60` (12 hours)

**Problem:** Domain metrics change weekly/monthly, not hourly.

**Fix:** Extend to 7 days (604800 seconds)

**Savings:** 85% fewer API calls

---

### 7. Keyword Volume Cache — Already Good, Could Extend

**Current:** 7-day TTL

**Reality:** Google Ads updates monthly. Could extend to 14-30 days.

**Savings:** Minor

---

## What's Already Well-Designed

### Voice Analysis
- User-triggered only (no auto-analysis)
- Stored permanently in PostgreSQL
- `buildVoiceConstraints()` is pure function (no API call)
- No scheduled re-analysis

### Prospect Analysis
- User-triggered only (rate-limited to 10/day/workspace)
- Results frozen after analysis
- No scheduled refresh

### Content Generation (AI-Writer)
- User-scheduled or user-triggered
- No speculative pre-generation
- Research data cached appropriately

### Most DataForSEO Calls
- All on-demand with proper caching
- Rate limited (5 req/s)
- Cost tracking via Autumn

---

## Revised Gap Inventory Verdicts

Based on deep audit, here are the revised verdicts for the 31 items:

### KEEP (Actually needed)
- 6, 7: TTL extensions (easy wins)
- 11-15: Batching fixes (efficiency when calls happen)
- 16-20: Model optimizations (use appropriate models)
- 24-26: Prompt caching (free money)
- 30-31: Infrastructure (local embeddings, MGET)

### CONVERT TO ON-DEMAND (Don't cache, don't fetch automatically)
- 1-5: Caching items → just fetch when user asks
- 21: GSC-first ranking → or eliminate daily checks entirely
- 23: Tiered ranking → or eliminate daily checks entirely

### ELIMINATE (Not needed at all)
- 9: Singleflight → on-demand eliminates stampedes
- 10: SWR → show explicit freshness dates instead
- 27-29: Cache hit rate improvements → less important in on-demand model

### ALREADY IMPLEMENTED CORRECTLY
- Voice analysis caching
- Prospect analysis caching
- Most DataForSEO caching

---

## Priority Action List

### P0 — This Week (Biggest Impact)

1. **Disable daily ranking scheduler**
   - File: `rankingQueue.ts`
   - Action: Remove repeatable job, add manual trigger
   - Savings: $100-300/month

2. **Make dashboard metrics on-demand**
   - File: `dashboard-metrics-worker.ts`
   - Action: Remove schedule, compute on dashboard load
   - Savings: 288 job runs/day eliminated

3. **Chain alert + aggregates after metrics**
   - Files: `alertDetectionQueue.ts`, `portfolioAggregatesQueue.ts`
   - Action: Trigger from metrics completion, not cron
   - Savings: 576 job runs/day eliminated

### P1 — This Month

4. **Extend classification TTL to 90+ days**
   - File: `ClassificationSingleflight.ts`
   - Savings: 90%+ re-classification costs

5. **Extend backlinks TTL to 24 hours**
   - File: `backlinksServiceData.ts`
   - Savings: 75% fewer API calls

6. **Extend domain overview TTL to 7 days**
   - File: `DomainService.ts`
   - Savings: 85% fewer API calls

### P2 — Nice to Have

7. Implement prompt caching for Grok/Anthropic
8. Implement Gemini context caching
9. True batching in TranslationService (verify if fake)
10. Compress classification prompts

---

## Key Insight

**The biggest savings aren't in optimizing what we fetch — they're in NOT FETCHING things no one is looking at.**

The codebase already has good caching. The waste is in:
1. Scheduled jobs that run when no user is active
2. Pre-computing data that sits unused
3. Treating reference data (classifications, backlinks) like live data

**Philosophy shift:** From "cache longer" to "fetch only when asked."
