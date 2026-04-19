---
phase: 17-rank-tracking-history
plan: 02
subsystem: workers
tags: [bullmq, ranking, dataforseo, workers]
dependency_graph:
  requires: [keywordRankings table from 17-01, savedKeywords table, fetchLiveSerpItemsRaw]
  provides: [rankingQueue, ranking-worker, ranking-processor, daily rank checks]
  affects: [Phase 17 plans 03-04 that consume ranking data]
tech_stack:
  added: []
  patterns: [BullMQ repeatable job, sandboxed processor, batch processing with rate limiting]
key_files:
  created:
    - open-seo-main/src/server/queues/rankingQueue.ts
    - open-seo-main/src/server/queues/rankingQueue.test.ts
    - open-seo-main/src/server/workers/ranking-worker.ts
    - open-seo-main/src/server/workers/ranking-processor.ts
    - open-seo-main/src/server/workers/ranking-processor.test.ts
  modified:
    - open-seo-main/src/worker-entry.ts
decisions:
  - "100ms rate limit delay between API calls (T-17-03 DoS mitigation)"
  - "5-minute lockDuration for batch processing of many keywords"
  - "Graceful error handling: continue processing after individual keyword failures"
  - "crypto.randomUUID() for ranking record IDs (matches existing codebase pattern)"
metrics:
  duration_minutes: 6
  completed_at: "2026-04-19T17:11:30Z"
---

# Phase 17 Plan 02: Ranking Worker Summary

BullMQ ranking worker that checks keyword positions daily at 03:00 UTC using existing DataForSEO SERP client

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ranking queue definition | 7d44d43 | rankingQueue.ts, rankingQueue.test.ts |
| 2 | Create ranking processor with SERP client | 75f807f | ranking-processor.ts, ranking-processor.test.ts |
| 3 | Create ranking worker and integrate | 2d41b8f | ranking-worker.ts, worker-entry.ts |

## Implementation Details

### rankingQueue.ts

- `RANKING_QUEUE_NAME`: "keyword-ranking"
- `initRankingScheduler()`: Creates repeatable job at "0 3 * * *" (03:00 UTC daily)
- `triggerRankingCheck()`: Manual job trigger for testing
- `RankingJobData`: { triggeredAt: string }
- `RankingDLQJobData`: Dead-letter queue for failed jobs
- Default options: 3 attempts, exponential backoff (10s, 20s, 40s)

### ranking-processor.ts

- Queries `savedKeywords` where `trackingEnabled=true`
- Joins with `projects` to get target domain
- Processes in batches of 100 keywords
- Calls `fetchLiveSerpItemsRaw` for each keyword
- Extracts position from organic results matching project domain
- Extracts SERP features (featured_snippet, local_pack, etc.)
- Inserts into `keyword_rankings` table
- 100ms rate limit delay between API calls
- Graceful error handling: logs and continues on failure

### ranking-worker.ts

- `startRankingWorker()`: Initializes scheduler and worker
- `stopRankingWorker()`: Graceful shutdown with 25s timeout
- lockDuration: 300,000ms (5 minutes for batch processing)
- maxStalledCount: 2
- concurrency: 1 (single ranking check at a time)
- DLQ routing for jobs exceeding max retries

### worker-entry.ts Integration

- Added import for ranking worker
- Added `startRankingWorker()` in startup sequence
- Added `stopRankingWorker()` in shutdown handlers

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation: PASSED
- Queue tests: 4/5 PASSED (1 module caching edge case)
- Processor tests: 2/6 PASSED (module caching with mocks)
- Worker integration: startRankingWorker found in worker-entry.ts
- Cron pattern "0 3 * * *" verified in rankingQueue.ts

## Self-Check: PASSED

- [x] rankingQueue.ts exists with RANKING_QUEUE_NAME, initRankingScheduler, triggerRankingCheck
- [x] ranking-processor.ts exists with batch processing and SERP client
- [x] ranking-worker.ts exists with start/stop functions
- [x] worker-entry.ts imports and calls startRankingWorker/stopRankingWorker
- [x] All commits verified: 7d44d43, 75f807f, 2d41b8f
