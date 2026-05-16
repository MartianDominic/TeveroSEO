# Phase 102-04 Summary: Analytics Pipeline and Heatmap Visualization

**Phase:** 102-advanced-document-builder  
**Plan:** 04  
**Status:** Complete  
**Date:** 2026-05-16

## What Was Built

### Task 1: Analytics Service with Redis Counters

**File:** `apps/web/src/lib/document-builder/analytics-service.ts`

Implemented Redis counter operations and correlation tracking per D-04:

- `recordBlockView(blockId, variantId?)` - Increments Redis counter with atomic INCR
- `recordBlockDwell(blockId, variantId, dwellMs)` - Tracks cumulative dwell time with INCRBY
- `getBlockAnalytics(blockId, variantId?)` - Returns impressions, conversions, dwell stats
- `calculateCorrelation(blockId, variantId?)` - Returns -1 to 1 correlation with confidence score
- `markConversion(blockId, variantId, outcome)` - Tracks won/lost outcomes
- `processBatchedEvents(sessionId, events)` - Batch processing with Redis pipeline

Redis key patterns per D-04:
- `block:{blockId}:views` - total views
- `block:{blockId}:variant:{variantId}:views` - variant views
- `block:{blockId}:dwell` - cumulative dwell time
- `block:{blockId}:views:ts` - time-series sorted set

**Tests:** 17 passing (`__tests__/analytics-service.test.ts`)

### Task 2: Heatmap Calculator and Overlay Component

**File:** `apps/web/src/lib/document-builder/heatmap-calculator.ts`

Implemented engagement scoring per UI-SPEC:

- `calculateEngagementScore(views, dwell, totalViews, maxDwell)` - 40% view rate, 60% dwell
- `getHeatLevel(score)` - Returns cold/cool/warm/hot/very_hot per thresholds
- `getHeatColor(level)` - RGBA colors per UI-SPEC (gray/amber/orange/red gradient)
- `getHeatLabel(level)` - Human-readable labels ("Skipped by most viewers", "High engagement")
- `calculateHeatmapData(blocks)` - Normalizes scores across blocks
- `getHeatGradient(level)` - CSS linear-gradient for overlay

**File:** `apps/web/src/components/document-builder/HeatmapOverlay.tsx`

React component per UI-SPEC:
- Positioned absolute overlay on PersuasionBlock
- `pointer-events: none` for click-through
- `opacity transition: 280ms` per design system
- Heat level badges with score indicators
- `BlockAnalyticsDisplay` component for detailed stats panel

**Tests:** 18 passing (`__tests__/heatmap-calculator.test.ts`)

### Task 3: Analytics API Route and Sync Worker

**File:** `apps/web/src/app/api/document-builder/analytics/route.ts`

POST endpoint for batched analytics events:
- Accepts `{ sessionId: string, events: BlockInteraction[] }`
- Rate limit: 100 events/minute/session via Redis
- Fire-and-forget pattern (returns 202 Accepted immediately)
- Zod schema validation for event payloads

**File:** `open-seo-main/src/server/workers/analytics-sync-worker.ts`

BullMQ worker syncing Redis to Postgres every 5 minutes per D-04:
- Scans Redis keys matching `block:*:views`
- Uses GETSET for atomic read-and-reset
- Updates `persuasion_blocks.view_count` and `block_variants.impressions`
- Syncs dwell time and conversion counters
- Logs sync stats (blocks updated, impressions synced)

Exported via `open-seo-main/src/server/workers/index.ts`.

## Verification Results

All acceptance criteria pass:

| Criterion | Status |
|-----------|--------|
| `redis.incr/incrby` in analytics-service | PASS |
| `block:*:views` key pattern | PASS |
| `calculateCorrelation` exported | PASS |
| `recordBlockView` exported | PASS |
| `calculateEngagementScore` in heatmap-calculator | PASS |
| Heat levels (cold/cool/warm/hot/very_hot) | PASS |
| `pointer-events: none` in HeatmapOverlay | PASS |
| POST handler in analytics route | PASS |
| BullMQ Worker in sync worker | PASS |
| GETSET for atomic counters | PASS |
| 5-minute sync interval | PASS |

## Test Results

```
Test Files  2 passed
Tests       35 passed (17 analytics-service + 18 heatmap-calculator)
```

## Files Created

1. `apps/web/src/lib/document-builder/analytics-service.ts` (268 lines)
2. `apps/web/src/lib/document-builder/heatmap-calculator.ts` (146 lines)
3. `apps/web/src/components/document-builder/HeatmapOverlay.tsx` (232 lines)
4. `apps/web/src/app/api/document-builder/analytics/route.ts` (116 lines)
5. `open-seo-main/src/server/workers/analytics-sync-worker.ts` (294 lines)
6. `apps/web/src/lib/document-builder/__tests__/analytics-service.test.ts` (178 lines)
7. `apps/web/src/lib/document-builder/__tests__/heatmap-calculator.test.ts` (125 lines)

## Files Modified

1. `open-seo-main/src/server/workers/index.ts` - Added analyticsSyncWorker export

## Requirements Addressed

- **REQ-04:** Section heatmaps show engagement per block
- **REQ-05:** Block-to-close correlation is tracked and displayed

## Dependencies

- Redis for real-time counters
- BullMQ for repeatable sync job
- Postgres for persistent analytics (persuasion_blocks, block_variants tables from 102-01)

## Next Steps

- Wire HeatmapOverlay into PersuasionBlock component
- Add "Show Engagement" toggle to Document Builder toolbar
- Schedule analytics sync worker on application startup
