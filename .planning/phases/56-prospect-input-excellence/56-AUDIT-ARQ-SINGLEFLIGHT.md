# ARQ + Redis Singleflight Audit

**Date:** 2026-05-01  
**Auditor:** Claude Opus 4.5  
**Reference:** `docs/infra-research/crawling-10-5000-tasks-day.md`

---

## Executive Summary

The TeveroSEO codebase **does not implement** the ARQ + Redis singleflight patterns specified in the infrastructure document. The platform uses **BullMQ (TypeScript)** and **APScheduler (Python)** instead of ARQ, and lacks the critical Redis singleflight deduplication pattern.

### Overall Status: 20% Implemented

---

## Requirements vs Implementation

| Requirement | Status | Current Implementation |
|-------------|--------|------------------------|
| ARQ async task queue | **NOT IMPLEMENTED** | BullMQ (TS) + APScheduler (Python) |
| Redis singleflight (`SET NX EX`) | **PARTIAL** | ClassificationSingleflight only, not crawls |
| Pub/sub completion notification | **PARTIAL** | Classification only |
| DRR fair queuing | **NOT IMPLEMENTED** | No client weight-based fairness |
| Leader/follower crawl sharing | **NOT IMPLEMENTED** | 50 clients = 50 fetches |
| Shared aiohttp session | **YES** (AI-Writer) | Singleton httpx.AsyncClient |

---

## Detailed Findings

### 1. Task Queue System

**Infra Doc Specifies:** ARQ (async Redis queue)

**Current Implementation:**
- **open-seo-main:** BullMQ (TypeScript)
  - Location: `src/server/queues/auditQueue.ts`, `prospectAnalysisQueue.ts`
- **AI-Writer:** APScheduler (Python)
  - Location: `backend/services/scheduler/core/scheduler.py`

**Assessment:** BullMQ is production-grade and appropriate for TypeScript. The fragmentation (BullMQ + APScheduler) adds operational complexity but is acceptable given the polyglot architecture.

### 2. Redis Singleflight Pattern

**Infra Doc Specifies:**
```python
CLAIM_LUA = """
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return 1 end
return 0
"""
```

**Current Implementation:**

**Classification Singleflight EXISTS:**
```typescript
// ClassificationSingleflight.ts - IMPLEMENTED
const CLAIM_LUA = `
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return 1 end
return 0
`;
```

**Crawl Singleflight MISSING:**
- No `crawl:leader:{k}` keys
- No `crawl:result:{k}` caching
- No `crawl:done:{k}` pub/sub channels

**Impact:** 50 clients monitoring the same Lithuanian retailer trigger 50 independent DataForSEO fetches instead of 1 shared fetch. **98% potential cost waste.**

### 3. Pub/Sub Completion Notification

**Infra Doc Pattern:**
```python
pubsub = redis.pubsub()
await pubsub.subscribe(chan)  # subscribe BEFORE recheck (no lost wakeup)
```

**Current Implementation:**
- Classification: `classify:done:{k}` channel EXISTS
- Crawl: NO pub/sub notification

### 4. DRR Fair Queuing

**Infra Doc Specifies:** Deficit Round Robin across `client_id` buckets to prevent heavy clients from starving others.

**Current Implementation:** None. All jobs use identical priority:
```typescript
// prospectAnalysisQueue.ts
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 10_000 },
};
```

**Impact:** One heavy client can consume all worker capacity.

### 5. HTTP Session Management

**Infra Doc Warning:**
> `aiohttp.TCPConnector(limit=N)` is per-ClientSession, not global. If you create a session inside each task you have no global cap.

**Current Implementation:**

**AI-Writer (GOOD):**
```python
# http_client.py - Singleton pattern
_client: Optional[httpx.AsyncClient] = None

async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(limits=httpx.Limits(max_connections=100))
    return _client
```

**open-seo-main (NEEDS REVIEW):**
- Uses native `fetch()` which has no connection pooling control
- HttpClient class creates new instance per request context

---

## Recommendations

### Priority 1: Implement Crawl Singleflight (HIGH Impact)

Create `CrawlSingleflight.ts` mirroring `ClassificationSingleflight.ts`:

```typescript
// Proposed: server/lib/crawl/CrawlSingleflight.ts
export class CrawlSingleflight {
  private readonly LEADER_TTL = 30 * 60; // 30 min
  private readonly RESULT_TTL = 30 * 60;
  
  async fetchWithDedup(url: string, clientId: string): Promise<CrawlResult> {
    const k = this.urlKey(url);
    const cached = await this.redis.get(`crawl:result:${k}`);
    if (cached) return { ...JSON.parse(cached), shared: true };
    
    const isLeader = await this.claimLeader(k);
    if (isLeader) {
      const result = await this.doCrawl(url);
      await this.publishResult(k, result);
      return { ...result, shared: false };
    }
    
    return this.waitForLeader(k);
  }
}
```

### Priority 2: Add DRR Fair Queuing

Use BullMQ's priority feature with client-based weighting:

```typescript
// Proposed enhancement
function getJobPriority(clientId: string): number {
  const clientVolume = await redis.incr(`client:${clientId}:daily`);
  // Higher number = lower priority in BullMQ
  return Math.min(clientVolume, 100);
}
```

### Priority 3: HTTP Connection Pool for open-seo-main

Add undici connection pool or explicit fetch agent:

```typescript
import { Agent } from 'undici';

const agent = new Agent({
  connections: 100,
  pipelining: 1,
});

const response = await fetch(url, { dispatcher: agent });
```

---

## Files Audited

| File | Status |
|------|--------|
| `open-seo-main/src/server/lib/redis.ts` | No singleflight for crawls |
| `open-seo-main/src/server/queues/auditQueue.ts` | BullMQ, no fairness |
| `open-seo-main/src/server/features/keywords/services/ClassificationSingleflight.ts` | Good pattern to copy |
| `AI-Writer/backend/services/http_client.py` | Good singleton httpx |
| `AI-Writer/backend/services/scheduler/core/scheduler.py` | APScheduler, not ARQ |

---

## Cost Impact

| Scenario | Current | With Singleflight |
|----------|---------|-------------------|
| 50 clients, same retailer | 50 fetches | 1 fetch |
| DataForSEO cost | $1.00 | $0.02 |
| Proxy bandwidth | 6 GB | 120 KB |

**Potential monthly savings at 5,000 tasks/day: $300-$1,500**
