# Scraping Infrastructure Operations Runbook

## Table of Contents

1. [System Overview](#system-overview)
2. [Health Checks](#health-checks)
3. [Common Issues](#common-issues)
4. [Alert Response Procedures](#alert-response-procedures)
5. [Maintenance Tasks](#maintenance-tasks)
6. [Emergency Procedures](#emergency-procedures)

---

## System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ScrapingService                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ TieredFetcher │  │ QueueManager  │  │ CostTracker   │       │
│  └───────┬───────┘  └───────┬───────┘  └───────────────┘       │
│          │                  │                                    │
│  ┌───────▼───────┐  ┌───────▼───────┐                           │
│  │ 7 Proxy Tiers │  │ BullMQ Queue  │                           │
│  └───────────────┘  └───────────────┘                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Multi-Level Cache                         ││
│  │  L1 Memory → L2 Redis → L3 PostgreSQL → L4 Cloudflare R2   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Critical? |
|-----------|---------|-----------|
| TieredFetcher | 7-tier proxy escalation | Yes |
| QueueManager | Rate-limited job processing | Yes |
| MultiLevelCache | 4-tier caching | Yes |
| CostTracker | Budget enforcement | Yes |
| AlertManager | Monitoring and alerting | No |
| DomainLearning | Tier optimization | No |

### Dependencies

- **Redis**: Queue storage, L2 cache, rate limiting
- **PostgreSQL**: L3 cache, domain learning persistence
- **Cloudflare R2**: L4 long-term archive (optional)
- **DataForSEO**: Premium proxy tier (API)

---

## Health Checks

### Endpoints

```bash
# Overall health
curl http://localhost:3001/api/scraping/health

# Detailed status
curl http://localhost:3001/api/scraping/status

# Metrics (Prometheus format)
curl http://localhost:3001/api/scraping/metrics
```

### Health Response

```json
{
  "status": "healthy",
  "components": {
    "redis": { "status": "up", "latency_ms": 2 },
    "postgresql": { "status": "up", "latency_ms": 5 },
    "queue": { "status": "up", "waiting": 45, "active": 10 },
    "cache": { "status": "up", "hitRate": 0.85 }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Key Metrics to Monitor

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Error rate | < 5% | 5-15% | > 15% |
| Cache hit rate | > 70% | 50-70% | < 50% |
| Queue waiting | < 1000 | 1000-5000 | > 5000 |
| Daily cost | < $50 | $50-100 | > $100 |
| P95 latency | < 5s | 5-15s | > 15s |

---

## Common Issues

### Issue: High Error Rate

**Symptoms:**
- `scraping.error_rate` > 5%
- Alert: `error-rate-warning` or `error-rate-critical`

**Diagnosis:**
```bash
# Check error breakdown by tier
curl http://localhost:3001/api/scraping/metrics | grep error

# Check circuit breaker states
curl http://localhost:3001/api/scraping/status | jq '.circuits'

# Recent errors in logs
journalctl -u scraping-service -n 100 | grep ERROR
```

**Common Causes:**
1. **Proxy provider outage** - Check provider status pages
2. **Target site blocking** - Domain learning should escalate
3. **Network issues** - Check connectivity to proxy endpoints
4. **Rate limiting** - Reduce concurrency

**Resolution:**
1. Check if specific tier is failing (circuit open)
2. If DataForSEO failing, check API status and credentials
3. If all tiers failing, check network/firewall
4. Consider temporarily reducing scraping volume

---

### Issue: Cost Overrun

**Symptoms:**
- `cost.daily` > $50 (warning) or > $100 (critical)
- Alert: `daily-cost-warning` or `daily-cost-critical`

**Diagnosis:**
```bash
# Check cost breakdown by tier
curl http://localhost:3001/api/scraping/cost-report

# Check which consumers are driving costs
curl http://localhost:3001/api/scraping/cost-report | jq '.byConsumer'
```

**Common Causes:**
1. **Spike in scraping requests** - Check job queue source
2. **Domain learning reset** - Starting from expensive tiers
3. **Cache invalidation** - Massive cache miss
4. **New protected sites** - Escalating to expensive tiers

**Resolution:**
1. Identify high-cost consumer and rate limit
2. Check if domain learning DB was reset
3. Review recent cache invalidation operations
4. Consider adding budget caps per consumer

---

### Issue: Circuit Breaker Open

**Symptoms:**
- Alert: `circuit-open`
- Tier being skipped in escalation

**Diagnosis:**
```bash
# Check which circuits are open
curl http://localhost:3001/api/scraping/circuits

# Check failure history
curl http://localhost:3001/api/scraping/circuits/direct/history
```

**Resolution:**
1. Wait for automatic recovery (circuit half-open after timeout)
2. If underlying issue resolved, force close:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/circuits/direct/close
   ```
3. If issue persists, investigate tier provider

---

### Issue: Queue Backlog

**Symptoms:**
- `queue.waiting` > 1000 (warning) or > 5000 (critical)
- Alert: `queue-backlog-warning` or `queue-backlog-critical`

**Diagnosis:**
```bash
# Check queue stats
curl http://localhost:3001/api/scraping/queue/stats

# Check worker count
curl http://localhost:3001/api/scraping/queue/workers
```

**Common Causes:**
1. **Burst of jobs** - Normal during audits
2. **Worker failures** - Check worker health
3. **Rate limiting** - Per-domain limits backing up
4. **Slow tiers** - High latency causing backlog

**Resolution:**
1. If temporary burst, wait for processing
2. Scale workers: `pnpm queue:workers --scale 5`
3. If rate limited, review limit settings
4. Clear stale jobs if necessary:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/queue/drain?older_than=3600
   ```

---

### Issue: Low Cache Hit Rate

**Symptoms:**
- `cache.hit_rate` < 50%
- Higher than expected costs

**Diagnosis:**
```bash
# Check cache stats by level
curl http://localhost:3001/api/scraping/cache/stats

# Check memory cache size
curl http://localhost:3001/api/scraping/cache/l1/stats
```

**Common Causes:**
1. **New domains** - No cache built yet
2. **Cache eviction** - Memory pressure
3. **TTL expired** - Mass expiration
4. **Cache corruption** - Redis issues

**Resolution:**
1. Pre-warm cache for known domains:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/cache/warm \
     -d '{"domains": ["example.com", "other.com"]}'
   ```
2. Increase L1 cache size in config
3. Check Redis memory usage
4. If corrupted, invalidate and rebuild:
   ```bash
   curl -X POST http://localhost:3001/api/scraping/cache/rebuild
   ```

---

## Alert Response Procedures

### Critical Alerts (PagerDuty)

**Response SLA:** 15 minutes

1. Acknowledge alert in PagerDuty
2. Check system health: `curl .../health`
3. Follow runbook section for specific alert
4. If cannot resolve, escalate to on-call engineer
5. Post incident summary in #scraping-incidents

### Warning Alerts (Slack)

**Response SLA:** 1 hour

1. Acknowledge in thread
2. Investigate using diagnosis steps
3. Apply fix or document as known issue
4. Update status if recurring

---

## Maintenance Tasks

### Daily

- [ ] Review cost report
- [ ] Check error rate trends
- [ ] Verify backup completion

### Weekly

- [ ] Review domain learning effectiveness
- [ ] Analyze cache hit rate trends
- [ ] Clean up stale queue jobs
- [ ] Review alert noise

### Monthly

- [ ] Rotate API credentials
- [ ] Review and update rate limits
- [ ] Analyze cost optimization opportunities
- [ ] Update runbook with new learnings

---

## Emergency Procedures

### Complete Service Outage

1. Check all dependencies (Redis, PostgreSQL)
2. Check container/process status
3. Review recent deployments
4. If cannot recover, rollback to last known good

```bash
# Rollback deployment
kubectl rollout undo deployment/scraping-service

# Or restart service
systemctl restart scraping-service
```

### Data Corruption

1. Stop service immediately
2. Preserve corrupted state for analysis
3. Restore from backup
4. Replay any lost jobs from audit trail

### Budget Emergency Stop

If costs exceed emergency threshold:

```bash
# Emergency stop all scraping
curl -X POST http://localhost:3001/api/scraping/emergency-stop

# This will:
# - Pause all queues
# - Block new requests
# - Send alert to all channels
```

To resume after investigation:

```bash
curl -X POST http://localhost:3001/api/scraping/resume
```
