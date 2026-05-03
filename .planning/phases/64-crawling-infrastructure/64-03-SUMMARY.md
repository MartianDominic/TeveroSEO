---
phase: 64-crawling-infrastructure
plan: 03
subsystem: crawler
tags: [queue-lanes, bullmq, sla-isolation, fast-api, heavy-crawl]
dependency_graph:
  requires: [singleflight, delta-cascade, auditQueue, redis]
  provides: [fastApiQueue, crawlLaneRouter, fastApiWorker, routeJob, JobType]
  affects: [queue-routing, sla-enforcement, cost-reduction]
tech_stack:
  added: []
  patterns: [queue-lane-separation, tenant-scoped-singleflight, graceful-shutdown]
key_files:
  created:
    - open-seo-main/src/server/queues/fastApiQueue.ts
    - open-seo-main/src/server/queues/crawlLaneRouter.ts
    - open-seo-main/src/server/queues/crawlLaneRouter.test.ts
    - open-seo-main/src/server/workers/fast-api-worker.ts
  modified: []
decisions:
  - "Separate queues for SLA isolation (not priority-based per RESEARCH.md)"
  - "Type A to auditQueue (<15min SLA), Types B-F to fastApiQueue (<1min SLA)"
  - "Tenant-prefixed singleflight keys (T-64-01 mitigation)"
  - "High concurrency (50) for I/O-bound fast-api operations"
  - "Graceful shutdown with SIGTERM/SIGINT handlers (Pitfall 5)"
metrics:
  duration_minutes: 10
  completed: "2026-05-03T10:05:00Z"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 13
  coverage_delta: "+13 tests"
---

# Phase 64 Plan 03: Queue Lane Separation Summary

Separate BullMQ queues for SLA isolation: fast-api (<1min) for Types B/C/D/E/F, heavy-crawl (<15min) for Type A.

## What Was Built

### Fast API Queue (`fastApiQueue.ts`)

Queue definition (~78 lines):

- `FAST_API_QUEUE_NAME = "fast-api"`
- `FastApiJobData` interface with routing metadata
- 2 attempts, 1s fixed backoff
- removeOnComplete: 500, removeOnFail: 200

Key exports:
- `fastApiQueue`: BullMQ Queue instance
- `FAST_API_QUEUE_NAME`: Queue name constant
- `FastApiJobData`: Job data interface
- `FastApiJobType`: "B" | "C" | "D" | "E" | "F"

### Crawl Lane Router (`crawlLaneRouter.ts`)

Routing logic (~223 lines):

| Job Type | Name | Queue | SLA |
|----------|------|-------|-----|
| A | FULL_AUDIT | auditQueue | <15 min |
| B | COMPETITOR_SNAPSHOT | fastApiQueue | <1 min |
| C | KEYWORD_GAP | fastApiQueue | <1 min |
| D | BACKLINK_PROFILE | fastApiQueue | <1 min |
| E | CONTENT_GAP | fastApiQueue | <1 min |
| F | LOCAL_SEO | fastApiQueue | <1 min |

Key exports:
- `routeJob(type, data)`: Routes job to appropriate queue
- `determineJobType(type)`: Validates job type string
- `JobType`: Enum-like constant object
- `JobTypeValue`: Union type "A" | "B" | "C" | "D" | "E" | "F"

### Tests (`crawlLaneRouter.test.ts`)

13 tests covering:
- JobType constants (6 types defined)
- determineJobType validation (valid/invalid)
- Type A routes to auditQueue (heavy-crawl)
- Types B/C/D/E/F route to fastApiQueue
- Routing metadata (lane, enqueuedAt, jobType)
- Original job data preservation
- Invalid type rejection at runtime

### Fast API Worker (`fast-api-worker.ts`)

Worker implementation (~335 lines):

- Processes Types B/C/D/E/F with 50 concurrency
- 60-second lock duration (matches 1-min SLA)
- Integrates Singleflight (64-01) for deduplication
- Integrates deltaCascade (64-02) for Type E skip optimization
- Graceful shutdown (SIGTERM/SIGINT handlers)
- Event handlers for observability

Job processors:
- `processCompetitorSnapshot(B)`: Single URL fetch with singleflight
- `processKeywordGap(C)`: API call with singleflight
- `processBacklinkProfile(D)`: API call with singleflight
- `processContentGap(E)`: Delta cascade + singleflight
- `processLocalSEO(F)`: Location-based analysis with singleflight

## Implementation Details

### Queue Lane Architecture

```
API Request
    |
    v
+---------------------+
|  crawlLaneRouter    |
|  routeJob(type,data)|
+---------------------+
    |           |
    v           v
+--------+  +---------+
| Type A |  | Types   |
| audit  |  | B-F     |
| Queue  |  | fastApi |
+--------+  +---------+
    |           |
    v           v
+--------+  +---------+
| audit  |  | fastApi |
| worker |  | worker  |
| (5 con)|  | (50 con)|
+--------+  +---------+
```

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| T-64-07 Tampering | Job type validated before routing; unknown types rejected |
| T-64-08 DoS | Rate limiting at API layer; max queue size via BullMQ |
| T-64-09 Cross-tenant | tenantId in job data; tenant-prefixed singleflight keys |

### Integration Points

| From | To | Via |
|------|-----|-----|
| crawlLaneRouter.ts | fastApiQueue.ts | `fastApiQueue.add` |
| crawlLaneRouter.ts | auditQueue.ts | `auditQueue.add` |
| fast-api-worker.ts | singleflight.ts | `createCrawlSingleflight` |
| fast-api-worker.ts | delta-cascade.ts | `deltaCascade` |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 38ffdf782 | test | Add failing tests for crawl lane router (RED) |
| 97df104de | feat | Implement fast-api queue and crawl lane router (GREEN) |
| a6b7fa8c9 | feat | Implement fast-api worker with singleflight and delta cascade |

## Self-Check: PASSED

- [x] `open-seo-main/src/server/queues/fastApiQueue.ts` exists (78 lines)
- [x] `open-seo-main/src/server/queues/crawlLaneRouter.ts` exists (223 lines)
- [x] `open-seo-main/src/server/queues/crawlLaneRouter.test.ts` exists (178 lines)
- [x] `open-seo-main/src/server/workers/fast-api-worker.ts` exists (335 lines)
- [x] All 3 commits exist in git log
- [x] 13 tests pass
- [x] No TypeScript errors in our modules
- [x] fastApiWorker exported from worker file
