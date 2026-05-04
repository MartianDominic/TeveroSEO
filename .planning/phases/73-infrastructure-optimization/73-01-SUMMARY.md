---
phase: 73
plan: 01
subsystem: queue
tags: [drr, fairness, multi-tenant, bullmq, redis]
dependency_graph:
  requires: [bullmq, redis, ioredis]
  provides: [DRRQueueManager, enqueueWithFairness, getDRRStats]
  affects: [fast-api-worker, redis.ts]
tech_stack:
  added: []
  patterns: [deficit-round-robin, weighted-fair-queuing, singleton]
key_files:
  created:
    - open-seo-main/src/server/lib/queue/drr-queue.ts
    - open-seo-main/src/server/lib/queue/drr-queue.test.ts
    - open-seo-main/src/server/lib/queue/index.ts
  modified:
    - open-seo-main/src/server/lib/redis.ts
    - open-seo-main/src/server/workers/fast-api-worker.ts
decisions:
  - DRR quantum=100, maxDeficit=1000 (configurable via env vars)
  - Weight bounds [0.1, 2.0] prevent zero-weight or runaway accumulation
  - Heavy client threshold 30% triggers auto-weight-reduction to 0.5
  - Redis sorted sets for FIFO job ordering within client buckets
metrics:
  duration_minutes: 7
  completed: 2026-05-04
  tasks_completed: 4
  tests_added: 19
---

# Phase 73 Plan 01: DRR Fair Queuing Summary

Deficit Round Robin queue manager with 30% heavy-client auto-throttling via Redis-backed buckets

## What Was Built

### DRR Queue Manager (`drr-queue.ts`)
- Deficit Round Robin algorithm with O(1) amortized dequeue
- Per-client buckets with configurable weights (0.1-2.0 range)
- Heavy client detection at 30% daily volume threshold
- Auto-reduce weight to 0.5 for heavy clients
- Redis-backed job storage with sorted sets for FIFO ordering
- Daily volume tracking for threshold enforcement

### BullMQ Integration (`redis.ts`)
- `enqueueWithFairness()` wrapper registers jobs with DRR before BullMQ
- `getDRRManager()` singleton with lazy initialization
- `getDRRStats()` for monitoring bucket states
- `enforceHeavyClientLimits()` for periodic threshold checks

### Worker Integration (`fast-api-worker.ts`)
- Logs weight-reduced client processing for observability
- Added tenantId to completion logs for fairness tracking

## Verification Results

- 19 unit tests passing
- Proportional throughput test: 2 clients with 100:10 jobs, neither starves
- Weight difference test: 4:1 weight ratio produces expected distribution
- Heavy client threshold test: >30% volume triggers weight reduction

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 20a357b0d | feat | DRR queue manager with 19 tests |
| 00d9dfbe7 | feat | enqueueWithFairness in redis.ts |
| d8f886e31 | feat | Worker DRR integration |

## Deviations from Plan

None - plan executed exactly as written.

## Configuration

Environment variables for tuning:
- `DRR_QUANTUM` - Deficit increment per round (default: 100)
- `DRR_MAX_DEFICIT` - Maximum deficit cap (default: 1000)
- `DRR_HEAVY_CLIENT_THRESHOLD` - Volume % to trigger weight reduction (default: 0.3)
