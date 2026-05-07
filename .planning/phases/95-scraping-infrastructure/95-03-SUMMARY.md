# Phase 95 Plan 03: Queue & Rate Limiting Summary

---
phase: 95
plan: 03
subsystem: scraping
tags: [queue, rate-limiting, bullmq, redis, concurrency]
dependency_graph:
  requires: [95-01]
  provides: [queue-management, rate-limiting, concurrency-control]
  affects: [95-02, 95-04, 95-05]
tech_stack:
  added: []
  patterns: [sliding-window, distributed-semaphore, adaptive-backoff]
key_files:
  created:
    - open-seo-main/src/server/features/scraping/ratelimit/RateLimiter.ts
    - open-seo-main/src/server/features/scraping/ratelimit/AdaptiveBackoff.ts
    - open-seo-main/src/server/features/scraping/ratelimit/GlobalConcurrencyLimiter.ts
    - open-seo-main/src/server/features/scraping/queue/queue.types.ts
    - open-seo-main/src/server/features/scraping/queue/retry.config.ts
    - open-seo-main/src/server/features/scraping/queue/PriorityAssigner.ts
    - open-seo-main/src/server/features/scraping/queue/QueueManager.ts
    - open-seo-main/src/server/features/scraping/queue/QueueOrchestrator.ts
    - open-seo-main/src/server/features/scraping/workers/ScrapeWorker.ts
    - open-seo-main/src/server/features/scraping/monitoring/QueueMonitor.ts
    - open-seo-main/src/server/features/scraping/monitoring/BlockedDomainTracker.ts
    - open-seo-main/src/server/features/scraping/monitoring/ProcessingRateTracker.ts
    - open-seo-main/src/server/features/scraping/monitoring/alerts.config.ts
  modified:
    - open-seo-main/src/server/features/scraping/index.ts
decisions:
  - Used Lua script for atomic sliding window rate limiting to prevent race conditions
  - Domain normalization groups subdomains to prevent rate limit circumvention
  - Three-queue architecture (priority, standard, background) for SLA differentiation
  - Distributed semaphore using Redis sorted sets with stale entry cleanup
  - Adaptive backoff doubles multiplier on failure (max 16x), halves on success
metrics:
  duration: ~45 minutes
  completed: 2026-05-07T15:54:00Z
---

## One-liner

Polite scraping infrastructure with Redis sliding window rate limiting (2 req/sec), distributed semaphore (200 concurrent), and BullMQ priority queues with adaptive backoff.

## What Was Built

### 1. Rate Limiting Infrastructure (ratelimit/)

**RateLimiter.ts** - Per-domain rate limiting using Redis sliding window:
- Lua script for atomic check-and-insert operations
- Domain normalization handles compound TLDs (co.uk, com.au, etc.)
- Configurable requests per window (default: 2 req/sec)
- Blocking acquire with configurable max wait time

**AdaptiveBackoff.ts** - Exponential backoff for 429/503 errors:
- Multiplier doubles on failure (1x -> 2x -> 4x -> 8x -> 16x max)
- Multiplier halves on success (gradual recovery)
- Different base durations: 60s for 429, 30s for 503, 15s for other
- Redis-backed state with TTL-based cleanup

**GlobalConcurrencyLimiter.ts** - Distributed semaphore:
- 200 max concurrent requests (configurable)
- Redis sorted set with timestamp scores
- Stale entry cleanup (5 minute threshold)
- Race condition protection via verify-after-add pattern
- `withSlot()` helper for automatic acquire/release

### 2. Queue Infrastructure (queue/)

**queue.types.ts** - Type definitions:
- `ScrapeJobData`, `ScrapeJobResult` interfaces
- `JobPriority`: critical, high, normal, low
- `ScrapeErrorCode` for error classification
- Queue configuration constants

**retry.config.ts** - Error-specific retry policies:
- RATE_LIMITED: 5 attempts, 5s exponential backoff
- BLOCKED: 2 attempts (tier escalation preferred)
- TIMEOUT: 3 attempts, 3s exponential backoff
- DNS_FAILURE: 2 attempts, 10s fixed delay
- SSL_ERROR: 1 attempt (usually permanent)
- `calculateDelay()` with exponential backoff and jitter

**PriorityAssigner.ts** - Priority assignment logic:
- UI source gets critical/high priority
- Paid API features get normal priority
- Scheduler/system get low priority
- Queue selection based on priority and source

**QueueManager.ts** - Three-queue BullMQ system:
- `scrape:priority`: 50 concurrent, 5 min SLA
- `scrape:standard`: 100 concurrent, 15 min SLA
- `scrape:background`: 50 concurrent, 1 hour SLA
- `enqueue()` and `enqueueBatch()` methods
- Job status and metrics methods

**QueueOrchestrator.ts** - Dynamic queue management:
- Pauses background queue when priority >50% utilized
- Resumes when <30% utilized
- Automatic adjustment check interval

### 3. Worker Integration (workers/)

**ScrapeWorker.ts** - Main worker process:
- Integrates GlobalConcurrencyLimiter, RateLimiter, AdaptiveBackoff
- Creates workers for each queue with appropriate concurrency
- Error classification and tier escalation support
- Automatic backoff recording on 429/503 errors

### 4. Monitoring (monitoring/)

**QueueMonitor.ts** - Prometheus-compatible metrics:
- Queue depth by state (waiting, active, delayed)
- Jobs processed counter by queue/status/tier
- Processing time histogram
- Concurrency utilization gauge
- `toPrometheusFormat()` for metrics export

**BlockedDomainTracker.ts** - Tracks blocked domains:
- Lists all domains currently in backoff
- Classifies block reason (rate_limited, blocked, captcha, error)
- Sorted by blockedUntil timestamp

**ProcessingRateTracker.ts** - Rate calculations:
- Sliding window (1 minute) for rate tracking
- Jobs per second per queue
- Redis-backed with automatic cleanup

**alerts.config.ts** - Alert thresholds:
- Queue depth (warning/critical per queue)
- Processing rate (too slow/too fast)
- Blocked domains count
- Concurrency utilization
- Error rate percentage

## Test Coverage

All 99 unit tests passing:
- `RateLimiter.test.ts`: Domain normalization, acquire/release, Redis commands
- `AdaptiveBackoff.test.ts`: Failure/success recording, multiplier caps, backoff state
- `GlobalConcurrencyLimiter.test.ts`: Acquire/release, capacity, withSlot wrapper
- `PriorityAssigner.test.ts`: Priority assignment rules, queue selection
- `retry.config.test.ts`: Error-specific policies, delay calculation, tier escalation

## Commits

| Hash | Message |
|------|---------|
| 8ebf125 | feat(95-03): add rate limiting with Redis sliding window |
| 6030203 | feat(95-03): add BullMQ queue infrastructure |
| 6088ec5 | feat(95-03): add ScrapeWorker with rate limiting integration |
| b30d99f | feat(95-03): add queue monitoring and alerting |
| f9a0338 | test(95-03): add unit tests for queue and rate limiting |
| 67c4462 | chore(95-03): export queue and rate limiting modules from index |

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

- Depends on 95-01 TieredFetcher for actual fetch execution
- Provides queue infrastructure for 95-02 Caching to use
- Provides rate limiting that 95-04 DFS Optimization respects
- Monitoring feeds into 95-05 Migration dashboard

## Self-Check: PASSED

All files created, all commits verified in git log.
