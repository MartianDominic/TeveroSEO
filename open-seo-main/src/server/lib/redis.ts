/**
 * Redis client singleton for caching and BullMQ connection pooling.
 *
 * Used by:
 * - SERP cache (24h TTL)
 * - Keyword enrichment cache (7-day TTL)
 * - Embedding cache
 * - BullMQ workers and queues (shared connections)
 *
 * QUEUE-C01 FIX: Service-specific Redis namespace isolation
 * - open-seo-main uses DB 0 (default) with "openseo:" key prefix
 * - AI-Writer uses DB 1 with "aiwriter:" key prefix
 * - This prevents cross-service queue namespace collisions
 *
 * QUEUE-H04 FIX: Circuit breaker pattern for Redis failures
 * - Tracks consecutive failures to prevent retry storms
 * - Opens circuit after threshold failures, allows recovery after cooldown
 */

import Redis from "ioredis";

// =============================================================================
// Service Namespace Configuration (QUEUE-C01)
// =============================================================================

/**
 * Service identifier for Redis key prefixing.
 * All keys and queue names are prefixed with this to prevent collisions.
 */
export const REDIS_SERVICE_PREFIX = "openseo:" as const;

/**
 * Redis database number for this service.
 * open-seo-main: DB 0, AI-Writer: DB 1, Scheduler: DB 2
 */
export const REDIS_SERVICE_DB = parseInt(process.env.REDIS_DB ?? "0", 10);

// =============================================================================
// Circuit Breaker (QUEUE-H04)
// =============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  openedAt: number;
}

const CIRCUIT_BREAKER_THRESHOLD = parseInt(process.env.REDIS_CIRCUIT_BREAKER_THRESHOLD ?? "5", 10);
const CIRCUIT_BREAKER_COOLDOWN_MS = parseInt(process.env.REDIS_CIRCUIT_BREAKER_COOLDOWN_MS ?? "30000", 10);

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  openedAt: 0,
};

/**
 * Record a Redis failure and potentially open the circuit.
 */
export function recordRedisFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD && !circuitBreaker.isOpen) {
    circuitBreaker.isOpen = true;
    circuitBreaker.openedAt = Date.now();
    console.error(
      `[Redis:CircuitBreaker] OPEN - ${circuitBreaker.failures} consecutive failures. ` +
        `Blocking new requests for ${CIRCUIT_BREAKER_COOLDOWN_MS}ms`
    );
  }
}

/**
 * Record a Redis success and reset the circuit breaker.
 */
export function recordRedisSuccess(): void {
  if (circuitBreaker.failures > 0 || circuitBreaker.isOpen) {
    if (circuitBreaker.isOpen) {
      console.log("[Redis:CircuitBreaker] CLOSED - Connection recovered");
    }
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
    circuitBreaker.openedAt = 0;
  }
}

/**
 * Check if the circuit breaker is allowing requests.
 * Returns true if requests should be allowed, false if circuit is open.
 */
export function isCircuitBreakerClosed(): boolean {
  if (!circuitBreaker.isOpen) {
    return true;
  }

  // Check if cooldown period has elapsed
  const elapsed = Date.now() - circuitBreaker.openedAt;
  if (elapsed >= CIRCUIT_BREAKER_COOLDOWN_MS) {
    // Allow a single test request (half-open state)
    console.log("[Redis:CircuitBreaker] HALF-OPEN - Testing connection...");
    return true;
  }

  return false;
}

/**
 * Get current circuit breaker status for monitoring.
 */
export function getCircuitBreakerStatus(): {
  isOpen: boolean;
  failures: number;
  remainingCooldownMs: number;
} {
  const remainingCooldownMs = circuitBreaker.isOpen
    ? Math.max(0, CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - circuitBreaker.openedAt))
    : 0;

  return {
    isOpen: circuitBreaker.isOpen,
    failures: circuitBreaker.failures,
    remainingCooldownMs,
  };
}

/**
 * Get Redis URL from environment with validation.
 * In production, REDIS_URL is required. In development, falls back to localhost.
 *
 * QUEUE-C01 FIX: Appends service-specific DB number to URL.
 */
function getRedisUrl(): string {
  let url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "REDIS_URL environment variable is required in production — set it in .env or the deployment environment.",
      );
    }
    console.warn(
      "[Redis] REDIS_URL not set, falling back to redis://localhost:6379 (development only)",
    );
    url = "redis://localhost:6379";
  }

  // QUEUE-C01: Ensure service-specific DB is used
  // Parse and reconstruct URL with correct DB if not already specified
  try {
    const parsed = new URL(url);
    // Check if DB is already in pathname (e.g., /0, /1)
    if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = `/${REDIS_SERVICE_DB}`;
      url = parsed.toString();
      console.log(`[Redis] Using service-specific DB ${REDIS_SERVICE_DB}`);
    }
  } catch {
    // URL parsing failed, append DB directly
    if (!url.match(/\/\d+$/)) {
      url = `${url}/${REDIS_SERVICE_DB}`;
    }
  }

  return url;
}

const REDIS_URL = getRedisUrl();

// QUEUE-M02 FIX: Standardized exponential backoff with jitter
// QUEUE-H04 FIX: Circuit breaker integration to prevent retry storms
// Create singleton Redis client for caching
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // QUEUE-H04: Check circuit breaker before retrying
    if (!isCircuitBreakerClosed()) {
      console.error(`[Redis] Circuit breaker OPEN, skipping retry attempt ${times}`);
      return null; // Stop retrying while circuit is open
    }

    // QUEUE-M02: Standardized exponential backoff with jitter
    // Base delay: 200ms, max delay: 10s, jitter: +/- 10%
    const baseDelay = 200;
    const maxDelay = 10000;
    const effectiveTimes = Math.min(times, 10); // Cap exponential growth

    if (times > 50) {
      // After extended failures, log and continue with max delay
      console.error(`[Redis] Extended reconnection attempts (${times}), continuing with 30s delay`);
      recordRedisFailure();
      return 30000;
    }

    // Exponential backoff with jitter to prevent thundering herd
    const exponentialDelay = Math.min(Math.pow(2, effectiveTimes - 1) * baseDelay, maxDelay);
    const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1); // +/- 10%
    const delay = Math.round(exponentialDelay + jitter);

    console.log(`[Redis] Reconnection attempt ${times}, next retry in ${delay}ms`);
    recordRedisFailure();
    return delay;
  },
});

// Handle connection errors gracefully
redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
  recordRedisFailure();
});

redis.on("connect", () => {
  console.log("Redis connected");
  recordRedisSuccess();
});

redis.on("ready", () => {
  recordRedisSuccess();
});

// ============================================================================
// Health Check & Startup Validation
// ============================================================================

/**
 * Validate Redis connection at startup.
 * Call this before starting the HTTP server to fail fast if Redis is unavailable.
 *
 * @throws Error if Redis is not reachable within the timeout
 */
export async function validateRedisConnection(timeoutMs: number = 5000): Promise<void> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Redis connection timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    await Promise.race([redis.ping(), timeoutPromise]);
    console.log("[Redis] Connection validated successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Redis unavailable at startup: ${message}. Ensure Redis is running and REDIS_URL is correct.`);
  }
}

/**
 * Check Redis health without throwing.
 * Useful for health check endpoints.
 *
 * @returns Object with status, latencyMs, and optional error
 */
export async function checkRedisHealth(): Promise<{
  status: "healthy" | "unhealthy";
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await redis.ping();
    return {
      status: "healthy",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// BullMQ Connection Pooling
// ============================================================================

/**
 * Connection pool for BullMQ workers and queues.
 * Each label gets a dedicated connection to prevent connection leaks.
 *
 * TOCTOU Race Prevention:
 * ioredis creates Redis objects synchronously (TCP connection happens async).
 * We use a single synchronous check-and-set operation to prevent duplicates.
 * The Map.get() + Map.set() pattern is atomic within a single JS event loop tick.
 */
const bullmqConnections = new Map<string, Redis>();

/**
 * Create a new BullMQ-optimized Redis connection.
 * Internal helper - use getSharedBullMQConnection() instead.
 */
function createBullMQConnection(label: string): Redis {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ blocking commands
    enableReadyCheck: false, // Faster connection for BullMQ
    retryStrategy: (times: number) => {
      if (times > 10) {
        console.error(`[Redis:${label}] Max retries exceeded`);
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  connection.on("error", (err) => {
    console.error(`[Redis:${label}] Connection error:`, err.message);
  });

  connection.on("ready", () => {
    console.log(`[Redis:${label}] Connected`);
  });

  connection.on("close", () => {
    console.log(`[Redis:${label}] Connection closed`);
    // Remove from pool when connection closes to allow recreation
    bullmqConnections.delete(label);
  });

  // Also handle 'end' event for when connection is fully terminated
  connection.on("end", () => {
    console.log(`[Redis:${label}] Connection ended`);
    bullmqConnections.delete(label);
  });

  return connection;
}

/**
 * Get or create a shared Redis connection for BullMQ workers.
 * Uses synchronous check-and-set within single event loop tick to prevent TOCTOU race.
 *
 * BullMQ requires specific Redis settings:
 * - maxRetriesPerRequest: null (required for blocking commands)
 * - enableReadyCheck: false (faster connection)
 *
 * @param label - Unique identifier for the connection (e.g., 'worker:audit', 'queue:ranking')
 * @returns Shared Redis connection for the given label
 */
export function getSharedBullMQConnection(label: string): Redis {
  // Return existing connection if available and ready
  const existing = bullmqConnections.get(label);
  if (existing) {
    // Check if connection is still alive
    if (existing.status === "ready" || existing.status === "connecting") {
      return existing;
    }
    // Connection ended - remove stale entry and create new
    // This deletion + creation happens in the same event loop tick (atomic)
    bullmqConnections.delete(label);
    console.log(`[Redis:${label}] Removed stale connection (status: ${existing.status})`);
  }

  // Create new connection and store atomically in same tick
  // No await means no yield to event loop, preventing TOCTOU race
  const connection = createBullMQConnection(label);
  bullmqConnections.set(label, connection);
  return connection;
}

/**
 * Close all Redis connections gracefully.
 * Call this during application shutdown.
 *
 * Closes:
 * - All BullMQ worker/queue connections
 * - Main caching Redis connection
 */
export async function closeRedis(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  // Close BullMQ connections
  Array.from(bullmqConnections.entries()).forEach(([label, connection]) => {
    if (connection.status !== "end") {
      closePromises.push(
        connection
          .quit()
          .then(() => console.log(`[Redis:${label}] Closed`))
          .catch((err) =>
            console.error(`[Redis:${label}] Close error:`, err.message)
          )
      );
    }
  });

  // Close main redis connection if it exists and is not already closed
  if (redis && redis.status !== "end") {
    closePromises.push(
      redis
        .quit()
        .then(() => console.log("[Redis:main] Closed"))
        .catch((err) => console.error("[Redis:main] Close error:", err.message))
    );
  }

  await Promise.all(closePromises);
  bullmqConnections.clear();
}

/**
 * Get the number of active BullMQ connections.
 * Useful for monitoring and debugging.
 */
export function getBullMQConnectionCount(): number {
  return bullmqConnections.size;
}

/**
 * Get labels of all active BullMQ connections.
 * Useful for monitoring and debugging.
 */
export function getBullMQConnectionLabels(): string[] {
  return Array.from(bullmqConnections.keys());
}

// =============================================================================
// Global Concurrency Configuration (QUEUE-H02)
// =============================================================================

/**
 * QUEUE-H02 FIX: Global worker concurrency configuration.
 *
 * Total concurrency across all workers should not exceed DB connection pool max.
 * Default PostgreSQL max_connections is typically 100, with some reserved for admin.
 *
 * Worker concurrency allocations (total: 50, leaving headroom for API server):
 * - Audit: 5
 * - Report: 3
 * - Schedule: 2
 * - Ranking: 3
 * - Alert: 3
 * - Dashboard metrics: 2
 * - Prospect analysis: 3
 * - Voice analysis: 2
 * - Analytics: 3
 * - Webhook: 5
 * - Portfolio aggregates: 2
 * - Goal: 2
 * - Auto-revert: 1
 * - Phase: 3
 * - Plan: 3
 * - Onboarding: 2
 * - Maintenance: 1
 * - DLQ: 5
 * - Failed audits: 2
 */
export const WORKER_CONCURRENCY_LIMITS = {
  audit: parseInt(process.env.WORKER_CONCURRENCY_AUDIT ?? "5", 10),
  report: parseInt(process.env.WORKER_CONCURRENCY_REPORT ?? "3", 10),
  schedule: parseInt(process.env.WORKER_CONCURRENCY_SCHEDULE ?? "2", 10),
  ranking: parseInt(process.env.WORKER_CONCURRENCY_RANKING ?? "3", 10),
  alert: parseInt(process.env.WORKER_CONCURRENCY_ALERT ?? "3", 10),
  dashboardMetrics: parseInt(process.env.WORKER_CONCURRENCY_DASHBOARD_METRICS ?? "2", 10),
  prospectAnalysis: parseInt(process.env.WORKER_CONCURRENCY_PROSPECT_ANALYSIS ?? "3", 10),
  voiceAnalysis: parseInt(process.env.WORKER_CONCURRENCY_VOICE_ANALYSIS ?? "2", 10),
  analytics: parseInt(process.env.WORKER_CONCURRENCY_ANALYTICS ?? "3", 10),
  webhook: parseInt(process.env.WORKER_CONCURRENCY_WEBHOOK ?? "5", 10),
  portfolioAggregates: parseInt(process.env.WORKER_CONCURRENCY_PORTFOLIO_AGGREGATES ?? "2", 10),
  goal: parseInt(process.env.WORKER_CONCURRENCY_GOAL ?? "2", 10),
  autoRevert: parseInt(process.env.WORKER_CONCURRENCY_AUTO_REVERT ?? "1", 10),
  phase: parseInt(process.env.WORKER_CONCURRENCY_PHASE ?? "3", 10),
  plan: parseInt(process.env.WORKER_CONCURRENCY_PLAN ?? "3", 10),
  onboarding: parseInt(process.env.WORKER_CONCURRENCY_ONBOARDING ?? "2", 10),
  maintenance: parseInt(process.env.WORKER_CONCURRENCY_MAINTENANCE ?? "1", 10),
  dlq: parseInt(process.env.WORKER_CONCURRENCY_DLQ ?? "5", 10),
  failedAudits: parseInt(process.env.WORKER_CONCURRENCY_FAILED_AUDITS ?? "2", 10),
} as const;

/**
 * Get total configured worker concurrency.
 * Useful for capacity planning and monitoring.
 */
export function getTotalWorkerConcurrency(): number {
  return Object.values(WORKER_CONCURRENCY_LIMITS).reduce((sum, val) => sum + val, 0);
}

// =============================================================================
// Cross-Service Idempotency Keys (QUEUE-M01)
// =============================================================================

/**
 * QUEUE-M01 FIX: Shared idempotency key namespace.
 *
 * Both services use the same Redis key pattern for idempotency keys,
 * enabling cross-service visibility of in-progress operations.
 */
export const IDEMPOTENCY_KEY_PREFIX = "tevero:idempotency:" as const;
export const IDEMPOTENCY_TTL_SECONDS = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS ?? "3600", 10);

/**
 * Set an idempotency key with TTL.
 * Returns true if key was set (operation should proceed),
 * false if key already exists (duplicate operation).
 */
export async function setIdempotencyKey(
  operationId: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const key = `${IDEMPOTENCY_KEY_PREFIX}${operationId}`;
  const value = JSON.stringify({
    service: "open-seo-main",
    timestamp: new Date().toISOString(),
    ...metadata,
  });

  // SET with NX (only if not exists) and EX (TTL in seconds)
  const result = await redis.set(key, value, "EX", IDEMPOTENCY_TTL_SECONDS, "NX");
  return result === "OK";
}

/**
 * Check if an idempotency key exists.
 */
export async function hasIdempotencyKey(operationId: string): Promise<boolean> {
  const key = `${IDEMPOTENCY_KEY_PREFIX}${operationId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Remove an idempotency key (when operation completes or fails permanently).
 */
export async function removeIdempotencyKey(operationId: string): Promise<void> {
  const key = `${IDEMPOTENCY_KEY_PREFIX}${operationId}`;
  await redis.del(key);
}

// =============================================================================
// DRR Fair Queuing Integration (73-01)
// =============================================================================

import { Queue, type Job, type JobsOptions } from "bullmq";
import { DRRQueueManager } from "./queue/drr-queue";
import { nanoid } from "nanoid";

/**
 * Singleton DRR queue manager for multi-tenant fair scheduling.
 *
 * Per docs/infra-research/crawling-10-5000-tasks-day.md:
 * > Fair queuing across `client_id` buckets uses Deficit Round Robin
 *
 * Initialized lazily on first use to ensure Redis connection is ready.
 */
let drrManager: DRRQueueManager | null = null;

/**
 * Get or create the singleton DRR queue manager.
 *
 * @returns DRRQueueManager instance
 */
export function getDRRManager(): DRRQueueManager {
  if (!drrManager) {
    drrManager = new DRRQueueManager(redis, {
      quantum: parseInt(process.env.DRR_QUANTUM ?? "100", 10),
      maxDeficit: parseInt(process.env.DRR_MAX_DEFICIT ?? "1000", 10),
      heavyClientThreshold: parseFloat(process.env.DRR_HEAVY_CLIENT_THRESHOLD ?? "0.3"),
    });
  }
  return drrManager;
}

/**
 * Job data interface for DRR-enabled queues.
 * All jobs must include clientId for fair scheduling.
 */
export interface DRRJobData {
  clientId: string;
  [key: string]: unknown;
}

/**
 * Result of enqueueWithFairness operation.
 */
export interface EnqueueResult<T> {
  job: Job<T>;
  drrJobId: string;
}

/**
 * Enqueue a job with DRR fair scheduling.
 *
 * Before adding to BullMQ, registers the job with the DRR manager
 * to enable fair dequeue ordering across clients.
 *
 * @param queue - BullMQ queue to add job to
 * @param jobName - Name of the job (for BullMQ)
 * @param jobData - Job data including required clientId
 * @param opts - Optional BullMQ job options
 * @returns EnqueueResult with BullMQ job and DRR job ID
 */
export async function enqueueWithFairness<T extends DRRJobData>(
  queue: Queue<T>,
  jobName: string,
  jobData: T,
  opts?: JobsOptions
): Promise<EnqueueResult<T>> {
  if (!jobData.clientId) {
    throw new Error("clientId is required for fair queuing");
  }

  const drr = getDRRManager();
  const drrJobId = nanoid();

  // Register with DRR for fair scheduling
  await drr.registerJob(jobData.clientId, drrJobId);

  // Add to BullMQ queue
  // BullMQ Queue.add() has complex generics for job names; using type assertion
  // since we accept any string job name
  const job = await (queue.add as (name: string, data: T, opts?: JobsOptions) => Promise<Job<T>>)(
    jobName,
    jobData,
    opts
  );

  return { job, drrJobId };
}

/**
 * Check and enforce heavy client limits.
 *
 * Call periodically (e.g., via cron job) to auto-reduce weight
 * for clients exceeding the daily volume threshold.
 *
 * @returns Array of client IDs that had their weight reduced
 */
export async function enforceHeavyClientLimits(): Promise<string[]> {
  const drr = getDRRManager();
  return drr.enforceHeavyClientLimits();
}

/**
 * Get DRR queue statistics for monitoring.
 *
 * @returns DRRStats with bucket counts and pending jobs
 */
export function getDRRStats() {
  const drr = getDRRManager();
  return drr.getStats();
}
