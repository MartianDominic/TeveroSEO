/**
 * Queue Types for Scraping Jobs.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import type { ScrapeTier } from "@/db/domain-scrape-learning-schema";
import type { TieredFetchResult } from "../types";

// =============================================================================
// Job Priority
// =============================================================================

/**
 * Job priority levels.
 *
 * | Priority | BullMQ Value | Queue              | Use Case                    | SLA    |
 * |----------|--------------|--------------------|-----------------------------|--------|
 * | critical | 1            | scrape:priority    | User watching screen        | <60s   |
 * | high     | 5            | scrape:priority    | User-initiated, async       | <5min  |
 * | normal   | 10           | scrape:standard    | Paid feature, background    | <15min |
 * | low      | 20           | scrape:background  | Cache warming, re-audit     | <1hr   |
 */
export type JobPriority = "critical" | "high" | "normal" | "low";

/**
 * Job source indicating origin of the request.
 */
export type JobSource = "ui" | "api" | "scheduler" | "system";

// =============================================================================
// Job Data Structures
// =============================================================================

/**
 * Data for a scraping job.
 */
export interface ScrapeJobData {
  // Identity
  /** Unique job identifier */
  jobId: string;
  /** Groups related jobs (e.g., full audit) */
  batchId?: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;

  // Target
  /** URL to fetch */
  url: string;
  /** Pre-extracted domain for rate limiting */
  domain: string;

  // Configuration
  options: {
    /** Skip tier discovery, use specific tier */
    forceTier?: ScrapeTier;
    /** Force fresh fetch, skip cache */
    skipCache?: boolean;
    /** Override default timeout */
    timeoutMs?: number;
    /** Return raw HTML in result */
    includeHtml?: boolean;
    /** Return DFS pre-parsed data */
    includeParsedData?: boolean;
  };

  // Tracking
  /** Client ID for cost attribution */
  clientId: string;
  /** User who initiated the job */
  userId?: string;
  /** Source of the job */
  source: JobSource;

  // Metadata
  /** Unix timestamp when enqueued */
  enqueuedAt: number;
  /** Job priority */
  priority: JobPriority;
  /** Current retry count */
  retryCount: number;

  // Context
  metadata?: {
    prospectId?: string;
    auditId?: string;
    /** Feature that initiated the job */
    featureContext?: "site_audit" | "competitor_spy" | "content_brief" | "serp_analysis" | "prospect_scrape" | "cache_warming";
    /** Indicates this job was replayed from DLQ */
    replayedFromDlq?: boolean;
    /** Original DLQ job ID if replayed */
    originalDlqJobId?: string;
    /** Previous failure timestamp if replayed from DLQ */
    previousFailedAt?: number;
  };
}

/**
 * Result of a scraping job.
 */
export interface ScrapeJobResult {
  /** Whether the fetch succeeded */
  success: boolean;
  /** URL that was fetched */
  url: string;

  // On success
  /** Full fetch result */
  fetchResult?: TieredFetchResult;

  // On failure
  /** Error message */
  error?: string;
  /** Error code for categorization */
  errorCode?: ScrapeErrorCode;

  // Always present
  /** Tier used for the fetch */
  tierUsed: ScrapeTier;
  /** Whether result came from cache */
  fromCache: boolean;
  /** Total processing time in ms */
  processingTimeMs: number;
  /** Estimated cost in USD */
  estimatedCost: number;
}

/**
 * Error codes for categorizing scrape failures.
 *
 * CONSOLIDATION: Now includes retry behavior classification
 * (merged from ErrorClassifier.ErrorType).
 */
export type ScrapeErrorCode =
  | "RATE_LIMITED"
  | "BLOCKED"
  | "TIMEOUT"
  | "INVALID_URL"
  | "DNS_FAILURE"
  | "CONNECTION_REFUSED"
  | "SSL_ERROR"
  | "PARSE_ERROR"
  | "CAPTCHA"
  | "BOT_DETECTION"
  | "UNKNOWN";

/**
 * High-level retry behavior classification.
 * Merged from ErrorClassifier.ErrorType for unified retry logic.
 */
export type ScrapeRetryBehavior =
  /** Error can be retried with backoff (5xx, timeouts, network issues) */
  | "retryable"
  /** Error is permanent and should not be retried (4xx except 429/403) */
  | "permanent"
  /** Rate limited - wait for backoff then retry (429) */
  | "rate_limited"
  /** Blocked by target (403, 451) - escalate tier */
  | "blocked";

/**
 * Get retry behavior for a scrape error code.
 */
export function getScrapeRetryBehavior(code: ScrapeErrorCode): ScrapeRetryBehavior {
  switch (code) {
    case "RATE_LIMITED":
      return "rate_limited";
    case "BLOCKED":
    case "CAPTCHA":
    case "BOT_DETECTION":
      return "blocked";
    case "INVALID_URL":
    case "SSL_ERROR":
    case "PARSE_ERROR":
    case "DNS_FAILURE":
      return "permanent";
    case "TIMEOUT":
    case "CONNECTION_REFUSED":
    case "UNKNOWN":
    default:
      return "retryable";
  }
}

/**
 * Check if a scrape error should be retried.
 */
export function isScrapeErrorRetryable(code: ScrapeErrorCode): boolean {
  const behavior = getScrapeRetryBehavior(code);
  return behavior === "retryable" || behavior === "rate_limited";
}

/**
 * Check if a scrape error should trigger tier escalation.
 */
export function shouldScrapeEscalateTier(code: ScrapeErrorCode): boolean {
  const behavior = getScrapeRetryBehavior(code);
  return behavior === "blocked" || behavior === "rate_limited";
}

// =============================================================================
// Queue Names and Configuration
// =============================================================================

/**
 * Queue names for scraping jobs.
 */
export const SCRAPE_QUEUE_NAMES = {
  PRIORITY: "scrape:priority",
  STANDARD: "scrape:standard",
  BACKGROUND: "scrape:background",
} as const;

export type ScrapeQueueName = (typeof SCRAPE_QUEUE_NAMES)[keyof typeof SCRAPE_QUEUE_NAMES];

// =============================================================================
// Dead Letter Queue Types (PostgreSQL-based - SCR-01 CONSOLIDATION)
// =============================================================================
// NOTE: DLQ now uses the platform's PostgreSQL dead_letter_jobs table.
// The DlqJobData interface below is kept for backward compatibility but
// the actual storage uses FailedJobInfo from @/server/lib/dead-letter-queue.

/**
 * Result of adding a job to the DLQ.
 */
export interface DlqEnqueueResult {
  dlqJobId: string;
  originalJobId: string;
  sourceQueue: string;
}

/**
 * Status of a DLQ job.
 */
export interface DlqJobStatus {
  dlqJobId: string;
  originalJobId: string;
  sourceQueue: string;
  jobData: ScrapeJobData;
  error: string;
  attemptsMade: number;
  failedAt: number;
  replayedAt?: number;
}

/**
 * Queue configuration.
 */
export interface QueueConfig {
  /** Human-readable purpose */
  purpose: string;
  /** Worker concurrency */
  concurrency: number;
  /** Interval to check for stalled jobs in ms */
  stalledInterval: number;
  /** Maximum time a job can be locked in ms */
  lockDuration: number;
}

/**
 * Queue configurations by name.
 */
export const QUEUE_CONFIG: Record<ScrapeQueueName, QueueConfig> = {
  [SCRAPE_QUEUE_NAMES.PRIORITY]: {
    purpose: "User-initiated audits requiring <5 min SLA",
    concurrency: 50,
    stalledInterval: 30_000,
    lockDuration: 300_000, // 5 min
  },
  [SCRAPE_QUEUE_NAMES.STANDARD]: {
    purpose: "Paid feature scraping (competitor analysis, briefs)",
    concurrency: 100,
    stalledInterval: 60_000,
    lockDuration: 600_000, // 10 min
  },
  [SCRAPE_QUEUE_NAMES.BACKGROUND]: {
    purpose: "Background crawls, cache warming, re-audits",
    concurrency: 50,
    stalledInterval: 120_000,
    lockDuration: 900_000, // 15 min
  },
};

// =============================================================================
// Enqueue Types
// =============================================================================

/**
 * Input for enqueueing a single scraping job.
 */
export interface ScrapeJobInput {
  url: string;
  clientId: string;
  userId?: string;
  source: JobSource;
  priority?: JobPriority;
  options?: ScrapeJobData["options"];
  metadata?: ScrapeJobData["metadata"];
}

/**
 * Input for enqueueing a batch of scraping jobs.
 */
export type ScrapeJobBaseInput = Omit<ScrapeJobInput, "url">;

/**
 * Result of enqueueing a job.
 */
export interface EnqueueResult {
  jobId: string;
  batchId?: string;
  queue: ScrapeQueueName;
  priority: JobPriority;
  position: number;
  estimatedStartTime?: number;
}

// =============================================================================
// Status Types
// =============================================================================

/**
 * Job state in BullMQ.
 */
export type JobState = "waiting" | "active" | "completed" | "failed" | "delayed";

/**
 * Status of a single job.
 */
export interface JobStatus {
  jobId: string;
  state: JobState;
  progress?: number;
  result?: ScrapeJobResult;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  processedAt?: number;
  finishedAt?: number;
}

/**
 * Status of a batch of jobs.
 */
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

// =============================================================================
// Metrics Types
// =============================================================================

/**
 * Stats for a single queue.
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Global metrics across all queues.
 */
export interface GlobalMetrics {
  currentConcurrency: number;
  maxConcurrency: number;
  processingRate: number; // jobs/sec over last minute
  avgProcessingTime: number; // ms
  blockedDomains: number;
}

/**
 * Complete queue metrics.
 */
export interface QueueMetrics {
  queues: Record<ScrapeQueueName, QueueStats>;
  global: GlobalMetrics;
}
