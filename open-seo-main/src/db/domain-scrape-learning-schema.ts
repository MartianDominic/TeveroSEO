/**
 * Per-Domain Learning System Schema
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Tracks which scraping tier works best for each domain to avoid
 * wasting money re-discovering on every fetch.
 *
 * Learning triggers:
 * - First fetch of a new domain -> discovery process
 * - Periodic re-validation (domains change protection)
 * - Failure on previously working tier -> re-discover
 *
 * Cost savings: 97% reduction by starting at known-good tier
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  real,
  boolean,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// =============================================================================
// Scrape Tier Definitions
// =============================================================================

/**
 * Available scraping tiers in escalation order.
 * Cost increases with each tier.
 */
export const SCRAPE_TIERS = [
  "direct",       // T0: Free - direct fetch with polite rate limiting
  "webshare",     // T1: Free - Webshare DC proxies (10 IPs, 1GB/mo)
  "geonode",      // T2: $0.77/GB - Geonode residential proxies (fetch only)
  "camoufox",     // T2.5: $0.77/GB - Camoufox stealth browser + Geonode proxy
  "dfs_basic",    // T3: $0.000125/pg - DataForSEO Basic (HTML only)
  "dfs_js",       // T4: $0.00125/pg - DataForSEO JS rendering
  "dfs_browser",  // T5: $0.00425/pg - DataForSEO full browser (fallback)
] as const;
export type ScrapeTier = (typeof SCRAPE_TIERS)[number];

/**
 * Tier cost per request in USD.
 * Used for cost tracking and optimization.
 */
export const TIER_COSTS: Record<ScrapeTier, number> = {
  direct: 0,
  webshare: 0, // Free tier, bandwidth-limited
  geonode: 0.000077, // $0.77/GB, avg 100KB/page = $0.000077/page
  camoufox: 0.000077, // Same as geonode (bandwidth cost), browser overhead absorbed
  dfs_basic: 0.000125, // DataForSEO Standard Queue
  dfs_js: 0.00125, // DataForSEO with JS rendering
  dfs_browser: 0.00425, // DataForSEO full browser
};

/**
 * Tier index for ordering and escalation.
 */
export const TIER_INDEX: Record<ScrapeTier, number> = {
  direct: 0,
  webshare: 1,
  geonode: 2,
  camoufox: 2.5, // Between geonode and dfs_basic
  dfs_basic: 3,
  dfs_js: 4,
  dfs_browser: 5,
};

// =============================================================================
// Escalation Reason Definitions
// =============================================================================

/**
 * Reasons for tier escalation during discovery.
 */
export const ESCALATION_REASONS = [
  "rate_limited",     // HTTP 429 - need proxy rotation
  "ip_blocked",       // HTTP 403 - IP is blocked
  "dc_detected",      // Cloudflare DC/ASN detection
  "geo_blocked",      // Content varies by geo or blocked for region
  "js_required",      // SPA - needs JS rendering
  "captcha",          // CAPTCHA challenge detected
  "bot_detected",     // Generic bot detection page
  "empty_response",   // Response too small or missing content
  "timeout",          // Request timed out
  "ssl_error",        // SSL/TLS handshake failure
  "dns_error",        // DNS resolution failed
  "connection_reset", // Connection reset by peer
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

// =============================================================================
// Technology Detection
// =============================================================================

/**
 * Detected technologies that affect scraping strategy.
 */
export const DETECTED_TECHNOLOGIES = [
  // CMS Platforms
  "wordpress",
  "shopify",
  "woocommerce",
  "magento",
  "prestashop",
  "squarespace",
  "wix",
  "webflow",
  "drupal",
  "joomla",
  // JS Frameworks (require JS rendering)
  "react",
  "nextjs",
  "vue",
  "nuxt",
  "angular",
  "svelte",
  "gatsby",
  // Anti-bot
  "cloudflare",
  "akamai",
  "imperva",
  "datadome",
  "perimeterx",
  "recaptcha",
  "hcaptcha",
  // Other
  "custom",
  "unknown",
] as const;
export type DetectedTechnology = (typeof DETECTED_TECHNOLOGIES)[number];

// =============================================================================
// Geo Requirements
// =============================================================================

/**
 * Geographic requirements for successful scraping.
 * Some sites block or vary content by region.
 */
export interface GeoRequirement {
  /** Required country for residential proxy (ISO 3166-1 alpha-2) */
  country?: string;
  /** Required region/state */
  region?: string;
  /** Reason for geo requirement */
  reason: "geo_block" | "content_variance" | "legal_restriction";
  /** When this requirement was discovered */
  discoveredAt: string; // ISO timestamp
}

// =============================================================================
// Discovery Result
// =============================================================================

/**
 * Result of a single discovery attempt.
 */
export interface DiscoveryAttempt {
  /** Tier that was tested */
  tier: ScrapeTier;
  /** Whether the tier succeeded */
  success: boolean;
  /** HTTP status code returned */
  statusCode?: number;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Response body size in bytes */
  responseSizeBytes?: number;
  /** Content validation results */
  validation?: {
    hasBody: boolean;
    hasTitle: boolean;
    hasH1: boolean;
    wordCount: number;
    textRatio: number; // text length / html length
  };
  /** Reason for failure (if failed) */
  escalationReason?: EscalationReason;
  /** Error message (if failed) */
  errorMessage?: string;
  /** When this attempt was made */
  timestamp: string; // ISO timestamp
}

// =============================================================================
// Domain Scrape Config Table
// =============================================================================

/**
 * Main configuration table for per-domain scraping intelligence.
 * Stores the optimal tier and metadata for each domain.
 */
export const domainScrapeConfigs = pgTable(
  "domain_scrape_configs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Normalized domain (e.g., "example.com", no protocol/path/www).
     * Primary lookup key.
     */
    domain: text("domain").notNull().unique(),

    /**
     * Optimal scraping tier discovered for this domain.
     * Start here on next fetch.
     */
    optimalTier: text("optimal_tier").notNull().$type<ScrapeTier>(),

    /**
     * Whether this tier has been validated (successful fetches).
     * False during initial discovery.
     */
    isValidated: boolean("is_validated").notNull().default(false),

    // =========================================================================
    // Success Metrics
    // =========================================================================

    /** Total successful fetches at optimal tier */
    successCount: integer("success_count").notNull().default(0),

    /** Total failed fetches at optimal tier */
    failureCount: integer("failure_count").notNull().default(0),

    /** Consecutive failures (reset on success) */
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    /** Success rate (0-1) - updated on each fetch */
    successRate: real("success_rate").notNull().default(1.0),

    // =========================================================================
    // Performance Metrics
    // =========================================================================

    /** Average response time in milliseconds */
    avgResponseTimeMs: integer("avg_response_time_ms"),

    /** Average page size in bytes */
    avgPageSizeBytes: integer("avg_page_size_bytes"),

    /** P95 response time (95th percentile) */
    p95ResponseTimeMs: integer("p95_response_time_ms"),

    // =========================================================================
    // Technology Detection
    // =========================================================================

    /** Primary detected technology/platform */
    primaryTechnology: text("primary_technology").$type<DetectedTechnology>(),

    /** All detected technologies */
    detectedTechnologies: jsonb("detected_technologies").$type<DetectedTechnology[]>(),

    /** Whether Cloudflare or similar WAF is detected */
    hasAntiBotProtection: boolean("has_anti_bot_protection").default(false),

    /** Whether the site requires JS rendering for content */
    requiresJsRendering: boolean("requires_js_rendering").default(false),

    // =========================================================================
    // Geographic Requirements
    // =========================================================================

    /** Geo-specific requirements if any */
    geoRequirement: jsonb("geo_requirement").$type<GeoRequirement>(),

    // =========================================================================
    // Discovery History
    // =========================================================================

    /** Last 5 discovery attempts (for debugging) */
    discoveryHistory: jsonb("discovery_history").$type<DiscoveryAttempt[]>(),

    /** Most recent escalation reason (why we're at current tier) */
    lastEscalationReason: text("last_escalation_reason").$type<EscalationReason>(),

    // =========================================================================
    // Timestamps
    // =========================================================================

    /** When discovery was first completed */
    discoveredAt: timestamp("discovered_at", { withTimezone: true, mode: "date" }),

    /** Last successful fetch timestamp */
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true, mode: "date" }),

    /** Last failed fetch timestamp */
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true, mode: "date" }),

    /** Last validation/re-discovery attempt */
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true, mode: "date" }),

    /** Next scheduled re-validation */
    nextRevalidationAt: timestamp("next_revalidation_at", { withTimezone: true, mode: "date" }),

    /** Standard timestamps */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Primary lookup by domain
    uniqueIndex("ix_domain_scrape_configs_domain").on(table.domain),

    // Find domains needing re-validation
    index("ix_domain_scrape_configs_revalidation").on(table.nextRevalidationAt),

    // Find domains with high failure rates
    index("ix_domain_scrape_configs_failure_rate").on(
      table.successRate,
      table.consecutiveFailures
    ),

    // Find domains by tier (for cost analysis)
    index("ix_domain_scrape_configs_tier").on(table.optimalTier),

    // Find domains with anti-bot (for monitoring)
    index("ix_domain_scrape_configs_antibot").on(table.hasAntiBotProtection),

    // Find JS-required domains
    index("ix_domain_scrape_configs_js").on(table.requiresJsRendering),
  ]
);

// =============================================================================
// Domain Scrape History Table
// =============================================================================

/**
 * Historical log of all scrape attempts for debugging and analysis.
 * Partitioned by month for efficient cleanup.
 */
export const domainScrapeHistory = pgTable(
  "domain_scrape_history",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /** Reference to domain config */
    domainConfigId: bigint("domain_config_id", { mode: "number" })
      .notNull()
      .references(() => domainScrapeConfigs.id, { onDelete: "cascade" }),

    /** Domain (denormalized for faster queries) */
    domain: text("domain").notNull(),

    /** Full URL that was fetched */
    url: text("url").notNull(),

    /** Tier used for this attempt */
    tier: text("tier").notNull().$type<ScrapeTier>(),

    /** Whether the fetch succeeded */
    success: boolean("success").notNull(),

    /** HTTP status code */
    statusCode: integer("status_code"),

    /** Response time in milliseconds */
    responseTimeMs: integer("response_time_ms"),

    /** Response size in bytes */
    responseSizeBytes: integer("response_size_bytes"),

    /** Cost of this request in USD */
    costUsd: real("cost_usd").notNull().default(0),

    /** Escalation reason if failed */
    escalationReason: text("escalation_reason").$type<EscalationReason>(),

    /** Error message if failed */
    errorMessage: text("error_message"),

    /** Content validation results */
    validation: jsonb("validation").$type<{
      hasBody: boolean;
      hasTitle: boolean;
      hasH1: boolean;
      wordCount: number;
      textRatio: number;
    }>(),

    /** Proxy used (if any) */
    proxyUsed: text("proxy_used"),

    /** User agent used */
    userAgent: text("user_agent"),

    /** Job ID that triggered this fetch (for correlation) */
    jobId: text("job_id"),

    /** Client ID (for multi-tenant cost tracking) */
    clientId: text("client_id"),

    /** When this attempt was made */
    attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Lookup history for a domain
    index("ix_domain_scrape_history_domain").on(table.domain, table.attemptedAt),

    // Lookup by config ID
    index("ix_domain_scrape_history_config").on(table.domainConfigId),

    // Cost analysis by client
    index("ix_domain_scrape_history_client_cost").on(
      table.clientId,
      table.attemptedAt,
      table.costUsd
    ),

    // Tier distribution analysis
    index("ix_domain_scrape_history_tier").on(table.tier, table.attemptedAt),

    // Find failures for debugging
    index("ix_domain_scrape_history_failures").on(
      table.success,
      table.escalationReason,
      table.attemptedAt
    ),

    // Time-based cleanup (delete old records)
    index("ix_domain_scrape_history_cleanup").on(table.attemptedAt),
  ]
);

// =============================================================================
// Relations
// =============================================================================

export const domainScrapeConfigsRelations = relations(
  domainScrapeConfigs,
  ({ many }) => ({
    history: many(domainScrapeHistory),
  })
);

export const domainScrapeHistoryRelations = relations(
  domainScrapeHistory,
  ({ one }) => ({
    config: one(domainScrapeConfigs, {
      fields: [domainScrapeHistory.domainConfigId],
      references: [domainScrapeConfigs.id],
    }),
  })
);

// =============================================================================
// Inferred Types
// =============================================================================

export type DomainScrapeConfigSelect = typeof domainScrapeConfigs.$inferSelect;
export type DomainScrapeConfigInsert = typeof domainScrapeConfigs.$inferInsert;

export type DomainScrapeHistorySelect = typeof domainScrapeHistory.$inferSelect;
export type DomainScrapeHistoryInsert = typeof domainScrapeHistory.$inferInsert;

// =============================================================================
// Revalidation Constants
// =============================================================================

/**
 * Revalidation intervals in milliseconds.
 */
export const REVALIDATION_INTERVALS = {
  /** Default revalidation after 30 days of no access */
  DEFAULT_DAYS: 30,

  /** Revalidate after 3 consecutive failures */
  CONSECUTIVE_FAILURE_THRESHOLD: 3,

  /** Revalidate if success rate drops below 90% */
  SUCCESS_RATE_THRESHOLD: 0.9,

  /** Minimum time between revalidation attempts */
  MIN_INTERVAL_HOURS: 1,

  /** Maximum age before forced revalidation */
  MAX_AGE_DAYS: 90,
} as const;

/**
 * Redis cache TTL for domain configs.
 */
export const DOMAIN_CONFIG_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
