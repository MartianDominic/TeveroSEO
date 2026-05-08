# Runbook: Queue Backlog

## Alert Details

| Alert | Severity | Threshold | SLA |
|-------|----------|-----------|-----|
| `queue-backlog-warning` | Warning | >1000 jobs | 1 hour |
| `queue-backlog-critical` | Critical | >5000 jobs | 15 min |

## Impact Assessment

**Business Impact:**
- Delayed audit completions
- Increased time-to-insight for clients
- Background jobs (cache warming, learning) deferred
- SLA violations for time-sensitive features

**Technical Impact:**
- Memory pressure in Redis (job data storage)
- Potential job timeouts and retries
- Worker resource contention
- Downstream service queuing

## Queue Architecture

### Queue Types

| Queue | Priority | Concurrency | Purpose |
|-------|----------|-------------|---------|
| `scraping:priority` | High | 50 | UI-triggered, real-time requests |
| `scraping:standard` | Normal | 100 | API requests, scheduled jobs |
| `scraping:background` | Low | 50 | Cache warming, batch imports |

### Queue Orchestration

- Priority queue >50% utilized: background queue paused
- Priority queue >80% utilized: standard queue throttled
- All queues use Redis for persistence
- Jobs have configurable TTL and retry policy

## Quick Diagnosis

### 1. Check Queue Depths

```bash
curl https://api.tevero.io/scraping/health/queues
```

Expected response:
```json
{
  "queues": {
    "priority": { "waiting": 45, "active": 48, "completed": 12340, "failed": 12 },
    "standard": { "waiting": 250, "active": 95, "completed": 45670, "failed": 89 },
    "background": { "waiting": 1200, "active": 45, "completed": 8900, "failed": 34 }
  },
  "totalWaiting": 1495,
  "totalActive": 188
}
```

### 2. Check Worker Status

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/workers
```

### 3. Check Processing Rate

```bash
curl https://api.tevero.io/scraping/metrics | jq '.queues'
```

Key metrics:
- `processingRate`: jobs/second
- `avgProcessingTime`: time per job
- `waitTime`: time in queue before processing

### 4. Check Job Age Distribution

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/age-distribution
```

## Root Cause Analysis

### Scenario A: Workers Not Processing

**Symptoms:**
- Queue growing continuously
- Active job count = 0 or near 0
- No processing rate

**Cause:** Worker crash, Redis connection lost, deployment issue

**Investigation:**
```bash
# Check worker process status
systemctl status scraping-worker

# Check worker logs
journalctl -u scraping-worker -n 50 --since="30 minutes ago"

# Check Redis connectivity
redis-cli PING

# Check BullMQ connection
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/bullmq/status
```

**Action:**
1. If worker crashed, restart:
```bash
systemctl restart scraping-worker
# Or via kubectl
kubectl rollout restart deployment/scraping-worker
```
2. If Redis connection lost, check Redis health
3. If deployment stuck, check Kubernetes events

### Scenario B: Processing Slower Than Intake

**Symptoms:**
- Queue growing but active count is normal
- Processing rate lower than historical average
- High latency per job

**Cause:** Increased load, slow upstream, rate limiting active

**Investigation:**
```bash
# Check current intake rate
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/intake-rate

# Compare with processing rate
curl https://api.tevero.io/scraping/metrics | jq '{intake: .intakeRate, processing: .processingRate}'

# Check if rate limited
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/rate-limits
```

**Action:**
1. If temporary spike (bulk import, large audit), wait for processing
2. If sustained, increase worker concurrency:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"workerConcurrency": 75}'
```
3. If rate limited, review limit settings

### Scenario C: Stuck Jobs

**Symptoms:**
- Some jobs showing very old timestamps
- Active count includes old jobs
- Specific domains or job types stuck

**Cause:** Jobs hitting infinite retry, dependency stuck, worker deadlock

**Investigation:**
```bash
# Check oldest jobs
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/oldest?limit=10

# Check stuck job details
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/jobs/{jobId}

# Check for retry loops
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/jobs/high-retry
```

**Action:**
1. Identify stuck jobs pattern
2. Move to failed queue if unrecoverable:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/jobs/{jobId}/fail \
  -d '{"reason": "manual - stuck job"}'
```
3. Fix underlying issue (domain blocked, credential expired)

### Scenario D: Redis Memory Pressure

**Symptoms:**
- Redis memory >80% used
- Jobs being evicted
- Intermittent connection failures

**Cause:** Job data accumulating, no cleanup, memory limit too low

**Investigation:**
```bash
# Check Redis memory
redis-cli INFO memory

# Check job data size
redis-cli MEMORY USAGE bull:scraping:priority:waiting

# Check completed job retention
redis-cli LLEN bull:scraping:standard:completed
```

**Action:**
1. Clean up old completed jobs:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/cleanup \
  -d '{"olderThan": "24h", "states": ["completed", "failed"]}'
```
2. Reduce job retention settings
3. Increase Redis memory limit

### Scenario E: Priority Queue Starvation

**Symptoms:**
- Priority queue backlogged while background idle
- Or: Background never processing
- Queue orchestration not working

**Cause:** Orchestration misconfigured, priority jobs too heavy

**Investigation:**
```bash
# Check queue orchestration state
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/orchestration

# Check priority job characteristics
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/job-profile?queue=priority
```

**Action:**
1. Verify orchestration thresholds
2. If priority too heavy, move some to standard:
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/rebalance \
  -d '{"from": "priority", "to": "standard", "count": 100}'
```

## Step-by-Step Response Procedure

### Critical Alert Response (>5000 jobs, SLA: 15 min)

**Step 1: Immediate Assessment (0-5 min)**
```bash
# Quick health check
curl https://api.tevero.io/scraping/health/queues | jq '{
  totalWaiting: .totalWaiting,
  totalActive: .totalActive,
  worstQueue: (.queues | to_entries | max_by(.value.waiting) | {name: .key, waiting: .value.waiting})
}'
```

**Step 2: Check Workers (5-10 min)**
```bash
# Worker status
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/workers

# If workers down, restart immediately
systemctl restart scraping-worker
```

**Step 3: Scale or Drain (10-15 min)**

**Option A - Scale workers:**
```bash
# Kubernetes
kubectl scale deployment scraping-worker --replicas=5

# Or increase concurrency
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/config \
  -d '{"workerConcurrency": 100}'
```

**Option B - Drain old jobs (last resort):**
```bash
# Only drain jobs older than 1 hour
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/drain?older_than=3600000
```

**Option C - Pause intake:**
```bash
curl -X POST -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/queue/pause?queue=background
```

### Warning Alert Response (>1000 jobs, SLA: 1 hour)

**Step 1: Investigate (0-30 min)**
1. Check queue depths by type
2. Identify if normal spike or issue
3. Review worker health

**Step 2: Optimize (30-60 min)**
1. Scale workers if needed
2. Clear stuck jobs if any
3. Adjust orchestration if needed

## Mitigation Actions Reference

### Immediate

| Action | Command | Impact |
|--------|---------|--------|
| Restart workers | `systemctl restart scraping-worker` | Brief gap in processing |
| Scale workers | `kubectl scale deployment` | More parallel processing |
| Increase concurrency | `POST /admin/config` | More jobs per worker |
| Pause background | `POST /admin/queue/pause?queue=background` | Prioritize real-time |
| Drain old jobs | `POST /admin/queue/drain` | Jobs lost |

### Recovery

| Action | Command | Description |
|--------|---------|-------------|
| Resume queue | `POST /admin/queue/resume` | Unpause queue |
| Rebalance | `POST /admin/queue/rebalance` | Move jobs between queues |
| Reset workers | `POST /admin/workers/reset` | Clear worker state |

### Monitoring

```bash
# Watch queue depths every 10 seconds
watch -n 10 'curl -s https://api.tevero.io/scraping/health/queues | jq ".totalWaiting"'

# Watch processing rate
watch -n 10 'curl -s https://api.tevero.io/scraping/metrics | jq ".processingRate"'
```

## Escalation Paths

| Time Elapsed | Action |
|--------------|--------|
| +0 min | On-call investigates |
| +15 min | If critical and workers unresponsive, restart |
| +30 min | If not recovering, scale infrastructure |
| +1 hour | If still growing, consider partial drain |
| +2 hours | Incident review |

**Escalation Contacts:**
- Primary: On-call engineer
- Secondary: Platform team lead
- Infrastructure: devops@tevero.io

## Recovery Verification

### 1. Queue Depth Decreasing

```bash
# Check trend over 5 minutes
for i in 1 2 3 4 5; do
  curl -s https://api.tevero.io/scraping/health/queues | jq '.totalWaiting'
  sleep 60
done
```

**Success criteria:** Consistent decrease in waiting jobs

### 2. Workers Active

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/admin/workers | jq '.active'
```

**Success criteria:** Active workers > 0

### 3. Processing Rate Positive

```bash
curl https://api.tevero.io/scraping/metrics | jq '.processingRate'
```

**Success criteria:** Processing rate > intake rate

### 4. No Failed Jobs Spiking

```bash
curl https://api.tevero.io/scraping/health/queues | jq '.queues | map(.failed)'
```

**Success criteria:** Failed count stable or decreasing

### 5. Alert Resolved

```bash
curl -H "x-scraping-admin-key: $ADMIN_KEY" \
  https://api.tevero.io/scraping/alerts/active | jq '.[] | select(.type | contains("queue"))'
```

**Success criteria:** No queue-related alerts

## Related Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `scraping_queue_jobs{state="waiting"}` | Jobs waiting | >1000 warn, >5000 critical |
| `scraping_queue_jobs{state="active"}` | Jobs processing | =0 for >5min = critical |
| `scraping_queue_jobs{state="failed"}` | Failed jobs | >100/hour |
| `scraping_queue_processing_rate` | Jobs/second | <1 for >10min |
| `scraping_queue_wait_time_p95` | 95th percentile wait | >5min |
| `scraping_queue_job_duration_p99` | 99th percentile duration | >30s |

## Prevention Checklist

- [ ] Worker auto-restart configured (systemd/kubernetes)
- [ ] Queue depth monitoring active
- [ ] Worker health checks configured
- [ ] Redis memory limits set
- [ ] Completed job retention policy set
- [ ] Queue orchestration thresholds tuned
- [ ] Auto-scaling rules defined
- [ ] Intake rate limiting configured
