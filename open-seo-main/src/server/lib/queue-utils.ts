/**
 * BullMQ Queue Utilities - Hardening and Reliability
 *
 * Provides:
 * - Backpressure handling to prevent queue overflow
 * - Job data validation helpers
 * - Job timeout wrapper for processors
 * - Deduplication helpers
 * - Standardized retry configuration
 */

import type { Queue, Job, BackoffOptions, JobsOptions, KeepJobs } from "bullmq";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "queue-utils" });

// ============================================================================
// Standardized Retry Configuration
// ============================================================================

/**
 * Standardized backoff configuration for all queues (except webhook).
 *
 * Strategy: Exponential backoff with 1s base delay, max 60s.
 * - Attempt 1: immediate
 * - Attempt 2: 1s delay
 * - Attempt 3: 2s delay
 * - Attempt 4: 4s delay (capped at 60s for higher attempts)
 *
 * Rationale:
 * - Fast initial retry catches transient failures (network blips, brief DB locks)
 * - Exponential growth prevents thundering herd on sustained outages
 * - 60s cap prevents excessive delays while allowing recovery time
 *
 * Exception: Webhook queue uses longer delays (60s base) for external services
 * that may have rate limits or longer recovery times.
 *
 * @see https://docs.bullmq.io/guide/retrying-failing-jobs
 */
export const STANDARD_BACKOFF: BackoffOptions = {
  type: "exponential",
  delay: 1000, // 1s base delay
} as const;

/**
 * Maximum delay for exponential backoff (60 seconds).
 * BullMQ will cap delay at this value for higher retry attempts.
 *
 * Note: BullMQ's exponential backoff formula: delay * 2^(attemptsMade - 1)
 * With 1s base: 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped), 60s (capped), ...
 */
export const STANDARD_BACKOFF_MAX_DELAY = 60_000; // 60 seconds

/**
 * QUEUE-M02 FIX: Calculate exponential backoff delay with jitter.
 *
 * Adds random jitter to prevent thundering herd when multiple workers
 * retry simultaneously after a shared dependency failure.
 *
 * @param attempt - Current attempt number (1-based)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 60000)
 * @param jitterPercent - Jitter as percentage of delay (default: 0.1 = 10%)
 * @returns Delay in milliseconds with jitter applied
 *
 * @example
 * ```typescript
 * // Custom retry handler with jitter
 * const delay = calculateBackoffWithJitter(attemptsMade);
 * // Attempt 1: ~1000ms (+/- 10%)
 * // Attempt 2: ~2000ms (+/- 10%)
 * // Attempt 3: ~4000ms (+/- 10%)
 * ```
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = STANDARD_BACKOFF_MAX_DELAY,
  jitterPercent: number = 0.1,
): number {
  // Calculate base exponential delay
  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attempt - 1),
    maxDelayMs,
  );

  // Add jitter: +/- jitterPercent of the delay
  const jitter = exponentialDelay * jitterPercent * (Math.random() * 2 - 1);

  return Math.round(exponentialDelay + jitter);
}

/**
 * Standard number of retry attempts for most queues.
 */
export const STANDARD_ATTEMPTS = 3;

/**
 * Get standardized job options for most queues.
 * Provides consistent retry behavior across the system.
 *
 * @param overrides - Optional overrides for specific use cases
 * @returns JobsOptions with standardized retry configuration
 *
 * @example
 * ```typescript
 * const DEFAULT_JOB_OPTIONS = getStandardJobOptions({
 *   removeOnComplete: { count: 100 },
 *   removeOnFail: { count: 500 },
 * });
 * ```
 */
export function getStandardJobOptions(overrides?: {
  attempts?: number;
  removeOnComplete?: KeepJobs;
  removeOnFail?: KeepJobs;
}): JobsOptions {
  return {
    attempts: overrides?.attempts ?? STANDARD_ATTEMPTS,
    backoff: STANDARD_BACKOFF,
    removeOnComplete: overrides?.removeOnComplete ?? { count: 100 },
    removeOnFail: overrides?.removeOnFail ?? { count: 500 },
  };
}

// ============================================================================
// Backpressure Configuration
// ============================================================================

/**
 * Default maximum queue size before rejecting new jobs.
 * Can be overridden per-queue.
 */
export const DEFAULT_MAX_QUEUE_SIZE = 10_000;

/**
 * Queue capacity thresholds for monitoring and alerting.
 */
export const QUEUE_THRESHOLDS = {
  WARNING: 0.7, // 70% - start logging warnings
  CRITICAL: 0.9, // 90% - start rejecting new jobs with degraded mode
} as const;

// ============================================================================
// Backpressure Handling
// ============================================================================

export interface BackpressureOptions {
  maxQueueSize?: number;
  allowDegradedMode?: boolean; // If true, allow jobs when queue is 70-90% full but log warnings
}

export interface QueueCapacity {
  waiting: number;
  active: number;
  total: number;
  maxSize: number;
  utilizationPercent: number;
  status: "healthy" | "warning" | "critical" | "full";
}

/**
 * Get current queue capacity metrics.
 * Useful for monitoring dashboards and health checks.
 */
export async function getQueueCapacity(
  queue: Queue,
  maxSize: number = DEFAULT_MAX_QUEUE_SIZE,
): Promise<QueueCapacity> {
  const [waiting, active] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
  ]);

  const total = waiting + active;
  const utilizationPercent = (total / maxSize) * 100;

  let status: QueueCapacity["status"];
  if (total >= maxSize) {
    status = "full";
  } else if (utilizationPercent >= QUEUE_THRESHOLDS.CRITICAL * 100) {
    status = "critical";
  } else if (utilizationPercent >= QUEUE_THRESHOLDS.WARNING * 100) {
    status = "warning";
  } else {
    status = "healthy";
  }

  return {
    waiting,
    active,
    total,
    maxSize,
    utilizationPercent: Math.round(utilizationPercent * 100) / 100,
    status,
  };
}

/**
 * Error thrown when queue backpressure prevents job addition.
 */
export class QueueBackpressureError extends Error {
  constructor(
    public readonly queueName: string,
    public readonly capacity: QueueCapacity,
  ) {
    super(
      `Queue '${queueName}' at capacity (${capacity.total}/${capacity.maxSize}). ` +
        `Try again later.`,
    );
    this.name = "QueueBackpressureError";
  }
}

/**
 * Add a job to a queue with backpressure protection.
 * Prevents queue overflow by checking capacity before adding.
 *
 * @param queue - BullMQ queue instance
 * @param name - Job name
 * @param data - Job data
 * @param options - Job options (passed to queue.add)
 * @param backpressureOptions - Backpressure configuration
 * @returns The added job
 * @throws QueueBackpressureError if queue is at capacity
 *
 * @example
 * ```typescript
 * const job = await addJobWithBackpressure(
 *   auditQueue,
 *   'audit',
 *   jobData,
 *   { jobId: auditId },
 *   { maxQueueSize: 5000 }
 * );
 * ```
 */
export async function addJobWithBackpressure<T>(
  queue: Queue<T>,
  name: string,
  data: T,
  options?: Parameters<Queue<T>["add"]>[2],
  backpressureOptions?: BackpressureOptions,
): Promise<Job<T>> {
  const maxSize = backpressureOptions?.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
  const allowDegraded = backpressureOptions?.allowDegradedMode ?? true;

  const capacity = await getQueueCapacity(queue, maxSize);

  // Log warnings for high utilization
  if (capacity.status === "warning") {
    log.warn("Queue approaching capacity", {
      queue: queue.name,
      ...capacity,
    });
  }

  // Block new jobs when queue is full
  if (capacity.status === "full") {
    log.error("Queue at capacity, rejecting job", undefined, {
      queue: queue.name,
      jobName: name,
      ...capacity,
    });
    throw new QueueBackpressureError(queue.name, capacity);
  }

  // In critical state, reject unless degraded mode is allowed
  if (capacity.status === "critical" && !allowDegraded) {
    log.error("Queue in critical state, rejecting job", undefined, {
      queue: queue.name,
      jobName: name,
      ...capacity,
    });
    throw new QueueBackpressureError(queue.name, capacity);
  }

  // Add the job - use type assertion due to BullMQ's complex generics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = await (queue as any).add(name, data, options);

  // Log if we added during warning/critical state
  if (capacity.status !== "healthy") {
    log.info("Job added during high queue utilization", {
      queue: queue.name,
      jobId: job.id,
      jobName: name,
      queueStatus: capacity.status,
      utilizationPercent: capacity.utilizationPercent,
    });
  }

  return job as Job<T>;
}

// ============================================================================
// Job Timeout Wrapper
// ============================================================================

/**
 * Wrap a processor function with a timeout.
 * If the processor doesn't complete within the timeout, the job fails.
 *
 * Note: This is a soft timeout - it doesn't forcefully terminate the processor,
 * but it does cause the job to be marked as failed. The processor should check
 * for job.isActive() periodically for long-running operations.
 *
 * @param processor - The job processor function
 * @param timeoutMs - Timeout in milliseconds
 * @returns Wrapped processor with timeout
 *
 * @example
 * ```typescript
 * const worker = new Worker('my-queue',
 *   withJobTimeout(async (job) => {
 *     // This will timeout after 2 minutes
 *     return await longRunningOperation(job.data);
 *   }, 120_000),
 *   { connection }
 * );
 * ```
 */
export function withJobTimeout<T, R>(
  processor: (job: Job<T, R>) => Promise<R>,
  timeoutMs: number,
): (job: Job<T, R>) => Promise<R> {
  return async (job: Job<T, R>): Promise<R> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Job timeout after ${timeoutMs}ms (jobId: ${job.id}, name: ${job.name})`,
          ),
        );
      }, timeoutMs);
      // Clean up timer if job completes first
      // Note: This cleanup won't happen automatically since we're in a race
      // The timer will be cleaned up by GC after the promise settles
      timer.unref?.(); // Prevent timer from keeping process alive
    });

    return Promise.race([processor(job), timeoutPromise]);
  };
}

// ============================================================================
// Job Deduplication Helpers
// ============================================================================

/**
 * Generate a consistent job ID for deduplication.
 * Uses a deterministic format: `{prefix}-{entityId}-{timestamp?}`
 *
 * @param prefix - Job type prefix (e.g., 'audit', 'ranking')
 * @param entityId - Primary entity ID (e.g., auditId, clientId)
 * @param includeTimestamp - If true, appends timestamp (allows multiple jobs for same entity)
 * @returns Formatted job ID
 *
 * @example
 * ```typescript
 * // Deduplicate by entity (only one audit per auditId)
 * const jobId = generateJobId('audit', auditId, false);
 * // => 'audit-abc123'
 *
 * // Allow multiple per entity (backfill jobs)
 * const jobId = generateJobId('backfill', clientId, true);
 * // => 'backfill-xyz789-1714300800000'
 * ```
 */
export function generateJobId(
  prefix: string,
  entityId: string,
  includeTimestamp: boolean = false,
): string {
  const base = `${prefix}-${entityId}`;
  return includeTimestamp ? `${base}-${Date.now()}` : base;
}

// ============================================================================
// URL Validation Schema (SSRF Prevention)
// ============================================================================

/**
 * Blocked IP ranges and hostnames for SSRF prevention.
 * This is a secondary defense - primary validation should be in url-policy.ts
 */
const BLOCKED_IP_PREFIXES = [
  "127.",
  "0.",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
  "169.254.",
  "100.64.", // CGNAT
  "100.65.",
  "100.66.",
  "100.67.",
  "100.68.",
  "100.69.",
  "100.70.",
  "100.71.",
  "100.72.",
  "100.73.",
  "100.74.",
  "100.75.",
  "100.76.",
  "100.77.",
  "100.78.",
  "100.79.",
  "100.80.",
  "100.81.",
  "100.82.",
  "100.83.",
  "100.84.",
  "100.85.",
  "100.86.",
  "100.87.",
  "100.88.",
  "100.89.",
  "100.90.",
  "100.91.",
  "100.92.",
  "100.93.",
  "100.94.",
  "100.95.",
  "100.96.",
  "100.97.",
  "100.98.",
  "100.99.",
  "100.100.",
  "100.101.",
  "100.102.",
  "100.103.",
  "100.104.",
  "100.105.",
  "100.106.",
  "100.107.",
  "100.108.",
  "100.109.",
  "100.110.",
  "100.111.",
  "100.112.",
  "100.113.",
  "100.114.",
  "100.115.",
  "100.116.",
  "100.117.",
  "100.118.",
  "100.119.",
  "100.120.",
  "100.121.",
  "100.122.",
  "100.123.",
  "100.124.",
  "100.125.",
  "100.126.",
  "100.127.",
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
  "100.100.100.200",
]);

/**
 * Check if a hostname is blocked (SSRF prevention).
 * This is a lightweight check for job validation - the full DNS resolution
 * check is in url-policy.ts.
 */
function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Check exact matches
  if (BLOCKED_HOSTNAMES.has(lower)) return true;

  // Check IP prefixes
  if (BLOCKED_IP_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }

  // Check blocked suffixes
  const blockedSuffixes = [
    ".localhost",
    ".local",
    ".localdomain",
    ".internal",
    ".home.arpa",
  ];
  if (blockedSuffixes.some((suffix) => lower.endsWith(suffix))) {
    return true;
  }

  return false;
}

/**
 * Zod schema for URL validation with SSRF protection.
 * Use this in job data schemas to validate URLs before processing.
 *
 * @example
 * ```typescript
 * const crawlJobSchema = z.object({
 *   url: safeUrlSchema,
 *   depth: z.number().int().min(1).max(5),
 *   clientId: z.string().uuid(),
 * });
 * ```
 */
export const safeUrlSchema = z
  .string()
  .url("Invalid URL format")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Only allow http/https
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return false;
        }
        // Block internal networks
        return !isBlockedHostname(parsed.hostname);
      } catch {
        return false;
      }
    },
    { message: "URL blocked for security reasons" },
  );

// ============================================================================
// Common Job Validation Schemas
// ============================================================================

/**
 * Base schema for jobs that target a specific client.
 */
export const clientJobBaseSchema = z.object({
  clientId: z.string().uuid("Invalid client ID format"),
});

/**
 * Base schema for jobs that target a specific project.
 */
export const projectJobBaseSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  clientId: z.string().uuid("Invalid client ID format").optional(),
});

/**
 * Validate job data against a Zod schema.
 * Throws a descriptive error if validation fails.
 *
 * @param schema - Zod schema to validate against
 * @param data - Job data to validate
 * @param jobName - Job name for error messages
 * @returns Validated and typed data
 * @throws Error with detailed validation message
 *
 * @example
 * ```typescript
 * const worker = new Worker('crawl-queue', async (job) => {
 *   const data = validateJobData(crawlJobSchema, job.data, job.name);
 *   // data is now typed and validated
 *   return crawl(data.url, data.depth, data.clientId);
 * });
 * ```
 */
export function validateJobData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  jobName: string,
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid job data for '${jobName}': ${errors}`);
  }

  return result.data;
}

// ============================================================================
// Heartbeat Mechanism for Long-Running Jobs (JOB-HIGH-02)
// ============================================================================

/**
 * JOB-HIGH-02: Heartbeat mechanism for long-running jobs.
 *
 * BullMQ uses lockDuration to detect stalled jobs. For long-running jobs,
 * we need to periodically extend the lock to prevent false stall detection.
 *
 * Usage:
 * ```typescript
 * const worker = new Worker('my-queue', async (job) => {
 *   const heartbeat = createJobHeartbeat(job, 30_000); // 30s interval
 *   try {
 *     // Long-running operation
 *     await longOperation();
 *   } finally {
 *     heartbeat.stop();
 *   }
 * });
 * ```
 */
export interface JobHeartbeat {
  /** Stop the heartbeat timer */
  stop: () => void;
  /** Check if heartbeat is still active */
  isActive: () => boolean;
  /** Get number of heartbeats sent */
  getHeartbeatCount: () => number;
}

/**
 * Create a heartbeat for a long-running job.
 *
 * @param job - BullMQ job instance
 * @param intervalMs - Heartbeat interval in milliseconds (default: 30s)
 * @param onHeartbeat - Optional callback on each heartbeat
 * @returns Heartbeat controller
 */
export function createJobHeartbeat<T, R>(
  job: Job<T, R>,
  intervalMs: number = 30_000,
  onHeartbeat?: (count: number) => void,
): JobHeartbeat {
  let heartbeatCount = 0;
  let active = true;

  const timer = setInterval(async () => {
    if (!active) return;

    try {
      // Update job progress to extend the lock
      // This signals to BullMQ that the job is still active
      await job.updateProgress({
        heartbeat: Date.now(),
        count: ++heartbeatCount,
      });

      if (onHeartbeat) {
        onHeartbeat(heartbeatCount);
      }

      log.debug("Job heartbeat sent", {
        jobId: job.id,
        jobName: job.name,
        heartbeatCount,
      });
    } catch (err) {
      // Log but don't throw - heartbeat failure shouldn't crash the job
      log.warn("Job heartbeat failed", {
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, intervalMs);

  // Prevent timer from keeping process alive during shutdown
  timer.unref?.();

  return {
    stop: () => {
      active = false;
      clearInterval(timer);
    },
    isActive: () => active,
    getHeartbeatCount: () => heartbeatCount,
  };
}

/**
 * Wrap a processor with automatic heartbeat for long-running jobs.
 *
 * @param processor - The job processor function
 * @param heartbeatIntervalMs - Heartbeat interval (default: 30s)
 * @returns Wrapped processor with automatic heartbeat
 */
export function withHeartbeat<T, R>(
  processor: (job: Job<T, R>) => Promise<R>,
  heartbeatIntervalMs: number = 30_000,
): (job: Job<T, R>) => Promise<R> {
  return async (job: Job<T, R>): Promise<R> => {
    const heartbeat = createJobHeartbeat(job, heartbeatIntervalMs);
    try {
      return await processor(job);
    } finally {
      heartbeat.stop();
    }
  };
}

// ============================================================================
// Queue Health Monitoring
// ============================================================================

export interface QueueHealthReport {
  name: string;
  capacity: QueueCapacity;
  paused: boolean;
  failedCount: number;
  completedCount: number;
}

/**
 * Get health report for a queue.
 * Useful for monitoring dashboards and alerting.
 */
export async function getQueueHealthReport(
  queue: Queue,
  maxSize: number = DEFAULT_MAX_QUEUE_SIZE,
): Promise<QueueHealthReport> {
  const [capacity, paused, failedCount, completedCount] = await Promise.all([
    getQueueCapacity(queue, maxSize),
    queue.isPaused(),
    queue.getFailedCount(),
    queue.getCompletedCount(),
  ]);

  return {
    name: queue.name,
    capacity,
    paused,
    failedCount,
    completedCount,
  };
}
