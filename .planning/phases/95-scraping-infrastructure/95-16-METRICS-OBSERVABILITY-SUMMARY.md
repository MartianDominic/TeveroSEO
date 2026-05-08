---
phase: 95
plan: 16
subsystem: scraping
tags: [metrics, observability, prometheus, logging, monitoring]
dependency_graph:
  requires: [95-05, 95-03]
  provides: [prometheus-metrics, structured-logging, correlation-ids]
  affects: [TieredFetcher, ScrapingService, QueueOrchestrator, AlertManager]
tech_stack:
  added: [pino]
  patterns: [histogram-metrics, correlation-id-propagation, component-loggers]
key_files:
  created:
    - src/server/features/scraping/monitoring/MetricsCollector.ts
    - src/server/features/scraping/monitoring/__tests__/MetricsCollector.test.ts
    - src/server/features/scraping/logging/Logger.ts
    - src/server/features/scraping/logging/index.ts
  modified:
    - src/server/features/scraping/ScrapingService.ts
    - src/server/features/scraping/TieredFetcher.ts
    - src/server/features/scraping/DomainFeedback.ts
    - src/server/features/scraping/RevalidationCronJob.ts
    - src/server/features/scraping/monitoring/AlertManager.ts
    - src/server/features/scraping/monitoring/AuditLogger.ts
    - src/server/features/scraping/monitoring/QueueMonitor.ts
    - src/server/features/scraping/queue/QueueOrchestrator.ts
    - src/server/features/scraping/middleware/adminAuth.ts
    - src/server/features/scraping/index.ts
decisions:
  - Standard Prometheus histogram buckets (0.01s to 60s) for latency distribution
  - AsyncLocalStorage for correlation ID propagation (non-invasive, automatic)
  - Component-specific child loggers for isolated log filtering
  - Pino for structured JSON logging (production-ready, high performance)
metrics:
  duration_minutes: ~45
  completed: "2026-05-08T12:15:00Z"
---

# Phase 95 Plan 16: Metrics & Observability Completion Summary

Prometheus-compatible cost metrics + structured pino logging with correlation ID propagation.

## One-liner

Prometheus histogram metrics with standard buckets + pino structured logging with AsyncLocalStorage correlation IDs for full request tracing.

## What Was Built

### MetricsCollector (Core Prometheus-Compatible Metrics)

New file: `src/server/features/scraping/monitoring/MetricsCollector.ts`

- **Histogram metrics** with standard latency buckets (0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60 seconds)
- **Counter metrics** for request counts, costs, cache hits
- **Gauge metrics** for circuit breaker states, budget utilization
- **Percentile calculation** from histogram data (p50, p95, p99)
- **Helper functions**: `recordScrapeRequest()`, `recordCircuitState()`, `recordDfsBudgetUsage()`
- **Timing utility**: `withTiming()` for automatic duration recording
- **Prometheus format export**: `toPrometheusFormat()` with HELP/TYPE annotations
- **Singleton pattern** with `getMetricsCollector()` and `resetMetricsCollector()`

### Structured Logger (Pino + Correlation IDs)

New files: `src/server/features/scraping/logging/Logger.ts`, `logging/index.ts`

- **Pino JSON logging** with configurable log levels via LOG_LEVEL env var
- **AsyncLocalStorage** for automatic correlation ID propagation
- **Component loggers**: fetcherLogger, cacheLogger, queueLogger, costLogger, domainLogger, alertLogger, migrationLogger, circuitLogger
- **Correlation ID utilities**: `generateCorrelationId()`, `getCorrelationId()`, `withCorrelationId()`
- **Request context**: `withRequestContext()`, `withRequestContextAsync()`, `getRequestContext()`
- **Express middleware**: `correlationMiddleware()` for HTTP request correlation
- **BullMQ integration**: `createJobContext()`, `withJobContext()` for worker correlation
- **Logging helpers**: `logScrapeStart()`, `logScrapeComplete()`, `logScrapeError()`, `logTierEscalation()`, `logCacheOperation()`, `logCircuitStateChange()`, `logCostRecord()`, `logQueueOperation()`

### ScrapingService Integration

- Added `correlationId` to `ScrapeOptions` and `ScrapeResult` interfaces
- Wrapped `scrape()` in `withRequestContextAsync()` for automatic correlation propagation
- Call `recordScrapeRequest()` on every request for metrics collection
- Updated `getMetrics()` to compute real latency percentiles from histogram
- Updated `getPrometheusMetrics()` to include MetricsCollector output

### TieredFetcher Integration

- Log tier escalation with `logTierEscalation()`
- Log circuit state changes with `logCircuitStateChange()`
- Record circuit states in MetricsCollector with `recordCircuitState()`
- Log cache errors with `cacheLogger`

### Console.log Replacement

Replaced all `console.log/warn/error` statements with structured logging in:

- **DomainFeedback.ts**: Uses `domainLogger` for feedback processing
- **RevalidationCronJob.ts**: Uses `domainLogger` for cron operations
- **AlertManager.ts**: Uses `alertLogger` for channel configuration and alerts
- **AuditLogger.ts**: Uses `alertLogger` for audit persistence errors
- **QueueMonitor.ts**: Uses `queueLogger` for metrics collection lifecycle
- **QueueOrchestrator.ts**: Uses `queueLogger` for queue management events
- **adminAuth.ts**: Uses `alertLogger` for security events (IP rejection, invalid keys)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 868f89d | feat | Add MetricsCollector and structured logging |
| 0fda2f8 | test | Add MetricsCollector unit tests (25 tests) |
| 9fadae3 | feat | Integrate metrics and correlation ID into scrape flow |
| 23f0bf1 | refactor | Replace console.log with structured logging |

## Tests

25 unit tests for MetricsCollector covering:

- Counter increment and labeled counters
- Gauge setting and overwriting
- Histogram recording and percentile calculation
- Prometheus format export with HELP/TYPE annotations
- Timing utilities (withTiming, createTimer)
- Helper functions (recordScrapeRequest, recordCircuitState, recordDfsBudgetUsage)
- Singleton pattern and reset

## Prometheus Metrics Available

```prometheus
# Request duration histogram
scraping_request_duration_seconds_bucket{tier="direct",status="success",le="0.1"} 1234
scraping_request_duration_seconds_sum{tier="direct",status="success"} 12345.67
scraping_request_duration_seconds_count{tier="direct",status="success"} 10000

# Cost metrics
scraping_cost_usd_total{tier="dfs_basic"} 1.25
scraping_cost_usd_total{tier="all"} 8.75

# Budget metrics
scraping_dfs_budget_used_percent 87.5
scraping_dfs_savings_usd 15.00

# Request counts
scraping_requests_total{tier="direct",status="success"} 5000
scraping_requests_total{tier="direct",status="error"} 50

# Circuit state
scraping_circuit_state{tier="direct"} 0
scraping_circuit_state{tier="webshare"} 1

# Cache hits
scraping_cache_hits_total{level="l1"} 2500
```

## Log Format Example

```json
{
  "level": "info",
  "time": "2026-05-08T12:00:00.000Z",
  "service": "scraping",
  "component": "fetcher",
  "correlationId": "scrape-abc123-xyz789",
  "url": "https://example.com",
  "tier": "direct",
  "cached": false,
  "durationMs": 450,
  "costUsd": 0,
  "statusCode": 200,
  "msg": "Scrape completed"
}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added correlation ID to ScrapeResult**
- **Found during:** Task 7
- **Issue:** Correlation ID was generated but not returned to caller
- **Fix:** Added `correlationId` field to `ScrapeResult` interface
- **Files modified:** ScrapingService.ts

**2. [Rule 2 - Missing functionality] Added logging module exports**
- **Found during:** Task 5
- **Issue:** Logging utilities not exported from scraping index
- **Fix:** Added all logging exports to scraping/index.ts
- **Files modified:** index.ts

## Self-Check: PASSED

- [x] MetricsCollector.ts exists
- [x] Logger.ts exists
- [x] logging/index.ts exists
- [x] MetricsCollector.test.ts exists
- [x] All commits verified (868f89d, 0fda2f8, 9fadae3, 23f0bf1)
- [x] TypeScript compiles without errors in scraping module
- [x] 25 tests pass
