---
phase: 26
plan: 03
subsystem: prospects
tags: [bullmq, queue, worker, rate-limiting, dataforseo]
dependency_graph:
  requires:
    - 26-01 (prospect schema and ProspectService)
  provides:
    - prospectAnalysisQueue BullMQ definition
    - AnalysisService for triggering analyses
    - prospect-analysis-processor for DataForSEO calls
    - prospect-analysis-worker for job processing
  affects:
    - future prospect analysis UI
    - worker-entry.ts startup
tech_stack:
  added:
    - prospectAnalysisQueue.ts
    - AnalysisService.ts
    - prospect-analysis-processor.ts
    - prospect-analysis-worker.ts
  patterns:
    - BullMQ sandboxed worker pattern
    - Rate limiting with 100ms delay between API calls
    - Dead-letter queue for failed jobs
    - Workspace-scoped daily rate limits
key_files:
  created:
    - open-seo-main/src/server/queues/prospectAnalysisQueue.ts
    - open-seo-main/src/server/queues/prospectAnalysisQueue.test.ts
    - open-seo-main/src/server/features/prospects/services/AnalysisService.ts
    - open-seo-main/src/server/features/prospects/services/AnalysisService.test.ts
    - open-seo-main/src/server/workers/prospect-analysis-processor.ts
    - open-seo-main/src/server/workers/prospect-analysis-worker.ts
  modified:
    - open-seo-main/src/worker-entry.ts
decisions:
  - Rate limit 10 analyses per day per workspace (MAX_ANALYSES_PER_DAY)
  - 100ms API_RATE_LIMIT_MS between DataForSEO calls to respect rate limits
  - Analysis limits vary by type quick_scan (50 keywords, 10 competitors), deep_dive (200, 20), opportunity_discovery (500, 30)
  - 5-minute lock duration for analysis jobs (allows time for multiple API calls)
  - Concurrency 2 for parallel analyses
  - Job ID format prospect-{prospectId}-{timestamp} for deduplication
metrics:
  duration: 245s
  tasks_completed: 4
  tasks_total: 4
  files_created: 6
  files_modified: 1
  completed_at: "2026-04-20T21:32:12Z"
---

# Phase 26 Plan 03: BullMQ Queue and Worker Summary

BullMQ queue and worker for prospect analysis with rate limiting and cost tracking

## What Was Built

Created the job processing infrastructure for prospect analysis, enabling async DataForSEO analysis with proper rate limits, cost tracking, and graceful error handling.

### Queue Definition (prospectAnalysisQueue.ts)

- `PROSPECT_ANALYSIS_QUEUE_NAME = "prospect-analysis"`
- `ProspectAnalysisJobData` interface: prospectId, workspaceId, analysisType, analysisId, targetRegion, targetLanguage, triggeredAt, triggeredBy
- `ProspectAnalysisDLQJobData` for dead-letter queue entries
- `submitProspectAnalysis()` creates jobs with unique ID pattern
- `getWorkspaceAnalysisCountToday()` counts completed/active/waiting jobs for rate limiting
- Default job options: 3 attempts with exponential backoff (10s, 20s, 40s)

### AnalysisService (AnalysisService.ts)

| Method | Purpose |
|--------|---------|
| `triggerAnalysis()` | Create analysis record, submit BullMQ job, enforce rate limit |
| `markRunning()` | Update status to running |
| `updateAnalysisResult()` | Store results, update prospect status to analyzed |
| `markFailed()` | Mark failed, revert prospect status |
| `findById()` | Get analysis by ID |
| `getRemainingAnalysesToday()` | Calculate remaining quota |

**Rate limiting:** Enforces max 10 analyses per day per workspace before job submission.

**LOCATION_CODES export:** Common DataForSEO region codes (US: 2840, UK: 2826, DE: 2276, etc.)

### Processor (prospect-analysis-processor.ts)

Sandboxed processor for BullMQ worker:

1. Mark analysis as running
2. Fetch domain rank overview (DataForSEO Labs API)
3. Fetch keywords for site (with limit based on analysis type)
4. Fetch competitor domains
5. Store results with total cost tracking
6. Handle errors with proper status updates

**API rate limiting:** 100ms sleep between DataForSEO calls to respect API rate limits.

**Analysis type limits:**
- quick_scan: 50 keywords, 10 competitors
- deep_dive: 200 keywords, 20 competitors
- opportunity_discovery: 500 keywords, 30 competitors

### Worker (prospect-analysis-worker.ts)

BullMQ worker configuration:
- lockDuration: 300_000 (5 minutes - analysis takes time)
- maxStalledCount: 2
- concurrency: 2 (max 2 parallel analyses)
- Graceful shutdown with 25s timeout
- Dead-letter queue for jobs that exceed max retries

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `b8b3f29` | feat | Create prospect analysis BullMQ queue definition |
| `056f0f1` | feat | Create AnalysisService with rate limiting |
| `16eda3a` | feat | Create sandboxed prospect analysis processor |
| `5d9da65` | feat | Create prospect analysis worker and wire to startup |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Compliance

All threat mitigations from the plan were implemented:

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-26-10 | Rate limit 10/day per workspace | Enforced in AnalysisService.triggerAnalysis() before job submission |
| T-26-11 | 100ms rate limit, concurrency 2 | API_RATE_LIMIT_MS = 100 in processor, concurrency: 2 in worker |
| T-26-12 | Job events logged | All job lifecycle events logged with jobId, prospectId, timestamps |
| T-26-13 | DLQ keeps errors server-side | Error details in ProspectAnalysisDLQJobData, not exposed to client |
| T-26-14 | Job data validated | workspaceId verified in triggerAnalysis before creating analysis record |

## Success Criteria Verification

- [x] Queue definition exports ProspectAnalysisJobData interface
- [x] Queue has 3 attempts with exponential backoff
- [x] AnalysisService.triggerAnalysis checks rate limit before submitting
- [x] Rate limit is 10 analyses per day per workspace
- [x] Processor calls DataForSEO APIs with 100ms delay between calls
- [x] Processor tracks total cost in cents
- [x] Processor updates analysis status (running, completed, failed)
- [x] Worker handles DLQ on max retries
- [x] Worker started in worker-entry.ts
- [x] TypeScript compiles without errors

## Self-Check: PASSED

**Files verified:**
- FOUND: open-seo-main/src/server/queues/prospectAnalysisQueue.ts
- FOUND: open-seo-main/src/server/queues/prospectAnalysisQueue.test.ts
- FOUND: open-seo-main/src/server/features/prospects/services/AnalysisService.ts
- FOUND: open-seo-main/src/server/features/prospects/services/AnalysisService.test.ts
- FOUND: open-seo-main/src/server/workers/prospect-analysis-processor.ts
- FOUND: open-seo-main/src/server/workers/prospect-analysis-worker.ts

**Commits verified:**
- FOUND: b8b3f29
- FOUND: 056f0f1
- FOUND: 16eda3a
- FOUND: 5d9da65
