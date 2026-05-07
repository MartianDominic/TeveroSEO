/**
 * Per-Domain Learning Service
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Learns and remembers which scraping tier works best for each domain
 * to avoid wasting money re-discovering on every fetch.
 *
 * Features:
 * - Tiered escalation (direct -> webshare -> geonode -> DataForSEO)
 * - Per-domain memory with Redis cache + PostgreSQL persistence
 * - Automatic revalidation for stale or failing configs
 * - Cost tracking per client and job
 * - Technology and anti-bot detection
 */

import { eq, lt, and, or, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  domainScrapeConfigs,
  domainScrapeHistory,
  SCRAPE_TIERS,
  TIER_COSTS,
  TIER_INDEX,
  REVALIDATION_INTERVALS,
  DOMAIN_CONFIG_CACHE_TTL_SECONDS,
  type ScrapeTier,
  type EscalationReason,
  type DetectedTechnology,
  type DiscoveryAttempt,
  type DomainScrapeConfigInsert,
  type DomainScrapeHistoryInsert,
} from "@/db/domain-scrape-learning-schema";
import { redis, REDIS_SERVICE_PREFIX } from "@/server/lib/redis";
import type {
  DomainConfig,
  DomainConfigUpdate,
  TieredFetchRequest,
  TieredFetchResult,
  DiscoveryRequest,
  DiscoveryResult,
  RevalidationCandidate,
  RevalidationResult,
  ContentValidation,
  CrawlCostSummary,
  DailyCostReport,
  IDomainLearningService,
} from "./types";

// =============================================================================
// Constants
// =============================================================================

const CACHE_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}domain_tier:`;
const COST_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}crawl_cost:`;

/**
 * Content validation thresholds.
 */
const VALIDATION_THRESHOLDS = {
  MIN_WORD_COUNT: 100,
  MIN_TEXT_RATIO: 0.05,
  MIN_CONTENT_LENGTH: 1024, // 1KB
};

/**
 * SPA detection patterns.
 */
const SPA_INDICATORS = [
  'id="__next"', // Next.js
  'id="__nuxt"', // Nuxt
  'id="app"', // Vue
  'id="root"', // React
  "ng-app", // Angular
  "data-reactroot", // React
  "window.__NUXT__", // Nuxt hydration
  "window.__NEXT_DATA__", // Next.js hydration
];

/**
 * Bot detection patterns.
 */
const BOT_DETECTION_PATTERNS = [
  "Please verify you are human",
  "Are you a robot",
  "Pardon Our Interruption",
  "We want to make sure it is actually you",
  "detecting automated access",
  "Access Denied",
  "You have been blocked",
  "Your IP has been blocked",
  "Security Check Required",
];

/**
 * CAPTCHA patterns.
 */
const CAPTCHA_PATTERNS = [
  "g-recaptcha",
  "h-captcha",
  "captcha-container",
  "cf-turnstile",
  "arkose-challenge",
];

/**
 * Cloudflare patterns.
 */
const CLOUDFLARE_PATTERNS = [
  "Attention Required",
  "cf-browser-verification",
  "__cf_chl_opt",
  "cloudflare-static",
  "cf-ray",
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalize a domain for consistent lookup.
 * Removes protocol, www, trailing slash, and path.
 */
export function normalizeDomain(input: string): string {
  let domain = input.toLowerCase().trim();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, "");

  // Remove www prefix
  domain = domain.replace(/^www\./, "");

  // Remove path and query string
  domain = domain.split("/")[0].split("?")[0].split("#")[0];

  // Remove port if present
  domain = domain.split(":")[0];

  return domain;
}

/**
 * Get the next tier in the escalation chain.
 */
export function getNextTier(current: ScrapeTier): ScrapeTier | null {
  const currentIndex = TIER_INDEX[current];
  const nextIndex = currentIndex + 1;

  if (nextIndex >= SCRAPE_TIERS.length) {
    return null; // Already at highest tier
  }

  return SCRAPE_TIERS[nextIndex];
}

/**
 * Calculate cost for a tier based on response size.
 */
export function calculateCost(tier: ScrapeTier, bytes: number): number {
  const baseCost = TIER_COSTS[tier];

  // For geonode, cost is per GB
  if (tier === "geonode") {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb * 1.0; // $1/GB
  }

  return baseCost;
}

/**
 * Build Redis cache key for a domain.
 */
function buildCacheKey(domain: string): string {
  return `${CACHE_KEY_PREFIX}${normalizeDomain(domain)}`;
}

// =============================================================================
// Domain Learning Service
// =============================================================================

export class DomainLearningService implements IDomainLearningService {
  // ===========================================================================
  // Configuration Lookup
  // ===========================================================================

  /**
   * Get the optimal configuration for a domain.
   * Checks Redis cache first, then falls back to database.
   */
  async getConfig(domain: string): Promise<DomainConfig | null> {
    const normalizedDomain = normalizeDomain(domain);
    const cacheKey = buildCacheKey(normalizedDomain);

    // Check Redis cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as DomainConfig;
      } catch {
        // Invalid cache entry, continue to DB lookup
      }
    }

    // Query database
    const result = await db
      .select()
      .from(domainScrapeConfigs)
      .where(eq(domainScrapeConfigs.domain, normalizedDomain))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const config: DomainConfig = {
      domain: row.domain,
      optimalTier: row.optimalTier as ScrapeTier,
      isValidated: row.isValidated,
      successRate: row.successRate,
      consecutiveFailures: row.consecutiveFailures,
      avgResponseTimeMs: row.avgResponseTimeMs,
      detectedTechnologies: (row.detectedTechnologies ?? []) as DetectedTechnology[],
      hasAntiBotProtection: row.hasAntiBotProtection ?? false,
      requiresJsRendering: row.requiresJsRendering ?? false,
      geoRequirement: row.geoRequirement,
      lastEscalationReason: row.lastEscalationReason as EscalationReason | null,
      updatedAt: row.updatedAt,
      nextRevalidationAt: row.nextRevalidationAt,
    };

    // Cache in Redis
    await redis.set(
      cacheKey,
      JSON.stringify(config),
      "EX",
      DOMAIN_CONFIG_CACHE_TTL_SECONDS
    );

    return config;
  }

  // ===========================================================================
  // Tiered Fetch
  // ===========================================================================

  /**
   * Perform tiered fetch with automatic tier selection.
   * This is a stub that should be connected to actual HTTP fetching logic.
   */
  async fetch(request: TieredFetchRequest): Promise<TieredFetchResult> {
    const domain = normalizeDomain(request.url);

    // Get or discover config
    let config = request.skipCache ? null : await this.getConfig(domain);
    const isNewDomain = config === null;

    // Determine starting tier
    const startTier = request.startTier ?? config?.optimalTier ?? "direct";
    const maxTier = request.maxTier ?? "dfs_browser";

    // Track escalation path
    const tiersAttempted: ScrapeTier[] = [];
    const escalationPath: Array<{ tier: ScrapeTier; reason: EscalationReason }> = [];

    let currentTier = startTier;
    let lastError: { reason: EscalationReason; message: string; tier: ScrapeTier } | undefined;

    // Attempt fetches with escalation
    while (TIER_INDEX[currentTier] <= TIER_INDEX[maxTier]) {
      tiersAttempted.push(currentTier);

      // Perform fetch at current tier
      // This is where the actual HTTP fetch would happen
      const result = await this.performFetch(request.url, currentTier, {
        timeoutMs: request.timeoutMs,
        headers: request.headers,
        geo: request.geo,
      });

      // Log to history
      await this.logHistory({
        domain,
        url: request.url,
        tier: currentTier,
        success: result.success,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        responseSizeBytes: result.responseSizeBytes,
        costUsd: calculateCost(currentTier, result.responseSizeBytes),
        escalationReason: result.escalationReason,
        errorMessage: result.error,
        validation: result.validation,
        jobId: request.jobId,
        clientId: request.clientId,
      });

      if (result.success) {
        // Update config with successful tier
        await this.updateConfig(domain, {
          success: true,
          tier: currentTier,
          responseTimeMs: result.responseTimeMs,
          responseSizeBytes: result.responseSizeBytes,
          technologies: result.technologies,
        });

        return {
          success: true,
          tier: currentTier,
          statusCode: result.statusCode,
          html: result.html,
          headers: result.headers,
          responseTimeMs: result.responseTimeMs,
          responseSizeBytes: result.responseSizeBytes,
          costUsd: calculateCost(currentTier, result.responseSizeBytes),
          validation: result.validation,
          discovery: isNewDomain
            ? { isNewDomain: true, tiersAttempted, escalationPath }
            : undefined,
        };
      }

      // Track escalation
      if (result.escalationReason) {
        escalationPath.push({
          tier: currentTier,
          reason: result.escalationReason,
        });
        lastError = {
          reason: result.escalationReason,
          message: result.error ?? "Unknown error",
          tier: currentTier,
        };
      }

      // Get next tier
      const nextTier = this.decideNextTier(currentTier, result.escalationReason);
      if (!nextTier || TIER_INDEX[nextTier] > TIER_INDEX[maxTier]) {
        break; // No more tiers to try
      }

      currentTier = nextTier;
    }

    // All tiers failed
    await this.updateConfig(domain, {
      success: false,
      tier: currentTier,
      responseTimeMs: 0,
      escalationReason: lastError?.reason,
    });

    return {
      success: false,
      tier: currentTier,
      statusCode: 0,
      responseTimeMs: 0,
      responseSizeBytes: 0,
      costUsd: 0,
      validation: {
        hasBody: false,
        hasTitle: false,
        hasH1: false,
        wordCount: 0,
        textRatio: 0,
        isSpaShell: false,
        isBotDetectionPage: false,
        isCaptchaPage: false,
      },
      error: lastError,
      discovery: { isNewDomain, tiersAttempted, escalationPath },
    };
  }

  /**
   * Decide which tier to try next based on failure reason.
   */
  private decideNextTier(
    currentTier: ScrapeTier,
    reason?: EscalationReason
  ): ScrapeTier | null {
    if (!reason) {
      return getNextTier(currentTier);
    }

    switch (reason) {
      case "rate_limited":
      case "ip_blocked":
      case "timeout":
      case "connection_reset":
        // Try next tier up
        return getNextTier(currentTier);

      case "dc_detected":
        // Skip DC tiers, go straight to residential
        return TIER_INDEX[currentTier] < TIER_INDEX["geonode"]
          ? "geonode"
          : getNextTier(currentTier);

      case "js_required":
      case "captcha":
        // Need browser rendering
        return "dfs_browser";

      case "bot_detected":
        // Could be DC detection or need browser
        return TIER_INDEX[currentTier] < TIER_INDEX["geonode"]
          ? "geonode"
          : "dfs_browser";

      case "geo_blocked":
        // Need geo-targeted residential proxy
        return "geonode";

      case "empty_response":
        // Might be SPA, try JS rendering
        return TIER_INDEX[currentTier] < TIER_INDEX["dfs_js"]
          ? "dfs_js"
          : "dfs_browser";

      case "ssl_error":
      case "dns_error":
        // Infrastructure issue, unlikely to help with escalation
        return null;

      default:
        return getNextTier(currentTier);
    }
  }

  /**
   * Perform the actual HTTP fetch at a given tier.
   * This is a stub that should be implemented with real HTTP logic.
   */
  private async performFetch(
    url: string,
    tier: ScrapeTier,
    options: {
      timeoutMs?: number;
      headers?: Record<string, string>;
      geo?: { country?: string; region?: string };
    }
  ): Promise<{
    success: boolean;
    statusCode: number;
    html?: string;
    headers?: Record<string, string>;
    responseTimeMs: number;
    responseSizeBytes: number;
    escalationReason?: EscalationReason;
    error?: string;
    validation: ContentValidation;
    technologies?: DetectedTechnology[];
  }> {
    // This is a stub - actual implementation would:
    // 1. Select the appropriate HTTP client/proxy based on tier
    // 2. Make the request with proper headers/timeout
    // 3. Parse response and validate content
    // 4. Detect technologies and anti-bot patterns
    throw new Error(
      "performFetch must be implemented with actual HTTP fetching logic"
    );
  }

  // ===========================================================================
  // Discovery
  // ===========================================================================

  /**
   * Discover the optimal tier for a domain.
   */
  async discover(request: DiscoveryRequest): Promise<DiscoveryResult> {
    const domain = normalizeDomain(request.domain);
    const testUrl = request.testUrl ?? `https://${domain}/`;
    const maxTier = request.maxTier ?? "dfs_browser";

    const startTime = Date.now();
    const attempts: DiscoveryAttempt[] = [];
    let totalCostUsd = 0;

    let optimalTier: ScrapeTier = "direct";
    let technologies: DetectedTechnology[] = [];
    let hasAntiBotProtection = false;
    let requiresJsRendering = false;

    // Try each tier until success
    for (const tier of SCRAPE_TIERS) {
      if (TIER_INDEX[tier] > TIER_INDEX[maxTier]) {
        break;
      }

      const attemptStart = Date.now();

      try {
        const result = await this.performFetch(testUrl, tier, {});

        const attempt: DiscoveryAttempt = {
          tier,
          success: result.success,
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          responseSizeBytes: result.responseSizeBytes,
          validation: {
            hasBody: result.validation.hasBody,
            hasTitle: result.validation.hasTitle,
            hasH1: result.validation.hasH1,
            wordCount: result.validation.wordCount,
            textRatio: result.validation.textRatio,
          },
          escalationReason: result.escalationReason,
          errorMessage: result.error,
          timestamp: new Date().toISOString(),
        };
        attempts.push(attempt);
        totalCostUsd += calculateCost(tier, result.responseSizeBytes);

        if (result.success) {
          optimalTier = tier;
          technologies = result.technologies ?? [];
          break;
        }

        // Track anti-bot and JS requirements
        if (result.escalationReason === "dc_detected" ||
            result.escalationReason === "bot_detected" ||
            result.escalationReason === "captcha") {
          hasAntiBotProtection = true;
        }
        if (result.escalationReason === "js_required") {
          requiresJsRendering = true;
        }
      } catch (error) {
        const attempt: DiscoveryAttempt = {
          tier,
          success: false,
          responseTimeMs: Date.now() - attemptStart,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };
        attempts.push(attempt);
      }
    }

    // Persist discovery results
    await this.persistDiscovery(domain, {
      optimalTier,
      attempts,
      technologies,
      hasAntiBotProtection,
      requiresJsRendering,
    });

    return {
      domain,
      optimalTier,
      attempts,
      totalTimeMs: Date.now() - startTime,
      totalCostUsd,
      technologies,
      hasAntiBotProtection,
      requiresJsRendering,
      geoRequirement: null, // Detected during fetch if geo-blocked
    };
  }

  /**
   * Persist discovery results to database.
   */
  private async persistDiscovery(
    domain: string,
    result: {
      optimalTier: ScrapeTier;
      attempts: DiscoveryAttempt[];
      technologies: DetectedTechnology[];
      hasAntiBotProtection: boolean;
      requiresJsRendering: boolean;
    }
  ): Promise<void> {
    const now = new Date();
    const nextRevalidation = new Date(
      now.getTime() + REVALIDATION_INTERVALS.DEFAULT_DAYS * 24 * 60 * 60 * 1000
    );

    // Keep only last 5 attempts in discovery history
    const discoveryHistory = result.attempts.slice(-5);

    // Find the escalation reason that led to this tier
    const lastFailedAttempt = result.attempts
      .filter((a) => !a.success && a.escalationReason)
      .pop();

    const config: DomainScrapeConfigInsert = {
      domain,
      optimalTier: result.optimalTier,
      isValidated: true,
      successCount: 1,
      failureCount: result.attempts.filter((a) => !a.success).length,
      consecutiveFailures: 0,
      successRate: 1.0,
      avgResponseTimeMs: result.attempts.find((a) => a.success)?.responseTimeMs,
      avgPageSizeBytes: result.attempts.find((a) => a.success)?.responseSizeBytes,
      primaryTechnology: result.technologies[0],
      detectedTechnologies: result.technologies,
      hasAntiBotProtection: result.hasAntiBotProtection,
      requiresJsRendering: result.requiresJsRendering,
      discoveryHistory,
      lastEscalationReason: lastFailedAttempt?.escalationReason,
      discoveredAt: now,
      lastSuccessAt: now,
      lastTestedAt: now,
      nextRevalidationAt: nextRevalidation,
    };

    // Upsert config
    await db
      .insert(domainScrapeConfigs)
      .values(config)
      .onConflictDoUpdate({
        target: domainScrapeConfigs.domain,
        set: {
          optimalTier: config.optimalTier,
          isValidated: config.isValidated,
          successCount: sql`${domainScrapeConfigs.successCount} + 1`,
          failureCount: sql`${domainScrapeConfigs.failureCount} + ${config.failureCount}`,
          consecutiveFailures: 0,
          successRate: config.successRate,
          avgResponseTimeMs: config.avgResponseTimeMs,
          avgPageSizeBytes: config.avgPageSizeBytes,
          primaryTechnology: config.primaryTechnology,
          detectedTechnologies: config.detectedTechnologies,
          hasAntiBotProtection: config.hasAntiBotProtection,
          requiresJsRendering: config.requiresJsRendering,
          discoveryHistory: config.discoveryHistory,
          lastEscalationReason: config.lastEscalationReason,
          lastSuccessAt: now,
          lastTestedAt: now,
          nextRevalidationAt: nextRevalidation,
          updatedAt: now,
        },
      });

    // Invalidate cache
    await this.invalidateCache(domain);
  }

  // ===========================================================================
  // Config Updates
  // ===========================================================================

  /**
   * Update domain config after a fetch.
   */
  async updateConfig(domain: string, update: DomainConfigUpdate): Promise<void> {
    const normalizedDomain = normalizeDomain(domain);
    const now = new Date();

    if (update.success) {
      // Update success metrics
      await db
        .update(domainScrapeConfigs)
        .set({
          optimalTier: update.tier,
          isValidated: true,
          successCount: sql`${domainScrapeConfigs.successCount} + 1`,
          consecutiveFailures: 0,
          successRate: sql`(${domainScrapeConfigs.successCount}::float + 1) /
            (${domainScrapeConfigs.successCount} + ${domainScrapeConfigs.failureCount} + 1)`,
          avgResponseTimeMs: sql`COALESCE(
            (${domainScrapeConfigs.avgResponseTimeMs} * ${domainScrapeConfigs.successCount} + ${update.responseTimeMs}) /
            (${domainScrapeConfigs.successCount} + 1),
            ${update.responseTimeMs}
          )`,
          avgPageSizeBytes: update.responseSizeBytes
            ? sql`COALESCE(
                (${domainScrapeConfigs.avgPageSizeBytes} * ${domainScrapeConfigs.successCount} + ${update.responseSizeBytes}) /
                (${domainScrapeConfigs.successCount} + 1),
                ${update.responseSizeBytes}
              )`
            : undefined,
          detectedTechnologies: update.technologies,
          lastSuccessAt: now,
          updatedAt: now,
        })
        .where(eq(domainScrapeConfigs.domain, normalizedDomain));
    } else {
      // Update failure metrics
      const result = await db
        .update(domainScrapeConfigs)
        .set({
          failureCount: sql`${domainScrapeConfigs.failureCount} + 1`,
          consecutiveFailures: sql`${domainScrapeConfigs.consecutiveFailures} + 1`,
          successRate: sql`${domainScrapeConfigs.successCount}::float /
            (${domainScrapeConfigs.successCount} + ${domainScrapeConfigs.failureCount} + 1)`,
          lastEscalationReason: update.escalationReason,
          lastFailureAt: now,
          updatedAt: now,
        })
        .where(eq(domainScrapeConfigs.domain, normalizedDomain))
        .returning({ consecutiveFailures: domainScrapeConfigs.consecutiveFailures });

      // Check if revalidation is needed
      if (
        result[0]?.consecutiveFailures >=
        REVALIDATION_INTERVALS.CONSECUTIVE_FAILURE_THRESHOLD
      ) {
        // Schedule immediate revalidation
        await db
          .update(domainScrapeConfigs)
          .set({ nextRevalidationAt: now })
          .where(eq(domainScrapeConfigs.domain, normalizedDomain));
      }
    }

    // Invalidate cache
    await this.invalidateCache(domain);
  }

  // ===========================================================================
  // Revalidation
  // ===========================================================================

  /**
   * Get candidates for revalidation.
   */
  async getRevalidationCandidates(limit = 100): Promise<RevalidationCandidate[]> {
    const now = new Date();

    const candidates = await db
      .select({
        domain: domainScrapeConfigs.domain,
        currentTier: domainScrapeConfigs.optimalTier,
        successRate: domainScrapeConfigs.successRate,
        consecutiveFailures: domainScrapeConfigs.consecutiveFailures,
        lastSuccessAt: domainScrapeConfigs.lastSuccessAt,
        nextRevalidationAt: domainScrapeConfigs.nextRevalidationAt,
      })
      .from(domainScrapeConfigs)
      .where(
        or(
          // Scheduled revalidation is due
          lt(domainScrapeConfigs.nextRevalidationAt, now),
          // Consecutive failure threshold reached
          sql`${domainScrapeConfigs.consecutiveFailures} >= ${REVALIDATION_INTERVALS.CONSECUTIVE_FAILURE_THRESHOLD}`,
          // Low success rate
          lt(
            domainScrapeConfigs.successRate,
            REVALIDATION_INTERVALS.SUCCESS_RATE_THRESHOLD
          )
        )
      )
      .orderBy(
        desc(domainScrapeConfigs.consecutiveFailures),
        domainScrapeConfigs.successRate,
        domainScrapeConfigs.nextRevalidationAt
      )
      .limit(limit);

    return candidates.map((c) => {
      const daysSinceLastSuccess = c.lastSuccessAt
        ? Math.floor((now.getTime() - c.lastSuccessAt.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      // Determine reason for revalidation
      let reason: RevalidationCandidate["reason"] = "scheduled";
      if (c.consecutiveFailures >= REVALIDATION_INTERVALS.CONSECUTIVE_FAILURE_THRESHOLD) {
        reason = "consecutive_failures";
      } else if (c.successRate < REVALIDATION_INTERVALS.SUCCESS_RATE_THRESHOLD) {
        reason = "low_success_rate";
      } else if (daysSinceLastSuccess > REVALIDATION_INTERVALS.DEFAULT_DAYS) {
        reason = "stale";
      }

      // Calculate priority (higher = more urgent)
      let priority = 0;
      priority += c.consecutiveFailures * 10;
      priority += (1 - c.successRate) * 50;
      priority += Math.min(daysSinceLastSuccess, 90);

      return {
        domain: c.domain,
        currentTier: c.currentTier as ScrapeTier,
        reason,
        successRate: c.successRate,
        daysSinceLastSuccess,
        consecutiveFailures: c.consecutiveFailures,
        priority,
      };
    });
  }

  /**
   * Revalidate a domain's optimal tier.
   */
  async revalidate(domain: string): Promise<RevalidationResult> {
    const normalizedDomain = normalizeDomain(domain);

    // Get current config
    const config = await this.getConfig(normalizedDomain);
    const previousTier = config?.optimalTier ?? "direct";

    // Run discovery
    const discovery = await this.discover({
      domain: normalizedDomain,
    });

    // Calculate next revalidation
    const now = new Date();
    const nextRevalidationAt = new Date(
      now.getTime() + REVALIDATION_INTERVALS.DEFAULT_DAYS * 24 * 60 * 60 * 1000
    );

    return {
      domain: normalizedDomain,
      previousTier,
      newTier: discovery.optimalTier,
      tierChanged: previousTier !== discovery.optimalTier,
      newSuccessRate: 1.0, // Fresh after revalidation
      nextRevalidationAt,
    };
  }

  // ===========================================================================
  // History Logging
  // ===========================================================================

  /**
   * Log a scrape attempt to history.
   */
  private async logHistory(entry: {
    domain: string;
    url: string;
    tier: ScrapeTier;
    success: boolean;
    statusCode?: number;
    responseTimeMs?: number;
    responseSizeBytes?: number;
    costUsd: number;
    escalationReason?: EscalationReason;
    errorMessage?: string;
    validation?: ContentValidation;
    jobId?: string;
    clientId?: string;
  }): Promise<void> {
    const normalizedDomain = normalizeDomain(entry.domain);

    // Get or create domain config
    let configId: number;
    const existingConfig = await db
      .select({ id: domainScrapeConfigs.id })
      .from(domainScrapeConfigs)
      .where(eq(domainScrapeConfigs.domain, normalizedDomain))
      .limit(1);

    if (existingConfig.length > 0) {
      configId = existingConfig[0].id;
    } else {
      // Create a minimal config for unknown domain
      const inserted = await db
        .insert(domainScrapeConfigs)
        .values({
          domain: normalizedDomain,
          optimalTier: entry.tier,
          isValidated: false,
        })
        .returning({ id: domainScrapeConfigs.id });
      configId = inserted[0].id;
    }

    // Insert history record
    const historyEntry: DomainScrapeHistoryInsert = {
      domainConfigId: configId,
      domain: normalizedDomain,
      url: entry.url,
      tier: entry.tier,
      success: entry.success,
      statusCode: entry.statusCode,
      responseTimeMs: entry.responseTimeMs,
      responseSizeBytes: entry.responseSizeBytes,
      costUsd: entry.costUsd,
      escalationReason: entry.escalationReason,
      errorMessage: entry.errorMessage,
      validation: entry.validation,
      jobId: entry.jobId,
      clientId: entry.clientId,
    };

    await db.insert(domainScrapeHistory).values(historyEntry);
  }

  // ===========================================================================
  // Cost Tracking
  // ===========================================================================

  /**
   * Get cost summary for a crawl job.
   */
  async getCrawlCost(jobId: string): Promise<CrawlCostSummary | null> {
    // Check Redis cache first
    const cacheKey = `${COST_KEY_PREFIX}job:${jobId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CrawlCostSummary;
    }

    // Query history
    const history = await db
      .select()
      .from(domainScrapeHistory)
      .where(eq(domainScrapeHistory.jobId, jobId));

    if (history.length === 0) {
      return null;
    }

    // Aggregate by tier
    const byTier: CrawlCostSummary["byTier"] = {} as CrawlCostSummary["byTier"];
    for (const tier of SCRAPE_TIERS) {
      byTier[tier] = { pages: 0, bytes: 0, cost: 0 };
    }

    let totalCostUsd = 0;
    let totalPages = 0;
    let domain = "";
    let clientId = "";
    let startedAt = new Date();
    let completedAt: Date | undefined;

    for (const row of history) {
      const tier = row.tier as ScrapeTier;
      byTier[tier].pages++;
      byTier[tier].bytes += row.responseSizeBytes ?? 0;
      byTier[tier].cost += row.costUsd;
      totalCostUsd += row.costUsd;
      totalPages++;
      domain = row.domain;
      clientId = row.clientId ?? "";

      if (row.attemptedAt < startedAt) {
        startedAt = row.attemptedAt;
      }
      if (!completedAt || row.attemptedAt > completedAt) {
        completedAt = row.attemptedAt;
      }
    }

    // Calculate savings vs all-DataForSEO
    const allDfsCost = totalPages * TIER_COSTS.dfs_browser;
    const savingsVsAllDfs = allDfsCost - totalCostUsd;
    const savingsPercent = allDfsCost > 0 ? (savingsVsAllDfs / allDfsCost) * 100 : 0;

    const summary: CrawlCostSummary = {
      jobId,
      clientId,
      domain,
      totalPages,
      byTier,
      totalCostUsd,
      avgCostPerPage: totalPages > 0 ? totalCostUsd / totalPages : 0,
      savingsVsAllDfs,
      savingsPercent,
      startedAt,
      completedAt,
    };

    // Cache for 1 hour
    await redis.set(cacheKey, JSON.stringify(summary), "EX", 3600);

    return summary;
  }

  /**
   * Get daily cost report.
   */
  async getDailyCost(date: string, clientId?: string): Promise<DailyCostReport[]> {
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59Z`);

    let query = db
      .select()
      .from(domainScrapeHistory)
      .where(
        and(
          sql`${domainScrapeHistory.attemptedAt} >= ${startOfDay}`,
          sql`${domainScrapeHistory.attemptedAt} <= ${endOfDay}`,
          clientId ? eq(domainScrapeHistory.clientId, clientId) : sql`1=1`
        )
      );

    const history = await query;

    // Group by client
    const byClient = new Map<string, typeof history>();
    for (const row of history) {
      const cid = row.clientId ?? "unknown";
      if (!byClient.has(cid)) {
        byClient.set(cid, []);
      }
      byClient.get(cid)!.push(row);
    }

    // Build reports
    const reports: DailyCostReport[] = [];

    for (const [cid, rows] of byClient) {
      const byTier: DailyCostReport["byTier"] = {} as DailyCostReport["byTier"];
      for (const tier of SCRAPE_TIERS) {
        byTier[tier] = { pages: 0, cost: 0 };
      }

      const domainCosts = new Map<
        string,
        { pages: number; cost: number; tiers: Map<ScrapeTier, number> }
      >();

      let totalCostUsd = 0;
      let totalPages = 0;

      for (const row of rows) {
        const tier = row.tier as ScrapeTier;
        byTier[tier].pages++;
        byTier[tier].cost += row.costUsd;
        totalCostUsd += row.costUsd;
        totalPages++;

        // Track per-domain costs
        if (!domainCosts.has(row.domain)) {
          domainCosts.set(row.domain, { pages: 0, cost: 0, tiers: new Map() });
        }
        const dc = domainCosts.get(row.domain)!;
        dc.pages++;
        dc.cost += row.costUsd;
        dc.tiers.set(tier, (dc.tiers.get(tier) ?? 0) + 1);
      }

      // Get top domains by cost
      const topDomains = Array.from(domainCosts.entries())
        .map(([domain, data]) => {
          // Find primary tier (most used)
          let primaryTier: ScrapeTier = "direct";
          let maxCount = 0;
          for (const [tier, count] of data.tiers) {
            if (count > maxCount) {
              maxCount = count;
              primaryTier = tier;
            }
          }
          return { domain, pages: data.pages, cost: data.cost, primaryTier };
        })
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);

      reports.push({
        date,
        clientId: cid,
        totalPages,
        byTier,
        totalCostUsd,
        topDomains,
      });
    }

    return reports;
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Invalidate cached config for a domain.
   */
  async invalidateCache(domain: string): Promise<void> {
    const cacheKey = buildCacheKey(domain);
    await redis.del(cacheKey);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const domainLearningService = new DomainLearningService();
