/**
 * TieredFetcher - Cost-Optimized Web Scraping Orchestrator
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Main entry point for all web scraping in TeveroSEO.
 * Automatically discovers and remembers the cheapest working tier for each domain.
 *
 * Tier escalation order (by cost):
 * - T0: Direct ($0) - Native fetch with rate limiting
 * - T1: Webshare ($0) - Free DC proxies
 * - T2: Geonode ($0.77/GB) - Residential proxies
 * - T2.5: Camoufox ($0.77/GB) - Stealth browser
 * - T3: DFS Basic ($0.000125/pg) - DataForSEO no JS
 * - T4: DFS JS ($0.00125/pg) - DataForSEO with JS
 * - T5: DFS Browser ($0.00425/pg) - DataForSEO full browser
 *
 * Target: 60%+ requests served by T0-T2, 90%+ cost reduction vs all-DFS
 */

import type { ScrapeTier, EscalationReason } from "@/db/domain-scrape-learning-schema";
import { TIER_COSTS, TIER_INDEX, SCRAPE_TIERS } from "@/db/domain-scrape-learning-schema";
import { domainLearningService, normalizeDomain } from "./DomainLearningService";
import { contentQualityAssessor } from "./ContentQualityAssessor";
import type {
  TieredFetchRequest,
  TieredFetchResult,
  ContentValidation,
} from "./types";
import type { CacheManager, CacheLevel, CachedPage, ContentType } from "./cache";
import { getContentHash, detectContentType } from "./cache";
import { CircuitBreaker, type CircuitState, CircuitOpenError } from "./resilience/CircuitBreaker";
import type { AlertManager } from "./monitoring/AlertManager";
import { recordCircuitState, recordTierUsage } from "./monitoring/MetricsCollector";
import { fetcherLogger, cacheLogger, logCircuitStateChange, logTierEscalation } from "./logging";
import { getBandwidthTracker, type BandwidthTracker, type ProxyProvider } from "./monitoring/BandwidthTracker";

// =============================================================================
// Types
// =============================================================================

export interface FetchOptions {
  /** Force a specific tier (skip learning) */
  forceTier?: ScrapeTier;

  /** Skip cache lookup */
  skipCache?: boolean;

  /** Skip domain learning (always use forceTier or startTier) */
  skipLearning?: boolean;

  /** Starting tier for discovery (default: direct) */
  startTier?: ScrapeTier;

  /** Maximum tier to try (default: dfs_browser) */
  maxTier?: ScrapeTier;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Custom headers */
  headers?: Record<string, string>;

  /** Geo-targeting */
  geo?: { country?: string; region?: string };

  /** Client ID for cost attribution */
  clientId?: string;

  /** Job ID for correlation */
  jobId?: string;
}

export interface FetchResult {
  /** Request URL */
  url: string;

  /** Whether fetch was successful */
  success: boolean;

  /** HTML content (if successful) */
  html?: string;

  /** HTTP status code */
  statusCode: number;

  /** Tier that was used */
  tierUsed: ScrapeTier;

  /** Whether result came from cache */
  fromCache: boolean;

  /** Cache level if from cache */
  cacheLevel?: CacheLevel;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Response size in bytes */
  responseSizeBytes: number;

  /** Estimated cost in USD */
  estimatedCostUsd: number;

  /** Content quality metrics */
  quality?: {
    score: number;
    acceptable: boolean;
    wordCount: number;
    textRatio: number;
  };

  /** Error message if failed */
  error?: string;

  /** Discovery info (if new domain) */
  discovery?: {
    isNewDomain: boolean;
    tiersAttempted: ScrapeTier[];
    escalationPath: Array<{ tier: ScrapeTier; reason: EscalationReason }>;
  };
}

// =============================================================================
// Circuit Breaker Configuration per Tier
// =============================================================================

/**
 * Failure thresholds per tier - higher tiers (more expensive) have lower thresholds.
 */
const TIER_FAILURE_THRESHOLDS: Record<ScrapeTier, number> = {
  direct: 10,      // Allow more failures (free)
  webshare: 10,    // Allow more failures (free)
  geonode: 5,      // Moderate threshold
  camoufox: 5,     // Moderate threshold
  dfs_basic: 3,    // Lower threshold (paid)
  dfs_js: 3,       // Lower threshold (paid)
  dfs_browser: 2,  // Lowest threshold (expensive)
};

/**
 * Reset timeout per tier - DataForSEO tiers have longer cooldown.
 */
const TIER_RESET_TIMEOUTS: Record<ScrapeTier, number> = {
  direct: 30_000,      // 30 seconds
  webshare: 30_000,    // 30 seconds
  geonode: 60_000,     // 1 minute
  camoufox: 60_000,    // 1 minute
  dfs_basic: 120_000,  // 2 minutes
  dfs_js: 120_000,     // 2 minutes
  dfs_browser: 300_000, // 5 minutes
};

/**
 * Tier escalation order for when a circuit opens.
 * Uses SCRAPE_TIERS from schema as single source of truth.
 */
const TIER_ORDER: readonly ScrapeTier[] = SCRAPE_TIERS;

/**
 * Mapping of tiers to their proxy providers for bandwidth tracking.
 * Tiers with null don't use tracked proxies (direct fetch or DFS-managed).
 */
const TIER_PROVIDERS: Record<ScrapeTier, ProxyProvider | null> = {
  direct: null,       // No proxy
  webshare: 'webshare',
  geonode: 'geonode',
  camoufox: 'geonode', // Uses geonode proxies
  dfs_basic: null,    // DFS manages own quota
  dfs_js: null,
  dfs_browser: null,
};

// =============================================================================
// TieredFetcher
// =============================================================================

export class TieredFetcher {
  private cacheManager: CacheManager | null = null;
  private circuitBreakers: Map<ScrapeTier, CircuitBreaker> = new Map();
  private alertManager: AlertManager | null = null;
  private bandwidthTracker: BandwidthTracker;

  constructor() {
    this.bandwidthTracker = getBandwidthTracker();
    this.initializeCircuitBreakers();
  }

  /**
   * Initialize circuit breakers for each tier.
   */
  private initializeCircuitBreakers(): void {
    for (const tier of TIER_ORDER) {
      const breaker = new CircuitBreaker({
        name: `tier-${tier}`,
        failureThreshold: TIER_FAILURE_THRESHOLDS[tier],
        successThreshold: 2,
        timeout: TIER_RESET_TIMEOUTS[tier],
        volumeThreshold: 5,
        halfOpenMaxRequests: 3,
        errorFilter: (error) => {
          // Don't count 4xx client errors as failures (except 429 rate limit)
          if (error.message.includes('429')) return true;
          if (error.message.includes('4')) return false;
          return true;
        },
      });

      // Set up state change listener
      breaker.onStateChange((oldState, newState) => {
        logCircuitStateChange(tier, oldState, newState);
        recordCircuitState(tier, newState);
        if (newState === 'open' && this.alertManager) {
          // Fire alert when circuit opens
          this.alertManager.evaluate({
            'circuit.open_count': this.getOpenCircuitCount(),
          });
        }
      });

      this.circuitBreakers.set(tier, breaker);
    }
  }

  /**
   * Set the alert manager for circuit breaker alerts.
   */
  setAlertManager(alertManager: AlertManager): void {
    this.alertManager = alertManager;
  }

  /**
   * Set the cache manager for this fetcher.
   * Call this during initialization with your Redis and DB instances.
   */
  setCacheManager(cacheManager: CacheManager): void {
    this.cacheManager = cacheManager;
  }

  /**
   * Get the number of circuits currently in open state.
   */
  private getOpenCircuitCount(): number {
    let count = 0;
    for (const [_, breaker] of this.circuitBreakers) {
      if (breaker.getState() === 'open') {
        count++;
      }
    }
    return count;
  }

  /**
   * Fetch a URL using the optimal tier for its domain.
   * Checks cache first (unless skipCache is set).
   * Uses circuit breakers to prevent cascade failures.
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const startTime = Date.now();
    const domain = normalizeDomain(url);

    // Check cache first (unless skipped)
    if (!options.skipCache && this.cacheManager) {
      try {
        const cacheResult = await this.cacheManager.get(url);
        if (cacheResult.hit && cacheResult.data) {
          // Return cached result
          return this.createCacheHitResult(url, cacheResult.data, cacheResult.level!, startTime);
        }
      } catch (error) {
        // Log but continue to network fetch on cache error
        cacheLogger.error({ url, error: error instanceof Error ? error.message : String(error) }, 'Cache lookup failed');
      }
    }

    // Determine starting tier
    let tier: ScrapeTier = options.startTier ?? 'direct';

    // Force tier mode - skip all learning
    if (options.forceTier) {
      tier = options.forceTier;
    } else if (!options.skipLearning) {
      // Check if we know the optimal tier
      const config = await domainLearningService.getConfig(domain);
      if (config && config.isValidated) {
        tier = config.optimalTier;
      }
    }

    // Check if the selected tier's provider is bandwidth-exhausted
    const provider = TIER_PROVIDERS[tier];
    if (provider) {
      const status = await this.bandwidthTracker.getStatus(provider);
      if (status.isExhausted) {
        fetcherLogger.info({
          url,
          tier,
          provider,
          usedPercent: status.percentUsed.toFixed(1),
        }, 'Initial tier bandwidth exhausted, escalating');
        // Escalate to next available tier
        const result = await this.escalateToNextTier(url, tier, options, startTime, 'bandwidth_exhausted');
        await this.storeToCacheIfSuccessful(url, result);
        return result;
      }
    }

    // Execute fetch with circuit breaker protection
    const result = await this.fetchWithCircuitBreaker(url, tier, options, startTime);
    await this.storeToCacheIfSuccessful(url, result);
    return result;
  }

  /**
   * Execute fetch through circuit breaker with automatic escalation.
   */
  private async fetchWithCircuitBreaker(
    url: string,
    tier: ScrapeTier,
    options: FetchOptions,
    startTime: number
  ): Promise<FetchResult> {
    const breaker = this.circuitBreakers.get(tier);

    // If no breaker (shouldn't happen) or circuit is open, escalate
    if (!breaker) {
      return this.fetchWithTier(url, tier, options, startTime);
    }

    // Check if circuit is open - escalate immediately
    if (breaker.getState() === 'open') {
      fetcherLogger.debug({ url, tier }, 'Circuit open, escalating');
      return this.escalateToNextTier(url, tier, options, startTime);
    }

    try {
      // Execute through circuit breaker
      const result = await breaker.execute(async () => {
        return this.fetchWithTier(url, tier, options, startTime);
      });

      // If fetch failed but circuit didn't trip, check if we should escalate
      if (!result.success && options.maxTier !== tier) {
        // Check if the circuit just tripped from this failure
        if (breaker.getState() === 'open') {
          return this.escalateToNextTier(url, tier, options, startTime);
        }
      }

      return result;
    } catch (error) {
      // Circuit breaker threw (circuit open or execution error)
      if (error instanceof CircuitOpenError) {
        return this.escalateToNextTier(url, tier, options, startTime);
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Escalate to the next tier when current tier's circuit is open or bandwidth exhausted.
   */
  private async escalateToNextTier(
    url: string,
    currentTier: ScrapeTier,
    options: FetchOptions,
    startTime: number,
    reason: EscalationReason = 'circuit_open'
  ): Promise<FetchResult> {
    const nextTier = await this.getNextTier(currentTier, options.maxTier);

    if (!nextTier) {
      // All tiers exhausted
      return {
        url,
        success: false,
        statusCode: 503,
        tierUsed: currentTier,
        fromCache: false,
        responseTimeMs: Date.now() - startTime,
        responseSizeBytes: 0,
        estimatedCostUsd: 0,
        error: `All tiers exhausted (circuits open or bandwidth exhausted). Last tier: ${currentTier}`,
      };
    }

    logTierEscalation(url, currentTier, nextTier, reason);
    return this.fetchWithCircuitBreaker(url, nextTier, { ...options, startTier: nextTier }, startTime);
  }

  /**
   * Get the next tier in the escalation order.
   * Skips tiers with open circuits or exhausted bandwidth.
   */
  private async getNextTier(currentTier: ScrapeTier, maxTier?: ScrapeTier): Promise<ScrapeTier | null> {
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const maxIndex = maxTier ? TIER_ORDER.indexOf(maxTier) : TIER_ORDER.length - 1;

    // Find next available tier that isn't circuit-broken or bandwidth-exhausted
    for (let i = currentIndex + 1; i <= maxIndex; i++) {
      const nextTier = TIER_ORDER[i];
      const breaker = this.circuitBreakers.get(nextTier);

      // Skip if circuit is open
      if (breaker && breaker.getState() === 'open') {
        continue;
      }

      // Skip if provider bandwidth is exhausted
      const provider = TIER_PROVIDERS[nextTier];
      if (provider) {
        const status = await this.bandwidthTracker.getStatus(provider);
        if (status.isExhausted) {
          fetcherLogger.info({
            tier: nextTier,
            provider,
            usedPercent: status.percentUsed.toFixed(1),
          }, 'Skipping tier due to bandwidth exhaustion');
          continue;
        }
      }

      return nextTier;
    }

    return null;
  }

  /**
   * Get current circuit breaker states for all tiers.
   */
  getCircuitStates(): Record<ScrapeTier, CircuitState> {
    const states: Partial<Record<ScrapeTier, CircuitState>> = {};
    for (const [tier, breaker] of this.circuitBreakers) {
      states[tier] = breaker.getState();
    }
    return states as Record<ScrapeTier, CircuitState>;
  }

  /**
   * Get detailed circuit breaker statistics.
   */
  getCircuitStats(): Record<ScrapeTier, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Partial<Record<ScrapeTier, ReturnType<CircuitBreaker['getStats']>>> = {};
    for (const [tier, breaker] of this.circuitBreakers) {
      stats[tier] = breaker.getStats();
    }
    return stats as Record<ScrapeTier, ReturnType<CircuitBreaker['getStats']>>;
  }

  /**
   * Manually reset a circuit breaker (for recovery).
   */
  resetCircuit(tier: ScrapeTier): void {
    const breaker = this.circuitBreakers.get(tier);
    if (breaker) {
      breaker.forceClose();
      fetcherLogger.info({ tier }, 'Circuit manually reset');
      recordCircuitState(tier, 'closed');
    }
  }

  /**
   * Manually force open a circuit breaker (for emergency).
   */
  forceOpenCircuit(tier: ScrapeTier): void {
    const breaker = this.circuitBreakers.get(tier);
    if (breaker) {
      breaker.forceOpen();
      fetcherLogger.warn({ tier }, 'Circuit manually opened');
      recordCircuitState(tier, 'open');
    }
  }

  /**
   * Create a FetchResult from a cache hit.
   */
  private createCacheHitResult(
    url: string,
    cached: CachedPage,
    level: CacheLevel,
    startTime: number
  ): FetchResult {
    // Assess quality from cached HTML
    let quality: FetchResult["quality"] | undefined;
    if (cached.html) {
      const assessment = contentQualityAssessor.assess(cached.html);
      quality = {
        score: assessment.score,
        acceptable: assessment.acceptable,
        wordCount: assessment.metrics.wordCount,
        textRatio: assessment.metrics.textRatio,
      };
    }

    return {
      url,
      success: true,
      html: cached.html,
      statusCode: cached.statusCode,
      tierUsed: cached.tierUsed,
      fromCache: true,
      cacheLevel: level,
      responseTimeMs: Date.now() - startTime,
      responseSizeBytes: cached.pageSizeBytes,
      estimatedCostUsd: 0, // No cost for cache hits!
      quality,
    };
  }

  /**
   * Store successful fetch result to cache.
   */
  private async storeToCacheIfSuccessful(url: string, result: FetchResult): Promise<void> {
    if (!this.cacheManager || !result.success || !result.html) {
      return;
    }

    try {
      const contentType = detectContentType(url, result.html);
      const cachedPage: CachedPage = {
        html: result.html,
        contentHash: getContentHash(result.html),
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Will be adjusted by TTL strategy
        tierUsed: result.tierUsed,
        statusCode: result.statusCode,
        pageSizeBytes: result.responseSizeBytes,
        contentType,
      };

      await this.cacheManager.set(url, cachedPage, { contentType });
    } catch (error) {
      // Log but don't fail the request
      cacheLogger.error({ url, error: error instanceof Error ? error.message : String(error) }, 'Failed to cache result');
    }
  }

  /**
   * Fetch using the domain learning service (full discovery support).
   */
  private async discoverAndFetch(
    url: string,
    options: FetchOptions,
    startTime: number
  ): Promise<FetchResult> {
    const request: TieredFetchRequest = {
      url,
      startTier: options.startTier,
      maxTier: options.maxTier,
      timeoutMs: options.timeoutMs,
      headers: options.headers,
      geo: options.geo,
      clientId: options.clientId,
      jobId: options.jobId,
      skipCache: options.skipCache ?? false,
    };

    const result = await domainLearningService.fetch(request);

    return this.convertResult(url, result, startTime);
  }

  /**
   * Fetch directly with a specific tier.
   */
  private async fetchWithTier(
    url: string,
    tier: ScrapeTier,
    options: FetchOptions,
    startTime: number
  ): Promise<FetchResult> {
    const request: TieredFetchRequest = {
      url,
      startTier: tier,
      maxTier: tier, // Don't escalate when tier is specified
      timeoutMs: options.timeoutMs,
      headers: options.headers,
      geo: options.geo,
      clientId: options.clientId,
      jobId: options.jobId,
      skipCache: options.skipCache ?? false,
    };

    const result = await domainLearningService.fetch(request);

    return this.convertResult(url, result, startTime);
  }

  /**
   * Convert internal result format to public FetchResult.
   */
  private convertResult(
    url: string,
    result: TieredFetchResult,
    startTime: number
  ): FetchResult {
    // Record tier usage for distribution tracking (Phase 95 cost optimization)
    recordTierUsage(result.tier);

    // Assess content quality if we have HTML
    let quality: FetchResult["quality"] | undefined;
    if (result.html) {
      const assessment = contentQualityAssessor.assess(result.html);
      quality = {
        score: assessment.score,
        acceptable: assessment.acceptable,
        wordCount: assessment.metrics.wordCount,
        textRatio: assessment.metrics.textRatio,
      };
    }

    return {
      url,
      success: result.success,
      html: result.html,
      statusCode: result.statusCode,
      tierUsed: result.tier,
      fromCache: false, // Cache integration TODO
      responseTimeMs: result.responseTimeMs,
      responseSizeBytes: result.responseSizeBytes,
      estimatedCostUsd: result.costUsd,
      quality,
      error: result.error?.message,
      discovery: result.discovery,
    };
  }

  /**
   * Batch fetch multiple URLs efficiently.
   */
  async fetchBatch(
    urls: string[],
    options: FetchOptions & { concurrency?: number } = {}
  ): Promise<Map<string, FetchResult>> {
    const concurrency = options.concurrency ?? 10;
    const results = new Map<string, FetchResult>();
    const queue = [...urls];

    // Process in batches
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map((url) => this.fetch(url, options).catch((error) => ({
          url,
          success: false,
          statusCode: 0,
          tierUsed: "direct" as ScrapeTier,
          fromCache: false,
          responseTimeMs: 0,
          responseSizeBytes: 0,
          estimatedCostUsd: 0,
          error: error instanceof Error ? error.message : String(error),
        })))
      );

      for (let i = 0; i < batch.length; i++) {
        results.set(batch[i], batchResults[i]);
      }
    }

    return results;
  }

  /**
   * Pre-discover optimal tier for a domain without fetching content.
   * Useful for warming up the tier cache before crawls.
   */
  async discoverDomain(domain: string): Promise<{
    domain: string;
    optimalTier: ScrapeTier;
    technologies: string[];
  }> {
    const discovery = await domainLearningService.discover({ domain });

    return {
      domain: discovery.domain,
      optimalTier: discovery.optimalTier,
      technologies: discovery.technologies,
    };
  }

  /**
   * Get cost estimate for fetching a URL.
   */
  async estimateCost(url: string): Promise<{
    domain: string;
    knownTier: ScrapeTier | null;
    estimatedCostUsd: number;
    estimatedTimeMs: number;
  }> {
    const domain = normalizeDomain(url);
    const config = await domainLearningService.getConfig(domain);

    const tier = config?.optimalTier ?? "dfs_basic"; // Conservative estimate
    const cost = TIER_COSTS[tier];
    const timeMs = this.getEstimatedTime(tier);

    return {
      domain,
      knownTier: config?.optimalTier ?? null,
      estimatedCostUsd: cost,
      estimatedTimeMs: timeMs,
    };
  }

  /**
   * Get estimated time for a tier.
   */
  private getEstimatedTime(tier: ScrapeTier): number {
    const times: Record<ScrapeTier, number> = {
      direct: 2000,
      webshare: 4000,
      geonode: 6000,
      camoufox: 15000,
      dfs_basic: 10000,
      dfs_js: 15000,
      dfs_browser: 20000,
    };
    return times[tier];
  }

  /**
   * Get statistics for domain learning.
   */
  async getDomainStats(domain: string): Promise<{
    domain: string;
    optimalTier: ScrapeTier | null;
    successRate: number;
    avgResponseTimeMs: number | null;
    totalRequests: number;
    technologies: string[];
  } | null> {
    const config = await domainLearningService.getConfig(domain);
    if (!config) {
      return null;
    }

    return {
      domain: config.domain,
      optimalTier: config.optimalTier,
      successRate: config.successRate,
      avgResponseTimeMs: config.avgResponseTimeMs,
      totalRequests: 0, // Would need to aggregate from history
      technologies: config.detectedTechnologies,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const tieredFetcher = new TieredFetcher();

/**
 * Create a new TieredFetcher instance (for testing or isolated use).
 */
export function createTieredFetcher(): TieredFetcher {
  return new TieredFetcher();
}

// Re-export CircuitState for external use
export type { CircuitState } from "./resilience/CircuitBreaker";
