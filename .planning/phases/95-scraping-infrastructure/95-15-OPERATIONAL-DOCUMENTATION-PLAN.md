# Plan 95-15: Operational Documentation

**Phase:** 95 - Scraping Infrastructure  
**Plan:** 15 - Operational Documentation  
**Status:** Ready  
**Priority:** P0 (Critical - Production Blocker)  
**Estimated Effort:** 6 hours  
**Dependencies:** 95-14 (Security & Authentication)

---

## Objective

Create comprehensive runbook documentation for all alert types and operational procedures. The current alert configurations reference runbook URLs that don't exist, leaving operators unable to respond effectively to incidents.

---

## Current State Analysis

### Missing Documentation

Alert configurations in `AlertManager.ts` reference these non-existent runbooks:

| Alert | Referenced Runbook | Status |
|-------|-------------------|--------|
| daily-cost-warning | `#cost-overrun` | MISSING |
| daily-cost-critical | `#cost-overrun` | MISSING |
| error-rate-warning | `#high-error-rate` | MISSING |
| error-rate-critical | `#high-error-rate` | MISSING |
| circuit-open | `#circuit-breaker-open` | MISSING |
| cache-hit-rate-low | `#cache-miss-high` | MISSING |
| queue-backlog-warning | `#queue-backlog` | MISSING |
| queue-backlog-critical | `#queue-backlog` | MISSING |
| dfs-budget-warning | `#dfs-budget` | MISSING |
| dfs-budget-critical | `#dfs-budget` | MISSING |

### Existing Documentation

- `docs/runbooks/SCRAPING-OPERATIONS.md` exists but is incomplete
- No environment variable documentation
- No architecture decision records

---

## Task Breakdown

### Task 1: Create Cost Overrun Runbook

**File:** `open-seo-main/docs/runbooks/scraping/cost-overrun.md`

```markdown
# Runbook: Cost Overrun

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `daily-cost-warning` | Warning | >$50/day | 1 hour |
| `daily-cost-critical` | Critical | >$100/day | 15 min |

## Quick Diagnosis

1. **Check current spend:**
   ```bash
   curl -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/cost-report?period=day
   ```

2. **Identify top consumers:**
   ```bash
   curl -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/cost-report?period=day&groupBy=client
   ```

3. **Check tier distribution:**
   ```bash
   curl -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/metrics | jq '.tierDistribution'
   ```

## Root Cause Analysis

### Scenario A: Single client spike
**Symptoms:** One client consuming >80% of daily spend
**Cause:** Bulk import, audit of large site, or runaway job
**Action:**
1. Contact client to verify intentional
2. If unintentional: pause client's jobs via queue
3. If intentional: increase daily budget or throttle

### Scenario B: Domain learning failures
**Symptoms:** High percentage of DFS Browser tier usage
**Cause:** New domains not being learned, or learning cache expired
**Action:**
1. Check domain learning cache hit rate
2. Verify Redis connectivity
3. Check `domain_scrape_configs` for recent updates

### Scenario C: Cache misses
**Symptoms:** Low cache hit rate (<40%)
**Cause:** Cache eviction, Redis memory pressure, or new URL patterns
**Action:**
1. Check cache hit rate: `GET /metrics | grep cache_hit_rate`
2. Check Redis memory: `redis-cli INFO memory`
3. Consider cache warming for high-traffic domains

## Mitigation Actions

### Immediate (Critical alert)

1. **Hard budget enforcement:**
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/budget/enforce-hard-limit
   ```

2. **Pause non-critical queues:**
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/queue/pause?queue=background
   ```

### Short-term (Warning alert)

1. Review and optimize domain learning configurations
2. Increase cache TTLs for stable content
3. Shift more traffic to Standard Queue (if latency permits)

### Long-term

1. Review per-client budgets
2. Implement client-specific rate limiting
3. Add cost anomaly detection

## Escalation

| Time | Action |
|------|--------|
| +0 min | On-call investigates |
| +15 min | If critical, page senior engineer |
| +30 min | If unresolved, notify product team |
| +1 hour | If unresolved, consider emergency stop |

## Related Metrics

- `scraping_cost_usd_total{tier}` - Cost by tier
- `scraping_requests_total{tier}` - Requests by tier
- `scraping_cache_hit_rate{level}` - Cache effectiveness
- `scraping_domain_learning_cache_hits` - Learning efficiency
```

**Acceptance Criteria:**
- [ ] Clear diagnosis steps with actual API calls
- [ ] Root cause scenarios with specific symptoms
- [ ] Immediate and long-term mitigation actions
- [ ] Escalation matrix

---

### Task 2: Create High Error Rate Runbook

**File:** `open-seo-main/docs/runbooks/scraping/high-error-rate.md`

```markdown
# Runbook: High Error Rate

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `error-rate-warning` | Warning | >5% | 30 min |
| `error-rate-critical` | Critical | >15% | 10 min |

## Quick Diagnosis

1. **Check overall health:**
   ```bash
   curl https://api.tevero.io/scraping/health/detailed
   ```

2. **Check circuit breaker states:**
   ```bash
   curl https://api.tevero.io/scraping/health/circuits
   ```

3. **Check error breakdown:**
   ```bash
   curl -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/metrics | jq '.errors'
   ```

## Root Cause Analysis

### Scenario A: Single tier failing
**Symptoms:** One tier has >50% error rate, others normal
**Cause:** Upstream provider issue (DataForSEO, proxy, etc.)
**Action:**
1. Force circuit open for failing tier
2. Let traffic escalate to next tier
3. Monitor provider status page

### Scenario B: Target sites blocking
**Symptoms:** Errors concentrated on specific domains
**Cause:** Anti-bot detection, IP blocks, rate limiting
**Action:**
1. Check domain learning for affected domains
2. Consider geo-targeting changes
3. Escalate to higher tier (more stealth)

### Scenario C: Infrastructure issue
**Symptoms:** All tiers failing, health checks red
**Cause:** Redis down, PostgreSQL down, network issue
**Action:**
1. Check Redis: `redis-cli PING`
2. Check PostgreSQL: `pg_isready`
3. Check network connectivity to providers

### Scenario D: Rate limiting triggered
**Symptoms:** 429 errors from DataForSEO or proxies
**Cause:** Exceeded rate limits
**Action:**
1. Check adaptive backoff state
2. Verify rate limiter configuration
3. Consider reducing concurrency

## Mitigation Actions

### Immediate (Critical alert)

1. **Identify failing tier:**
   ```bash
   curl https://api.tevero.io/scraping/health/circuits | jq '.circuits[] | select(.state == "open")'
   ```

2. **Force close circuit if false positive:**
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/circuits/dfs_basic/close
   ```

3. **If widespread, emergency stop:**
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/emergency-stop
   ```

### Recovery

1. **Resume after fix:**
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/resume
   ```

2. **Monitor recovery:**
   ```bash
   watch -n 5 'curl -s https://api.tevero.io/scraping/metrics | jq ".errorRate"'
   ```

## Escalation

| Time | Action |
|------|--------|
| +0 min | On-call investigates |
| +10 min | If critical and spreading, emergency stop |
| +15 min | Page senior engineer |
| +30 min | Notify affected clients |

## Related Metrics

- `scraping_error_rate` - Overall error rate
- `scraping_circuit_state{tier}` - Circuit breaker states
- `scraping_requests_total{status="error"}` - Error count
- `scraping_tier_errors{tier}` - Errors by tier
```

---

### Task 3: Create Circuit Breaker Runbook

**File:** `open-seo-main/docs/runbooks/scraping/circuit-breaker-open.md`

```markdown
# Runbook: Circuit Breaker Open

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `circuit-open` | Warning | Any circuit open | 30 min |

## Understanding Circuit Breakers

The scraping infrastructure uses circuit breakers per tier to:
- Prevent cascade failures
- Allow automatic recovery
- Protect upstream providers

**States:**
- `closed` - Normal operation
- `open` - Failing fast, no requests sent
- `half-open` - Testing recovery

**Auto-recovery:**
- Opens after threshold failures (default: 5)
- Resets after timeout (60s for cheap tiers, 300s for expensive)
- Closes after success threshold in half-open (default: 2)

## Quick Diagnosis

1. **Check which circuits are open:**
   ```bash
   curl https://api.tevero.io/scraping/health/circuits
   ```

2. **Check circuit statistics:**
   ```bash
   curl https://api.tevero.io/scraping/health/circuits | jq '.circuits[] | select(.state != "closed")'
   ```

## Root Cause by Tier

### T0 (Direct) / T1 (Webshare) Open
**Likely cause:** Target sites blocking, network issues
**Impact:** Low - traffic escalates to T2
**Action:** Usually wait for auto-recovery

### T2 (Geonode) Open
**Likely cause:** Proxy provider issue, bandwidth exceeded
**Impact:** Medium - traffic goes to expensive DFS tiers
**Action:**
1. Check Geonode dashboard for status
2. Verify bandwidth quota
3. Force close if provider recovered

### T3/T4/T5 (DataForSEO) Open
**Likely cause:** API rate limit, service outage, budget exceeded
**Impact:** High - no fallback for JS/browser rendering
**Action:**
1. Check DataForSEO status page
2. Verify API credentials
3. Check budget limits

## Mitigation Actions

### Wait for Auto-Recovery (Recommended)

Most circuits will auto-recover. Monitor:
```bash
watch -n 10 'curl -s https://api.tevero.io/scraping/health/circuits | jq ".circuits"'
```

### Force Close Circuit

Only if you've verified the upstream is healthy:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/circuits/{tier}/close
```

### Force Open Circuit

To manually disable a tier (e.g., during provider maintenance):
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/circuits/{tier}/open
```

## Prevention

1. **Tune thresholds per tier** based on historical failure rates
2. **Increase timeouts** for tiers with slow recovery
3. **Add more tiers** for additional redundancy

## Related Metrics

- `scraping_circuit_state{tier}` - Current state (0=closed, 1=half-open, 2=open)
- `scraping_circuit_failures{tier}` - Failure count
- `scraping_circuit_trips_total{tier}` - Total times tripped
```

---

### Task 4: Create Queue Backlog Runbook

**File:** `open-seo-main/docs/runbooks/scraping/queue-backlog.md`

```markdown
# Runbook: Queue Backlog

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `queue-backlog-warning` | Warning | >1000 jobs | 1 hour |
| `queue-backlog-critical` | Critical | >5000 jobs | 15 min |

## Quick Diagnosis

1. **Check queue depths:**
   ```bash
   curl https://api.tevero.io/scraping/health/queues
   ```

2. **Check worker status:**
   ```bash
   curl -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/workers
   ```

3. **Check processing rate:**
   ```bash
   curl https://api.tevero.io/scraping/metrics | jq '.queues'
   ```

## Root Cause Analysis

### Scenario A: Workers not processing
**Symptoms:** Queue growing, active count = 0
**Cause:** Worker crash, Redis connection lost
**Action:**
1. Check worker logs
2. Restart worker processes
3. Verify Redis connectivity

### Scenario B: Processing slower than intake
**Symptoms:** Queue growing, active count normal
**Cause:** Increased load, slow upstream, rate limiting active
**Action:**
1. Check if special event (bulk import, etc.)
2. Increase worker concurrency
3. Check for rate limiting

### Scenario C: Stuck jobs
**Symptoms:** Some jobs not progressing
**Cause:** Jobs hitting infinite retry, dependency stuck
**Action:**
1. Identify stuck jobs
2. Check job failure reasons
3. Consider draining stuck jobs

## Mitigation Actions

### Increase Processing Capacity

```bash
# Scale workers (if using k8s)
kubectl scale deployment scraping-worker --replicas=5

# Or increase concurrency dynamically
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"workerConcurrency": 50}'
```

### Drain Old Jobs

Only as last resort - jobs will be lost:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/drain?older_than=3600000
```

### Pause Intake

Stop accepting new jobs while catching up:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/pause?queue=background
```

## Related Metrics

- `scraping_queue_jobs{state="waiting"}` - Waiting jobs
- `scraping_queue_jobs{state="active"}` - Processing jobs
- `scraping_queue_jobs{state="failed"}` - Failed jobs
- `scraping_queue_processing_rate` - Jobs/second
```

---

### Task 5: Create DataForSEO Budget Runbook

**File:** `open-seo-main/docs/runbooks/scraping/dfs-budget.md`

```markdown
# Runbook: DataForSEO Budget

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `dfs-budget-warning` | Warning | >75% used | 4 hours |
| `dfs-budget-critical` | Critical | >90% used | 1 hour |

## Quick Diagnosis

1. **Check current usage:**
   ```bash
   curl -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/cost-report?period=day
   ```

2. **Check budget configuration:**
   ```bash
   echo "Daily: $DFS_DAILY_BUDGET, Monthly: $DFS_MONTHLY_BUDGET"
   ```

## Understanding DFS Costs

| Mode | Cost/Page | Use Case |
|------|-----------|----------|
| basic | $0.000125 | Static HTML |
| js | $0.00125 | JS-rendered content |
| browser | $0.00425 | Full browser, screenshots |

**Standard Queue:** 60-70% cheaper but async (results via webhook)

## Mitigation Actions

### Short-term

1. **Shift to Standard Queue:**
   More requests can use async Standard Queue:
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/config \
     -d '{"preferStandardQueue": true, "standardQueueThreshold": 0}'
   ```

2. **Reduce browser mode usage:**
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/config \
     -d '{"maxTier": "dfs_js"}'
   ```

3. **Warm cache for high-traffic domains:**
   ```bash
   curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
     https://api.tevero.io/scraping/admin/cache/warm \
     -d '{"domains": ["example.com", "test.com"]}'
   ```

### Long-term

1. **Increase budget:**
   Update environment variables:
   ```bash
   DFS_DAILY_BUDGET=200
   DFS_MONTHLY_BUDGET=3000
   ```

2. **Optimize domain learning:**
   Ensure domains are being learned to avoid unnecessary escalation

3. **Review client usage:**
   Implement per-client budgets for heavy users

## Budget Reset

Budgets reset at:
- Daily: 00:00 UTC
- Monthly: 1st of month 00:00 UTC

## Related Metrics

- `scraping_dfs_cost_usd_total` - Total DFS spend
- `scraping_dfs_budget_used_percent` - Budget utilization
- `scraping_dfs_requests_total{mode}` - Requests by mode
- `scraping_dfs_standard_queue_savings` - Savings from queue
```

---

### Task 6: Create Environment Variables Documentation

**File:** `open-seo-main/docs/configuration/SCRAPING-ENV-VARS.md`

```markdown
# Scraping Infrastructure Environment Variables

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost/db` |
| `DATAFORSEO_API_KEY` | DataForSEO API credentials | `login:password` (base64 encoded) |

## Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPING_ADMIN_API_KEY` | API key for admin endpoints | (required in prod) |
| `SCRAPING_ADMIN_ALLOWED_IPS` | Comma-separated IP allowlist | (all IPs if not set) |

## DataForSEO Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DFS_DAILY_BUDGET` | Daily budget in USD | `10.0` |
| `DFS_MONTHLY_BUDGET` | Monthly budget in USD | `100.0` |
| `DFS_ALERT_WEBHOOK_URL` | Webhook for budget alerts | - |
| `DFS_ALERT_EMAILS` | Comma-separated alert emails | - |
| `DFS_ENFORCE_HARD_LIMIT` | Block requests at budget | `false` |

## Proxy Configuration

### Geonode (Residential Proxy)

| Variable | Description | Default |
|----------|-------------|---------|
| `GEONODE_USERNAME` | Username with type suffix | - |
| `GEONODE_PASSWORD` | Password (UUID format) | - |
| `GEONODE_HOST` | Proxy host | `proxy.geonode.io` |
| `GEONODE_PORT` | Proxy port | `9000` |
| `GEONODE_DEFAULT_COUNTRY` | Default geo-targeting | - |

### Webshare (DC Proxy)

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBSHARE_API_KEY` | Webshare API key | - |

## Storage (Cloudflare R2)

| Variable | Description | Default |
|----------|-------------|---------|
| `R2_BUCKET` | R2 bucket name | `scrape-archive` |
| `R2_ACCESS_KEY_ID` | R2 access key | - |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | - |
| `CF_ACCOUNT_ID` | Cloudflare account ID | - |

## Alerting

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook | - |
| `PAGERDUTY_ROUTING_KEY` | PagerDuty Events API key | - |

## Performance Tuning

| Variable | Description | Default |
|----------|-------------|---------|
| `SCRAPING_MAX_CONCURRENCY` | Global concurrent requests | `200` |
| `SCRAPING_WORKER_CONCURRENCY` | Jobs per worker | `10` |
| `SCRAPING_QUEUE_PRIORITY_CONCURRENCY` | Priority queue concurrency | `50` |

## Cache Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `L1_CACHE_MAX_SIZE_MB` | Memory cache size | `100` |
| `L1_CACHE_TTL_SECONDS` | Memory cache TTL | `300` |
| `L2_CACHE_TTL_SECONDS` | Redis cache TTL | `3600` |
| `L3_CACHE_TTL_DAYS` | PostgreSQL cache TTL | `30` |

## Circuit Breaker

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_CIRCUIT_BREAKER_THRESHOLD` | Failures to open | `5` |
| `REDIS_CIRCUIT_BREAKER_COOLDOWN_MS` | Cooldown period | `30000` |

## CWV (Core Web Vitals)

| Variable | Description | Default |
|----------|-------------|---------|
| `CRUX_API_KEY` | Chrome UX Report API key | - |
| `PSI_DAILY_BUDGET` | PageSpeed Insights daily limit | `1000` |
```

---

## Acceptance Criteria

- [ ] All 5 runbooks created with diagnosis steps
- [ ] Each runbook includes actual API calls
- [ ] Escalation matrices defined
- [ ] Environment variables documented
- [ ] Runbook links updated in AlertManager.ts
- [ ] Documentation reviewed for accuracy
