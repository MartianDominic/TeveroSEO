# Plan 95-08: Test Coverage & Reliability

**Phase:** 95 - Scraping Infrastructure Optimization  
**Priority:** P0 (Blocking - Required for Production Confidence)  
**Estimated Effort:** 2-3 days  
**Dependencies:** 95-01 through 95-05 (core infrastructure)

---

## Problem Statement

The Phase 95 integration review identified critical gaps in test coverage:

1. **TieredFetcher has zero unit tests** - The core escalation logic is untested
2. **QueueManager lacks coverage** - Rate limiting and priority handling untested
3. **Circuit breaker pattern not implemented** - No protection against cascading failures
4. **Integration tests missing** - End-to-end flows through ScrapingService untested
5. **Error recovery untested** - Retry logic, timeout handling, partial failures

Without comprehensive tests, we cannot confidently deploy to production or make future changes.

---

## Success Criteria

- [ ] TieredFetcher unit test coverage ≥ 80%
- [ ] QueueManager unit test coverage ≥ 80%
- [ ] Circuit breaker pattern implemented and tested
- [ ] Integration tests covering all 7 tiers
- [ ] Error scenarios tested (timeouts, rate limits, network failures)
- [ ] Retry logic verified with exponential backoff
- [ ] Cost tracking accuracy verified
- [ ] All tests passing in CI

---

## Task Breakdown

### Task 95-08-01: TieredFetcher Unit Tests

**File:** `open-seo-main/src/server/features/scraping/fetchers/__tests__/TieredFetcher.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TieredFetcher } from '../TieredFetcher';
import { FetcherConfig, TierResult } from '../types';

describe('TieredFetcher', () => {
  let fetcher: TieredFetcher;
  let mockDirectFetcher: MockFetcher;
  let mockWebshareFetcher: MockFetcher;
  let mockGeonodeFetcher: MockFetcher;
  let mockCamoufoxFetcher: MockFetcher;
  let mockDfsBasicFetcher: MockFetcher;
  let mockDfsJsFetcher: MockFetcher;
  let mockDfsBrowserFetcher: MockFetcher;

  beforeEach(() => {
    // Reset all mocks
    mockDirectFetcher = createMockFetcher('direct');
    // ... setup all mocks
    
    fetcher = new TieredFetcher({
      tiers: [
        mockDirectFetcher,
        mockWebshareFetcher,
        mockGeonodeFetcher,
        mockCamoufoxFetcher,
        mockDfsBasicFetcher,
        mockDfsJsFetcher,
        mockDfsBrowserFetcher,
      ],
      costTracker: mockCostTracker,
      metrics: mockMetrics,
    });
  });

  describe('Tier Escalation', () => {
    it('should start with direct fetch for non-protected URLs', async () => {
      mockDirectFetcher.fetch.mockResolvedValue(successResponse);
      
      const result = await fetcher.fetch('https://example.com');
      
      expect(result.tier).toBe('direct');
      expect(mockDirectFetcher.fetch).toHaveBeenCalled();
      expect(mockWebshareFetcher.fetch).not.toHaveBeenCalled();
    });

    it('should escalate to webshare on direct fetch failure', async () => {
      mockDirectFetcher.fetch.mockRejectedValue(new Error('Connection refused'));
      mockWebshareFetcher.fetch.mockResolvedValue(successResponse);
      
      const result = await fetcher.fetch('https://protected-site.com');
      
      expect(result.tier).toBe('webshare');
      expect(mockDirectFetcher.fetch).toHaveBeenCalled();
      expect(mockWebshareFetcher.fetch).toHaveBeenCalled();
    });

    it('should escalate through all tiers until success', async () => {
      mockDirectFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockWebshareFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockGeonodeFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockCamoufoxFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockDfsBasicFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockDfsJsFetcher.fetch.mockResolvedValue(successResponse);
      
      const result = await fetcher.fetch('https://heavily-protected.com');
      
      expect(result.tier).toBe('dfs_js');
      expect(mockDfsJsFetcher.fetch).toHaveBeenCalled();
      expect(mockDfsBrowserFetcher.fetch).not.toHaveBeenCalled();
    });

    it('should throw after all tiers exhausted', async () => {
      // All tiers fail
      [mockDirectFetcher, mockWebshareFetcher, mockGeonodeFetcher,
       mockCamoufoxFetcher, mockDfsBasicFetcher, mockDfsJsFetcher,
       mockDfsBrowserFetcher].forEach(mock => {
        mock.fetch.mockRejectedValue(new Error('Blocked'));
      });
      
      await expect(fetcher.fetch('https://impossible.com'))
        .rejects.toThrow('All tiers exhausted');
    });
  });

  describe('Domain Learning', () => {
    it('should skip to learned tier for known domains', async () => {
      // Set up domain learning state
      fetcher.setDomainTier('protected-domain.com', 'geonode');
      
      const result = await fetcher.fetch('https://protected-domain.com/page');
      
      expect(mockDirectFetcher.fetch).not.toHaveBeenCalled();
      expect(mockWebshareFetcher.fetch).not.toHaveBeenCalled();
      expect(mockGeonodeFetcher.fetch).toHaveBeenCalled();
    });

    it('should learn and persist successful tier for domain', async () => {
      mockDirectFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockWebshareFetcher.fetch.mockResolvedValue(successResponse);
      
      await fetcher.fetch('https://new-domain.com/page1');
      
      // Second request should skip direct
      mockDirectFetcher.fetch.mockClear();
      await fetcher.fetch('https://new-domain.com/page2');
      
      expect(mockDirectFetcher.fetch).not.toHaveBeenCalled();
      expect(mockWebshareFetcher.fetch).toHaveBeenCalled();
    });
  });

  describe('Cost Tracking', () => {
    it('should track cost for each tier used', async () => {
      mockDirectFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockWebshareFetcher.fetch.mockResolvedValue(successResponse);
      
      await fetcher.fetch('https://example.com');
      
      expect(mockCostTracker.recordFetch).toHaveBeenCalledWith({
        tier: 'webshare',
        url: 'https://example.com',
        success: true,
        cost: expect.any(Number),
      });
    });

    it('should track failed attempts', async () => {
      mockDirectFetcher.fetch.mockRejectedValue(new Error('Blocked'));
      mockWebshareFetcher.fetch.mockResolvedValue(successResponse);
      
      await fetcher.fetch('https://example.com');
      
      // Direct tier failure should be tracked
      expect(mockCostTracker.recordFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'direct',
          success: false,
        })
      );
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout individual tiers without blocking escalation', async () => {
      mockDirectFetcher.fetch.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );
      mockWebshareFetcher.fetch.mockResolvedValue(successResponse);
      
      fetcher.setTierTimeout('direct', 100);
      
      const result = await fetcher.fetch('https://slow-response.com');
      
      expect(result.tier).toBe('webshare');
    });

    it('should respect global timeout across all tiers', async () => {
      // All tiers slow
      [mockDirectFetcher, mockWebshareFetcher, mockGeonodeFetcher].forEach(mock => {
        mock.fetch.mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 5000))
        );
      });
      
      fetcher.setGlobalTimeout(200);
      
      await expect(fetcher.fetch('https://very-slow.com'))
        .rejects.toThrow('Global timeout exceeded');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect tier rate limits', async () => {
      mockWebshareFetcher.setRateLimit(2); // 2 req/sec
      
      const start = Date.now();
      await Promise.all([
        fetcher.fetch('https://rate-limited.com/1'),
        fetcher.fetch('https://rate-limited.com/2'),
        fetcher.fetch('https://rate-limited.com/3'),
      ]);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThan(500); // Third request delayed
    });
  });

  describe('Response Validation', () => {
    it('should detect and escalate on soft blocks (CAPTCHA)', async () => {
      mockDirectFetcher.fetch.mockResolvedValue({
        html: '<html><title>Please verify you are human</title></html>',
        status: 200,
      });
      mockWebshareFetcher.fetch.mockResolvedValue(successResponse);
      
      const result = await fetcher.fetch('https://captcha-site.com');
      
      expect(result.tier).toBe('webshare');
    });

    it('should detect and escalate on access denied pages', async () => {
      mockDirectFetcher.fetch.mockResolvedValue({
        html: '<html><title>Access Denied</title></html>',
        status: 200,
      });
      mockWebshareFetcher.fetch.mockResolvedValue(successResponse);
      
      const result = await fetcher.fetch('https://access-denied.com');
      
      expect(result.tier).toBe('webshare');
    });
  });
});
```

**Test Coverage Goals:**
- [ ] Tier escalation (7 tiers)
- [ ] Domain learning
- [ ] Cost tracking
- [ ] Timeout handling
- [ ] Rate limiting
- [ ] Response validation (soft blocks)
- [ ] Error propagation
- [ ] Metrics emission

---

### Task 95-08-02: QueueManager Unit Tests

**File:** `open-seo-main/src/server/features/scraping/queue/__tests__/QueueManager.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueManager } from '../QueueManager';

describe('QueueManager', () => {
  let queueManager: QueueManager;
  let mockRedis: MockRedis;
  let mockProcessor: MockProcessor;

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockProcessor = vi.fn();
    
    queueManager = new QueueManager({
      redis: mockRedis,
      concurrency: 10,
      rateLimits: {
        global: 100,  // 100 req/sec
        perDomain: 5, // 5 req/sec per domain
      },
    });
  });

  describe('Priority Handling', () => {
    it('should process high priority jobs before low priority', async () => {
      const processOrder: string[] = [];
      
      queueManager.setProcessor(async (job) => {
        processOrder.push(job.id);
      });
      
      await queueManager.add({ id: 'low-1', priority: 'low' });
      await queueManager.add({ id: 'high-1', priority: 'high' });
      await queueManager.add({ id: 'low-2', priority: 'low' });
      await queueManager.add({ id: 'critical-1', priority: 'critical' });
      
      await queueManager.drain();
      
      expect(processOrder[0]).toBe('critical-1');
      expect(processOrder[1]).toBe('high-1');
    });

    it('should respect FIFO within same priority', async () => {
      const processOrder: string[] = [];
      
      queueManager.setProcessor(async (job) => {
        processOrder.push(job.id);
      });
      
      await queueManager.add({ id: 'high-1', priority: 'high' });
      await queueManager.add({ id: 'high-2', priority: 'high' });
      await queueManager.add({ id: 'high-3', priority: 'high' });
      
      await queueManager.drain();
      
      expect(processOrder).toEqual(['high-1', 'high-2', 'high-3']);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce global rate limit', async () => {
      queueManager = new QueueManager({
        redis: mockRedis,
        concurrency: 100,
        rateLimits: { global: 10 }, // 10 req/sec
      });
      
      const start = Date.now();
      const jobs = Array.from({ length: 20 }, (_, i) => ({ id: `job-${i}` }));
      
      await Promise.all(jobs.map(job => queueManager.add(job)));
      await queueManager.drain();
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(1000); // At least 1 second for 20 jobs at 10/sec
    });

    it('should enforce per-domain rate limit', async () => {
      queueManager = new QueueManager({
        redis: mockRedis,
        concurrency: 100,
        rateLimits: { perDomain: 2 }, // 2 req/sec per domain
      });
      
      const domainTimestamps: Map<string, number[]> = new Map();
      
      queueManager.setProcessor(async (job) => {
        const domain = new URL(job.url).hostname;
        const timestamps = domainTimestamps.get(domain) || [];
        timestamps.push(Date.now());
        domainTimestamps.set(domain, timestamps);
      });
      
      await queueManager.add({ id: '1', url: 'https://example.com/1' });
      await queueManager.add({ id: '2', url: 'https://example.com/2' });
      await queueManager.add({ id: '3', url: 'https://example.com/3' });
      await queueManager.add({ id: '4', url: 'https://other.com/1' }); // Different domain
      
      await queueManager.drain();
      
      const exampleTimestamps = domainTimestamps.get('example.com')!;
      const timeBetween = exampleTimestamps[2] - exampleTimestamps[0];
      expect(timeBetween).toBeGreaterThan(500); // At least 0.5s for 3 requests at 2/sec
    });
  });

  describe('Concurrency Control', () => {
    it('should not exceed concurrency limit', async () => {
      let currentConcurrency = 0;
      let maxObservedConcurrency = 0;
      
      queueManager = new QueueManager({
        redis: mockRedis,
        concurrency: 5,
      });
      
      queueManager.setProcessor(async () => {
        currentConcurrency++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, currentConcurrency);
        await sleep(100);
        currentConcurrency--;
      });
      
      const jobs = Array.from({ length: 20 }, (_, i) => ({ id: `job-${i}` }));
      await Promise.all(jobs.map(job => queueManager.add(job)));
      await queueManager.drain();
      
      expect(maxObservedConcurrency).toBeLessThanOrEqual(5);
    });
  });

  describe('Job Lifecycle', () => {
    it('should emit job:completed event on success', async () => {
      const completedHandler = vi.fn();
      queueManager.on('job:completed', completedHandler);
      
      queueManager.setProcessor(async () => ({ success: true }));
      
      await queueManager.add({ id: 'test-job' });
      await queueManager.drain();
      
      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'test-job' })
      );
    });

    it('should emit job:failed event on failure', async () => {
      const failedHandler = vi.fn();
      queueManager.on('job:failed', failedHandler);
      
      queueManager.setProcessor(async () => {
        throw new Error('Processing failed');
      });
      
      await queueManager.add({ id: 'failing-job' });
      await queueManager.drain();
      
      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'failing-job',
          error: expect.any(Error),
        })
      );
    });

    it('should retry failed jobs with exponential backoff', async () => {
      let attempts = 0;
      const attemptTimes: number[] = [];
      
      queueManager.setProcessor(async () => {
        attempts++;
        attemptTimes.push(Date.now());
        if (attempts < 3) throw new Error('Temporary failure');
        return { success: true };
      });
      
      await queueManager.add({ id: 'retry-job', maxRetries: 3 });
      await queueManager.drain();
      
      expect(attempts).toBe(3);
      // Exponential backoff: ~100ms, ~200ms between retries
      const backoff1 = attemptTimes[1] - attemptTimes[0];
      const backoff2 = attemptTimes[2] - attemptTimes[1];
      expect(backoff2).toBeGreaterThan(backoff1);
    });
  });

  describe('Batch Operations', () => {
    it('should support batch job addition', async () => {
      const jobs = Array.from({ length: 100 }, (_, i) => ({
        id: `batch-${i}`,
        url: `https://example.com/${i}`,
      }));
      
      await queueManager.addBatch(jobs);
      
      const stats = await queueManager.getStats();
      expect(stats.waiting).toBe(100);
    });

    it('should support batch job cancellation', async () => {
      await queueManager.addBatch([
        { id: 'keep-1' },
        { id: 'cancel-1' },
        { id: 'keep-2' },
        { id: 'cancel-2' },
      ]);
      
      await queueManager.cancelBatch(['cancel-1', 'cancel-2']);
      
      const stats = await queueManager.getStats();
      expect(stats.waiting).toBe(2);
    });
  });
});
```

**Test Coverage Goals:**
- [ ] Priority handling (critical/high/normal/low)
- [ ] Rate limiting (global and per-domain)
- [ ] Concurrency control
- [ ] Job lifecycle events
- [ ] Retry with exponential backoff
- [ ] Batch operations
- [ ] Stats and metrics

---

### Task 95-08-03: Circuit Breaker Implementation

**File:** `open-seo-main/src/server/features/scraping/resilience/CircuitBreaker.ts`

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;      // Failures before opening
  successThreshold: number;      // Successes in half-open before closing
  timeout: number;               // Time before transitioning to half-open
  volumeThreshold: number;       // Minimum requests before evaluating
  errorFilter?: (error: Error) => boolean;  // Which errors count as failures
}

interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  totalRequests: number;
  totalFailures: number;
}

class CircuitBreaker<T> {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastStateChange = Date.now();
  private stats: CircuitStats;

  constructor(private config: CircuitBreakerConfig) {
    this.stats = this.initStats();
  }

  async execute<R>(operation: () => Promise<R>): Promise<R> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitOpenError(this.config.name, this.getTimeUntilRetry());
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.stats.lastSuccess = new Date();
    this.stats.totalRequests++;
    
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    } else {
      this.failures = 0; // Reset failure count on success
    }
  }

  private onFailure(error: Error): void {
    // Check if this error should count as a failure
    if (this.config.errorFilter && !this.config.errorFilter(error)) {
      return;
    }

    this.stats.lastFailure = new Date();
    this.stats.totalFailures++;
    this.stats.totalRequests++;
    
    if (this.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      this.failures++;
      if (this.failures >= this.config.failureThreshold &&
          this.stats.totalRequests >= this.config.volumeThreshold) {
        this.transitionTo('open');
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    
    if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === 'half-open') {
      this.successes = 0;
    }

    this.emitStateChange(oldState, newState);
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitStats {
    return { ...this.stats, state: this.state };
  }

  forceOpen(): void {
    this.transitionTo('open');
  }

  forceClose(): void {
    this.transitionTo('closed');
  }
}

class CircuitOpenError extends Error {
  constructor(
    public circuitName: string,
    public retryAfter: number
  ) {
    super(`Circuit ${circuitName} is open. Retry after ${retryAfter}ms`);
    this.name = 'CircuitOpenError';
  }
}
```

**Implementation Details:**
- Three states: closed (normal), open (failing fast), half-open (testing)
- Configurable thresholds for state transitions
- Error filtering (e.g., don't count 404s as failures)
- Stats and metrics for monitoring
- Manual override for testing/emergencies

---

### Task 95-08-04: Circuit Breaker Integration

**File:** `open-seo-main/src/server/features/scraping/fetchers/TieredFetcher.ts` (modify)

```typescript
class TieredFetcher {
  private circuits: Map<TierName, CircuitBreaker>;

  constructor(config: TieredFetcherConfig) {
    // Initialize circuit breakers for each tier
    this.circuits = new Map(
      config.tiers.map(tier => [
        tier.name,
        new CircuitBreaker({
          name: `tier-${tier.name}`,
          failureThreshold: tier.circuitConfig?.failureThreshold ?? 5,
          successThreshold: tier.circuitConfig?.successThreshold ?? 2,
          timeout: tier.circuitConfig?.timeout ?? 30000,
          volumeThreshold: tier.circuitConfig?.volumeThreshold ?? 10,
          errorFilter: this.isRecoverableError,
        }),
      ])
    );
  }

  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    for (const tier of this.tiers) {
      const circuit = this.circuits.get(tier.name)!;
      
      // Skip tier if circuit is open
      if (circuit.getState() === 'open') {
        this.logger.debug(`Skipping tier ${tier.name} (circuit open)`);
        continue;
      }

      try {
        const result = await circuit.execute(() => 
          this.fetchWithTier(tier, url, options)
        );
        return result;
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          // Circuit just opened, try next tier
          continue;
        }
        // Other errors - tier failed, try next
        this.logger.warn(`Tier ${tier.name} failed: ${error.message}`);
      }
    }

    throw new AllTiersExhaustedError(url);
  }

  private isRecoverableError(error: Error): boolean {
    // Don't count these as circuit-breaking failures
    if (error.message.includes('404')) return false;
    if (error.message.includes('410')) return false;
    return true;
  }

  getCircuitStats(): Map<TierName, CircuitStats> {
    return new Map(
      Array.from(this.circuits.entries()).map(([name, circuit]) => [
        name,
        circuit.getStats(),
      ])
    );
  }
}
```

**Integration Points:**
- Each tier gets its own circuit breaker
- Open circuits are skipped during escalation
- Metrics exposed for monitoring
- Manual override for operational control

---

### Task 95-08-05: Circuit Breaker Unit Tests

**File:** `open-seo-main/src/server/features/scraping/resilience/__tests__/CircuitBreaker.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../CircuitBreaker';

describe('CircuitBreaker', () => {
  let circuit: CircuitBreaker;
  let mockOperation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    circuit = new CircuitBreaker({
      name: 'test-circuit',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      volumeThreshold: 5,
    });
    mockOperation = vi.fn();
  });

  describe('Closed State', () => {
    it('should execute operations normally when closed', async () => {
      mockOperation.mockResolvedValue('success');
      
      const result = await circuit.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(circuit.getState()).toBe('closed');
    });

    it('should transition to open after failure threshold', async () => {
      mockOperation.mockRejectedValue(new Error('fail'));
      
      // Build up volume
      for (let i = 0; i < 5; i++) {
        try { await circuit.execute(mockOperation); } catch {}
      }
      
      expect(circuit.getState()).toBe('open');
    });

    it('should reset failure count on success', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));
      
      // Two failures, then success
      try { await circuit.execute(mockOperation); } catch {}
      try { await circuit.execute(mockOperation); } catch {}
      await circuit.execute(mockOperation);
      
      // Two more failures - should not trip (count reset)
      try { await circuit.execute(mockOperation); } catch {}
      try { await circuit.execute(mockOperation); } catch {}
      
      expect(circuit.getState()).toBe('closed');
    });
  });

  describe('Open State', () => {
    it('should fail fast when open', async () => {
      // Trip the circuit
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 10; i++) {
        try { await circuit.execute(mockOperation); } catch {}
      }
      
      mockOperation.mockClear();
      
      await expect(circuit.execute(mockOperation))
        .rejects.toThrow(CircuitOpenError);
      
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should transition to half-open after timeout', async () => {
      circuit = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 100,
        volumeThreshold: 1,
      });
      
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      try { await circuit.execute(mockOperation); } catch {}
      
      expect(circuit.getState()).toBe('open');
      
      await sleep(150);
      
      mockOperation.mockResolvedValueOnce('success');
      await circuit.execute(mockOperation);
      
      expect(circuit.getState()).toBe('closed');
    });
  });

  describe('Half-Open State', () => {
    it('should transition to closed after success threshold', async () => {
      circuit = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 100,
        volumeThreshold: 1,
      });
      
      // Trip circuit
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      try { await circuit.execute(mockOperation); } catch {}
      
      await sleep(150);
      
      // First success in half-open
      mockOperation.mockResolvedValue('success');
      await circuit.execute(mockOperation);
      expect(circuit.getState()).toBe('half-open');
      
      // Second success - should close
      await circuit.execute(mockOperation);
      expect(circuit.getState()).toBe('closed');
    });

    it('should transition back to open on failure in half-open', async () => {
      circuit = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 100,
        volumeThreshold: 1,
      });
      
      // Trip circuit
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      try { await circuit.execute(mockOperation); } catch {}
      
      await sleep(150);
      
      // Fail in half-open
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      try { await circuit.execute(mockOperation); } catch {}
      
      expect(circuit.getState()).toBe('open');
    });
  });

  describe('Error Filtering', () => {
    it('should not count filtered errors as failures', async () => {
      circuit = new CircuitBreaker({
        name: 'test',
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
        volumeThreshold: 1,
        errorFilter: (error) => !error.message.includes('404'),
      });
      
      const notFoundError = new Error('404 Not Found');
      mockOperation.mockRejectedValue(notFoundError);
      
      // Many 404s shouldn't trip circuit
      for (let i = 0; i < 10; i++) {
        try { await circuit.execute(mockOperation); } catch {}
      }
      
      expect(circuit.getState()).toBe('closed');
    });
  });

  describe('Manual Override', () => {
    it('should allow forcing circuit open', () => {
      circuit.forceOpen();
      expect(circuit.getState()).toBe('open');
    });

    it('should allow forcing circuit closed', async () => {
      // Trip circuit
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 10; i++) {
        try { await circuit.execute(mockOperation); } catch {}
      }
      
      circuit.forceClose();
      expect(circuit.getState()).toBe('closed');
    });
  });

  describe('Stats', () => {
    it('should track total requests and failures', async () => {
      mockOperation
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      await circuit.execute(mockOperation);
      try { await circuit.execute(mockOperation); } catch {}
      await circuit.execute(mockOperation);
      
      const stats = circuit.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalFailures).toBe(1);
    });
  });
});
```

---

### Task 95-08-06: Integration Tests

**File:** `open-seo-main/src/server/features/scraping/__tests__/integration/`

```typescript
// ScrapingService.integration.test.ts
describe('ScrapingService Integration', () => {
  let service: ScrapingService;
  let redis: Redis;
  let pg: Pool;

  beforeAll(async () => {
    redis = new Redis(process.env.TEST_REDIS_URL);
    pg = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    
    service = await ScrapingService.create({
      redis,
      pg,
      config: testConfig,
    });
  });

  afterAll(async () => {
    await redis.quit();
    await pg.end();
  });

  describe('End-to-End Scraping', () => {
    it('should scrape and cache a simple page', async () => {
      const result = await service.scrape({
        url: 'https://httpbin.org/html',
        parseHtml: true,
      });

      expect(result.html).toContain('Herman Melville');
      expect(result.cached).toBe(false);
      expect(result.tier).toBeDefined();

      // Second request should hit cache
      const cachedResult = await service.scrape({
        url: 'https://httpbin.org/html',
        parseHtml: true,
      });

      expect(cachedResult.cached).toBe(true);
    });

    it('should escalate tiers for protected pages', async () => {
      // This requires a mock server that blocks direct requests
      const result = await service.scrape({
        url: 'https://protected-test.example.com/',
        parseHtml: true,
      });

      expect(result.tier).not.toBe('direct');
    });

    it('should batch scrape multiple URLs efficiently', async () => {
      const urls = [
        'https://httpbin.org/html',
        'https://httpbin.org/ip',
        'https://httpbin.org/user-agent',
      ];

      const results = await service.scrapeBatch({
        urls,
        concurrency: 3,
      });

      expect(results.succeeded).toBe(3);
      expect(results.failed).toBe(0);
    });
  });

  describe('Cost Tracking', () => {
    it('should accurately track costs across tiers', async () => {
      const initialReport = await service.getCostReport();
      
      await service.scrape({
        url: 'https://httpbin.org/html',
        bypassCache: true,
      });

      const finalReport = await service.getCostReport();
      
      expect(finalReport.totalCost).toBeGreaterThanOrEqual(initialReport.totalCost);
      expect(finalReport.requestsByTier.direct).toBeGreaterThan(
        initialReport.requestsByTier?.direct ?? 0
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout gracefully', async () => {
      const result = await service.scrape({
        url: 'https://httpbin.org/delay/30',
        timeout: 1000,
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('should handle 404 without triggering circuit breaker', async () => {
      const result = await service.scrape({
        url: 'https://httpbin.org/status/404',
      });

      expect(result.status).toBe(404);
      
      // Circuit should still be closed
      const metrics = await service.getMetrics();
      expect(metrics.circuitStates.direct).toBe('closed');
    });
  });
});
```

---

### Task 95-08-07: Cache Layer Tests

**File:** `open-seo-main/src/server/features/scraping/cache/__tests__/`

```typescript
// MultiLevelCache.test.ts
describe('MultiLevelCache', () => {
  describe('L1 Memory Cache', () => {
    it('should store and retrieve from memory', async () => {
      await cache.set('test-key', 'test-value');
      const result = await cache.get('test-key');
      expect(result).toBe('test-value');
      expect(cache.getHitSource()).toBe('L1');
    });

    it('should respect memory size limits', async () => {
      // Fill memory cache
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key-${i}`, 'x'.repeat(1000));
      }
      
      // Oldest entries should be evicted
      const oldestResult = await cache.get('key-0');
      expect(cache.getHitSource()).not.toBe('L1');
    });
  });

  describe('L2 Redis Cache', () => {
    it('should fall through to Redis on L1 miss', async () => {
      // Set directly in Redis
      await redis.set('cache:test-key', JSON.stringify({ data: 'value' }));
      
      const result = await cache.get('test-key');
      expect(result.data).toBe('value');
      expect(cache.getHitSource()).toBe('L2');
    });

    it('should promote to L1 on L2 hit', async () => {
      await redis.set('cache:test-key', JSON.stringify({ data: 'value' }));
      
      // First access - L2 hit
      await cache.get('test-key');
      expect(cache.getHitSource()).toBe('L2');
      
      // Second access - should now be L1
      await cache.get('test-key');
      expect(cache.getHitSource()).toBe('L1');
    });
  });

  describe('L3 PostgreSQL Cache', () => {
    it('should fall through to PostgreSQL on L1/L2 miss', async () => {
      // Insert directly into PostgreSQL
      await pg.query(
        'INSERT INTO scraping_cache (key, value, expires_at) VALUES ($1, $2, $3)',
        ['test-key', JSON.stringify({ data: 'pg-value' }), new Date(Date.now() + 3600000)]
      );
      
      const result = await cache.get('test-key');
      expect(result.data).toBe('pg-value');
      expect(cache.getHitSource()).toBe('L3');
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate across all levels', async () => {
      await cache.set('test-key', 'value');
      await cache.invalidate('test-key');
      
      const result = await cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should support pattern-based invalidation', async () => {
      await cache.set('domain:example.com:page1', 'v1');
      await cache.set('domain:example.com:page2', 'v2');
      await cache.set('domain:other.com:page1', 'v3');
      
      await cache.invalidatePattern('domain:example.com:*');
      
      expect(await cache.get('domain:example.com:page1')).toBeNull();
      expect(await cache.get('domain:example.com:page2')).toBeNull();
      expect(await cache.get('domain:other.com:page1')).not.toBeNull();
    });
  });
});
```

---

### Task 95-08-08: CI Pipeline Configuration

**File:** `open-seo-main/.github/workflows/test-scraping.yml`

```yaml
name: Scraping Infrastructure Tests

on:
  push:
    paths:
      - 'open-seo-main/src/server/features/scraping/**'
  pull_request:
    paths:
      - 'open-seo-main/src/server/features/scraping/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      
      - name: Run unit tests
        run: pnpm --filter open-seo-main test:unit --coverage
        env:
          NODE_ENV: test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./open-seo-main/coverage/lcov.info
          flags: scraping-unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_open_seo
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      
      - name: Run database migrations
        run: pnpm --filter open-seo-main db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_open_seo
      
      - name: Run integration tests
        run: pnpm --filter open-seo-main test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_open_seo
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./open-seo-main/coverage/lcov.info
          flags: scraping-integration

  coverage-gate:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    steps:
      - name: Check coverage threshold
        uses: codecov/codecov-action@v4
        with:
          fail_ci_if_error: true
          # Fail if coverage drops below 80%
```

---

## Definition of Done

- [ ] TieredFetcher unit tests ≥ 80% coverage
- [ ] QueueManager unit tests ≥ 80% coverage
- [ ] CircuitBreaker implemented and tested
- [ ] CircuitBreaker integrated with TieredFetcher
- [ ] Cache layer tests complete
- [ ] Integration tests passing
- [ ] CI pipeline configured
- [ ] All tests passing locally and in CI
- [ ] Coverage reports generated and reviewed
