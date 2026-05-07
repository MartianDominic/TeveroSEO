/**
 * Load Testing Infrastructure
 * Phase 95-13: E2E Testing & Migration Rollout
 *
 * Provides load testing capabilities for the scraping infrastructure:
 * - Configurable requests per second (RPS)
 * - Ramp-up support
 * - Latency percentile calculation
 * - Tier distribution tracking
 * - Cache hit rate measurement
 * - Cost tracking
 */

import type { ScrapingService, ScrapeResult } from '../../ScrapingService';
import type { ScrapeTier } from '@/db/domain-scrape-learning-schema';

// =============================================================================
// Types
// =============================================================================

/**
 * Load test configuration.
 */
export interface LoadTestConfig {
  /** Target requests per second */
  targetRps: number;
  /** Test duration in seconds */
  durationSeconds: number;
  /** Time to ramp up to target RPS in seconds */
  rampUpSeconds: number;
  /** URLs to test (randomly selected) */
  urls: string[];
  /** Optional client ID for attribution */
  clientId?: string;
  /** Callback for progress updates */
  onProgress?: (progress: LoadTestProgress) => void;
}

/**
 * Progress callback data.
 */
export interface LoadTestProgress {
  elapsed: number;
  totalRequests: number;
  currentRps: number;
  successRate: number;
  cacheHitRate: number;
}

/**
 * Individual request result.
 */
interface RequestResult {
  url: string;
  latencyMs: number;
  success: boolean;
  tier: ScrapeTier;
  fromCache: boolean;
  error?: string;
  costUsd: number;
  timestamp: Date;
}

/**
 * Load test results.
 */
export interface LoadTestResult {
  /** Test configuration */
  config: LoadTestConfig;
  /** Test start time */
  startedAt: Date;
  /** Test end time */
  completedAt: Date;
  /** Total requests made */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average latency in milliseconds */
  avgLatencyMs: number;
  /** 50th percentile latency */
  p50LatencyMs: number;
  /** 95th percentile latency */
  p95LatencyMs: number;
  /** 99th percentile latency */
  p99LatencyMs: number;
  /** Maximum latency */
  maxLatencyMs: number;
  /** Minimum latency */
  minLatencyMs: number;
  /** Actual requests per second achieved */
  requestsPerSecond: number;
  /** Tier distribution */
  tierDistribution: Record<ScrapeTier, number>;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Total cost in USD */
  totalCostUsd: number;
  /** Average cost per request */
  avgCostPerRequest: number;
  /** Errors by type */
  errors: Record<string, number>;
  /** Success rate (0-1) */
  successRate: number;
  /** Throughput (successful requests per second) */
  throughput: number;
}

// =============================================================================
// LoadTester Implementation
// =============================================================================

/**
 * Load tester for scraping infrastructure.
 *
 * @example
 * ```typescript
 * const tester = new LoadTester(scrapingService);
 * const results = await tester.runLoadTest({
 *   targetRps: 28,  // ~100K pages/hour
 *   durationSeconds: 60,
 *   rampUpSeconds: 10,
 *   urls: ['https://example.com', 'https://httpbin.org/html'],
 * });
 * console.log(JSON.stringify(results, null, 2));
 * ```
 */
export class LoadTester {
  private service: ScrapingService;
  private results: RequestResult[] = [];
  private inFlightRequests: number = 0;
  private maxInFlight: number = 100;

  constructor(service: ScrapingService) {
    this.service = service;
  }

  /**
   * Run a load test with the given configuration.
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const { targetRps, durationSeconds, rampUpSeconds, urls, clientId } = config;

    console.log(`[LoadTest] Starting: ${targetRps} RPS for ${durationSeconds}s with ${rampUpSeconds}s ramp-up`);
    console.log(`[LoadTest] Testing ${urls.length} URLs`);

    // Reset state
    this.results = [];
    this.inFlightRequests = 0;

    const startTime = Date.now();
    const endTime = startTime + durationSeconds * 1000;
    let requestCount = 0;
    let lastProgressTime = startTime;

    // Main load generation loop
    while (Date.now() < endTime) {
      const elapsed = (Date.now() - startTime) / 1000;

      // Calculate current RPS (ramp up)
      const currentRps =
        elapsed < rampUpSeconds
          ? (elapsed / rampUpSeconds) * targetRps
          : targetRps;

      // Calculate delay between requests
      const delayMs = currentRps > 0 ? 1000 / currentRps : 1000;

      // Check if we have room for more in-flight requests
      if (this.inFlightRequests < this.maxInFlight) {
        // Pick random URL
        const url = urls[Math.floor(Math.random() * urls.length)];

        // Fire request (don't await)
        this.fireRequest(url, clientId, requestCount++);
      }

      // Wait before next request
      await this.sleep(Math.max(1, delayMs));

      // Report progress every 5 seconds
      if (Date.now() - lastProgressTime >= 5000) {
        lastProgressTime = Date.now();
        const cachedCount = this.results.filter((r) => r.fromCache).length;
        const successCount = this.results.filter((r) => r.success).length;

        config.onProgress?.({
          elapsed,
          totalRequests: this.results.length,
          currentRps,
          successRate: this.results.length > 0 ? successCount / this.results.length : 0,
          cacheHitRate: this.results.length > 0 ? cachedCount / this.results.length : 0,
        });

        console.log(
          `[LoadTest] Progress: ${this.results.length} requests, ` +
            `${currentRps.toFixed(1)} RPS, ` +
            `${((successCount / Math.max(1, this.results.length)) * 100).toFixed(1)}% success`
        );
      }
    }

    // Wait for in-flight requests to complete (with timeout)
    console.log(`[LoadTest] Waiting for ${this.inFlightRequests} in-flight requests...`);
    const drainTimeout = Date.now() + 30000; // 30 second timeout
    while (this.inFlightRequests > 0 && Date.now() < drainTimeout) {
      await this.sleep(100);
    }

    const completedAt = new Date();

    console.log(`[LoadTest] Complete: ${this.results.length} total requests`);

    return this.calculateResults(config, new Date(startTime), completedAt);
  }

  /**
   * Fire a single request (fire-and-forget with tracking).
   */
  private async fireRequest(url: string, clientId: string | undefined, _requestId: number): Promise<void> {
    this.inFlightRequests++;
    const startTime = Date.now();

    try {
      const result = await this.service.scrape(url, {
        clientId: clientId ?? 'load-test',
        feature: 'siteAudits', // Use a valid feature
      });

      this.results.push({
        url,
        latencyMs: Date.now() - startTime,
        success: result.success,
        tier: result.tierUsed,
        fromCache: result.fromCache,
        costUsd: result.estimatedCostUsd,
        timestamp: new Date(),
      });
    } catch (error) {
      this.results.push({
        url,
        latencyMs: Date.now() - startTime,
        success: false,
        tier: 'direct',
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        costUsd: 0,
        timestamp: new Date(),
      });
    } finally {
      this.inFlightRequests--;
    }
  }

  /**
   * Calculate final test results.
   */
  private calculateResults(
    config: LoadTestConfig,
    startedAt: Date,
    completedAt: Date
  ): LoadTestResult {
    const latencies = this.results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const successful = this.results.filter((r) => r.success);
    const cached = this.results.filter((r) => r.fromCache);
    const durationSeconds = (completedAt.getTime() - startedAt.getTime()) / 1000;

    // Tier distribution
    const tierCounts: Record<ScrapeTier, number> = {
      direct: 0,
      webshare: 0,
      geonode: 0,
      camoufox: 0,
      dfs_basic: 0,
      dfs_js: 0,
      dfs_browser: 0,
    };

    // Error counts
    const errorCounts: Record<string, number> = {};

    // Aggregate results
    for (const result of this.results) {
      tierCounts[result.tier] = (tierCounts[result.tier] || 0) + 1;
      if (result.error) {
        const errorKey = this.normalizeError(result.error);
        errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
      }
    }

    // Calculate percentiles
    const getPercentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.floor(arr.length * p);
      return arr[Math.min(index, arr.length - 1)];
    };

    const totalCostUsd = this.results.reduce((sum, r) => sum + r.costUsd, 0);

    return {
      config,
      startedAt,
      completedAt,
      totalRequests: this.results.length,
      successfulRequests: successful.length,
      failedRequests: this.results.length - successful.length,
      avgLatencyMs: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0,
      p50LatencyMs: getPercentile(latencies, 0.5),
      p95LatencyMs: getPercentile(latencies, 0.95),
      p99LatencyMs: getPercentile(latencies, 0.99),
      maxLatencyMs: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
      minLatencyMs: latencies.length > 0 ? latencies[0] : 0,
      requestsPerSecond: durationSeconds > 0 ? this.results.length / durationSeconds : 0,
      tierDistribution: tierCounts,
      cacheHitRate: this.results.length > 0 ? cached.length / this.results.length : 0,
      totalCostUsd,
      avgCostPerRequest: this.results.length > 0 ? totalCostUsd / this.results.length : 0,
      errors: errorCounts,
      successRate: this.results.length > 0 ? successful.length / this.results.length : 0,
      throughput: durationSeconds > 0 ? successful.length / durationSeconds : 0,
    };
  }

  /**
   * Normalize error messages for aggregation.
   */
  private normalizeError(error: string): string {
    const lowerError = error.toLowerCase();

    if (lowerError.includes('timeout')) return 'Timeout';
    if (lowerError.includes('rate limit') || lowerError.includes('429')) return 'Rate Limited';
    if (lowerError.includes('connection') || lowerError.includes('network')) return 'Network Error';
    if (lowerError.includes('dns')) return 'DNS Error';
    if (lowerError.includes('ssl') || lowerError.includes('certificate')) return 'SSL Error';
    if (lowerError.includes('blocked') || lowerError.includes('banned')) return 'Blocked';
    if (lowerError.includes('captcha')) return 'CAPTCHA';
    if (lowerError.includes('circuit') || lowerError.includes('exhausted')) return 'Circuit Open';

    return 'Other';
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a report summary.
   */
  static generateReport(result: LoadTestResult): string {
    const lines: string[] = [
      '='.repeat(60),
      '  LOAD TEST REPORT',
      '='.repeat(60),
      '',
      `Test Duration: ${(result.completedAt.getTime() - result.startedAt.getTime()) / 1000}s`,
      `Target RPS: ${result.config.targetRps}`,
      `Actual RPS: ${result.requestsPerSecond.toFixed(2)}`,
      '',
      '--- REQUESTS ---',
      `Total:      ${result.totalRequests}`,
      `Successful: ${result.successfulRequests} (${(result.successRate * 100).toFixed(1)}%)`,
      `Failed:     ${result.failedRequests}`,
      `Throughput: ${result.throughput.toFixed(2)} req/s`,
      '',
      '--- LATENCY (ms) ---',
      `Average: ${result.avgLatencyMs.toFixed(0)}`,
      `Min:     ${result.minLatencyMs.toFixed(0)}`,
      `P50:     ${result.p50LatencyMs.toFixed(0)}`,
      `P95:     ${result.p95LatencyMs.toFixed(0)}`,
      `P99:     ${result.p99LatencyMs.toFixed(0)}`,
      `Max:     ${result.maxLatencyMs.toFixed(0)}`,
      '',
      '--- CACHE ---',
      `Hit Rate: ${(result.cacheHitRate * 100).toFixed(1)}%`,
      '',
      '--- COST ---',
      `Total:   $${result.totalCostUsd.toFixed(4)}`,
      `Per Req: $${result.avgCostPerRequest.toFixed(6)}`,
      '',
      '--- TIER DISTRIBUTION ---',
    ];

    for (const [tier, count] of Object.entries(result.tierDistribution)) {
      if (count > 0) {
        const pct = ((count / result.totalRequests) * 100).toFixed(1);
        lines.push(`${tier.padEnd(12)}: ${count} (${pct}%)`);
      }
    }

    if (Object.keys(result.errors).length > 0) {
      lines.push('');
      lines.push('--- ERRORS ---');
      for (const [error, count] of Object.entries(result.errors)) {
        lines.push(`${error}: ${count}`);
      }
    }

    lines.push('');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}

// =============================================================================
// Benchmark Utilities
// =============================================================================

/**
 * Run a quick benchmark (30 seconds) at the target RPS.
 */
export async function runQuickBenchmark(
  service: ScrapingService,
  urls: string[],
  targetRps: number = 10
): Promise<LoadTestResult> {
  const tester = new LoadTester(service);
  return tester.runLoadTest({
    targetRps,
    durationSeconds: 30,
    rampUpSeconds: 5,
    urls,
  });
}

/**
 * Run a full benchmark (5 minutes) at the target RPS.
 */
export async function runFullBenchmark(
  service: ScrapingService,
  urls: string[],
  targetRps: number = 28
): Promise<LoadTestResult> {
  const tester = new LoadTester(service);
  return tester.runLoadTest({
    targetRps,
    durationSeconds: 300,
    rampUpSeconds: 30,
    urls,
  });
}

/**
 * Test for 100K pages/hour capacity (28 RPS).
 */
export async function test100kCapacity(
  service: ScrapingService,
  urls: string[]
): Promise<{ passed: boolean; result: LoadTestResult }> {
  const result = await runFullBenchmark(service, urls, 28);

  // Success criteria: 95% success rate, 28 RPS throughput
  const passed =
    result.successRate >= 0.95 && result.requestsPerSecond >= 25; // Allow some variance

  return { passed, result };
}

// =============================================================================
// CLI Entry Point
// =============================================================================

/**
 * CLI runner for load tests.
 * Usage: npx tsx LoadTest.ts [--rps=28] [--duration=60]
 */
export async function runCLI(service: ScrapingService): Promise<void> {
  const args = process.argv.slice(2);
  const rps = parseInt(args.find((a) => a.startsWith('--rps='))?.split('=')[1] ?? '10', 10);
  const duration = parseInt(args.find((a) => a.startsWith('--duration='))?.split('=')[1] ?? '60', 10);

  const tester = new LoadTester(service);

  console.log('Starting load test...');
  console.log(`RPS: ${rps}, Duration: ${duration}s`);

  const result = await tester.runLoadTest({
    targetRps: rps,
    durationSeconds: duration,
    rampUpSeconds: Math.min(10, duration / 6),
    urls: [
      'https://example.com',
      'https://httpbin.org/html',
      // Add more test URLs as needed
    ],
    onProgress: (progress) => {
      console.log(`[Progress] ${progress.elapsed.toFixed(0)}s - ${progress.totalRequests} requests`);
    },
  });

  console.log('\n' + LoadTester.generateReport(result));
  console.log('\nJSON Output:');
  console.log(JSON.stringify(result, null, 2));
}
