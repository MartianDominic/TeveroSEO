# Runbook: High Error Rate

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `error-rate-warning` | Warning | >5% | 30 min |
| `error-rate-critical` | Critical | >15% | 10 min |

## Impact Assessment

**Business Impact:**
- Failed scrape requests delay audits and content analysis
- Increased costs as failed requests may trigger retries
- Client-facing features degraded (competitor analysis, SERP content)

**Technical Impact:**
- Circuit breakers may trip, cascading to higher tiers
- Queue backlog builds as failed jobs retry
- Dependent services (audits, briefs) receive incomplete data

## Quick Diagnosis

### 1. Check Overall Health

```bash
curl https://api.tevero.io/scraping/health/detailed
```

Expected healthy response:
```json
{
  "status": "healthy",
  "components": {
    "redis": { "status": "up", "latency_ms": 2 },
    "postgresql": { "status": "up", "latency_ms": 5 },
    "queue": { "status": "up", "waiting": 45, "active": 10 },
    "cache": { "status": "up", "hitRate": 0.85 }
  }
}
```

### 2. Check Circuit Breaker States

```bash
curl https://api.tevero.io/scraping/health/circuits
```

Look for any circuits in `open` or `half-open` state.

### 3. Check Error Breakdown

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/metrics | jq '.errors'
```

Key metrics:
- `errorsByTier`: Which tiers are failing
- `errorsByType`: Timeout, 4xx, 5xx, connection refused
- `errorsByDomain`: Are specific domains failing

### 4. Check Recent Error Logs

```bash
# Last 100 errors
journalctl -u scraping-service -n 100 --grep="ERROR" --since="1 hour ago"

# Or via API
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/logs?level=error&limit=50
```

## Root Cause Analysis

### Scenario A: Single Tier Failing

**Symptoms:**
- One tier has >50% error rate, others normal
- Circuit breaker open for specific tier
- Traffic escalating to next tier

**Cause:** Upstream provider outage or rate limiting

**Investigation:**
```bash
# Check tier-specific error rate
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/metrics | jq '.errorsByTier'

# Check provider-specific status
curl https://api.tevero.io/scraping/health/providers
```

**Action:**
1. Check provider status pages:
   - DataForSEO: https://status.dataforseo.com
   - Webshare: https://status.webshare.io
   - Geonode: https://status.geonode.com
2. If provider down, let circuit breaker handle escalation
3. If resolved, force close circuit if needed

### Scenario B: Target Sites Blocking

**Symptoms:**
- Errors concentrated on specific domains
- 403 Forbidden or challenge pages returned
- Works on higher tiers (DFS Browser)

**Cause:** Anti-bot detection, IP blocks, rate limiting by target

**Investigation:**
```bash
# Check domain-specific errors
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domains/errors?limit=20

# Check if domain learning suggests higher tier
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domain-learning?domain=example.com
```

**Action:**
1. Review domain learning for affected domains
2. Force tier escalation for blocked domains:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domain-learning/override \
  -d '{"domain": "example.com", "minTier": "geonode"}'
```
3. Consider geo-targeting changes for geo-blocked domains

### Scenario C: Infrastructure Issue

**Symptoms:**
- All tiers failing simultaneously
- Health checks show component down
- Network connectivity issues

**Cause:** Redis down, PostgreSQL down, network/firewall issue

**Investigation:**
```bash
# Check Redis
redis-cli PING

# Check PostgreSQL
pg_isready -h localhost -p 5432

# Check network connectivity to providers
curl -I https://api.dataforseo.com
curl -I https://proxy.webshare.io
curl -I https://proxy.geonode.io
```

**Action:**
1. If Redis down: restart Redis, check memory
2. If PostgreSQL down: check disk space, connections
3. If network issue: check firewall rules, VPN status

### Scenario D: Rate Limiting Triggered

**Symptoms:**
- 429 Too Many Requests errors
- Adaptive backoff active
- Request rate higher than normal

**Cause:** Exceeded rate limits on providers or target sites

**Investigation:**
```bash
# Check rate limiter state
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/rate-limits

# Check adaptive backoff multipliers
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/backoff-state
```

**Action:**
1. Let adaptive backoff handle recovery (automatic)
2. If persistent, reduce global concurrency:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"maxConcurrency": 100}'
```
3. Review per-domain rate limits

### Scenario E: Code/Configuration Bug

**Symptoms:**
- Errors started after recent deployment
- Consistent error pattern across all requests
- Parse errors or type errors in logs

**Cause:** Bug in scraping code or misconfiguration

**Investigation:**
```bash
# Check recent deployments
git log --oneline -10 --since="2 hours ago"

# Check for stack traces
journalctl -u scraping-service --grep="TypeError|ParseError|SyntaxError" -n 20
```

**Action:**
1. If deployment-related: rollback
```bash
kubectl rollout undo deployment/scraping-service
# Or
git revert HEAD && git push
```
2. If config-related: revert config change

## Step-by-Step Response Procedure

### Critical Alert Response (>15%, SLA: 10 min)

**Step 1: Immediate Assessment (0-3 min)**
1. Acknowledge alert
2. Check system health: `curl .../health/detailed`
3. Check circuit states: `curl .../health/circuits`

**Step 2: Identify Scope (3-5 min)**

Is it isolated or widespread?
```bash
# Quick triage query
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/metrics | jq '{
    errorRate: .errorRate,
    openCircuits: [.circuits[] | select(.state == "open") | .tier],
    topErrorDomains: .errorsByDomain | keys[:5]
  }'
```

**Step 3: Mitigate (5-10 min)**

Based on scope:

**Option A - Single tier failing:**
```bash
# Force circuit open to skip failing tier
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/circuits/{tier}/open
```

**Option B - Widespread infrastructure issue:**
```bash
# Emergency stop to prevent cascade
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/emergency-stop
```

**Option C - Specific domains causing issues:**
```bash
# Block problematic domains temporarily
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/domains/block \
  -d '{"domains": ["problem-site.com"], "duration": "1h"}'
```

**Step 4: Communicate**
1. Post in #scraping-incidents with current status
2. If client-impacting, notify support team

### Warning Alert Response (>5%, SLA: 30 min)

**Step 1: Investigate (0-15 min)**
1. Review error breakdown by tier and domain
2. Check for recent changes (deployments, configs)
3. Identify root cause scenario

**Step 2: Apply Fix (15-25 min)**
1. Follow scenario-specific actions above
2. Monitor error rate trend

**Step 3: Document (25-30 min)**
1. Log findings and actions taken
2. Update runbook if new pattern

## Mitigation Actions Reference

### Immediate (Critical)

| Action | Command | When to Use |
|--------|---------|-------------|
| Force circuit open | `POST /circuits/{tier}/open` | Single tier failing, skip it |
| Force circuit close | `POST /circuits/{tier}/close` | False positive, tier recovered |
| Emergency stop | `POST /admin/emergency-stop` | Widespread failure |
| Block domains | `POST /admin/domains/block` | Specific sites causing issues |
| Reduce concurrency | `POST /admin/config` | Rate limiting triggered |

### Recovery

| Action | Command | Description |
|--------|---------|-------------|
| Resume service | `POST /admin/resume` | After emergency stop |
| Unblock domains | `POST /admin/domains/unblock` | Remove temporary blocks |
| Reset backoff | `POST /admin/backoff/reset` | Clear all backoff multipliers |

### Monitoring Recovery

```bash
# Watch error rate every 5 seconds
watch -n 5 'curl -s https://api.tevero.io/scraping/metrics | jq ".errorRate"'

# Watch circuit states
watch -n 10 'curl -s https://api.tevero.io/scraping/health/circuits | jq ".circuits"'
```

## Escalation Paths

| Time Elapsed | Action |
|--------------|--------|
| +0 min | On-call investigates |
| +10 min | If critical and spreading, emergency stop |
| +15 min | Page senior engineer if not resolved |
| +30 min | Notify affected clients if service degraded |
| +1 hour | Incident review and postmortem initiated |

**Escalation Contacts:**
- Primary: On-call engineer (PagerDuty)
- Secondary: Platform team lead
- Client notification: support@tevero.io

## Recovery Verification

### 1. Error Rate Normalized

```bash
# Check current error rate
curl https://api.tevero.io/scraping/metrics | jq '.errorRate'
```

**Success criteria:** Error rate <5%

### 2. All Circuits Closed

```bash
curl https://api.tevero.io/scraping/health/circuits | jq '.circuits[] | select(.state != "closed")'
```

**Success criteria:** No circuits in open state (empty result)

### 3. Queue Processing Normally

```bash
curl https://api.tevero.io/scraping/health/queues
```

**Success criteria:**
- Active workers > 0
- Failed jobs not increasing
- Processing rate stable

### 4. No Error Spike in Logs

```bash
journalctl -u scraping-service --since="5 minutes ago" | grep -c ERROR
```

**Success criteria:** Error count consistent with normal operations (<10/min)

## Related Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `scraping_error_rate` | Overall error percentage | >5% warn, >15% critical |
| `scraping_circuit_state{tier}` | Circuit breaker state | Any open = alert |
| `scraping_requests_total{status="error"}` | Total error count | N/A (trend) |
| `scraping_tier_errors{tier}` | Errors by proxy tier | >50% per tier |
| `scraping_error_type{type}` | Breakdown by error type | N/A (diagnostic) |
| `scraping_request_duration_p99` | 99th percentile latency | >30s |

## Prevention Checklist

- [ ] Circuit breakers configured per tier
- [ ] Adaptive backoff enabled
- [ ] Domain learning active
- [ ] Rate limits set per provider
- [ ] Health check monitoring active
- [ ] Provider status pages bookmarked
- [ ] Recent deployments reversible
