/**
 * Redis-based distributed lock with atomic operations.
 *
 * Provides mutual exclusion across multiple server instances to prevent
 * race conditions when processing jobs or updating shared resources.
 *
 * Features:
 * - Lua script for atomic acquire/release (prevents race conditions)
 * - TTL to prevent deadlocks from crashed processes
 * - Token-based ownership verification (only owner can release)
 * - withLock() helper for safe lock management
 * - Automatic extension for long-running operations
 */

import crypto from "crypto";

import { logger } from '@/lib/logger';
import { redis } from "@/lib/redis/client";
/** Lock key prefix to namespace all locks */
const LOCK_PREFIX = "tevero:lock:";

/** Default lock TTL in seconds */
const DEFAULT_LOCK_TTL = 30;

/** Default acquire timeout in milliseconds */
const DEFAULT_ACQUIRE_TIMEOUT = 5000;

/** Retry interval when waiting for lock (ms) */
const ACQUIRE_RETRY_INTERVAL = 50;

/**
 * Lua script for atomic lock acquisition.
 * Returns 1 if acquired, 0 if already held by another owner.
 *
 * This is atomic - no race condition between checking and setting.
 *
 * Note: redis.call('eval', ...) is the standard Redis method for
 * executing Lua scripts atomically. This is NOT JavaScript eval().
 */
const ACQUIRE_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]
local ttl = tonumber(ARGV[2])

-- Check if lock exists
local current = redis.call('GET', key)

-- If no lock or we already own it, acquire/refresh
if current == false or current == token then
  redis.call('SET', key, token, 'EX', ttl)
  return 1
end

-- Lock held by another owner
return 0
`;

/**
 * Lua script for atomic lock release.
 * Only releases if the token matches (owner verification).
 * Returns 1 if released, 0 if not owner.
 */
const RELEASE_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]

local current = redis.call('GET', key)

-- Only release if we own the lock
if current == token then
  redis.call('DEL', key)
  return 1
end

-- Not the owner, don't release
return 0
`;

/**
 * Lua script for atomic lock extension.
 * Only extends if the token matches (owner verification).
 * Returns 1 if extended, 0 if not owner or lock expired.
 */
const EXTEND_SCRIPT = `
local key = KEYS[1]
local token = ARGV[1]
local ttl = tonumber(ARGV[2])

local current = redis.call('GET', key)

-- Only extend if we own the lock
if current == token then
  redis.call('EXPIRE', key, ttl)
  return 1
end

-- Not the owner or lock expired
return 0
`;

export interface LockOptions {
  /** Lock TTL in seconds (default: 30) */
  ttlSeconds?: number;
  /** Max time to wait for lock acquisition in ms (default: 5000) */
  acquireTimeoutMs?: number;
  /** Auto-extend lock while operation runs (default: true) */
  autoExtend?: boolean;
}

export interface LockHandle {
  /** Unique token identifying this lock holder */
  token: string;
  /** Lock key (without prefix) */
  resource: string;
  /** Full Redis key */
  key: string;
  /** When lock was acquired */
  acquiredAt: Date;
  /** Release the lock (idempotent) */
  release: () => Promise<boolean>;
  /** Extend the lock TTL */
  extend: (ttlSeconds?: number) => Promise<boolean>;
  /** Check if still holding the lock */
  isHeld: () => Promise<boolean>;
}

/**
 * Generate a unique lock token.
 * Includes process ID and random bytes for uniqueness across restarts.
 */
function generateToken(): string {
  const random = crypto.randomBytes(16).toString("hex");
  const pid = typeof process !== "undefined" ? process.pid : 0;
  return `${pid}:${Date.now()}:${random}`;
}

/**
 * Sleep helper for retry loops.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a Lua script atomically in Redis.
 * This uses Redis EVAL command which runs Lua scripts server-side.
 */
async function executeScript(
  script: string,
  keys: string[],
  args: string[]
): Promise<unknown> {
  // ioredis eval signature: eval(script, numKeys, ...keys, ...args)
  return redis.eval(script, keys.length, ...keys, ...args);
}

/**
 * Acquire a distributed lock on a resource.
 *
 * The lock is automatically released after ttlSeconds if not explicitly released,
 * preventing deadlocks from crashed processes.
 *
 * @param resource - Unique identifier for the resource to lock
 * @param options - Lock configuration options
 * @returns LockHandle if acquired, null if timeout waiting for lock
 *
 * @example
 * ```typescript
 * const lock = await acquireLock("job:process:123");
 * if (!lock) {
 *   logger.debug("Could not acquire lock, another process is handling this job");
 *   return;
 * }
 *
 * try {
 *   await processJob("123");
 * } finally {
 *   await lock.release();
 * }
 * ```
 */
export async function acquireLock(
  resource: string,
  options: LockOptions = {}
): Promise<LockHandle | null> {
  const {
    ttlSeconds = DEFAULT_LOCK_TTL,
    acquireTimeoutMs = DEFAULT_ACQUIRE_TIMEOUT,
  } = options;

  const key = `${LOCK_PREFIX}${resource}`;
  const token = generateToken();
  const startTime = Date.now();

  // Retry loop until timeout
  while (Date.now() - startTime < acquireTimeoutMs) {
    try {
      const result = await executeScript(
        ACQUIRE_SCRIPT,
        [key],
        [token, ttlSeconds.toString()]
      );

      if (result === 1) {
        // Lock acquired
        const handle: LockHandle = {
          token,
          resource,
          key,
          acquiredAt: new Date(),
          release: async () => releaseLock(key, token),
          extend: async (newTtl?: number) =>
            extendLock(key, token, newTtl ?? ttlSeconds),
          isHeld: async () => isLockHeld(key, token),
        };
        return handle;
      }

      // Lock held by another process, wait and retry
      await sleep(ACQUIRE_RETRY_INTERVAL);
    } catch (error) {
      // Redis error - log and retry
      logger.error("[distributed-lock] Acquire error", error instanceof Error ? error : { error: String(error) });
      await sleep(ACQUIRE_RETRY_INTERVAL);
    }
  }

  // Timeout - could not acquire lock
  return null;
}

/**
 * Try to acquire a lock without waiting.
 * Returns immediately with the lock or null.
 *
 * @param resource - Unique identifier for the resource to lock
 * @param ttlSeconds - Lock TTL in seconds
 * @returns LockHandle if acquired, null if already held
 */
export async function tryAcquireLock(
  resource: string,
  ttlSeconds: number = DEFAULT_LOCK_TTL
): Promise<LockHandle | null> {
  return acquireLock(resource, { ttlSeconds, acquireTimeoutMs: 0 });
}

/**
 * Release a distributed lock.
 * Only releases if the token matches (owner verification).
 *
 * @internal Use lock.release() from LockHandle instead
 */
async function releaseLock(key: string, token: string): Promise<boolean> {
  try {
    const result = await executeScript(RELEASE_SCRIPT, [key], [token]);
    return result === 1;
  } catch (error) {
    logger.error("[distributed-lock] Release error", error instanceof Error ? error : { error: String(error) });
    return false;
  }
}

/**
 * Extend a lock's TTL.
 * Only extends if the token matches (owner verification).
 *
 * @internal Use lock.extend() from LockHandle instead
 */
async function extendLock(
  key: string,
  token: string,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const result = await executeScript(
      EXTEND_SCRIPT,
      [key],
      [token, ttlSeconds.toString()]
    );
    return result === 1;
  } catch (error) {
    logger.error("[distributed-lock] Extend error", error instanceof Error ? error : { error: String(error) });
    return false;
  }
}

/**
 * Check if a lock is still held with the given token.
 *
 * @internal Use lock.isHeld() from LockHandle instead
 */
async function isLockHeld(key: string, token: string): Promise<boolean> {
  try {
    const current = await redis.get(key);
    return current === token;
  } catch (error) {
    logger.error("[distributed-lock] isHeld error", error instanceof Error ? error : { error: String(error) });
    return false;
  }
}

/**
 * Execute an operation while holding a distributed lock.
 *
 * This is the recommended way to use distributed locks as it:
 * - Automatically acquires the lock
 * - Automatically releases on completion or error
 * - Optionally auto-extends the lock for long operations
 *
 * @param resource - Unique identifier for the resource to lock
 * @param operation - Async operation to execute while holding lock
 * @param options - Lock configuration options
 * @returns Operation result, or throws if lock cannot be acquired
 *
 * @example
 * ```typescript
 * const result = await withLock(
 *   `job:${jobId}`,
 *   async (lock) => {
 *     // Only one instance can execute this at a time
 *     await processJob(jobId);
 *     return { success: true };
 *   },
 *   { ttlSeconds: 60 }
 * );
 * ```
 */
export async function withLock<T>(
  resource: string,
  operation: (lock: LockHandle) => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const { autoExtend = true, ttlSeconds = DEFAULT_LOCK_TTL } = options;

  const lock = await acquireLock(resource, options);
  if (!lock) {
    throw new Error(
      `Failed to acquire lock on resource "${resource}" within timeout`
    );
  }

  let extendInterval: ReturnType<typeof setInterval> | null = null;

  try {
    // Auto-extend lock while operation runs
    if (autoExtend) {
      // Extend at 50% of TTL to ensure lock doesn't expire during operation
      const extendIntervalMs = (ttlSeconds * 1000) / 2;
      extendInterval = setInterval(async () => {
        const extended = await lock.extend(ttlSeconds);
        if (!extended) {
          console.warn(
            `[distributed-lock] Failed to extend lock for "${resource}"`
          );
        }
      }, extendIntervalMs);
    }

    return await operation(lock);
  } finally {
    if (extendInterval) {
      clearInterval(extendInterval);
    }
    await lock.release();
  }
}

/**
 * Try to execute an operation with a lock, but don't wait if locked.
 *
 * Useful for background jobs where you want to skip if already processing.
 *
 * @param resource - Unique identifier for the resource to lock
 * @param operation - Async operation to execute while holding lock
 * @param options - Lock configuration options
 * @returns Operation result, or null if lock was already held
 *
 * @example
 * ```typescript
 * const result = await tryWithLock(
 *   `sync:${clientId}`,
 *   async () => {
 *     await syncClientData(clientId);
 *     return { synced: true };
 *   }
 * );
 *
 * if (result === null) {
 *   logger.debug("Sync already in progress, skipping");
 * }
 * ```
 */
export async function tryWithLock<T>(
  resource: string,
  operation: (lock: LockHandle) => Promise<T>,
  options: Omit<LockOptions, "acquireTimeoutMs"> = {}
): Promise<T | null> {
  const lock = await tryAcquireLock(resource, options.ttlSeconds);
  if (!lock) {
    return null;
  }

  const { autoExtend = true, ttlSeconds = DEFAULT_LOCK_TTL } = options;
  let extendInterval: ReturnType<typeof setInterval> | null = null;

  try {
    if (autoExtend) {
      const extendIntervalMs = (ttlSeconds * 1000) / 2;
      extendInterval = setInterval(async () => {
        await lock.extend(ttlSeconds);
      }, extendIntervalMs);
    }

    return await operation(lock);
  } finally {
    if (extendInterval) {
      clearInterval(extendInterval);
    }
    await lock.release();
  }
}

/**
 * Check if a resource is currently locked.
 * Useful for UI feedback or skipping operations.
 *
 * @param resource - Resource identifier to check
 * @returns true if locked, false if available
 */
export async function isLocked(resource: string): Promise<boolean> {
  const key = `${LOCK_PREFIX}${resource}`;
  try {
    const value = await redis.get(key);
    return value !== null;
  } catch (error) {
    logger.error("[distributed-lock] isLocked error", error instanceof Error ? error : { error: String(error) });
    return false;
  }
}

/**
 * Force release a lock (admin operation).
 * Use with caution - this bypasses owner verification.
 *
 * @param resource - Resource identifier to unlock
 */
export async function forceReleaseLock(resource: string): Promise<void> {
  const key = `${LOCK_PREFIX}${resource}`;
  try {
    await redis.del(key);
  } catch (error) {
    logger.error("[distributed-lock] Force release error", error instanceof Error ? error : { error: String(error) });
  }
}
