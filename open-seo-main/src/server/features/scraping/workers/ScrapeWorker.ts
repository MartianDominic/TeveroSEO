/**
 * Scrape Worker - Main Worker Process.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Integrates:
 * - Global concurrency limiter (200 concurrent max)
 * - Per-domain rate limiter (2 req/sec)
 * - Adaptive backoff for 429/503 responses
 * - TieredFetcher for cost-optimized fetching
 */

import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection, redis } from "@/server/lib/redis";
import type { ScrapeJobData, ScrapeJobResult, ScrapeErrorCode, ScrapeQueueName } from "../queue/queue.types";
import { SCRAPE_QUEUE_NAMES, QUEUE_CONFIG } from "../queue/queue.types";
import { getRetryPolicy, shouldEscalateTier, isPermanentError, calculateDelay } from "../queue/retry.config";
import { RateLimiter, RateLimitExceededError } from "../ratelimit/RateLimiter";
import { AdaptiveBackoff } from "../ratelimit/AdaptiveBackoff";
import { GlobalConcurrencyLimiter } from "../ratelimit/GlobalConcurrencyLimiter";
import type { TieredFetchRequest, TieredFetchResult } from "../types";

/**
 * Worker configuration.
 */
export interface ScrapeWorkerConfig {
  /** Global max concurrent requests */
  maxGlobalConcurrency: number;

  /** Per-domain rate limit (requests per second) */
  domainRateLimit: number;

  /** Max wait time for rate limit in ms */
  maxRateLimitWait: number;

  /** Enable adaptive backoff */
  enableAdaptiveBackoff: boolean;
}

/**
 * Default worker configuration.
 */
const DEFAULT_CONFIG: ScrapeWorkerConfig = {
  maxGlobalConcurrency: 200,
  domainRateLimit: 2,
  maxRateLimitWait: 30_000,
  enableAdaptiveBackoff: true,
};

/**
 * HTTP error for type checking in catch blocks.
 */
interface HTTPError extends Error {
  statusCode: number;
}

/**
 * Check if error is an HTTP error with status code.
 */
function isHTTPError(error: unknown): error is HTTPError {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as HTTPError).statusCode === "number"
  );
}

/**
 * Map error to ScrapeErrorCode.
 */
function mapErrorCode(error: unknown): ScrapeErrorCode {
  if (isHTTPError(error)) {
    const status = error.statusCode;
    if (status === 429) return "RATE_LIMITED";
    if (status === 403) return "BLOCKED";
    if (status >= 500) return "TIMEOUT"; // Treat server errors as potentially transient
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("timeout")) return "TIMEOUT";
  if (message.includes("dns")) return "DNS_FAILURE";
  if (message.includes("econnrefused") || message.includes("connection refused"))
    return "CONNECTION_REFUSED";
  if (message.includes("ssl") || message.includes("certificate")) return "SSL_ERROR";
  if (message.includes("captcha")) return "CAPTCHA";
  if (message.includes("bot") || message.includes("cloudflare")) return "BOT_DETECTION";
  if (message.includes("parse")) return "PARSE_ERROR";
  if (message.includes("invalid url")) return "INVALID_URL";

  return "UNKNOWN";
}

/**
 * Create a scrape worker for a specific queue.
 *
 * @param queueName - Queue to process
 * @param tieredFetcher - Fetcher service (injected for testability)
 * @param config - Worker configuration
 * @returns BullMQ Worker instance
 */
export function createScrapeWorker(
  queueName: ScrapeQueueName,
  tieredFetcher: { fetch: (request: TieredFetchRequest) => Promise<TieredFetchResult> },
  config: Partial<ScrapeWorkerConfig> = {}
): Worker<ScrapeJobData, ScrapeJobResult> {
  const workerConfig = { ...DEFAULT_CONFIG, ...config };
  const queueConfig = QUEUE_CONFIG[queueName];

  // Initialize limiters with the Redis client
  const globalLimiter = new GlobalConcurrencyLimiter(redis, {
    maxConcurrent: workerConfig.maxGlobalConcurrency,
  });

  const rateLimiter = new RateLimiter(redis, {
    requestsPerWindow: workerConfig.domainRateLimit,
    windowMs: 1000,
    maxWaitMs: workerConfig.maxRateLimitWait,
    enableAdaptiveBackoff: workerConfig.enableAdaptiveBackoff,
  });

  const adaptiveBackoff = new AdaptiveBackoff(redis);

  const worker = new Worker<ScrapeJobData, ScrapeJobResult>(
    queueName,
    async (job: Job<ScrapeJobData, ScrapeJobResult>) => {
      const startTime = Date.now();
      const requestId = job.data.jobId;

      // Report initial progress
      await job.updateProgress(10);

      // Acquire global concurrency slot
      const acquireResult = await globalLimiter.acquire(requestId, 60_000);
      if (!acquireResult.acquired) {
        throw new Error(
          `Failed to acquire concurrency slot after ${acquireResult.waitedMs}ms`
        );
      }

      await job.updateProgress(20);

      try {
        // Check adaptive backoff before proceeding
        if (workerConfig.enableAdaptiveBackoff) {
          const remainingBackoff = await adaptiveBackoff.getRemainingBackoffMs(
            job.data.domain
          );
          if (remainingBackoff > 0) {
            // Wait for backoff to expire (up to a reasonable limit)
            const waitTime = Math.min(remainingBackoff, 30_000);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }

        await job.updateProgress(30);

        // Acquire per-domain rate limit
        try {
          await rateLimiter.acquire(job.data.domain);
        } catch (error) {
          if (error instanceof RateLimitExceededError) {
            return {
              success: false,
              url: job.data.url,
              error: `Rate limit exceeded for ${job.data.domain}`,
              errorCode: "RATE_LIMITED" as ScrapeErrorCode,
              tierUsed: job.data.options.forceTier ?? "direct",
              fromCache: false,
              processingTimeMs: Date.now() - startTime,
              estimatedCost: 0,
            };
          }
          throw error;
        }

        await job.updateProgress(50);

        // Perform fetch using TieredFetcher
        const fetchRequest: TieredFetchRequest = {
          url: job.data.url,
          startTier: job.data.options.forceTier,
          skipCache: job.data.options.skipCache,
          timeoutMs: job.data.options.timeoutMs,
          jobId: job.data.jobId,
          clientId: job.data.clientId,
        };

        const result = await tieredFetcher.fetch(fetchRequest);

        await job.updateProgress(90);

        // Record success for adaptive backoff
        if (result.success && workerConfig.enableAdaptiveBackoff) {
          await adaptiveBackoff.recordSuccess(job.data.domain);
        }

        await job.updateProgress(100);

        return {
          success: result.success,
          url: job.data.url,
          fetchResult: job.data.options.includeHtml ? result : {
            ...result,
            html: undefined, // Strip HTML unless requested
          },
          tierUsed: result.tier,
          fromCache: false, // TieredFetcher would indicate this
          processingTimeMs: Date.now() - startTime,
          estimatedCost: result.costUsd,
        };
      } catch (error) {
        const errorCode = mapErrorCode(error);

        // Record failure for adaptive backoff
        if (workerConfig.enableAdaptiveBackoff) {
          const statusCode = isHTTPError(error) ? error.statusCode : 500;
          await adaptiveBackoff.recordFailure(job.data.domain, statusCode);
        }

        // Determine if we should retry or escalate
        const retryPolicy = getRetryPolicy(errorCode);
        const shouldRetry =
          !isPermanentError(errorCode) && job.attemptsMade < retryPolicy.attempts;

        if (shouldRetry) {
          // Calculate delay for next attempt
          const delay = calculateDelay(
            job.attemptsMade + 1,
            retryPolicy.backoff.delay,
            retryPolicy.backoff.type
          );

          // Move to delayed state
          await job.moveToDelayed(Date.now() + delay, job.token);
        }

        // If error should trigger tier escalation, update job data
        if (shouldEscalateTier(errorCode)) {
          // The next retry will use a higher tier
          // This is handled by TieredFetcher's domain learning
          console.log(
            `[ScrapeWorker] Tier escalation triggered for ${job.data.domain}: ${errorCode}`
          );
        }

        return {
          success: false,
          url: job.data.url,
          error: error instanceof Error ? error.message : String(error),
          errorCode,
          tierUsed: job.data.options.forceTier ?? "direct",
          fromCache: false,
          processingTimeMs: Date.now() - startTime,
          estimatedCost: 0,
        };
      } finally {
        // Always release global slot
        await globalLimiter.release(requestId);
      }
    },
    {
      connection: getSharedBullMQConnection(`worker:${queueName}`),
      concurrency: queueConfig.concurrency,
      stalledInterval: queueConfig.stalledInterval,
      lockDuration: queueConfig.lockDuration,
    }
  );

  // Event handlers for monitoring
  worker.on("completed", (job) => {
    console.log(
      `[${queueName}] Job ${job.id} completed: ${job.data.url} (${job.returnvalue?.processingTimeMs}ms)`
    );
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[${queueName}] Job ${job?.id} failed: ${job?.data.url} - ${error.message}`
    );
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[${queueName}] Job ${jobId} stalled`);
  });

  return worker;
}

/**
 * Create all three scrape workers.
 *
 * @param tieredFetcher - Fetcher service
 * @param config - Shared worker configuration
 * @returns Object with all three workers
 */
export function createAllScrapeWorkers(
  tieredFetcher: { fetch: (request: TieredFetchRequest) => Promise<TieredFetchResult> },
  config: Partial<ScrapeWorkerConfig> = {}
): {
  priorityWorker: Worker<ScrapeJobData, ScrapeJobResult>;
  standardWorker: Worker<ScrapeJobData, ScrapeJobResult>;
  backgroundWorker: Worker<ScrapeJobData, ScrapeJobResult>;
} {
  return {
    priorityWorker: createScrapeWorker(SCRAPE_QUEUE_NAMES.PRIORITY, tieredFetcher, config),
    standardWorker: createScrapeWorker(SCRAPE_QUEUE_NAMES.STANDARD, tieredFetcher, config),
    backgroundWorker: createScrapeWorker(SCRAPE_QUEUE_NAMES.BACKGROUND, tieredFetcher, config),
  };
}
