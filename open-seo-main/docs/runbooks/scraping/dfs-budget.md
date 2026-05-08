# Runbook: DataForSEO Budget

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `dfs-budget-warning` | Warning | >75% used | 4 hours |
| `dfs-budget-critical` | Critical | >90% used | 1 hour |

## Impact Assessment

**Business Impact:**
- If budget exhausted, DFS-dependent features fail
- JS-rendered sites cannot be scraped
- Browser-only content unavailable
- Quality of site audits degraded

**Technical Impact:**
- If `DFS_ENFORCE_HARD_LIMIT=true`, DFS requests blocked at limit
- Traffic cannot escalate beyond Camoufox tier
- Circuit breaker may trip on failed requests
- Queue backlog for DFS-dependent jobs

## Understanding DataForSEO Costs

### Pricing by Mode

| Mode | Cost/Page | Use Case | Example |
|------|-----------|----------|---------|
| `basic` | $0.000125 | Static HTML | News articles, blogs |
| `js` | $0.00125 | JS-rendered content | SPAs, React sites |
| `browser` | $0.00425 | Full browser, screenshots | Complex apps, anti-bot |

### Queue Types

| Queue Type | Cost Multiplier | Latency | Use Case |
|------------|-----------------|---------|----------|
| Live Queue | 1.0x | 5-15s | Real-time UI requests |
| Standard Queue | 0.3-0.4x | 1-5min | Background processing |

**Standard Queue:** 60-70% cheaper but async (results via webhook)

### Budget Configuration

Default environment variables:
```bash
DFS_DAILY_BUDGET=100     # USD per day
DFS_MONTHLY_BUDGET=2000  # USD per month
DFS_ENFORCE_HARD_LIMIT=false
```

## Quick Diagnosis

### 1. Check Current Usage

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=day
```

Response:
```json
{
  "period": "day",
  "dfs": {
    "totalUsd": 82.50,
    "byMode": {
      "basic": 5.20,
      "js": 45.80,
      "browser": 31.50
    },
    "budget": {
      "daily": 100,
      "monthly": 2000,
      "dailyUsedPercent": 82.5,
      "monthlyUsedPercent": 41.2
    }
  }
}
```

### 2. Check Budget Configuration

```bash
echo "Daily: $DFS_DAILY_BUDGET"
echo "Monthly: $DFS_MONTHLY_BUDGET"
echo "Hard limit: $DFS_ENFORCE_HARD_LIMIT"
```

### 3. Check Usage Breakdown

```bash
# By mode
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/usage?groupBy=mode

# By consumer/client
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/usage?groupBy=client

# By domain
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/usage?groupBy=domain
```

### 4. Check Recent DFS Requests

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/requests?limit=50
```

## Root Cause Analysis

### Scenario A: Single Client Spike

**Symptoms:**
- One client using >50% of DFS budget
- Recent large audit or bulk import
- Unusual request volume from single workspace

**Investigation:**
```bash
# Check top DFS consumers
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/usage?groupBy=client&period=day | jq '.top10'
```

**Action:**
1. Contact client if abnormal
2. Apply client-specific DFS rate limit:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/client/{clientId}/limits \
  -d '{"dfsRateLimit": 100, "dfsDailyBudget": 20}'
```

### Scenario B: Browser Mode Overuse

**Symptoms:**
- Browser mode (most expensive) >40% of DFS spend
- Sites being escalated to browser unnecessarily
- Domain learning not working

**Investigation:**
```bash
# Check browser mode usage
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/usage?mode=browser | jq '.domains'

# Check why domains need browser
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domain-learning?minTier=dfs_browser
```

**Action:**
1. Review domains requiring browser mode
2. For false positives, override domain learning:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domain-learning/override \
  -d '{"domain": "example.com", "maxTier": "dfs_js"}'
```
3. Cap browser mode globally if needed:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"maxTier": "dfs_js"}'
```

### Scenario C: Not Using Standard Queue

**Symptoms:**
- Most DFS requests via Live Queue
- Standard Queue utilization <20%
- High per-request costs

**Investigation:**
```bash
# Check queue distribution
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/usage?groupBy=queue
```

**Action:**
1. Enable Standard Queue preference:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"preferStandardQueue": true, "standardQueueThreshold": 0}'
```
2. Set minimum delay threshold (e.g., allow 30s for standard queue):
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"standardQueueMaxWait": 30000}'
```

### Scenario D: Cache Not Effective

**Symptoms:**
- Low cache hit rate for DFS-required domains
- Same URLs being fetched repeatedly
- Cache TTL too short

**Investigation:**
```bash
# Check DFS cache stats
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cache/stats | jq '.dfs'

# Check repeated URLs
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/repeated-urls
```

**Action:**
1. Warm cache for high-traffic DFS domains:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/cache/warm \
  -d '{"domains": ["spa-site.com"], "tier": "dfs_js"}'
```
2. Increase cache TTL for stable content:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"dfsContentCacheTtl": 86400}'
```

### Scenario E: Over-escalation from Lower Tiers

**Symptoms:**
- Many requests escalating through all tiers to DFS
- Lower tier success rate low
- Domain learning not recording

**Investigation:**
```bash
# Check escalation paths
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/escalation-analysis

# Check lower tier success rates
curl https://api.tevero.io/scraping/metrics | jq '.successRateByTier'
```

**Action:**
1. Fix lower tier issues (see circuit breaker runbook)
2. Review domain learning patterns
3. Consider geo-targeting for blocked regions

## Step-by-Step Response Procedure

### Critical Alert Response (>90%, SLA: 1 hour)

**Step 1: Assess Situation (0-10 min)**
```bash
# Current budget status
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=day | jq '.dfs'

# Biggest consumers
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/usage?groupBy=client&limit=5
```

**Step 2: Immediate Cost Reduction (10-30 min)**

**Option A - Force Standard Queue:**
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"preferStandardQueue": true, "standardQueueThreshold": 0}'
```

**Option B - Cap at JS mode (disable browser):**
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"maxTier": "dfs_js"}'
```

**Option C - Throttle high consumers:**
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/client/{clientId}/limits \
  -d '{"dfsRateLimit": 10}'
```

**Step 3: Communicate (30-60 min)**
1. If client-impacting, notify account team
2. Document actions taken

### Warning Alert Response (>75%, SLA: 4 hours)

**Step 1: Analyze (0-1 hour)**
1. Review usage breakdown by mode, client, domain
2. Identify optimization opportunities
3. Check Standard Queue utilization

**Step 2: Optimize (1-3 hours)**
1. Enable Standard Queue if not active
2. Warm cache for high-traffic DFS domains
3. Review and fix domain learning

**Step 3: Document (3-4 hours)**
1. Log findings and optimizations
2. Update budget projections

## Mitigation Actions Reference

### Cost Reduction (Immediate)

| Action | Command | Savings |
|--------|---------|---------|
| Force Standard Queue | `POST /admin/config` | 60-70% |
| Cap at JS mode | `POST /admin/config` | ~65% (vs browser) |
| Throttle consumer | `POST /admin/client/{id}/limits` | Variable |
| Cache warming | `POST /admin/cache/warm` | ~30-50% repeats |

### Budget Management

| Action | Command | Description |
|--------|---------|-------------|
| Increase budget | Update env vars | More headroom |
| Enable hard limit | `DFS_ENFORCE_HARD_LIMIT=true` | Block at limit |
| Per-client budget | `POST /admin/client/{id}/limits` | Isolate spend |

### Monitoring

```bash
# Watch DFS spend rate
watch -n 60 'curl -s -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=hour | jq ".dfs.totalUsd"'

# Watch budget percentage
watch -n 300 'curl -s -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=day | jq ".dfs.budget.dailyUsedPercent"'
```

## Budget Reset Schedule

| Budget | Reset Time | Notes |
|--------|------------|-------|
| Daily | 00:00 UTC | Full reset |
| Monthly | 1st of month, 00:00 UTC | Full reset |

**Timezone Note:** All budget tracking is in UTC.

## Escalation Paths

| Time Elapsed | Action |
|--------------|--------|
| +0 min | On-call investigates |
| +1 hour | If >95%, implement cost reduction |
| +2 hours | If at limit, notify clients |
| +4 hours | Budget review meeting |
| Next day | Retrospective if limit hit |

**Escalation Contacts:**
- Primary: On-call engineer
- Finance notification: billing@tevero.io
- Client notification: support@tevero.io

## Recovery Verification

### 1. Spend Rate Normalized

```bash
# Compare hourly rate
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=hour | jq '.dfs.totalUsd'
```

**Success criteria:** Hourly rate sustainable for remaining budget

### 2. Optimizations Active

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config | jq '{
    standardQueue: .preferStandardQueue,
    maxTier: .maxTier
  }'
```

**Success criteria:** Standard queue enabled, appropriate tier cap

### 3. Alert Resolved

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/alerts/active | jq '.[] | select(.type | contains("dfs"))'
```

**Success criteria:** No DFS budget alerts active

### 4. Budget Under Threshold

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/cost-report?period=day | jq '.dfs.budget.dailyUsedPercent'
```

**Success criteria:** <75% or stable with mitigation in place

## Related Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `scraping_dfs_cost_usd_total` | Total DFS spend | N/A (tracking) |
| `scraping_dfs_budget_used_percent` | Budget utilization | >75% warn, >90% critical |
| `scraping_dfs_requests_total{mode}` | Requests by mode | N/A (tracking) |
| `scraping_dfs_standard_queue_savings` | Savings from queue | <50% = underutilized |
| `scraping_dfs_cache_hit_rate` | DFS cache effectiveness | <30% = optimize |

## Prevention Checklist

- [ ] Standard Queue enabled by default
- [ ] Per-client budget limits set
- [ ] Cache warming for top DFS domains
- [ ] Domain learning tuned to minimize DFS
- [ ] Budget alerts at 50%, 75%, 90%
- [ ] Monthly budget review scheduled
- [ ] Client notification process documented
- [ ] Emergency budget increase process known

---

## Security Note: HTTPS Requirement

**CRITICAL:** All admin API endpoints used in this runbook MUST be accessed over HTTPS.

The `X-Admin-API-Key` header is transmitted with every admin request. Without HTTPS:
- API keys can be intercepted via network sniffing
- Budget controls can be bypassed by unauthorized parties
- Cost limits can be manipulated

**Before using any admin endpoint:**
1. Verify the endpoint URL starts with `https://`
2. Ensure TLS certificate is valid (not expired, not self-signed in production)
3. Check that HTTP requests are redirected to HTTPS

**If you suspect API key compromise:**
1. Rotate `SCRAPING_ADMIN_API_KEY` immediately
2. Review audit logs for unauthorized actions
3. Check for unexpected budget increases or config changes

See [SCRAPING-ENV-VARS.md](../../configuration/SCRAPING-ENV-VARS.md#security-requirements) for full HTTPS deployment requirements.
