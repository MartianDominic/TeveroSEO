/**
 * Centralized Rate Limit Configuration
 *
 * Single source of truth for all rate limit values across the monorepo.
 * This consolidates rate limits that were previously defined inconsistently
 * in multiple locations:
 *
 * - open-seo-main/src/server/services/RateLimitService.ts
 * - open-seo-main/src/server/middleware/rate-limit.ts
 * - apps/web/src/lib/rate-limit/auth-limiter.ts
 * - apps/web/src/lib/middleware/rate-limit.ts
 *
 * All rate limit consumers should import from this file to ensure consistency.
 *
 * @module @tevero/utils/rate-limit-config
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Rate limit configuration for a specific endpoint or operation type.
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  readonly requests: number;
  /** Window duration in milliseconds */
  readonly windowMs: number;
  /** Human-readable description for documentation */
  readonly description: string;
}

/**
 * Rate limit tier for fallback behavior when Redis is unavailable.
 * - strict: 25% of normal limit (auth, admin, security-sensitive)
 * - standard: 50% of normal limit (most operations)
 * - relaxed: 75% of normal limit (read-heavy, low-risk operations)
 */
export type RateLimitTier = "strict" | "standard" | "relaxed";

/**
 * Extended configuration with tier information for services that support
 * graceful degradation.
 */
export interface TieredRateLimitConfig extends RateLimitConfig {
  /** Tier determines fallback behavior when Redis is unavailable */
  readonly tier: RateLimitTier;
  /** Redis key prefix for this rate limit bucket */
  readonly keyPrefix: string;
}

// =============================================================================
// Authentication Rate Limits
// =============================================================================

/**
 * Authentication rate limits - strict to prevent credential stuffing,
 * brute force attacks, and account enumeration.
 *
 * STANDARDIZED: All auth endpoints now use 10 requests per 60 seconds
 * as the default, with stricter limits for sensitive operations.
 */
export const AUTH_RATE_LIMITS = {
  /**
   * Default auth rate limit: 10 requests per minute per IP.
   * Used for generic auth endpoints (token refresh, session validation).
   */
  DEFAULT: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "Default authentication endpoints",
    tier: "strict",
    keyPrefix: "ratelimit:auth:",
  },

  /**
   * Sign-in: 10 requests per minute per IP.
   * Balanced to allow typo corrections while blocking brute force.
   */
  SIGNIN: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "Sign-in attempts",
    tier: "strict",
    keyPrefix: "ratelimit:auth:signin:",
  },

  /**
   * Sign-up: 5 requests per 5 minutes per IP.
   * Strict to prevent mass account creation and enumeration.
   */
  SIGNUP: {
    requests: 5,
    windowMs: 300_000, // 5 minutes
    description: "Sign-up attempts (prevents mass account creation)",
    tier: "strict",
    keyPrefix: "ratelimit:auth:signup:",
  },

  /**
   * Password reset: 3 requests per 5 minutes per IP.
   * Very strict to prevent email bombing and account takeover.
   */
  PASSWORD_RESET: {
    requests: 3,
    windowMs: 300_000, // 5 minutes
    description: "Password reset requests (prevents email bombing)",
    tier: "strict",
    keyPrefix: "ratelimit:auth:password-reset:",
  },

  /**
   * Email verification: 5 requests per 5 minutes per IP.
   */
  EMAIL_VERIFY: {
    requests: 5,
    windowMs: 300_000, // 5 minutes
    description: "Email verification attempts",
    tier: "strict",
    keyPrefix: "ratelimit:auth:email-verify:",
  },

  /**
   * API key generation: 5 requests per minute per user.
   */
  API_KEY_GENERATE: {
    requests: 5,
    windowMs: 60_000, // 1 minute
    description: "API key generation",
    tier: "strict",
    keyPrefix: "ratelimit:auth:api-key:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// API Rate Limits
// =============================================================================

/**
 * General API rate limits for various endpoint categories.
 */
export const API_RATE_LIMITS = {
  /**
   * Default API limit: 100 requests per minute.
   * Used as fallback for endpoints without specific limits.
   */
  DEFAULT: {
    requests: 100,
    windowMs: 60_000, // 1 minute
    description: "Default API endpoints",
    tier: "relaxed",
    keyPrefix: "ratelimit:api:default:",
  },

  /**
   * Admin endpoints: 10 requests per minute.
   * Strict to prevent abuse of administrative functions.
   */
  ADMIN: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "Admin endpoints",
    tier: "strict",
    keyPrefix: "ratelimit:admin:",
  },

  /**
   * Webhook endpoints: 100 requests per minute.
   * Higher limit for external service callbacks.
   */
  WEBHOOK: {
    requests: 100,
    windowMs: 60_000, // 1 minute
    description: "Webhook callbacks",
    tier: "relaxed",
    keyPrefix: "ratelimit:webhook:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// SEO Operation Rate Limits
// =============================================================================

/**
 * Rate limits for SEO-specific operations.
 */
export const SEO_RATE_LIMITS = {
  /**
   * Audit run checks: 10 requests per minute per client.
   * Resource intensive - involves crawling and analysis.
   */
  AUDIT_RUN_CHECKS: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "SEO audit check runs",
    tier: "standard",
    keyPrefix: "ratelimit:audit:run-checks:",
  },

  /**
   * Full audit: 5 audits per hour per user.
   * Audits can crawl up to 10K pages - very expensive.
   */
  AUDIT_FULL: {
    requests: 5,
    windowMs: 3_600_000, // 1 hour
    description: "Full SEO audits (crawls up to 10K pages)",
    tier: "standard",
    keyPrefix: "ratelimit:audit:full:",
  },

  /**
   * Content validation: 10 requests per minute per client.
   */
  CONTENT_VALIDATE: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "Content validation checks",
    tier: "standard",
    keyPrefix: "ratelimit:seo:content:validate:",
  },

  /**
   * Link suggestions: 30 requests per minute per client.
   * Lighter operation than full validation.
   */
  LINK_SUGGESTIONS: {
    requests: 30,
    windowMs: 60_000, // 1 minute
    description: "Link suggestions",
    tier: "relaxed",
    keyPrefix: "ratelimit:seo:links:suggestions:",
  },

  /**
   * SERP analysis: 20 requests per minute.
   * Involves external API calls.
   */
  SERP_ANALYZE: {
    requests: 20,
    windowMs: 60_000, // 1 minute
    description: "SERP analysis",
    tier: "standard",
    keyPrefix: "ratelimit:serp:analyze:",
  },

  /**
   * Keyword enrichment: 30 requests per minute.
   * External API calls to DataForSEO.
   */
  KEYWORD_ENRICH: {
    requests: 30,
    windowMs: 60_000, // 1 minute
    description: "Keyword enrichment",
    tier: "standard",
    keyPrefix: "ratelimit:keyword:enrich:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// Content Generation Rate Limits
// =============================================================================

/**
 * Rate limits for AI/LLM-powered content operations.
 */
export const CONTENT_RATE_LIMITS = {
  /**
   * Content generation: 20 requests per minute.
   * LLM calls are expensive.
   */
  GENERATE: {
    requests: 20,
    windowMs: 60_000, // 1 minute
    description: "AI content generation",
    tier: "standard",
    keyPrefix: "ratelimit:content:generate:",
  },

  /**
   * Brief generation: 10 requests per minute.
   */
  BRIEF_GENERATE: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "Content brief generation",
    tier: "standard",
    keyPrefix: "ratelimit:brief:generate:",
  },

  /**
   * LLM calls: 50 per hour per user.
   * For voice analysis, translations, etc.
   */
  LLM: {
    requests: 50,
    windowMs: 3_600_000, // 1 hour
    description: "LLM API calls",
    tier: "standard",
    keyPrefix: "ratelimit:llm:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// Analytics Rate Limits
// =============================================================================

/**
 * Rate limits for analytics and reporting operations.
 */
export const ANALYTICS_RATE_LIMITS = {
  /**
   * Standard analytics: 60 requests per minute.
   */
  STANDARD: {
    requests: 60,
    windowMs: 60_000, // 1 minute
    description: "Standard analytics queries",
    tier: "relaxed",
    keyPrefix: "ratelimit:analytics:standard:",
  },

  /**
   * Expensive analytics: 30 requests per minute.
   * Trend detection, cannibalization analysis.
   */
  EXPENSIVE: {
    requests: 30,
    windowMs: 60_000, // 1 minute
    description: "Expensive analytics (trends, cannibalization)",
    tier: "standard",
    keyPrefix: "ratelimit:analytics:expensive:",
  },

  /**
   * Sync triggers: 5 per hour.
   * Prevents GSC/GA4 API quota exhaustion.
   */
  SYNC: {
    requests: 5,
    windowMs: 3_600_000, // 1 hour
    description: "Analytics sync triggers",
    tier: "strict",
    keyPrefix: "ratelimit:analytics:sync:",
  },

  /**
   * GSC Bridge: 100 calls per day per client.
   */
  GSC_BRIDGE: {
    requests: 100,
    windowMs: 86_400_000, // 24 hours
    description: "Google Search Console API bridge",
    tier: "standard",
    keyPrefix: "ratelimit:gsc-bridge:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// Portal Rate Limits
// =============================================================================

/**
 * Rate limits for client portal operations.
 */
export const PORTAL_RATE_LIMITS = {
  /**
   * Standard portal endpoints: 60 requests per minute.
   */
  STANDARD: {
    requests: 60,
    windowMs: 60_000, // 1 minute
    description: "Standard portal endpoints",
    tier: "relaxed",
    keyPrefix: "ratelimit:portal:standard:",
  },

  /**
   * Expensive portal operations: 30 requests per minute.
   */
  EXPENSIVE: {
    requests: 30,
    windowMs: 60_000, // 1 minute
    description: "Expensive portal analytics",
    tier: "standard",
    keyPrefix: "ratelimit:portal:expensive:",
  },

  /**
   * Portal exports: 5 per hour.
   * File downloads are bandwidth intensive.
   */
  EXPORT: {
    requests: 5,
    windowMs: 3_600_000, // 1 hour
    description: "Portal file exports (CSV/PDF)",
    tier: "standard",
    keyPrefix: "ratelimit:portal:export:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// Scraping Admin Rate Limits
// =============================================================================

/**
 * Rate limits for scraping administration operations.
 * Tiered by operation severity.
 */
export const SCRAPING_ADMIN_RATE_LIMITS = {
  /**
   * Critical operations: 2 requests per minute.
   * Emergency stop, resume.
   */
  CRITICAL: {
    requests: 2,
    windowMs: 60_000, // 1 minute
    description: "Critical scraping operations (emergency stop/resume)",
    tier: "strict",
    keyPrefix: "ratelimit:scraping:admin:critical:",
  },

  /**
   * State change operations: 5 requests per minute.
   * Migration advance/rollback.
   */
  STATE_CHANGE: {
    requests: 5,
    windowMs: 60_000, // 1 minute
    description: "Scraping state changes",
    tier: "strict",
    keyPrefix: "ratelimit:scraping:admin:state:",
  },

  /**
   * Resource intensive operations: 10 requests per minute.
   * Cache warm, domain reset.
   */
  RESOURCE: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "Resource-intensive scraping operations",
    tier: "standard",
    keyPrefix: "ratelimit:scraping:admin:resource:",
  },

  /**
   * General admin operations: 30 requests per minute.
   * Metrics, status (read-only).
   */
  GENERAL: {
    requests: 30,
    windowMs: 60_000, // 1 minute
    description: "General scraping admin (read-only)",
    tier: "relaxed",
    keyPrefix: "ratelimit:scraping:admin:general:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// Resource-Intensive Operation Rate Limits
// =============================================================================

/**
 * Rate limits for CPU/memory intensive operations.
 */
export const RESOURCE_RATE_LIMITS = {
  /**
   * CPU intensive: 30 requests per minute.
   * Pattern detection, report generation.
   */
  CPU_INTENSIVE: {
    requests: 30,
    windowMs: 60_000, // 1 minute
    description: "CPU-intensive operations",
    tier: "standard",
    keyPrefix: "ratelimit:cpu:",
  },

  /**
   * Report generation: 5 per hour.
   * PDF rendering and data aggregation.
   */
  REPORT: {
    requests: 5,
    windowMs: 3_600_000, // 1 hour
    description: "Report generation (PDF)",
    tier: "standard",
    keyPrefix: "ratelimit:report:",
  },

  /**
   * Export/download: 20 per hour.
   */
  DOWNLOAD: {
    requests: 20,
    windowMs: 3_600_000, // 1 hour
    description: "File downloads",
    tier: "standard",
    keyPrefix: "ratelimit:download:",
  },

  /**
   * Connection testing: 10 per minute.
   * Prevents SSRF abuse.
   */
  CONNECTION_TEST: {
    requests: 10,
    windowMs: 60_000, // 1 minute
    description: "CMS connection testing",
    tier: "standard",
    keyPrefix: "ratelimit:connection:",
  },

  /**
   * Web scraping: 10 per hour.
   * Expensive and can trigger bot detection.
   */
  SCRAPE: {
    requests: 10,
    windowMs: 3_600_000, // 1 hour
    description: "Web scraping operations",
    tier: "standard",
    keyPrefix: "ratelimit:scrape:",
  },
} as const satisfies Record<string, TieredRateLimitConfig>;

// =============================================================================
// Fallback Percentages by Tier
// =============================================================================

/**
 * Fallback limit percentages when Redis is unavailable.
 * Used by services that support graceful degradation.
 */
export const FALLBACK_PERCENTAGES: Record<RateLimitTier, number> = {
  strict: 0.25, // 25% of normal limit
  standard: 0.5, // 50% of normal limit
  relaxed: 0.75, // 75% of normal limit
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a rate limit config to seconds-based format.
 * Useful for services that expect window in seconds.
 */
export function toSecondsConfig(config: RateLimitConfig): {
  limit: number;
  window: number;
} {
  return {
    limit: config.requests,
    window: Math.floor(config.windowMs / 1000),
  };
}

/**
 * Calculate the fallback limit based on tier.
 */
export function getFallbackLimit(config: TieredRateLimitConfig): number {
  return Math.max(1, Math.floor(config.requests * FALLBACK_PERCENTAGES[config.tier]));
}

/**
 * Get all rate limit configs as a flat object for debugging/monitoring.
 */
export function getAllRateLimitConfigs(): Record<string, TieredRateLimitConfig> {
  return {
    // Auth
    ...Object.fromEntries(
      Object.entries(AUTH_RATE_LIMITS).map(([k, v]) => [`AUTH_${k}`, v])
    ),
    // API
    ...Object.fromEntries(
      Object.entries(API_RATE_LIMITS).map(([k, v]) => [`API_${k}`, v])
    ),
    // SEO
    ...Object.fromEntries(
      Object.entries(SEO_RATE_LIMITS).map(([k, v]) => [`SEO_${k}`, v])
    ),
    // Content
    ...Object.fromEntries(
      Object.entries(CONTENT_RATE_LIMITS).map(([k, v]) => [`CONTENT_${k}`, v])
    ),
    // Analytics
    ...Object.fromEntries(
      Object.entries(ANALYTICS_RATE_LIMITS).map(([k, v]) => [`ANALYTICS_${k}`, v])
    ),
    // Portal
    ...Object.fromEntries(
      Object.entries(PORTAL_RATE_LIMITS).map(([k, v]) => [`PORTAL_${k}`, v])
    ),
    // Scraping Admin
    ...Object.fromEntries(
      Object.entries(SCRAPING_ADMIN_RATE_LIMITS).map(([k, v]) => [`SCRAPING_ADMIN_${k}`, v])
    ),
    // Resource
    ...Object.fromEntries(
      Object.entries(RESOURCE_RATE_LIMITS).map(([k, v]) => [`RESOURCE_${k}`, v])
    ),
  };
}
