# Runbook: Circuit Breaker Open

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `circuit-open` | Warning | Any circuit open | 30 min |

## Impact Assessment

**Business Impact:**
- Tier unavailable, traffic escalates to more expensive tiers
- If highest tier circuit opens, requests fail entirely
- Cost increase if low-cost tier circuits are open

**Technical Impact:**
- Requests bypass open circuit tier
- Automatic escalation to next tier
- If all circuits open, scraping fails with circuit breaker error

## Understanding Circuit Breakers

### Purpose

Circuit breakers protect the system from:
- Cascade failures when a tier is down
- Wasting resources on known-failing requests
- Overloading recovering services

### States

| State | Description | Behavior |
|-------|-------------|----------|
| `closed` | Normal operation | All requests pass through |
| `open` | Tier failing | Fast-fail, skip tier |
| `half-open` | Testing recovery | Limited requests pass |

### Tier Circuit Configuration

| Tier | Failure Threshold | Reset Timeout | Success Threshold |
|------|-------------------|---------------|-------------------|
| direct | 5 failures | 60s | 2 successes |
| webshare | 5 failures | 60s | 2 successes |
| geonode | 5 failures | 120s | 2 successes |
| camoufox | 3 failures | 180s | 2 successes |
| dfs_basic | 3 failures | 300s | 2 successes |
| dfs_js | 3 failures | 300s | 2 successes |
| dfs_browser | 3 failures | 300s | 2 successes |

**Auto-recovery flow:**
1. After threshold failures in window, circuit opens
2. Circuit stays open for reset timeout period
3. Circuit transitions to half-open, allows test requests
4. On success threshold, circuit closes
5. On any failure in half-open, circuit reopens

## Quick Diagnosis

### 1. Check Which Circuits Are Open

```bash
curl https://api.tevero.io/scraping/health/circuits
```

Example response:
```json
{
  "circuits": [
    { "tier": "direct", "state": "closed", "failures": 0 },
    { "tier": "webshare", "state": "open", "failures": 5, "openedAt": "2024-01-15T10:25:00Z" },
    { "tier": "geonode", "state": "closed", "failures": 1 },
    { "tier": "camoufox", "state": "closed", "failures": 0 },
    { "tier": "dfs_basic", "state": "half-open", "failures": 3 },
    { "tier": "dfs_js", "state": "closed", "failures": 0 },
    { "tier": "dfs_browser", "state": "closed", "failures": 0 }
  ]
}
```

### 2. Check Circuit Statistics

```bash
curl https://api.tevero.io/scraping/health/circuits | jq '.circuits[] | select(.state != "closed")'
```

### 3. Check Circuit History

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/circuits/{tier}/history?limit=10
```

### 4. Check Recent Failures for Tier

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/errors?tier={tier}&limit=20
```

## Root Cause by Tier

### T0 (Direct) Circuit Open

**Likely Causes:**
- Network connectivity issues
- Target sites blocking server IP
- DNS resolution failures

**Impact:** Low - traffic escalates to Webshare (T1)

**Investigation:**
```bash
# Test direct connectivity
curl -I https://example.com

# Check DNS
dig example.com

# Check if IP is blacklisted
curl https://api.tevero.io/scraping/admin/ip-reputation
```

**Action:** Usually wait for auto-recovery. Direct tier is opportunistic.

### T1 (Webshare) Circuit Open

**Likely Causes:**
- Webshare service outage
- API key issues
- Bandwidth quota exceeded

**Impact:** Low-Medium - traffic escalates to Geonode (T2)

**Investigation:**
```bash
# Check Webshare status
curl https://api.webshare.io/v2/health

# Check API key validity
curl -H "x-api-key: $WEBSHARE_API_KEY" \
  https://api.webshare.io/v2/proxy/list
```

**Provider Status:** https://status.webshare.io

**Action:**
1. Check Webshare dashboard for quota/billing issues
2. If provider down, wait for recovery
3. If API key issue, rotate credentials

### T2 (Geonode) Circuit Open

**Likely Causes:**
- Geonode residential proxy service issue
- Bandwidth exceeded
- Authentication failure

**Impact:** Medium - traffic goes to expensive Camoufox/DFS tiers

**Investigation:**
```bash
# Test Geonode connectivity
curl -x "http://$GEONODE_USERNAME:$GEONODE_PASSWORD@proxy.geonode.io:9000" \
  https://httpbin.org/ip

# Check usage
curl -H "Authorization: Bearer $GEONODE_API_KEY" \
  https://api.geonode.com/v1/usage
```

**Provider Status:** https://status.geonode.com

**Action:**
1. Verify Geonode dashboard for bandwidth quota
2. Check billing status
3. If quota exceeded, consider upgrading plan or waiting for reset
4. Force close circuit if provider confirmed healthy

### T3 (Camoufox) Circuit Open

**Likely Causes:**
- Local browser pool exhausted
- Memory pressure on server
- Browser crashes

**Impact:** Medium - traffic escalates to DataForSEO tiers

**Investigation:**
```bash
# Check Camoufox pool status
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/camoufox/pool

# Check server memory
free -h

# Check for zombie browser processes
ps aux | grep -i camoufox | wc -l
```

**Action:**
1. If pool exhausted, wait for browsers to recycle
2. If memory issue, increase server memory or reduce pool size
3. Kill zombie processes if any:
```bash
pkill -f camoufox
```
4. Restart Camoufox pool:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/camoufox/restart
```

### T4/T5/T6 (DataForSEO) Circuit Open

**Likely Causes:**
- DataForSEO API outage
- API rate limit exceeded
- Budget exhausted
- Authentication failure

**Impact:** High - no fallback for JS/browser rendering

**Investigation:**
```bash
# Check DataForSEO API status
curl -u "$DATAFORSEO_API_KEY" \
  https://api.dataforseo.com/v3/serp/google/organic/live

# Check DFS budget
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/budget

# Check DFS rate limit status
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/dfs/rate-limit
```

**Provider Status:** https://status.dataforseo.com

**Action:**
1. Check DataForSEO dashboard for API status
2. Verify API credentials are valid
3. Check if budget exhausted (see DFS Budget runbook)
4. If rate limited, wait for quota reset
5. Force close circuit only if API confirmed healthy

## Step-by-Step Response Procedure

### Alert Response (SLA: 30 min)

**Step 1: Identify Open Circuits (0-5 min)**
```bash
curl https://api.tevero.io/scraping/health/circuits | jq '.circuits[] | select(.state != "closed")'
```

**Step 2: Assess Impact (5-10 min)**

Determine tier criticality:
- T0-T1 open: Low impact, auto-recovery likely
- T2 open: Medium impact, check provider
- T3+ open: High impact, immediate action needed

**Step 3: Investigate Root Cause (10-20 min)**

Follow tier-specific investigation above.

**Step 4: Take Action (20-30 min)**

Based on root cause:

**Option A - Wait for Auto-Recovery:**
Most circuits will self-recover. Monitor:
```bash
watch -n 10 'curl -s https://api.tevero.io/scraping/health/circuits | jq ".circuits"'
```

**Option B - Force Close Circuit:**
Only if you've verified upstream is healthy:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/circuits/{tier}/close
```

**Option C - Force Open Circuit:**
To manually disable a tier (e.g., during maintenance):
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/circuits/{tier}/open
```

**Option D - Adjust Circuit Parameters:**
For persistent issues, tune thresholds:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"circuitBreakers": {"geonode": {"failureThreshold": 10, "resetTimeout": 300000}}}'
```

## Mitigation Actions Reference

| Action | Command | When to Use |
|--------|---------|-------------|
| Force close | `POST /circuits/{tier}/close` | Provider recovered |
| Force open | `POST /circuits/{tier}/open` | Planned maintenance |
| Reset circuit | `POST /circuits/{tier}/reset` | Clear failure count |
| Adjust threshold | `POST /admin/config` | Tune sensitivity |

## Escalation Paths

| Time Elapsed | Action |
|--------------|--------|
| +0 min | On-call investigates |
| +15 min | If DFS tiers open, check provider status |
| +30 min | If not recovering, escalate to senior engineer |
| +1 hour | If all tiers affected, consider emergency measures |

**Tier-specific escalation:**
- T0-T2: Can wait for auto-recovery (low urgency)
- T3: Monitor server resources (medium urgency)
- T4-T6: Check DataForSEO immediately (high urgency)

## Recovery Verification

### 1. Circuit Closed

```bash
curl https://api.tevero.io/scraping/health/circuits | jq '.circuits[] | select(.tier == "{tier}")'
```

**Success criteria:** `state: "closed"`, `failures: 0`

### 2. Tier Processing Requests

```bash
# Check recent requests through tier
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/requests?tier={tier}&limit=5
```

**Success criteria:** Recent successful requests

### 3. Error Rate Normal

```bash
curl https://api.tevero.io/scraping/metrics | jq '.errorRate'
```

**Success criteria:** Error rate <5%

### 4. No Alert Active

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/alerts/active | jq '.[] | select(.type == "circuit-open")'
```

**Success criteria:** Empty result (no circuit alerts)

## Related Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `scraping_circuit_state{tier}` | State (0=closed, 1=half-open, 2=open) | Any >0 |
| `scraping_circuit_failures{tier}` | Current failure count | N/A (trending) |
| `scraping_circuit_trips_total{tier}` | Total times circuit tripped | N/A (trending) |
| `scraping_circuit_recovery_time{tier}` | Time to recover | >5min warning |

## Prevention Checklist

- [ ] Circuit thresholds tuned per tier based on historical data
- [ ] Reset timeouts appropriate for tier recovery speed
- [ ] Provider status pages monitored
- [ ] Credentials validated regularly
- [ ] Budget alerts set before circuit-triggering exhaustion
- [ ] Local browser pool (Camoufox) sized appropriately
- [ ] Memory limits set to prevent OOM kills
