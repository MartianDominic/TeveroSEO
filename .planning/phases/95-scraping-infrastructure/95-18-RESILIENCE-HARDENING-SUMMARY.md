---
phase: 95
plan: 18
subsystem: scraping-infrastructure
tags: [resilience, circuit-breaker, rate-limiting, bandwidth-tracking, prometheus]
dependency_graph:
  requires: [95-11, 95-16]
  provides: [crux-rate-limiting, db-circuit-breaker, proxy-bandwidth-tracking]
  affects: [scraping-service, cwv-checks, l3-cache, domain-learning]
tech_stack:
  added: []
  patterns: [circuit-breaker, rate-limiter, graceful-degradation]
key_files:
  created:
    - open-seo-main/src/server/features/scraping/cwv/CruxRateLimiter.ts
    - open-seo-main/src/server/features/scraping/resilience/DatabaseCircuitBreaker.ts
    - open-seo-main/src/server/features/scraping/monitoring/BandwidthTracker.ts
  modified:
    - open-seo-main/src/server/features/scraping/cwv/CruxClient.ts
    - open-seo-main/src/server/features/scraping/cache/L3Cache.ts
    - open-seo-main/src/server/features/scraping/DomainLearningService.ts
    - open-seo-main/src/server/features/scraping/providers/DfsCostTracker.ts
    - open-seo-main/src/server/features/scraping/fetchers/GeonodeFetcher.ts
    - open-seo-main/src/server/features/scraping/fetchers/WebshareFetcher.ts
    - open-seo-main/src/server/features/scraping/monitoring/MetricsCollector.ts
decisions:
  - "Fail-open for CrUX rate limit check on Redis error - availability over strict limiting"
  - "Circuit breaker returns null/default instead of throwing - graceful degradation pattern"
  - "35-day TTL for monthly bandwidth counters - covers month rollover"
  - "Alert deduplication via Redis SET NX - one alert per threshold per period"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-08"
  tasks: 7
  files_created: 3
  files_modified: 8
---

# Phase 95 Plan 18: Resilience Hardening Summary

CrUX rate limiting with Redis daily counters, PostgreSQL circuit breaker with health checks, and proxy bandwidth tracking for Geonode/Webshare - all with Prometheus metrics export

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b3f5a2f | fix | Correct pino logger argument order |
| 8a9eadd | feat | Add resilience metrics to Prometheus export |
| 8bca68d | feat | Integrate bandwidth tracking into proxy fetchers |
| eb7b8af | feat | Add proxy bandwidth tracking with monthly limits |

## Task Completion

### Task 1: CrUX API Rate Limit Tracker

Created `CruxRateLimiter.ts`:
- Daily usage tracking in Redis with automatic TTL expiry at end of day
- Warning at 80%, critical at 95% thresholds
- Alert deduplication via Redis SET NX (one alert per level per day)
- Prometheus metrics: `scraping_crux_requests_total`, `scraping_crux_quota_remaining`, `scraping_crux_alerts_total`

### Task 2: CrUX Rate Limiter Integration

Modified `CruxClient.ts`:
- Check `canMakeRequest()` before each CrUX API call
- Return null when quota exhausted (triggers PSI fallback)
- Record request via `recordRequest()` even on failure

### Task 3: PostgreSQL Circuit Breaker

Created `DatabaseCircuitBreaker.ts`:
- Three states: closed (normal), open (failing), half-open (testing)
- Failure threshold: 5 (configurable via `DB_CIRCUIT_FAILURE_THRESHOLD`)
- Recovery timeout: 30s (configurable via `DB_CIRCUIT_RECOVERY_TIMEOUT_MS`)
- Background health checks at 10s intervals
- Slow query detection at 5s threshold
- Methods: `execute()`, `executeOrNull()`, `executeOrDefault()`, `forceOpen()`, `forceClose()`

### Task 4: Database Circuit Breaker Integration

Modified three services:
- `L3Cache.ts`: Wrapped `get()` and `set()` with `executeOrNull()` - returns null when circuit open
- `DomainLearningService.ts`: Wrapped `getConfig()` - returns null when circuit open
- `DfsCostTracker.ts`: Wrapped `recordCost()` with `executeOrDefault(-1)` - returns -1 when circuit open

### Task 5: Proxy Bandwidth Tracker

Created `BandwidthTracker.ts`:
- Monthly bandwidth tracking per provider with 35-day TTL
- Geonode: 10GB default limit, $0.77/GB cost
- Webshare: 50GB default limit, $0.10/GB cost
- Warning at 75%, critical at 90% thresholds
- Alert deduplication via Redis SET NX (one alert per level per month)
- Prometheus metrics: `scraping_proxy_bandwidth_bytes`, `scraping_proxy_bandwidth_cost_usd`, `scraping_proxy_bandwidth_alerts_total`

### Task 6: Bandwidth Tracking Integration

Modified both proxy fetchers:
- `GeonodeFetcher.ts`: Call `getBandwidthTracker().recordUsage("geonode", requestBytes, responseBytes)` after fetch
- `WebshareFetcher.ts`: Call `getBandwidthTracker().recordUsage("webshare", requestBytes, responseBytes)` after fetch
- Request bytes estimated as URL length + 500 bytes for headers

### Task 7: Resilience Metrics Export

Added to `MetricsCollector.ts`:
- CrUX metrics: `scraping_crux_requests_total`, `scraping_crux_quota_remaining`, `scraping_crux_alerts_total`
- Database circuit metrics: `scraping_db_circuit_state`, `scraping_db_health_check_status`, `scraping_db_health_check_duration_seconds`
- Proxy bandwidth metrics: `scraping_proxy_bandwidth_bytes`, `scraping_proxy_bandwidth_cost_usd`, `scraping_proxy_bandwidth_alerts_total`
- Helper functions: `recordCruxQuotaStatus()`, `recordProxyBandwidthStatus()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pino logger argument order**
- **Found during:** Task 7 verification
- **Issue:** Pino expects `logger.info(object, message)` not `logger.info(message, object)`
- **Fix:** Swapped argument order in all logger calls across 6 files
- **Files modified:** CruxRateLimiter.ts, BandwidthTracker.ts, DatabaseCircuitBreaker.ts, DfsCostTracker.ts, L3Cache.ts, DomainLearningService.ts
- **Commit:** b3f5a2f

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CRUX_DAILY_LIMIT` | CrUX API daily limit | `25000` |
| `GEONODE_MONTHLY_BANDWIDTH_GB` | Geonode bandwidth limit in GB | `10` |
| `WEBSHARE_MONTHLY_BANDWIDTH_GB` | Webshare bandwidth limit in GB | `50` |
| `DB_CIRCUIT_FAILURE_THRESHOLD` | Failures before circuit opens | `5` |
| `DB_CIRCUIT_RECOVERY_TIMEOUT_MS` | Time before half-open state | `30000` |

## Acceptance Criteria

- [x] CrUX API rate limit tracked in Redis
- [x] CrUX returns null when limit reached
- [x] PostgreSQL circuit breaker implemented
- [x] Proxy bandwidth tracked per provider
- [x] All metrics exported to Prometheus
- [x] TypeScript compiles without errors

## Self-Check: PASSED

All created files exist:
- CruxRateLimiter.ts: FOUND
- DatabaseCircuitBreaker.ts: FOUND
- BandwidthTracker.ts: FOUND

All commits exist:
- b3f5a2f: FOUND
- 8a9eadd: FOUND
- 8bca68d: FOUND
- eb7b8af: FOUND
