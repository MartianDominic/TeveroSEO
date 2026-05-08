# Runbook: Cost Overrun

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `daily-cost-warning` | Warning | >$50/day | 1 hour |
| `daily-cost-critical` | Critical | >$100/day | 15 min |

## Impact Assessment

**Business Impact:**
- Budget exhaustion before end of billing period
- Potential service degradation if hard limits enforced
- Unexpected operating costs

**Technical Impact:**
- If `DFS_ENFORCE_HARD_LIMIT=true`, scraping stops at budget
- Lower-cost tiers may be rate-limited
- Cache-dependent services may experience latency increase

## Quick Diagnosis

### 1. Check Current Spend

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=day
```

Expected response:
```json
{
  "period": "day",
  "totalUsd": 65.42,
  "byTier": {
    "direct": 0.00,
    "webshare": 0.12,
    "geonode": 8.50,
    "camoufox": 2.30,
    "dfs_basic": 15.80,
    "dfs_js": 28.20,
    "dfs_browser": 10.50
  },
  "budget": { "daily": 100, "used": 65.42, "percent": 65.42 }
}
```

### 2. Identify Top Consumers

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=day&groupBy=client
```

### 3. Check Tier Distribution

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/metrics | jq '.tierDistribution'
```

Healthy distribution:
- Direct + Webshare: 60-70%
- Geonode: 15-25%
- DataForSEO tiers: <15%

### 4. Check Cache Effectiveness

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/metrics | jq '.cacheHitRate'
```

Target: >70% overall hit rate

## Root Cause Analysis

### Scenario A: Single Client Spike

**Symptoms:**
- One client consuming >80% of daily spend
- Sudden increase in job count from single source

**Cause:** Bulk import, large site audit, or runaway automation job

**Investigation:**
```bash
# Check client job counts
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/jobs?groupBy=clientId&period=hour

# Check if specific audit running
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/audits/active
```

**Action:**
1. Contact client to verify intentional usage
2. If unintentional: pause client's jobs via queue
3. If intentional but unsustainable: throttle or discuss budget increase

### Scenario B: Domain Learning Failures

**Symptoms:**
- High percentage of DFS Browser tier usage (>20%)
- Low domain learning cache hit rate (<50%)
- Many requests starting at expensive tiers

**Cause:** New domains not being learned, or learning cache expired/corrupted

**Investigation:**
```bash
# Check domain learning stats
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domain-learning/stats

# Check recent domain learning decisions
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domain-learning/recent?limit=50
```

**Action:**
1. Verify Redis connectivity (domain learning L1 cache)
2. Check `domain_scrape_configs` table for recent updates
3. Consider backfilling domain learning for high-traffic domains

### Scenario C: Cache Misses

**Symptoms:**
- Low cache hit rate (<40%)
- High request volume but low L1/L2 cache hits
- Memory cache size at limit

**Cause:** Cache eviction due to memory pressure, Redis issues, or new URL patterns

**Investigation:**
```bash
# Check cache stats per level
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cache/stats

# Check Redis memory
redis-cli INFO memory

# Check L1 cache status
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cache/l1/stats
```

**Action:**
1. If Redis memory >80%, consider eviction policy review
2. If L1 at limit, increase `L1_CACHE_MAX_SIZE_MB`
3. For high-traffic domains, consider cache warming

### Scenario D: Expensive Tier Over-escalation

**Symptoms:**
- DFS tier requests >30% of total
- Many domains consistently escalating to DFS

**Cause:** Anti-bot detection evolution, geo-blocking, or overly aggressive escalation

**Investigation:**
```bash
# Check escalation patterns
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/escalation-analysis

# Check domains with high DFS usage
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domains/expensive
```

**Action:**
1. Review and tune escalation thresholds
2. Consider geo-targeting adjustments
3. Add problematic domains to manual tier override list

## Step-by-Step Response Procedure

### Critical Alert Response (>$100/day, SLA: 15 min)

**Step 1: Triage (0-5 min)**
1. Acknowledge alert in PagerDuty/Slack
2. Run quick diagnosis commands above
3. Determine primary cost driver

**Step 2: Immediate Mitigation (5-10 min)**

Option A - Enforce hard budget limit:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/budget/enforce-hard-limit
```

Option B - Pause non-critical queues:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/pause?queue=background
```

Option C - Throttle specific consumer:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/consumer/{consumerId}/throttle \
  -d '{"rateLimit": 10}'
```

**Step 3: Document and Communicate (10-15 min)**
1. Post update in #scraping-incidents channel
2. Document mitigation action taken
3. If client-impacting, notify account team

### Warning Alert Response (>$50/day, SLA: 1 hour)

**Step 1: Investigate (0-30 min)**
1. Review cost breakdown by tier and consumer
2. Check cache hit rates
3. Identify root cause scenario

**Step 2: Optimize (30-60 min)**
1. Review and adjust domain learning configurations
2. Increase cache TTLs for stable content
3. Shift more traffic to Standard Queue (if latency permits):
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"preferStandardQueue": true, "standardQueueThreshold": 30000}'
```

**Step 3: Document**
1. Log findings in incident tracking
2. Update runbook if new pattern discovered

## Mitigation Actions Reference

### Immediate (Critical Alert)

| Action | Command | Impact |
|--------|---------|--------|
| Hard budget stop | `POST /admin/budget/enforce-hard-limit` | Blocks all new requests |
| Pause background queue | `POST /admin/queue/pause?queue=background` | Stops low-priority jobs |
| Emergency stop | `POST /admin/emergency-stop` | Stops everything |
| Throttle consumer | `POST /admin/consumer/{id}/throttle` | Limits specific client |

### Short-term (Warning Alert)

| Action | Command | Impact |
|--------|---------|--------|
| Enable standard queue | `POST /admin/config` with preferStandardQueue | Async processing, cheaper |
| Cap tier escalation | `POST /admin/config` with maxTier | Limits expensive tiers |
| Cache warm domains | `POST /admin/cache/warm` | Reduces future fetches |

### Long-term

| Action | Description |
|--------|-------------|
| Per-client budgets | Set `clientBudget` in workspace settings |
| Anomaly detection | Enable `costAnomalyAlert` in AlertManager |
| Rate tier review | Monthly review of tier costs vs effectiveness |

## Escalation Paths

| Time Elapsed | Action |
|--------------|--------|
| +0 min | On-call investigates using this runbook |
| +15 min | If critical and unresolved, page senior engineer |
| +30 min | If unresolved, notify product team and finance |
| +1 hour | If unresolved critical, consider emergency stop |
| +2 hours | Incident review meeting |

**Escalation Contacts:**
- Primary: On-call engineer (PagerDuty rotation)
- Secondary: Platform team lead
- Finance notification: billing@tevero.io

## Recovery Verification

After mitigation, verify recovery:

### 1. Cost Rate Normalized

```bash
# Check last hour cost rate
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=hour

# Watch real-time (every 5 min)
watch -n 300 'curl -s -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=hour | jq .totalUsd'
```

**Success criteria:** Hourly cost rate returning to normal (<$4/hour for $100/day budget)

### 2. Services Operational

```bash
curl https://api.tevero.io/scraping/health/detailed
```

**Success criteria:** All components healthy, queues processing

### 3. Alert Resolved

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/alerts/active
```

**Success criteria:** No cost-related alerts active

## Related Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `scraping_cost_usd_total{tier}` | Cost by tier | N/A (informational) |
| `scraping_requests_total{tier}` | Requests by tier | N/A (informational) |
| `scraping_cache_hit_rate{level}` | Cache effectiveness | <50% |
| `scraping_domain_learning_cache_hits` | Learning efficiency | <30% |
| `scraping_dfs_budget_used_percent` | DFS budget utilization | >75% warn, >90% critical |

## Prevention Checklist

- [ ] Per-client budgets configured
- [ ] Cost anomaly detection enabled
- [ ] Domain learning cache warmed for top domains
- [ ] Standard Queue preference set for background jobs
- [ ] Weekly cost trend review scheduled
- [ ] Tier escalation thresholds tuned
