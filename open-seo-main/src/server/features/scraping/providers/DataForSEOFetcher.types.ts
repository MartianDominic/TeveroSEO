/**
 * DataForSEO Fetcher Types
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Type definitions for the optimized DataForSEO fetcher:
 * - Standard Queue vs Live API
 * - Pre-parsed data structures
 * - Batch request handling
 * - Error codes and retry config
 */

import type { FetchResult, BaseFetchOptions } from "../fetchers/types";

// =============================================================================
// DFS Mode & Queue Types
// =============================================================================

/**
 * DataForSEO rendering modes in order of capability/cost.
 */
export type DfsMode = "basic" | "js" | "browser";

/**
 * Queue type determines cost and latency.
 */
export type DfsQueueType = "standard" | "live";

/**
 * Urgency level determines queue selection.
 */
export type DfsUrgency = "immediate" | "background" | "bulk";

// =============================================================================
// Fetch Options
// =============================================================================

/**
 * Options for DataForSEO fetch operations.
 * Note: url is optional here since batch methods pass URL separately.
 */
export interface DfsFetchOptions extends Omit<BaseFetchOptions, "url"> {
  /** URL to fetch (optional - may be passed separately for batch operations) */
  url?: string;
  /** Force specific mode (basic, js, browser) */
  mode?: DfsMode;

  /** Use Standard Queue instead of Live API */
  useStandardQueue?: boolean;

  /** Include raw HTML in response */
  includeRawHtml?: boolean;

  /** Load resources (images, CSS, scripts) */
  loadResources?: boolean;

  /** Custom JavaScript to execute (browser mode only) */
  customJs?: string;

  /** Timeout override (ms) */
  timeoutMs?: number;

  /** Webhook URL for Standard Queue results */
  webhookUrl?: string;

  /** Cost tracking: client ID for attribution */
  clientId?: string;

  /** Cost tracking: workspace ID */
  workspaceId?: string;

  /** Cost tracking: job ID for correlation */
  jobId?: string;

  /** Device type for rendering */
  device?: "desktop" | "mobile";

  /** Urgency level (affects queue selection) */
  urgency?: DfsUrgency;
}

// =============================================================================
// Fetch Result
// =============================================================================

/**
 * Extended fetch result with DFS-specific data.
 */
export interface DfsFetchResult extends FetchResult {
  /** DFS-specific error code */
  dfsErrorCode?: number;

  /** DFS task ID (for Standard Queue) */
  taskId?: string;

  /** Pre-parsed data from DFS */
  parsedData?: DataForSEOParsedData;

  /** Estimated cost at request time */
  estimatedCost: number;

  /** Actual cost charged by DFS */
  actualCost?: number;

  /** Mode used for this request */
  modeUsed: DfsMode;

  /** Whether Standard Queue was used */
  usedStandardQueue: boolean;

  /** When result was delivered (for queue latency tracking) */
  deliveredAt?: Date;
}

// =============================================================================
// Pre-Parsed Data Structures
// =============================================================================

/**
 * Pre-parsed SEO data extracted from DataForSEO response.
 * Covers ~60% of SEO checks without HTML parsing.
 */
export interface DataForSEOParsedData {
  // =========================================================================
  // Meta Information
  // =========================================================================

  /** Page title */
  title: string;

  /** Title character length */
  titleLength: number;

  /** Meta description */
  metaDescription: string;

  /** Meta description character length */
  metaDescriptionLength: number;

  /** Canonical URL */
  canonical: string | null;

  /** Language declared */
  language: string | null;

  /** Character encoding */
  charset: string | null;

  // =========================================================================
  // Headings
  // =========================================================================

  /** All H1 tags */
  h1: string[];

  /** All H2 tags */
  h2: string[];

  /** All H3 tags */
  h3: string[];

  /** All H4 tags */
  h4: string[];

  /** All H5 tags */
  h5: string[];

  /** All H6 tags */
  h6: string[];

  // =========================================================================
  // Content Metrics
  // =========================================================================

  /** Word count */
  wordCount: number;

  /** Plain text size in bytes */
  plainTextSize: number;

  /** Text-to-HTML ratio (0-1) */
  plainTextRate: number;

  // =========================================================================
  // Links
  // =========================================================================

  /** Internal links on the page */
  internalLinks: DfsLinkData[];

  /** External links on the page */
  externalLinks: DfsLinkData[];

  // =========================================================================
  // Media (requires loadResources)
  // =========================================================================

  /** Images on the page */
  images?: DfsImageData[];

  /** Scripts on the page */
  scripts?: DfsResourceData[];

  /** Stylesheets on the page */
  stylesheets?: DfsResourceData[];

  // =========================================================================
  // Social Meta
  // =========================================================================

  /** Open Graph tags */
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    url?: string;
    siteName?: string;
  };

  /** Twitter Card tags */
  twitterCard: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    site?: string;
    creator?: string;
  };

  // =========================================================================
  // Technical SEO
  // =========================================================================

  /** Robots meta directives */
  robotsDirectives: string[];

  /** X-Robots-Tag header value */
  xRobotsTag: string | null;

  // =========================================================================
  // Performance (from page_timing)
  // =========================================================================

  /** Page timing metrics */
  pageTiming: {
    /** Time to interactive (ms) */
    timeToInteractive: number | null;

    /** DOM complete time (ms) */
    domComplete: number | null;

    /** Largest Contentful Paint (ms) */
    lcp: number | null;

    /** Connection time (ms) */
    connectionTime: number | null;

    /** Time to secure connection (ms) */
    timeToSecureConnection: number | null;
  };
}

/**
 * Link data from DFS response.
 */
export interface DfsLinkData {
  url: string;
  anchor: string;
  nofollow: boolean;
  sponsored?: boolean;
  ugc?: boolean;
}

/**
 * Image data from DFS response.
 */
export interface DfsImageData {
  src: string;
  alt: string;
  size?: number;
  width?: number;
  height?: number;
}

/**
 * Generic resource data.
 */
export interface DfsResourceData {
  src: string;
  size?: number;
}

// =============================================================================
// Error Codes
// =============================================================================

/**
 * DataForSEO-specific error codes.
 * Reference: https://docs.dataforseo.com/v3/appendix/errors
 */
export const DFS_ERROR_CODES = {
  // Success
  20000: "OK",
  20100: "Task created, results not ready",

  // Rate limiting
  20002: "Rate limit exceeded",
  20003: "Insufficient balance",

  // Task errors
  40001: "Invalid task ID",
  40002: "Task not found",
  40003: "Task expired",
  40004: "Invalid parameters",
  40100: "Invalid URL",
  40101: "URL not accessible",
  40102: "Invalid location",
  40103: "Invalid language",
  40501: "Request entity too large",

  // Fetch errors
  50001: "Target unreachable",
  50002: "Target timeout",
  50003: "Target returned error",
  50004: "JavaScript execution failed",
  50005: "Browser rendering failed",
  50006: "Resource loading failed",
  50007: "CAPTCHA detected",
  50008: "Bot detection page",

  // System errors
  60001: "Internal server error",
  60002: "Service unavailable",
  60003: "Service temporarily unavailable",
} as const;

export type DfsErrorCode = keyof typeof DFS_ERROR_CODES;

/**
 * Error codes that should trigger retry.
 */
export const RETRYABLE_DFS_ERRORS: DfsErrorCode[] = [
  20002, // Rate limit
  60001, // Internal server error
  60002, // Service unavailable
  60003, // Temporarily unavailable
];

/**
 * Error codes that should trigger tier escalation.
 */
export const ESCALATE_TIER_DFS_ERRORS: DfsErrorCode[] = [
  50001, // Target unreachable
  50002, // Target timeout
  50004, // JS execution failed
  50005, // Browser rendering failed
  50007, // CAPTCHA detected
  50008, // Bot detection
];

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Configuration for retry behavior.
 */
export interface DfsRetryConfig {
  /** Maximum number of retries */
  maxRetries: number;

  /** Base delay in milliseconds */
  baseDelayMs: number;

  /** Maximum delay in milliseconds */
  maxDelayMs: number;

  /** Error codes that are retryable */
  retryableCodes: DfsErrorCode[];

  /** Error codes that trigger tier escalation */
  escalateTierOn: DfsErrorCode[];
}

/**
 * Default retry configuration.
 */
export const DEFAULT_DFS_RETRY_CONFIG: DfsRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableCodes: RETRYABLE_DFS_ERRORS,
  escalateTierOn: ESCALATE_TIER_DFS_ERRORS,
};

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Status of a batch request.
 */
export type BatchStatus = "pending" | "submitted" | "polling" | "completed" | "failed";

/**
 * Individual URL in a batch.
 */
export interface BatchedUrl {
  url: string;
  options: DfsFetchOptions;
  status: "pending" | "completed" | "failed";
  result?: DfsFetchResult;
  taskId?: string;
  addedAt: Date;
}

/**
 * A batch of URLs being processed together.
 */
export interface DfsBatch {
  /** Unique batch identifier */
  id: string;

  /** URLs in this batch */
  urls: BatchedUrl[];

  /** Batch options (shared across URLs) */
  options: DfsFetchOptions;

  /** Current batch status */
  status: BatchStatus;

  /** When batch was created */
  createdAt: Date;

  /** When batch was submitted to DFS */
  submittedAt?: Date;

  /** When batch completed */
  completedAt?: Date;

  /** DFS task IDs for polling */
  taskIds: string[];

  /** Total estimated cost */
  estimatedCost: number;
}

// =============================================================================
// Budget & Usage Statistics
// =============================================================================

/**
 * Budget status for monitoring.
 */
export interface DfsBudgetStatus {
  /** Today's spend in USD */
  dailySpend: number;

  /** Daily budget limit */
  dailyLimit: number;

  /** Daily usage percentage (0-1) */
  dailyUsagePercent: number;

  /** This month's spend in USD */
  monthlySpend: number;

  /** Monthly budget limit */
  monthlyLimit: number;

  /** Monthly usage percentage (0-1) */
  monthlyUsagePercent: number;

  /** Whether daily budget is exceeded */
  isOverDailyBudget: boolean;

  /** Whether monthly budget is exceeded */
  isOverMonthlyBudget: boolean;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Usage statistics for dashboard.
 */
export interface DfsUsageStats {
  /** Today's total spend */
  todaySpend: number;

  /** This month's total spend */
  monthSpend: number;

  /** Total requests today */
  requestsToday: number;

  /** Total requests this month */
  requestsMonth: number;

  /** Average cost per request */
  averageCostPerRequest: number;

  /** Distribution by tier */
  tierDistribution: {
    basic: { cost: number; count: number };
    js: { cost: number; count: number };
    browser: { cost: number; count: number };
  };

  /** Distribution by queue type */
  queueDistribution: {
    standard: { cost: number; count: number };
    live: { cost: number; count: number };
  };

  /** Savings from using Standard Queue */
  savingsFromStandardQueue: number;
}

// =============================================================================
// Circuit Breaker
// =============================================================================

/**
 * Circuit breaker state.
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;

  /** Time to wait before trying half-open (ms) */
  recoveryTimeoutMs: number;

  /** Number of successes needed to close circuit from half-open */
  successThreshold: number;
}

/**
 * Default circuit breaker configuration.
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 60000, // 1 minute
  successThreshold: 2,
};

// =============================================================================
// Tier Selection Context
// =============================================================================

/**
 * Context for selecting the appropriate DFS tier.
 */
export interface DfsTierContext {
  /** Domain being fetched */
  domain: string;

  /** Whether JS rendering is required */
  requiresJs: boolean;

  /** Whether heavy anti-bot protection is detected */
  hasAntiBot: boolean;

  /** Request urgency */
  urgency: DfsUrgency;

  /** Batch size (affects queue decision) */
  batchSize: number;

  /** Previous tier that failed (for escalation) */
  previousTier?: DfsMode;
}

/**
 * Result of tier selection.
 */
export interface DfsTierSelection {
  /** Selected endpoint */
  endpoint: string;

  /** Selected mode */
  mode: DfsMode;

  /** Whether to use Standard Queue */
  useStandardQueue: boolean;

  /** Enable JavaScript rendering */
  enableJavascript: boolean;

  /** Enable full browser simulation */
  browserScreen: boolean;

  /** Estimated cost per page */
  estimatedCost: number;

  /** Expected delivery time */
  deliveryTime: string;
}

// =============================================================================
// API Response Types (Internal)
// =============================================================================

/**
 * Raw OnPage API result item structure.
 */
export interface DfsOnPageResultItem {
  url: string;
  status_code: number;
  meta?: {
    title?: string;
    description?: string;
    canonical?: string;
    robots_txt?: string;
    x_robots_tag?: string | null;
    htags?: {
      h1?: string[];
      h2?: string[];
      h3?: string[];
      h4?: string[];
      h5?: string[];
      h6?: string[];
    };
    content?: {
      plain_text_size?: number;
      plain_text_rate?: number;
      plain_text_word_count?: number;
    };
    language?: string;
    charset?: string;
    open_graph?: Record<string, string>;
    twitter_card?: Record<string, string>;
  };
  links?: {
    internal?: Array<{ url: string; anchor?: string; nofollow?: boolean }>;
    external?: Array<{ url: string; anchor?: string; nofollow?: boolean }>;
  };
  resources?: {
    images?: Array<{ src: string; alt?: string; size?: number }>;
    scripts?: Array<{ src: string; size?: number }>;
    stylesheets?: Array<{ src: string; size?: number }>;
  };
  page_timing?: {
    time_to_interactive?: number;
    dom_complete?: number;
    largest_contentful_paint?: number;
    connection_time?: number;
    time_to_secure_connection?: number;
  };
  raw_html?: string;
  fetch_html?: string;
}

/**
 * Task POST response for Standard Queue.
 */
export interface DfsTaskPostResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: Record<string, unknown>;
    result: null; // No result on POST, need to poll
  }>;
}

/**
 * Tasks ready response for polling.
 */
export interface DfsTasksReadyResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: Record<string, unknown>;
    result: DfsOnPageResultItem[] | null;
  }>;
}
