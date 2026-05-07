/**
 * Per-Domain Learning System Types
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * TypeScript interfaces for the domain learning system.
 */

import type {
  ScrapeTier,
  EscalationReason,
  DetectedTechnology,
  GeoRequirement,
  DiscoveryAttempt,
} from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Fetch Request/Response Types
// =============================================================================

/**
 * Request to fetch a URL with tiered escalation.
 */
export interface TieredFetchRequest {
  /** URL to fetch */
  url: string;

  /** Starting tier (default: look up from cache/DB or start at 'direct') */
  startTier?: ScrapeTier;

  /** Maximum tier to escalate to (default: 'dfs_browser') */
  maxTier?: ScrapeTier;

  /** Request timeout in milliseconds (default: 15000) */
  timeoutMs?: number;

  /** Custom headers to include */
  headers?: Record<string, string>;

  /** Whether to skip cache lookup (force discovery) */
  skipCache?: boolean;

  /** Job ID for correlation */
  jobId?: string;

  /** Client ID for cost tracking */
  clientId?: string;

  /** Geo-targeting requirements */
  geo?: {
    country?: string;
    region?: string;
  };
}

/**
 * Result of a tiered fetch operation.
 */
export interface TieredFetchResult {
  /** Whether the fetch succeeded */
  success: boolean;

  /** Tier that was used for the successful fetch */
  tier: ScrapeTier;

  /** HTTP status code */
  statusCode: number;

  /** Response body (HTML) */
  html?: string;

  /** Response headers */
  headers?: Record<string, string>;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Response size in bytes */
  responseSizeBytes: number;

  /** Cost of this fetch in USD */
  costUsd: number;

  /** Content validation results */
  validation: ContentValidation;

  /** Error details if failed */
  error?: {
    reason: EscalationReason;
    message: string;
    tier: ScrapeTier;
  };

  /** Discovery metadata (if this was a discovery) */
  discovery?: {
    isNewDomain: boolean;
    tiersAttempted: ScrapeTier[];
    escalationPath: Array<{
      tier: ScrapeTier;
      reason: EscalationReason;
    }>;
  };
}

/**
 * Content validation results.
 */
export interface ContentValidation {
  /** Has a <body> tag */
  hasBody: boolean;

  /** Has a <title> tag */
  hasTitle: boolean;

  /** Has an <h1> tag */
  hasH1: boolean;

  /** Word count in the body */
  wordCount: number;

  /** Text ratio (text length / html length) */
  textRatio: number;

  /** Whether content appears to be a SPA shell */
  isSpaShell: boolean;

  /** Whether content appears to be a bot detection page */
  isBotDetectionPage: boolean;

  /** Whether content appears to be a CAPTCHA page */
  isCaptchaPage: boolean;
}

// =============================================================================
// Domain Config Types
// =============================================================================

/**
 * Cached domain configuration for fast lookup.
 */
export interface DomainConfig {
  /** Normalized domain */
  domain: string;

  /** Optimal tier to use */
  optimalTier: ScrapeTier;

  /** Whether the tier has been validated */
  isValidated: boolean;

  /** Success rate (0-1) */
  successRate: number;

  /** Consecutive failures */
  consecutiveFailures: number;

  /** Average response time */
  avgResponseTimeMs: number | null;

  /** Detected technologies */
  detectedTechnologies: DetectedTechnology[];

  /** Has anti-bot protection */
  hasAntiBotProtection: boolean;

  /** Requires JS rendering */
  requiresJsRendering: boolean;

  /** Geo requirements */
  geoRequirement: GeoRequirement | null;

  /** Last escalation reason */
  lastEscalationReason: EscalationReason | null;

  /** When this config was last updated */
  updatedAt: Date;

  /** When the next revalidation is due */
  nextRevalidationAt: Date | null;
}

/**
 * Update to domain configuration after a fetch.
 */
export interface DomainConfigUpdate {
  /** Whether the fetch succeeded */
  success: boolean;

  /** Tier that was used */
  tier: ScrapeTier;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Response size in bytes */
  responseSizeBytes?: number;

  /** Escalation reason (if failed or escalated) */
  escalationReason?: EscalationReason;

  /** Technologies detected */
  technologies?: DetectedTechnology[];

  /** Geo requirement discovered */
  geoRequirement?: GeoRequirement;

  /** Full discovery history (if this was a discovery) */
  discoveryHistory?: DiscoveryAttempt[];
}

// =============================================================================
// Discovery Types
// =============================================================================

/**
 * Request to discover the optimal tier for a domain.
 */
export interface DiscoveryRequest {
  /** Domain to discover (will be normalized) */
  domain: string;

  /** URL to use for testing (default: homepage) */
  testUrl?: string;

  /** Maximum tier to test (default: 'dfs_browser') */
  maxTier?: ScrapeTier;

  /** Job ID for correlation */
  jobId?: string;
}

/**
 * Result of a discovery operation.
 */
export interface DiscoveryResult {
  /** Domain that was tested */
  domain: string;

  /** Optimal tier discovered */
  optimalTier: ScrapeTier;

  /** All tiers that were attempted */
  attempts: DiscoveryAttempt[];

  /** Total time spent on discovery */
  totalTimeMs: number;

  /** Total cost of discovery */
  totalCostUsd: number;

  /** Detected technologies */
  technologies: DetectedTechnology[];

  /** Whether anti-bot protection was detected */
  hasAntiBotProtection: boolean;

  /** Whether JS rendering is required */
  requiresJsRendering: boolean;

  /** Geo requirements (if any) */
  geoRequirement: GeoRequirement | null;
}

// =============================================================================
// Revalidation Types
// =============================================================================

/**
 * Domain requiring revalidation.
 */
export interface RevalidationCandidate {
  /** Domain to revalidate */
  domain: string;

  /** Current optimal tier */
  currentTier: ScrapeTier;

  /** Reason for revalidation */
  reason: "stale" | "consecutive_failures" | "low_success_rate" | "scheduled";

  /** Current success rate */
  successRate: number;

  /** Days since last success */
  daysSinceLastSuccess: number;

  /** Consecutive failures */
  consecutiveFailures: number;

  /** Priority (higher = more urgent) */
  priority: number;
}

/**
 * Result of a revalidation operation.
 */
export interface RevalidationResult {
  /** Domain that was revalidated */
  domain: string;

  /** Previous optimal tier */
  previousTier: ScrapeTier;

  /** New optimal tier */
  newTier: ScrapeTier;

  /** Whether the tier changed */
  tierChanged: boolean;

  /** New success rate after revalidation */
  newSuccessRate: number;

  /** Next scheduled revalidation */
  nextRevalidationAt: Date;
}

// =============================================================================
// Cost Tracking Types
// =============================================================================

/**
 * Cost summary for a crawl job.
 */
export interface CrawlCostSummary {
  /** Job ID */
  jobId: string;

  /** Client ID */
  clientId: string;

  /** Domain being crawled */
  domain: string;

  /** Total pages fetched */
  totalPages: number;

  /** Breakdown by tier */
  byTier: Record<
    ScrapeTier,
    {
      pages: number;
      bytes: number;
      cost: number;
    }
  >;

  /** Total cost in USD */
  totalCostUsd: number;

  /** Average cost per page */
  avgCostPerPage: number;

  /** Savings vs all-DataForSEO approach */
  savingsVsAllDfs: number;

  /** Savings percentage */
  savingsPercent: number;

  /** Time range */
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Daily cost report by client.
 */
export interface DailyCostReport {
  /** Date (YYYY-MM-DD) */
  date: string;

  /** Client ID */
  clientId: string;

  /** Total pages fetched */
  totalPages: number;

  /** Breakdown by tier */
  byTier: Record<ScrapeTier, { pages: number; cost: number }>;

  /** Total cost in USD */
  totalCostUsd: number;

  /** Top domains by cost */
  topDomains: Array<{
    domain: string;
    pages: number;
    cost: number;
    primaryTier: ScrapeTier;
  }>;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Domain learning service interface.
 */
export interface IDomainLearningService {
  /**
   * Get the optimal configuration for a domain.
   * Returns cached config or triggers discovery if not found.
   */
  getConfig(domain: string): Promise<DomainConfig | null>;

  /**
   * Perform tiered fetch with automatic tier selection.
   */
  fetch(request: TieredFetchRequest): Promise<TieredFetchResult>;

  /**
   * Discover the optimal tier for a domain.
   */
  discover(request: DiscoveryRequest): Promise<DiscoveryResult>;

  /**
   * Update domain config after a fetch.
   */
  updateConfig(domain: string, update: DomainConfigUpdate): Promise<void>;

  /**
   * Get candidates for revalidation.
   */
  getRevalidationCandidates(limit?: number): Promise<RevalidationCandidate[]>;

  /**
   * Revalidate a domain's optimal tier.
   */
  revalidate(domain: string): Promise<RevalidationResult>;

  /**
   * Get cost summary for a crawl job.
   */
  getCrawlCost(jobId: string): Promise<CrawlCostSummary | null>;

  /**
   * Get daily cost report.
   */
  getDailyCost(date: string, clientId?: string): Promise<DailyCostReport[]>;

  /**
   * Invalidate cached config for a domain.
   */
  invalidateCache(domain: string): Promise<void>;
}
