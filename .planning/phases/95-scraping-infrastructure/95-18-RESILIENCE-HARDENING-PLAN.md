# Plan 95-18: Resilience Hardening

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 18 - Resilience Hardening  
**Status:** Ready  
**Priority:** P1 (High)  
**Estimated Effort:** 6 hours  
**Dependencies:** 95-11 (Reliability & Resilience)

---

## Objective

Harden the scraping infrastructure resilience by adding rate limit tracking for CrUX API (to prevent quota exhaustion), implementing a circuit breaker for PostgreSQL operations (to prevent cascade failures), and adding proxy bandwidth tracking.

---

## Current State Analysis

### Identified Gaps

**1. CrUX API No Rate Limit Tracking**
- Free tier: 25,000 queries/day
- Current implementation: No tracking of usage
- Risk: Could exhaust quota silently, causing CWV data unavailability

**2. PostgreSQL No Circuit Breaker**
- Current: Direct connections, no failure isolation
- Risk: Database issues cascade through entire system

**3. Proxy Bandwidth Not Tracked**
- Geonode: $0.77/GB with monthly bandwidth limits
- Webshare: Usage-based pricing
- Risk: Unexpected overages or service cutoff

---

## Task Breakdown

### Task 1: Implement CrUX API Rate Limit Tracker

**File:** `open-seo-main/src/server/features/scraping/cwv/CruxRateLimiter.ts`

Create a rate limiter that:
- Tracks daily usage in Redis
- Warns at 80%, critical at 95%
- Deduplicates alerts per day
- Exports metrics for Prometheus

Key methods:
- `canMakeRequest()`: Check if under limit
- `recordRequest()`: Increment counter
- `getRemainingQuota()`: Get remaining calls
- `getMetrics()`: Export for monitoring

**Acceptance Criteria:**
- [ ] Daily usage tracked in Redis
- [ ] Warning at 80%, critical at 95%
- [ ] Alerts deduplicated per day

---

### Task 2: Integrate CrUX Rate Limiter into CruxClient

**File:** `open-seo-main/src/server/features/scraping/cwv/CruxClient.ts`

Modify to:
- Check rate limit before each request
- Return null when limit reached (triggers PSI fallback)
- Record request even on failure

**Acceptance Criteria:**
- [ ] Rate limit checked before each CrUX request
- [ ] Returns null when limit reached
- [ ] Request recorded even on failure

---

### Task 3: Implement PostgreSQL Circuit Breaker

**File:** `open-seo-main/src/server/features/scraping/resilience/DatabaseCircuitBreaker.ts`

Create circuit breaker that:
- Wraps database operations
- Runs background health checks
- Detects slow queries
- Provides manual override

Configuration:
- Failure threshold: 5
- Recovery timeout: 30s
- Health check interval: 10s
- Slow query threshold: 5s

**Acceptance Criteria:**
- [ ] Circuit breaker wraps PostgreSQL operations
- [ ] Background health checks
- [ ] Slow query detection

---

### Task 4: Integrate Database Circuit Breaker

**Files:**
- `L3Cache.ts` - Cache operations
- `DomainLearningService.ts` - Config persistence
- `DfsCostTracker.ts` - Cost recording

Wrap database calls and handle CircuitOpenError gracefully.

**Acceptance Criteria:**
- [ ] L3Cache operations use circuit breaker
- [ ] DomainLearningService uses circuit breaker
- [ ] Graceful degradation when circuit open

---

### Task 5: Implement Proxy Bandwidth Tracker

**File:** `open-seo-main/src/server/features/scraping/monitoring/BandwidthTracker.ts`

Track monthly bandwidth per provider:
- Geonode: 10GB default, $0.77/GB
- Webshare: 50GB default, $0.10/GB

Alert at 75% warning, 90% critical.

**Acceptance Criteria:**
- [ ] Monthly bandwidth tracked per provider
- [ ] Cost estimation included
- [ ] Alerts at thresholds

---

### Task 6: Integrate Bandwidth Tracking

**Files:**
- `GeonodeFetcher.ts`
- `WebshareFetcher.ts`

Record both request and response sizes after each fetch.

**Acceptance Criteria:**
- [ ] Geonode bandwidth tracked
- [ ] Webshare bandwidth tracked
- [ ] Both directions counted

---

### Task 7: Add Resilience Metrics to Prometheus

Export to `/metrics`:
- `scraping_crux_requests_total` - CrUX usage
- `scraping_crux_quota_remaining` - Remaining quota
- `scraping_db_circuit_state` - Database circuit state
- `scraping_proxy_bandwidth_bytes{provider}` - Bandwidth usage
- `scraping_proxy_bandwidth_cost_usd{provider}` - Cost estimate

**Acceptance Criteria:**
- [ ] All new metrics exported
- [ ] Grafana can query metrics

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CRUX_DAILY_LIMIT` | CrUX API daily limit | `25000` |
| `GEONODE_MONTHLY_BANDWIDTH_GB` | Geonode limit | `10` |
| `WEBSHARE_MONTHLY_BANDWIDTH_GB` | Webshare limit | `50` |
| `DB_CIRCUIT_FAILURE_THRESHOLD` | DB circuit threshold | `5` |

---

## Acceptance Criteria

- [ ] CrUX API rate limit tracked in Redis
- [ ] CrUX returns null when limit reached
- [ ] PostgreSQL circuit breaker implemented
- [ ] Proxy bandwidth tracked per provider
- [ ] All metrics exported to Prometheus
- [ ] TypeScript compiles without errors
