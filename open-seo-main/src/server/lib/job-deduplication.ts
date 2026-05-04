/**
 * Job Deduplication via Redis Distributed Locks
 *
 * Plan 69-04 Task 3: Prevents duplicate job execution across workers.
 *
 * Uses Redis SET NX EX for atomic lock acquisition:
 * - NX: Only set if key doesn't exist (atomic check-and-set)
 * - EX: Set TTL to auto-expire (prevents deadlocks if worker crashes)
 *
 * Lock ownership is verified via unique lock IDs (UUID) to ensure:
 * - Only the lock holder can release the lock
 * - Safe extension of lock TTL for long-running jobs
 *
 * Note: This module uses redis.eval() for Lua script execution. This is the
 * standard Redis mechanism for atomic operations and is NOT the dangerous
 * JavaScript eval() function. Lua scripts run server-side in Redis and are
 * a security best practice for atomic multi-step operations.
 *
 * @module server/lib/job-deduplication
 */

import { redis, REDIS_SERVICE_PREFIX } from "./redis";
import { createLogger } from "./logger";

const log = createLogger({ module: "job-deduplication" });

/** Default lock TTL in seconds (5 minutes) */
const DEFAULT_LOCK_TTL_SECONDS = 300;

/** Key prefix for job locks */
const JOB_LOCK_PREFIX = `${REDIS_SERVICE_PREFIX}job-lock:` as const;

/**
 * Result of a lock acquisition attempt.
 */
export interface LockResult {
  /** Whether the lock was acquired */
  acquired: boolean;
  /** Unique lock ID (needed for release/extend) - only present if acquired */
  lockId?: string;
  /** Holder info if lock was not acquired (for debugging) */
  heldBy?: string;
}

/**
 * Acquire a distributed lock for a job.
 *
 * Uses Redis SET NX EX for atomic lock acquisition.
 * Returns a unique lockId that must be used to release/extend the lock.
 *
 * @param jobKey - Unique key identifying the job (e.g., "audit:site123")
 * @param ttlSeconds - Lock TTL in seconds (default: 300)
 * @param metadata - Optional metadata to store with the lock
 * @returns LockResult with acquired status and lockId
 *
 * @example
 * const { acquired, lockId } = await acquireJobLock(`audit:${siteId}`);
 * if (!acquired) {
 *   console.log('Job already running');
 *   return;
 * }
 * try {
 *   await runJob();
 * } finally {
 *   await releaseJobLock(`audit:${siteId}`, lockId);
 * }
 */
export async function acquireJobLock(
  jobKey: string,
  ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS,
  metadata?: Record<string, unknown>
): Promise<LockResult> {
  const key = `${JOB_LOCK_PREFIX}${jobKey}`;
  const lockId = crypto.randomUUID();

  const lockValue = JSON.stringify({
    lockId,
    acquiredAt: new Date().toISOString(),
    worker: process.pid,
    ...metadata,
  });

  // SET NX EX: Atomic set-if-not-exists with TTL
  // Returns "OK" if set, null if key already exists
  const result = await redis.set(key, lockValue, "EX", ttlSeconds, "NX");

  if (result === "OK") {
    log.info("Job lock acquired", { jobKey, lockId, ttlSeconds });
    return { acquired: true, lockId };
  }

  // Lock not acquired - try to get holder info for debugging
  const existingValue = await redis.get(key);
  let heldBy: string | undefined;

  if (existingValue) {
    try {
      const parsed = JSON.parse(existingValue);
      heldBy = `lockId=${parsed.lockId}, worker=${parsed.worker}, since=${parsed.acquiredAt}`;
    } catch {
      heldBy = "unknown (parse error)";
    }
  }

  log.info("Job lock not acquired - already held", { jobKey, heldBy });
  return { acquired: false, heldBy };
}

/**
 * Lua script for atomic release: check ownership then delete.
 * Uses cjson.decode to parse the JSON lock value and verify lockId.
 *
 * KEYS[1] = lock key
 * ARGV[1] = expected lockId
 * Returns 1 if deleted, 0 if not found or not owned
 */
const RELEASE_LOCK_SCRIPT = `
  local value = redis.call('GET', KEYS[1])
  if value == false then
    return 0
  end
  local data = cjson.decode(value)
  if data.lockId == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 1
  end
  return 0
`;

/**
 * Release a job lock, but only if caller owns it.
 *
 * Uses Redis Lua script for atomic check-and-delete to prevent
 * releasing a lock that was acquired by another worker after TTL expired.
 *
 * @param jobKey - The job key used when acquiring the lock
 * @param lockId - The lockId returned from acquireJobLock
 * @returns true if lock was released, false if not owned
 *
 * @example
 * const released = await releaseJobLock(`audit:${siteId}`, lockId);
 * if (!released) {
 *   log.warn('Lock already expired or taken by another worker');
 * }
 */
export async function releaseJobLock(
  jobKey: string,
  lockId: string
): Promise<boolean> {
  const key = `${JOB_LOCK_PREFIX}${jobKey}`;

  // redis.eval() executes Lua scripts server-side in Redis
  // This is the standard Redis mechanism for atomic operations
  const result = await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, lockId);

  if (result === 1) {
    log.info("Job lock released", { jobKey, lockId });
    return true;
  }

  log.warn("Job lock release failed - not owner or expired", { jobKey, lockId });
  return false;
}

/**
 * Lua script for atomic extend: check ownership then extend TTL.
 *
 * KEYS[1] = lock key
 * ARGV[1] = expected lockId
 * ARGV[2] = new TTL in seconds
 * Returns 1 if extended, 0 if not found or not owned
 */
const EXTEND_LOCK_SCRIPT = `
  local value = redis.call('GET', KEYS[1])
  if value == false then
    return 0
  end
  local data = cjson.decode(value)
  if data.lockId == ARGV[1] then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return 1
  end
  return 0
`;

/**
 * Extend the TTL of a job lock for long-running jobs.
 *
 * Uses Redis Lua script for atomic check-and-extend to prevent
 * extending a lock that was acquired by another worker.
 *
 * Call this periodically for jobs that may exceed the initial TTL.
 *
 * @param jobKey - The job key used when acquiring the lock
 * @param lockId - The lockId returned from acquireJobLock
 * @param ttlSeconds - New TTL in seconds
 * @returns true if TTL was extended, false if not owned
 *
 * @example
 * // Extend lock every 2 minutes for a job with 5-minute TTL
 * const heartbeat = setInterval(async () => {
 *   const extended = await extendJobLock(`audit:${siteId}`, lockId, 300);
 *   if (!extended) {
 *     clearInterval(heartbeat);
 *     throw new Error('Lost lock ownership');
 *   }
 * }, 120000);
 */
export async function extendJobLock(
  jobKey: string,
  lockId: string,
  ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
): Promise<boolean> {
  const key = `${JOB_LOCK_PREFIX}${jobKey}`;

  // redis.eval() executes Lua scripts server-side in Redis
  const result = await redis.eval(EXTEND_LOCK_SCRIPT, 1, key, lockId, ttlSeconds);

  if (result === 1) {
    log.info("Job lock extended", { jobKey, lockId, ttlSeconds });
    return true;
  }

  log.warn("Job lock extend failed - not owner or expired", { jobKey, lockId });
  return false;
}

/**
 * Check if a job lock is currently held.
 *
 * @param jobKey - The job key to check
 * @returns true if lock exists, false otherwise
 */
export async function isJobLocked(jobKey: string): Promise<boolean> {
  const key = `${JOB_LOCK_PREFIX}${jobKey}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Get information about a job lock.
 *
 * @param jobKey - The job key to check
 * @returns Lock info or null if not held
 */
export async function getJobLockInfo(
  jobKey: string
): Promise<{
  lockId: string;
  acquiredAt: string;
  worker: number;
  ttlSeconds: number;
} | null> {
  const key = `${JOB_LOCK_PREFIX}${jobKey}`;

  const [value, ttl] = await Promise.all([
    redis.get(key),
    redis.ttl(key),
  ]);

  if (!value || ttl < 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return {
      lockId: parsed.lockId,
      acquiredAt: parsed.acquiredAt,
      worker: parsed.worker,
      ttlSeconds: ttl,
    };
  } catch {
    return null;
  }
}

/**
 * Force-release a job lock (admin operation).
 *
 * WARNING: Only use for stuck locks. This does NOT verify ownership.
 * Prefer releaseJobLock() for normal operation.
 *
 * @param jobKey - The job key to release
 * @returns true if lock was deleted, false if not found
 */
export async function forceReleaseJobLock(jobKey: string): Promise<boolean> {
  const key = `${JOB_LOCK_PREFIX}${jobKey}`;
  const deleted = await redis.del(key);

  if (deleted === 1) {
    log.warn("Job lock force-released", { jobKey });
    return true;
  }

  return false;
}

/**
 * Helper to run a job with automatic lock management.
 *
 * Acquires lock, runs the job, and releases lock automatically.
 * Supports optional heartbeat for long-running jobs.
 *
 * @param jobKey - Unique key identifying the job
 * @param job - Async function to run
 * @param options - Lock and heartbeat options
 * @returns Job result or null if lock not acquired
 *
 * @example
 * const result = await withJobLock(
 *   `audit:${siteId}`,
 *   () => runAudit(siteId),
 *   { ttlSeconds: 600, heartbeatIntervalMs: 60000 }
 * );
 */
export async function withJobLock<T>(
  jobKey: string,
  job: () => Promise<T>,
  options: {
    ttlSeconds?: number;
    heartbeatIntervalMs?: number;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ success: true; result: T } | { success: false; reason: "lock_not_acquired" }> {
  const { ttlSeconds = DEFAULT_LOCK_TTL_SECONDS, heartbeatIntervalMs, metadata } = options;

  const { acquired, lockId } = await acquireJobLock(jobKey, ttlSeconds, metadata);

  if (!acquired || !lockId) {
    return { success: false, reason: "lock_not_acquired" };
  }

  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

  try {
    // Start heartbeat if configured
    if (heartbeatIntervalMs && heartbeatIntervalMs > 0) {
      heartbeatInterval = setInterval(async () => {
        const extended = await extendJobLock(jobKey, lockId, ttlSeconds);
        if (!extended) {
          log.error("Lost lock ownership during heartbeat", undefined, { jobKey, lockId });
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }
        }
      }, heartbeatIntervalMs);
    }

    const result = await job();
    return { success: true, result };
  } finally {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    await releaseJobLock(jobKey, lockId);
  }
}
