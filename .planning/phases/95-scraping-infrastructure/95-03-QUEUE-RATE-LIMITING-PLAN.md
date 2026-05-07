# Plan 95-03: Queue & Rate Limiting

**Status:** Planning  
**Effort:** 1 week  
**Priority:** P0 (Required for polite, scalable scraping)  
**Depends On:** 95-01 (TieredFetcher)

---

## 1. Overview

### Why Queue Management Matters for Polite Scraping

Web scraping without proper rate limiting is both unethical and counterproductive:

1. **IP Blacklisting:** Aggressive crawling triggers anti-bot defenses, leading to IP bans that affect all subsequent requests.
2. **Legal Risk:** Ignoring `robots.txt` Crawl-Delay directives can constitute unauthorized access.
3. **Resource Abuse:** Overwhelming target servers degrades their service and creates liability.
4. **Unreliable Data:** Blocked requests return captchas or error pages instead of content.

A well-designed queue system with per-domain rate limiting ensures:
- **Politeness:** 2 req/sec per domain respects server resources
- **Reliability:** Retry logic handles transient failures gracefully
- **Fairness:** No single client monopolizes scraping capacity
- **Scalability:** 200 concurrent fetches across thousands of domains

### System Context

```
User Request -> API -> QueueManager -> BullMQ Queue -> Worker -> RateLimiter -> TieredFetcher
                         |                              |
                         |                              | Per-domain throttling
                         |                              | Adaptive backoff
                         |                              |
                         +-- Priority routing           +-- Redis sliding window
                             Job deduplication              Domain grouping
                             Retry orchestration            Blocked domain tracking
```

---

## 2. BullMQ Queue Design

### 2.1 Queue Architecture

Three queues handle different priority levels and SLA requirements:

```typescript
// Queue topology
const QUEUE_CONFIG = {
  'scrape:priority': {
    purpose: 'User-initiated audits requiring <5 min SLA',
    concurrency: 50,
    stalledInterval: 30_000,
    lockDuration: 300_000, // 5 min
  },
  'scrape:standard': {
    purpose: 'Paid feature scraping (competitor analysis, briefs)',
    concurrency: 100,
    stalledInterval: 60_000,
    lockDuration: 600_000, // 10 min
  },
  'scrape:background': {
    purpose: 'Background crawls, cache warming, re-audits',
    concurrency: 50,
    stalledInterval: 120_000,
    lockDuration: 900_000, // 15 min
  },
} as const;
```

### 2.2 Job Data Structure

```typescript
// src/server/features/scraping/types/queue.types.ts

export interface ScrapeJobData {
  // Identity
  jobId: string;                    // UUID for deduplication
  batchId?: string;                 // Groups related jobs (e.g., full audit)
  
  // Target
  url: string;
  domain: string;                   // Pre-extracted for rate limiting
  
  // Configuration
  options: {
    forceTier?: FetchTier;          // Skip tier discovery
    skipCache?: boolean;            // Force fresh fetch
    timeoutMs?: number;             // Override default timeout
    includeHtml?: boolean;          // Return raw HTML in result
    includeParsedData?: boolean;    // Return DFS pre-parsed data
  };
  
  // Tracking
  clientId: string;                 // Cost attribution
  userId?: string;                  // User who initiated
  source: 'ui' | 'api' | 'scheduler' | 'system';
  
  // Metadata
  enqueuedAt: number;               // Unix timestamp
  priority: JobPriority;
  retryCount: number;
  
  // Context
  metadata?: {
    prospectId?: string;
    auditId?: string;
    featureContext?: string;        // 'site_audit' | 'competitor_spy' | etc.
  };
}

export type JobPriority = 'critical' | 'high' | 'normal' | 'low';

export interface ScrapeJobResult {
  success: boolean;
  url: string;
  
  // On success
  fetchResult?: FetchResult;
  
  // On failure
  error?: string;
  errorCode?: ScrapeErrorCode;
  
  // Always present
  tierUsed: FetchTier;
  fromCache: boolean;
  processingTimeMs: number;
  estimatedCost: number;
}

export type ScrapeErrorCode = 
  | 'RATE_LIMITED'
  | 'BLOCKED'
  | 'TIMEOUT'
  | 'INVALID_URL'
  | 'DNS_FAILURE'
  | 'CONNECTION_REFUSED'
  | 'SSL_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';
```

### 2.3 Retry Strategy with Exponential Backoff

```typescript
// src/server/features/scraping/config/retry.config.ts

export const RETRY_CONFIG = {
  // Default retry settings
  default: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2_000,       // 2s initial delay
    },
  },
  
  // Error-specific retry policies
  errorPolicies: {
    RATE_LIMITED: {
      attempts: 5,
      backoff: {
        type: 'exponential' as const,
        delay: 5_000,     // 5s initial (429s need longer waits)
      },
    },
    BLOCKED: {
      attempts: 2,        // Will escalate tier, not retry same tier
      backoff: {
        type: 'fixed' as const,
        delay: 1_000,
      },
    },
    TIMEOUT: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 3_000,
      },
    },
    DNS_FAILURE: {
      attempts: 2,
      backoff: {
        type: 'fixed' as const,
        delay: 10_000,    // DNS propagation may take time
      },
    },
    SSL_ERROR: {
      attempts: 1,        // Usually permanent
      backoff: {
        type: 'fixed' as const,
        delay: 0,
      },
    },
  },
  
  // Backoff calculation
  calculateDelay(attempt: number, baseDelay: number, type: 'exponential' | 'fixed'): number {
    if (type === 'fixed') return baseDelay;
    
    // Exponential: 2s, 4s, 8s, 16s, 32s (capped at 60s)
    const delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // +0-1s jitter
    return Math.min(delay + jitter, 60_000);
  },
} as const;
```

### 2.4 Queue Manager Implementation

```typescript
// src/server/features/scraping/QueueManager.ts

import { Queue, Worker, Job, type JobsOptions } from 'bullmq';
import { getRedisConnection } from '@/server/lib/redis';

export class QueueManager {
  private priorityQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  private standardQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  private backgroundQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  
  constructor() {
    const connection = getRedisConnection();
    
    this.priorityQueue = new Queue('scrape:priority', {
      connection,
      defaultJobOptions: this.getDefaultOptions('critical'),
    });
    
    this.standardQueue = new Queue('scrape:standard', {
      connection,
      defaultJobOptions: this.getDefaultOptions('normal'),
    });
    
    this.backgroundQueue = new Queue('scrape:background', {
      connection,
      defaultJobOptions: this.getDefaultOptions('low'),
    });
  }
  
  async enqueue(data: Omit<ScrapeJobData, 'jobId' | 'enqueuedAt' | 'retryCount'>): Promise<Job<ScrapeJobData, ScrapeJobResult>> {
    const jobData: ScrapeJobData = {
      ...data,
      jobId: crypto.randomUUID(),
      enqueuedAt: Date.now(),
      retryCount: 0,
    };
    
    const queue = this.selectQueue(jobData.priority, jobData.source);
    const options = this.getJobOptions(jobData);
    
    return queue.add(
      `scrape:${jobData.domain}:${jobData.url}`,
      jobData,
      options
    );
  }
  
  async enqueueBatch(
    urls: string[],
    baseData: Omit<ScrapeJobData, 'jobId' | 'enqueuedAt' | 'retryCount' | 'url' | 'domain'>
  ): Promise<Job<ScrapeJobData, ScrapeJobResult>[]> {
    const batchId = crypto.randomUUID();
    
    return Promise.all(
      urls.map(url => this.enqueue({
        ...baseData,
        url,
        domain: extractDomain(url),
        metadata: {
          ...baseData.metadata,
          batchId,
        },
      }))
    );
  }
  
  private selectQueue(priority: JobPriority, source: string): Queue<ScrapeJobData, ScrapeJobResult> {
    // User-initiated always goes to priority queue
    if (source === 'ui') return this.priorityQueue;
    
    switch (priority) {
      case 'critical':
      case 'high':
        return this.priorityQueue;
      case 'normal':
        return this.standardQueue;
      case 'low':
        return this.backgroundQueue;
    }
  }
  
  private getDefaultOptions(priority: JobPriority): JobsOptions {
    return {
      attempts: RETRY_CONFIG.default.attempts,
      backoff: RETRY_CONFIG.default.backoff,
      removeOnComplete: {
        age: priority === 'low' ? 3600 : 86400, // 1h for background, 24h for others
        count: priority === 'low' ? 100 : 1000,
      },
      removeOnFail: {
        age: 604800, // 7 days
        count: 5000,
      },
    };
  }
  
  private getJobOptions(data: ScrapeJobData): JobsOptions {
    const bullmqPriority = this.toBullmqPriority(data.priority);
    
    return {
      priority: bullmqPriority,
      jobId: data.jobId, // Enables deduplication
      delay: 0,
    };
  }
  
  private toBullmqPriority(priority: JobPriority): number {
    // BullMQ: lower number = higher priority
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 5;
      case 'normal': return 10;
      case 'low': return 20;
    }
  }
}
```

---

## 3. Per-Domain Rate Limiting

### 3.1 Redis-Based Sliding Window Algorithm

The sliding window rate limiter uses Redis sorted sets to track request timestamps per domain. This approach:
- Handles distributed workers correctly (all share the same Redis state)
- Supports variable window sizes
- Allows burst tolerance while maintaining average rate

```typescript
// src/server/features/scraping/RateLimiter.ts

import { Redis } from 'ioredis';

export interface RateLimiterConfig {
  requestsPerWindow: number;  // Default: 2
  windowMs: number;           // Default: 1000 (1 second)
  maxWaitMs: number;          // Default: 30000 (30 seconds)
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimiterConfig;
  
  // Lua script for atomic sliding window check + insert
  private readonly SLIDING_WINDOW_SCRIPT = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowStart = tonumber(ARGV[2])
    local maxRequests = tonumber(ARGV[3])
    local requestId = ARGV[4]
    local windowMs = tonumber(ARGV[5])
    
    -- Remove expired entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
    
    -- Count current window
    local count = redis.call('ZCARD', key)
    
    if count < maxRequests then
      -- Allowed: add request and return 0 (no wait)
      redis.call('ZADD', key, now, requestId)
      redis.call('PEXPIRE', key, windowMs * 2)
      return 0
    else
      -- Denied: calculate wait time until oldest entry expires
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      if oldest[2] then
        local waitMs = oldest[2] - windowStart + 1
        return waitMs > 0 and waitMs or 1
      end
      return windowMs
    end
  `;
  
  constructor(redis: Redis, config: Partial<RateLimiterConfig> = {}) {
    this.redis = redis;
    this.config = {
      requestsPerWindow: config.requestsPerWindow ?? 2,
      windowMs: config.windowMs ?? 1000,
      maxWaitMs: config.maxWaitMs ?? 30_000,
    };
  }
  
  async acquire(domain: string): Promise<void> {
    const normalizedDomain = this.normalizeDomain(domain);
    const key = `ratelimit:domain:${normalizedDomain}`;
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    
    while (true) {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;
      
      const waitMs = await this.redis.eval(
        this.SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now.toString(),
        windowStart.toString(),
        this.config.requestsPerWindow.toString(),
        requestId,
        this.config.windowMs.toString()
      ) as number;
      
      if (waitMs === 0) {
        // Request allowed
        return;
      }
      
      // Check if we've waited too long
      if (Date.now() - startTime > this.config.maxWaitMs) {
        throw new RateLimitExceededError(domain, this.config.maxWaitMs);
      }
      
      // Wait and retry
      await sleep(Math.min(waitMs, 1000));
    }
  }
  
  /**
   * Normalize domain for rate limiting.
   * Subdomains share limits with their parent domain.
   */
  private normalizeDomain(domain: string): string {
    // Remove protocol if present
    const hostname = domain.replace(/^https?:\/\//, '').split('/')[0];
    
    // Extract base domain (handles subdomains)
    const parts = hostname.split('.');
    
    // Handle common cases
    if (parts.length >= 2) {
      // Special case: co.uk, com.au, etc.
      const tld = parts.slice(-2).join('.');
      const knownCompoundTlds = ['co.uk', 'com.au', 'co.nz', 'org.uk', 'com.br'];
      
      if (knownCompoundTlds.includes(tld) && parts.length >= 3) {
        return parts.slice(-3).join('.');
      }
      
      // Standard case: example.com
      return parts.slice(-2).join('.');
    }
    
    return hostname;
  }
}

export class RateLimitExceededError extends Error {
  constructor(
    public domain: string,
    public waitedMs: number
  ) {
    super(`Rate limit exceeded for ${domain} after waiting ${waitedMs}ms`);
    this.name = 'RateLimitExceededError';
  }
}
```

### 3.2 Domain Grouping Strategy

Subdomains share rate limits with their parent domain to prevent circumventing limits:

```typescript
// Domain normalization examples
const normalizeExamples = {
  'www.example.com': 'example.com',
  'blog.example.com': 'example.com',
  'api.v2.example.com': 'example.com',
  'shop.example.co.uk': 'example.co.uk',
  'example.com': 'example.com',
};
```

**Rationale:** Most websites configure rate limiting at the primary domain level. Treating `www.example.com` and `blog.example.com` as separate domains would allow 4 req/sec total, which may trigger blocks.

### 3.3 Adaptive Backoff on 429/503 Responses

When receiving rate limit or service unavailable responses, the system increases per-domain delays:

```typescript
// src/server/features/scraping/AdaptiveBackoff.ts

export class AdaptiveBackoff {
  private readonly redis: Redis;
  
  // Key: `backoff:domain:{domain}` 
  // Value: { multiplier: number, until: timestamp }
  
  async recordFailure(domain: string, statusCode: number): Promise<void> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    const current = await this.redis.get(key);
    
    let multiplier = 1;
    if (current) {
      const data = JSON.parse(current);
      multiplier = Math.min(data.multiplier * 2, 16); // Max 16x slowdown
    }
    
    // Backoff duration based on error type
    const baseDuration = statusCode === 429 ? 60_000 : 30_000;
    const backoffDuration = baseDuration * multiplier;
    
    await this.redis.setex(
      key,
      Math.ceil(backoffDuration / 1000),
      JSON.stringify({
        multiplier,
        until: Date.now() + backoffDuration,
        lastError: statusCode,
      })
    );
  }
  
  async recordSuccess(domain: string): Promise<void> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    const current = await this.redis.get(key);
    
    if (current) {
      const data = JSON.parse(current);
      // Reduce multiplier on success, but don't remove entirely
      const newMultiplier = Math.max(1, data.multiplier / 2);
      
      if (newMultiplier <= 1) {
        await this.redis.del(key);
      } else {
        await this.redis.setex(
          key,
          300, // 5 min TTL
          JSON.stringify({ ...data, multiplier: newMultiplier })
        );
      }
    }
  }
  
  async getEffectiveLimit(domain: string, baseLimit: number): Promise<number> {
    const key = `backoff:domain:${this.normalizeDomain(domain)}`;
    const current = await this.redis.get(key);
    
    if (!current) return baseLimit;
    
    const data = JSON.parse(current);
    if (Date.now() < data.until) {
      // Reduce rate limit by multiplier
      return Math.max(0.1, baseLimit / data.multiplier);
    }
    
    return baseLimit;
  }
}
```

**Backoff Escalation:**
| Consecutive Failures | Multiplier | Effective Rate | Duration |
|----------------------|------------|----------------|----------|
| 1 | 1x | 2 req/s | 60s |
| 2 | 2x | 1 req/s | 120s |
| 3 | 4x | 0.5 req/s | 240s |
| 4 | 8x | 0.25 req/s | 480s |
| 5+ | 16x | 0.125 req/s | 960s |

---

## 4. Global Concurrency Control

### 4.1 Semaphore Implementation

Global concurrency is controlled by a distributed semaphore using Redis:

```typescript
// src/server/features/scraping/GlobalConcurrencyLimiter.ts

export class GlobalConcurrencyLimiter {
  private readonly redis: Redis;
  private readonly maxConcurrent: number;
  private readonly key = 'scrape:concurrency:global';
  
  constructor(redis: Redis, maxConcurrent: number = 200) {
    this.redis = redis;
    this.maxConcurrent = maxConcurrent;
  }
  
  async acquire(requestId: string, timeoutMs: number = 30_000): Promise<AcquireResult> {
    const startTime = Date.now();
    
    while (true) {
      const now = Date.now();
      
      // Clean up stale entries (older than 5 minutes = stuck requests)
      await this.redis.zremrangebyscore(
        this.key,
        '-inf',
        (now - 300_000).toString()
      );
      
      // Try to acquire
      const count = await this.redis.zcard(this.key);
      
      if (count < this.maxConcurrent) {
        // Add our request with current timestamp as score
        await this.redis.zadd(this.key, now.toString(), requestId);
        
        // Verify we got in (race condition protection)
        const rank = await this.redis.zrank(this.key, requestId);
        if (rank !== null && rank < this.maxConcurrent) {
          return {
            acquired: true,
            waitedMs: Date.now() - startTime,
            position: rank,
          };
        }
        
        // We didn't make the cut, remove and retry
        await this.redis.zrem(this.key, requestId);
      }
      
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        return {
          acquired: false,
          waitedMs: Date.now() - startTime,
          position: count,
        };
      }
      
      // Wait before retry (with jitter)
      await sleep(100 + Math.random() * 100);
    }
  }
  
  async release(requestId: string): Promise<void> {
    await this.redis.zrem(this.key, requestId);
  }
  
  async getCurrentLoad(): Promise<{ current: number; max: number; utilization: number }> {
    const current = await this.redis.zcard(this.key);
    return {
      current,
      max: this.maxConcurrent,
      utilization: current / this.maxConcurrent,
    };
  }
}

interface AcquireResult {
  acquired: boolean;
  waitedMs: number;
  position: number;
}
```

### 4.2 Integration with BullMQ Workers

```typescript
// Worker integration with concurrency control
const worker = new Worker<ScrapeJobData, ScrapeJobResult>(
  'scrape:standard',
  async (job) => {
    const requestId = job.id!;
    
    // Acquire global slot
    const acquireResult = await globalLimiter.acquire(requestId, 60_000);
    if (!acquireResult.acquired) {
      throw new Error(`Failed to acquire concurrency slot after ${acquireResult.waitedMs}ms`);
    }
    
    try {
      // Acquire per-domain rate limit
      await rateLimiter.acquire(job.data.domain);
      
      // Perform fetch
      const result = await tieredFetcher.fetch(job.data.url, job.data.options);
      
      // Record success for adaptive backoff
      if (result.success) {
        await adaptiveBackoff.recordSuccess(job.data.domain);
      }
      
      return {
        success: result.success,
        url: job.data.url,
        fetchResult: result,
        tierUsed: result.tierUsed,
        fromCache: result.fromCache,
        processingTimeMs: result.responseTimeMs,
        estimatedCost: result.estimatedCost,
      };
    } catch (error) {
      // Record failure for adaptive backoff
      if (error instanceof HTTPError && [429, 503].includes(error.statusCode)) {
        await adaptiveBackoff.recordFailure(job.data.domain, error.statusCode);
      }
      
      throw error;
    } finally {
      // Always release global slot
      await globalLimiter.release(requestId);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 100, // BullMQ concurrency (local to this worker)
  }
);
```

---

## 5. Job Priority System

### 5.1 Priority Levels

| Priority | BullMQ Value | Queue | Use Case | SLA |
|----------|--------------|-------|----------|-----|
| `critical` | 1 | `scrape:priority` | User watching screen, paid feature | <60s |
| `high` | 5 | `scrape:priority` | User-initiated, async feedback | <5min |
| `normal` | 10 | `scrape:standard` | Paid feature, background | <15min |
| `low` | 20 | `scrape:background` | Cache warming, re-audit | <1hr |

### 5.2 Priority Assignment Logic

```typescript
// src/server/features/scraping/PriorityAssigner.ts

export function assignPriority(job: Partial<ScrapeJobData>): JobPriority {
  // User-initiated always gets elevated priority
  if (job.source === 'ui') {
    return job.metadata?.featureContext === 'site_audit' ? 'high' : 'critical';
  }
  
  // API calls from paid features
  if (job.source === 'api') {
    const paidFeatures = ['competitor_spy', 'content_brief', 'serp_analysis'];
    if (paidFeatures.includes(job.metadata?.featureContext ?? '')) {
      return 'normal';
    }
  }
  
  // Scheduled jobs
  if (job.source === 'scheduler') {
    return 'low';
  }
  
  // System jobs (cache warming, etc.)
  if (job.source === 'system') {
    return 'low';
  }
  
  return 'normal';
}
```

### 5.3 Queue Selection Matrix

```
+---------------------------------------------------------------+
|                      JOB ROUTING LOGIC                        |
+---------------------------------------------------------------+
|                                                               |
|  Source = 'ui'                                                |
|  |                                                            |
|  +---> scrape:priority (critical/high)                        |
|       +-- 50 concurrent slots reserved                        |
|       +-- SLA: <5 minutes                                     |
|                                                               |
|  Source = 'api' && featureContext in [paid_features]          |
|  |                                                            |
|  +---> scrape:standard (normal)                               |
|       +-- 100 concurrent slots                                |
|       +-- SLA: <15 minutes                                    |
|                                                               |
|  Source = 'scheduler' || Source = 'system'                    |
|  |                                                            |
|  +---> scrape:background (low)                                |
|       +-- 50 concurrent slots                                 |
|       +-- SLA: <1 hour                                        |
|       +-- Paused when priority queues >50% full               |
|                                                               |
+---------------------------------------------------------------+
```

### 5.4 Dynamic Priority Adjustment

Background queue processing pauses when priority queues are congested:

```typescript
// src/server/features/scraping/QueueOrchestrator.ts

export class QueueOrchestrator {
  private backgroundWorker: Worker;
  private isPaused = false;
  
  async checkAndAdjust(): Promise<void> {
    const priorityDepth = await this.priorityQueue.count();
    const standardDepth = await this.standardQueue.count();
    
    const priorityCapacity = QUEUE_CONFIG['scrape:priority'].concurrency;
    const standardCapacity = QUEUE_CONFIG['scrape:standard'].concurrency;
    
    const priorityUtilization = priorityDepth / priorityCapacity;
    const standardUtilization = standardDepth / standardCapacity;
    
    // Pause background when priority queues are stressed
    if ((priorityUtilization > 0.5 || standardUtilization > 0.5) && !this.isPaused) {
      await this.backgroundWorker.pause();
      this.isPaused = true;
      console.log('Background worker paused: priority queues congested');
    }
    
    // Resume when pressure eases
    if (priorityUtilization < 0.3 && standardUtilization < 0.3 && this.isPaused) {
      await this.backgroundWorker.resume();
      this.isPaused = false;
      console.log('Background worker resumed: priority queues cleared');
    }
  }
}
```

---

## 6. TypeScript Interfaces

### 6.1 RateLimiter Interface

```typescript
// src/server/features/scraping/interfaces/IRateLimiter.ts

export interface IRateLimiter {
  /**
   * Acquire permission to make a request to the given domain.
   * Blocks until the rate limit allows the request.
   * 
   * @param domain - The target domain (will be normalized)
   * @throws RateLimitExceededError if maxWaitMs exceeded
   */
  acquire(domain: string): Promise<void>;
  
  /**
   * Get current rate limit status for a domain.
   */
  getStatus(domain: string): Promise<RateLimitStatus>;
  
  /**
   * Manually release a slot (not typically needed, slots auto-expire).
   */
  release(domain: string): Promise<void>;
  
  /**
   * Get all domains currently being rate limited.
   */
  getActiveDomains(): Promise<string[]>;
}

export interface RateLimitStatus {
  domain: string;
  normalizedDomain: string;
  requestsInWindow: number;
  windowMs: number;
  maxRequests: number;
  effectiveLimit: number;  // After adaptive backoff
  isThrottled: boolean;
  backoffMultiplier: number;
  nextAllowedAt?: number;
}

export interface RateLimiterConfig {
  /** Max requests per window per domain. Default: 2 */
  requestsPerWindow: number;
  
  /** Window size in milliseconds. Default: 1000 */
  windowMs: number;
  
  /** Maximum time to wait for a slot. Default: 30000 */
  maxWaitMs: number;
  
  /** Enable adaptive backoff on 429/503. Default: true */
  enableAdaptiveBackoff: boolean;
}
```

### 6.2 QueueManager Interface

```typescript
// src/server/features/scraping/interfaces/IQueueManager.ts

export interface IQueueManager {
  /**
   * Add a single scraping job to the appropriate queue.
   */
  enqueue(data: ScrapeJobInput): Promise<EnqueueResult>;
  
  /**
   * Add multiple scraping jobs as a batch.
   */
  enqueueBatch(urls: string[], baseData: ScrapeJobBaseInput): Promise<EnqueueResult[]>;
  
  /**
   * Get status of a specific job.
   */
  getJobStatus(jobId: string): Promise<JobStatus | null>;
  
  /**
   * Get status of all jobs in a batch.
   */
  getBatchStatus(batchId: string): Promise<BatchStatus>;
  
  /**
   * Cancel a pending job.
   */
  cancelJob(jobId: string): Promise<boolean>;
  
  /**
   * Cancel all jobs in a batch.
   */
  cancelBatch(batchId: string): Promise<number>;
  
  /**
   * Get queue health metrics.
   */
  getQueueMetrics(): Promise<QueueMetrics>;
  
  /**
   * Pause/resume queues.
   */
  pauseQueue(queueName: QueueName): Promise<void>;
  resumeQueue(queueName: QueueName): Promise<void>;
}

export type QueueName = 'scrape:priority' | 'scrape:standard' | 'scrape:background';

export interface ScrapeJobInput {
  url: string;
  clientId: string;
  userId?: string;
  source: 'ui' | 'api' | 'scheduler' | 'system';
  priority?: JobPriority;
  options?: FetchOptions;
  metadata?: JobMetadata;
}

export interface ScrapeJobBaseInput extends Omit<ScrapeJobInput, 'url'> {}

export interface EnqueueResult {
  jobId: string;
  batchId?: string;
  queue: QueueName;
  priority: JobPriority;
  position: number;
  estimatedStartTime?: number;
}

export interface JobStatus {
  jobId: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: number;
  result?: ScrapeJobResult;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  processedAt?: number;
  finishedAt?: number;
}

export interface BatchStatus {
  batchId: string;
  totalJobs: number;
  completed: number;
  failed: number;
  pending: number;
  active: number;
  progress: number;
  estimatedCompletion?: number;
}

export interface QueueMetrics {
  queues: {
    [K in QueueName]: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: boolean;
    };
  };
  global: {
    currentConcurrency: number;
    maxConcurrency: number;
    processingRate: number;  // jobs/sec over last minute
    avgProcessingTime: number;  // ms
    blockedDomains: number;
  };
}
```

### 6.3 Full Type Exports

```typescript
// src/server/features/scraping/types/index.ts

export * from './queue.types';
export * from '../interfaces/IRateLimiter';
export * from '../interfaces/IQueueManager';

// Re-export commonly used types
export type {
  FetchTier,
  FetchOptions,
  FetchResult,
} from '../TieredFetcher.types';
```

---

## 7. Monitoring

### 7.1 Queue Depth Metrics

```typescript
// src/server/features/scraping/monitoring/QueueMonitor.ts

export class QueueMonitor {
  private readonly prometheus: PrometheusClient;
  
  // Gauge: Current queue depth by queue name
  private queueDepth = new Gauge({
    name: 'scrape_queue_depth',
    help: 'Number of jobs in queue',
    labelNames: ['queue', 'state'],
  });
  
  // Counter: Total jobs processed
  private jobsProcessed = new Counter({
    name: 'scrape_jobs_processed_total',
    help: 'Total number of jobs processed',
    labelNames: ['queue', 'status', 'tier'],
  });
  
  // Histogram: Job processing time
  private processingTime = new Histogram({
    name: 'scrape_job_processing_seconds',
    help: 'Job processing time in seconds',
    labelNames: ['queue', 'tier'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  });
  
  // Gauge: Global concurrency utilization
  private concurrencyUtilization = new Gauge({
    name: 'scrape_concurrency_utilization',
    help: 'Current concurrency utilization (0-1)',
  });
  
  async collectMetrics(): Promise<void> {
    const metrics = await this.queueManager.getQueueMetrics();
    
    for (const [queueName, stats] of Object.entries(metrics.queues)) {
      this.queueDepth.set({ queue: queueName, state: 'waiting' }, stats.waiting);
      this.queueDepth.set({ queue: queueName, state: 'active' }, stats.active);
      this.queueDepth.set({ queue: queueName, state: 'delayed' }, stats.delayed);
    }
    
    this.concurrencyUtilization.set(
      metrics.global.currentConcurrency / metrics.global.maxConcurrency
    );
  }
}
```

### 7.2 Processing Rate Tracking

```typescript
// Sliding window rate calculation
export class ProcessingRateTracker {
  private readonly windowMs = 60_000; // 1 minute window
  private readonly redis: Redis;
  
  async recordCompletion(queue: QueueName): Promise<void> {
    const key = `metrics:processing_rate:${queue}`;
    const now = Date.now();
    
    await this.redis
      .multi()
      .zadd(key, now.toString(), `${now}:${crypto.randomUUID()}`)
      .zremrangebyscore(key, '-inf', (now - this.windowMs).toString())
      .expire(key, 120)
      .exec();
  }
  
  async getRate(queue: QueueName): Promise<number> {
    const key = `metrics:processing_rate:${queue}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const count = await this.redis.zcount(key, windowStart, now);
    return count / (this.windowMs / 1000); // jobs/sec
  }
}
```

### 7.3 Blocked Domains Dashboard

```typescript
// src/server/features/scraping/monitoring/BlockedDomainTracker.ts

export interface BlockedDomainInfo {
  domain: string;
  reason: 'rate_limited' | 'blocked' | 'captcha' | 'error';
  blockedAt: number;
  blockedUntil: number;
  consecutiveFailures: number;
  lastStatusCode?: number;
  backoffMultiplier: number;
}

export class BlockedDomainTracker {
  async getBlockedDomains(): Promise<BlockedDomainInfo[]> {
    const keys = await this.redis.keys('backoff:domain:*');
    const blocked: BlockedDomainInfo[] = [];
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;
      
      const parsed = JSON.parse(data);
      if (parsed.until > Date.now()) {
        blocked.push({
          domain: key.replace('backoff:domain:', ''),
          reason: this.classifyReason(parsed.lastError),
          blockedAt: parsed.until - (parsed.multiplier * 60_000),
          blockedUntil: parsed.until,
          consecutiveFailures: Math.log2(parsed.multiplier) + 1,
          lastStatusCode: parsed.lastError,
          backoffMultiplier: parsed.multiplier,
        });
      }
    }
    
    return blocked.sort((a, b) => b.blockedUntil - a.blockedUntil);
  }
  
  private classifyReason(statusCode: number): BlockedDomainInfo['reason'] {
    if (statusCode === 429) return 'rate_limited';
    if (statusCode === 403) return 'blocked';
    if (statusCode === 503) return 'rate_limited';
    return 'error';
  }
}
```

### 7.4 Alert Thresholds

```typescript
// src/server/features/scraping/monitoring/alerts.config.ts

export const ALERT_THRESHOLDS = {
  // Queue depth alerts
  queueDepth: {
    priority: {
      warning: 30,    // >30 jobs waiting
      critical: 50,   // >50 jobs waiting
    },
    standard: {
      warning: 200,
      critical: 500,
    },
    background: {
      warning: 1000,
      critical: 2000,
    },
  },
  
  // Processing rate alerts
  processingRate: {
    tooSlow: 5,       // <5 jobs/sec when queue >100
    tooFast: 50,      // >50 jobs/sec may indicate issue
  },
  
  // Blocked domains alerts
  blockedDomains: {
    warning: 50,      // >50 domains blocked
    critical: 200,    // >200 domains blocked (possible IP issue)
  },
  
  // Concurrency alerts
  concurrency: {
    highUtilization: 0.9,  // >90% sustained
    lowUtilization: 0.1,   // <10% (possible issue or waste)
  },
  
  // Error rate alerts
  errorRate: {
    warning: 0.05,    // >5% failure rate
    critical: 0.15,   // >15% failure rate
  },
} as const;
```

---

## 8. Implementation Tasks

### Phase A: Core Rate Limiting (2 days)

| Task | Description | Estimate |
|------|-------------|----------|
| A1 | Create `RateLimiter.ts` with sliding window algorithm | 4h |
| A2 | Implement domain normalization (subdomain grouping) | 2h |
| A3 | Create `AdaptiveBackoff.ts` for 429/503 handling | 3h |
| A4 | Write unit tests for rate limiter | 3h |
| A5 | Write integration tests (Redis required) | 2h |

### Phase B: Queue Infrastructure (2 days)

| Task | Description | Estimate |
|------|-------------|----------|
| B1 | Create `QueueManager.ts` with 3 queue setup | 4h |
| B2 | Implement job data structure and validation | 2h |
| B3 | Create retry configuration and error policies | 2h |
| B4 | Implement priority assignment logic | 2h |
| B5 | Write unit tests for queue manager | 2h |
| B6 | Write integration tests with BullMQ | 2h |

### Phase C: Global Concurrency (1 day)

| Task | Description | Estimate |
|------|-------------|----------|
| C1 | Create `GlobalConcurrencyLimiter.ts` | 3h |
| C2 | Integrate with BullMQ workers | 2h |
| C3 | Implement stale entry cleanup | 1h |
| C4 | Write tests for concurrency control | 2h |

### Phase D: Worker Integration (1 day)

| Task | Description | Estimate |
|------|-------------|----------|
| D1 | Create worker with all limiters integrated | 4h |
| D2 | Implement job progress reporting | 2h |
| D3 | Add error classification and handling | 2h |

### Phase E: Monitoring (1 day)

| Task | Description | Estimate |
|------|-------------|----------|
| E1 | Create Prometheus metrics collectors | 3h |
| E2 | Implement blocked domain tracker | 2h |
| E3 | Set up alert thresholds | 1h |
| E4 | Create monitoring dashboard queries | 2h |

---

## 9. File Structure

```
open-seo-main/src/server/features/scraping/
|-- queue/
|   |-- QueueManager.ts           # Queue orchestration
|   |-- PriorityAssigner.ts       # Job priority logic
|   |-- QueueOrchestrator.ts      # Dynamic queue management
|   +-- retry.config.ts           # Retry policies
|-- ratelimit/
|   |-- RateLimiter.ts            # Per-domain rate limiting
|   |-- AdaptiveBackoff.ts        # 429/503 adaptive backoff
|   +-- GlobalConcurrencyLimiter.ts # Global semaphore
|-- workers/
|   |-- ScrapeWorker.ts           # Main worker process
|   +-- worker.config.ts          # Worker configuration
|-- monitoring/
|   |-- QueueMonitor.ts           # Prometheus metrics
|   |-- ProcessingRateTracker.ts  # Rate calculations
|   |-- BlockedDomainTracker.ts   # Blocked domain tracking
|   +-- alerts.config.ts          # Alert thresholds
|-- interfaces/
|   |-- IRateLimiter.ts
|   +-- IQueueManager.ts
|-- types/
|   |-- queue.types.ts
|   +-- index.ts
+-- __tests__/
    |-- RateLimiter.test.ts
    |-- RateLimiter.integration.test.ts
    |-- QueueManager.test.ts
    |-- QueueManager.integration.test.ts
    |-- GlobalConcurrencyLimiter.test.ts
    +-- ScrapeWorker.integration.test.ts
```

---

## 10. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Per-domain rate | 2 req/sec max | Redis sliding window count |
| Global concurrency | 200 concurrent max | Redis sorted set size |
| Priority SLA | 95% <5 min | Job completion timestamps |
| Standard SLA | 95% <15 min | Job completion timestamps |
| Adaptive backoff | 90% fewer retries after 429 | Retry count comparison |
| Test coverage | 80%+ | Jest coverage report |
| Zero race conditions | No duplicate requests | Job deduplication logs |

---

## 11. Dependencies

**Existing:**
- BullMQ 5.74.1 (already in package.json)
- Redis (existing infrastructure)

**New:**
- `@bull-board/api` (optional, for queue dashboard)

**From Plan 95-01:**
- `TieredFetcher` class
- `FetchResult` type
- `FetchOptions` type

---

## 12. Environment Variables

```env
# Rate Limiting
DOMAIN_RATE_LIMIT_REQUESTS=2
DOMAIN_RATE_LIMIT_WINDOW_MS=1000
RATE_LIMIT_MAX_WAIT_MS=30000

# Global Concurrency
GLOBAL_MAX_CONCURRENT=200

# Queue Configuration
SCRAPE_PRIORITY_CONCURRENCY=50
SCRAPE_STANDARD_CONCURRENCY=100
SCRAPE_BACKGROUND_CONCURRENCY=50

# Retry Configuration
JOB_DEFAULT_ATTEMPTS=3
JOB_BACKOFF_DELAY_MS=2000
JOB_TIMEOUT_MS=300000

# Monitoring
METRICS_COLLECTION_INTERVAL_MS=15000
ALERT_CHECK_INTERVAL_MS=60000
```

---

## Document History

- **v1.0** (2026-05-07): Initial plan based on Phase 95 context and HIGH-SCALE-SCRAPING-ARCHITECTURE.md
