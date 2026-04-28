/**
 * Optimistic locking utilities for preventing lost updates.
 *
 * Implements optimistic concurrency control where each update includes
 * a version number. Updates only succeed if the version matches,
 * preventing the "last write wins" problem.
 *
 * Features:
 * - Version-based conflict detection
 * - Automatic retry with exponential backoff
 * - Redis-backed version tracking for distributed systems
 * - Type-safe update operations
 */

import { redis } from "@/lib/redis/client";

/** Version key prefix */
const VERSION_PREFIX = "tevero:version:";

/** Default TTL for version entries in seconds (7 days) */
const DEFAULT_VERSION_TTL = 604800;

/** Default max retry attempts */
const DEFAULT_MAX_RETRIES = 3;

/** Base delay for exponential backoff in ms */
const BASE_RETRY_DELAY = 100;

export interface OptimisticLockOptions {
  /** TTL for version entries in seconds (default: 7 days) */
  ttlSeconds?: number;
  /** Maximum retry attempts on conflict (default: 3) */
  maxRetries?: number;
}

export interface VersionedData<T> {
  /** The data */
  data: T;
  /** Current version number */
  version: number;
}

export interface UpdateResult<T> {
  /** Whether the update succeeded */
  success: boolean;
  /** The updated data (if successful) */
  data?: T;
  /** New version number (if successful) */
  version?: number;
  /** Conflict details (if failed) */
  conflict?: {
    expectedVersion: number;
    actualVersion: number;
  };
}

/**
 * Error thrown when an optimistic lock conflict occurs.
 */
export class OptimisticLockError extends Error {
  expectedVersion: number;
  actualVersion: number;

  constructor(expectedVersion: number, actualVersion: number) {
    super(
      `Optimistic lock conflict: expected version ${expectedVersion}, got ${actualVersion}`
    );
    this.name = "OptimisticLockError";
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Lua script for atomic version check and increment.
 * Returns new version if check passes, -1 if conflict.
 *
 * Note: This uses Redis EVAL command which executes Lua scripts
 * server-side atomically. This is NOT JavaScript eval().
 */
const CHECK_AND_INCREMENT_SCRIPT = `
local key = KEYS[1]
local expectedVersion = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local currentVersion = redis.call('GET', key)

-- If no version exists, initialize to 0
if currentVersion == false then
  currentVersion = 0
else
  currentVersion = tonumber(currentVersion)
end

-- Version mismatch - conflict
if currentVersion ~= expectedVersion then
  return currentVersion
end

-- Increment version
local newVersion = currentVersion + 1
redis.call('SET', key, newVersion, 'EX', ttl)
return -newVersion
`;

/**
 * Execute a Lua script atomically in Redis.
 * Uses Redis EVAL command for server-side atomic execution.
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
 * Sleep helper for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the current version for a resource.
 *
 * @param resource - Resource identifier
 * @returns Current version number (0 if not set)
 */
export async function getVersion(resource: string): Promise<number> {
  const key = `${VERSION_PREFIX}${resource}`;
  try {
    const value = await redis.get(key);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error("[optimistic-lock] getVersion error:", error);
    return 0;
  }
}

/**
 * Increment version atomically if it matches expected value.
 *
 * @param resource - Resource identifier
 * @param expectedVersion - Expected current version
 * @param ttlSeconds - TTL for the version entry
 * @returns New version if successful, null if conflict
 */
export async function checkAndIncrementVersion(
  resource: string,
  expectedVersion: number,
  ttlSeconds: number = DEFAULT_VERSION_TTL
): Promise<number | null> {
  const key = `${VERSION_PREFIX}${resource}`;

  try {
    const result = await executeScript(
      CHECK_AND_INCREMENT_SCRIPT,
      [key],
      [expectedVersion.toString(), ttlSeconds.toString()]
    );

    const numResult = Number(result);

    // Negative result means success (new version is -result)
    if (numResult < 0) {
      return -numResult;
    }

    // Positive or zero result means conflict (actual version)
    return null;
  } catch (error) {
    console.error("[optimistic-lock] checkAndIncrementVersion error:", error);
    return null;
  }
}

/**
 * Update a resource with optimistic locking.
 *
 * The update only succeeds if the version matches. On conflict,
 * the operation can be retried with the new version.
 *
 * @param resource - Resource identifier
 * @param expectedVersion - Expected current version
 * @param updateFn - Function that performs the actual update
 * @param options - Optimistic lock options
 * @returns UpdateResult with success status and data/conflict details
 *
 * @example
 * ```typescript
 * // Read current data with version
 * const { data, version } = await getVersionedData("user:123");
 *
 * // Attempt update with version check
 * const result = await updateWithVersion(
 *   "user:123",
 *   version,
 *   async () => {
 *     const updated = { ...data, name: "New Name" };
 *     await db.users.update(updated);
 *     return updated;
 *   }
 * );
 *
 * if (!result.success) {
 *   console.log("Conflict: data was modified by another request");
 * }
 * ```
 */
export async function updateWithVersion<T>(
  resource: string,
  expectedVersion: number,
  updateFn: () => Promise<T>,
  options: OptimisticLockOptions = {}
): Promise<UpdateResult<T>> {
  const { ttlSeconds = DEFAULT_VERSION_TTL } = options;

  // Check and increment version atomically
  const newVersion = await checkAndIncrementVersion(
    resource,
    expectedVersion,
    ttlSeconds
  );

  if (newVersion === null) {
    // Version conflict
    const actualVersion = await getVersion(resource);
    return {
      success: false,
      conflict: {
        expectedVersion,
        actualVersion,
      },
    };
  }

  // Version check passed, perform the update
  try {
    const data = await updateFn();
    return {
      success: true,
      data,
      version: newVersion,
    };
  } catch (error) {
    // Update failed - we already incremented the version
    // This is intentional: the failed update "consumed" this version
    throw error;
  }
}

/**
 * Update a resource with automatic retry on conflict.
 *
 * On conflict, fetches the latest version and retries the update.
 * The readFn should read the current state including version.
 *
 * @param resource - Resource identifier
 * @param readFn - Function to read current data and version
 * @param updateFn - Function to compute and apply update
 * @param options - Optimistic lock options
 * @returns Updated data and new version
 * @throws OptimisticLockError if max retries exceeded
 *
 * @example
 * ```typescript
 * const result = await updateWithRetry(
 *   "counter:visitors",
 *   async () => {
 *     const counter = await db.counters.get("visitors");
 *     const version = await getVersion("counter:visitors");
 *     return { data: counter, version };
 *   },
 *   async (current) => {
 *     const updated = { ...current, count: current.count + 1 };
 *     await db.counters.update("visitors", updated);
 *     return updated;
 *   },
 *   { maxRetries: 5 }
 * );
 * ```
 */
export async function updateWithRetry<T>(
  resource: string,
  readFn: () => Promise<VersionedData<T>>,
  updateFn: (current: T) => Promise<T>,
  options: OptimisticLockOptions = {}
): Promise<{ data: T; version: number }> {
  const { maxRetries = DEFAULT_MAX_RETRIES, ttlSeconds = DEFAULT_VERSION_TTL } =
    options;

  let attempts = 0;

  while (attempts < maxRetries) {
    // Read current state
    const { data, version } = await readFn();

    // Attempt update
    const result = await updateWithVersion(
      resource,
      version,
      () => updateFn(data),
      { ttlSeconds }
    );

    if (result.success && result.data !== undefined && result.version !== undefined) {
      return { data: result.data, version: result.version };
    }

    // Conflict - exponential backoff before retry
    attempts++;
    if (attempts < maxRetries) {
      const delay = BASE_RETRY_DELAY * Math.pow(2, attempts - 1);
      await sleep(delay);
    }
  }

  // Max retries exceeded
  const currentVersion = await getVersion(resource);
  throw new OptimisticLockError(0, currentVersion);
}

/**
 * Create a versioned wrapper for an entity type.
 *
 * Provides a convenient interface for working with versioned entities
 * in a specific domain (e.g., users, orders, settings).
 *
 * @param prefix - Prefix for version keys (e.g., "user", "order")
 * @param options - Default options for all operations
 * @returns Object with version management functions
 *
 * @example
 * ```typescript
 * const userVersions = createVersionedEntity("user", { ttlSeconds: 86400 });
 *
 * // Get version
 * const version = await userVersions.get("user-123");
 *
 * // Update with version check
 * const result = await userVersions.update(
 *   "user-123",
 *   version,
 *   async () => {
 *     await db.users.update("user-123", newData);
 *     return newData;
 *   }
 * );
 * ```
 */
export function createVersionedEntity(
  prefix: string,
  defaultOptions: OptimisticLockOptions = {}
) {
  const buildResource = (id: string) => `${prefix}:${id}`;

  return {
    /**
     * Get version for an entity.
     */
    get: (id: string) => getVersion(buildResource(id)),

    /**
     * Update with version check.
     */
    update: <T>(
      id: string,
      expectedVersion: number,
      updateFn: () => Promise<T>,
      options?: OptimisticLockOptions
    ) =>
      updateWithVersion(buildResource(id), expectedVersion, updateFn, {
        ...defaultOptions,
        ...options,
      }),

    /**
     * Update with automatic retry.
     */
    updateWithRetry: <T>(
      id: string,
      readFn: () => Promise<VersionedData<T>>,
      updateFn: (current: T) => Promise<T>,
      options?: OptimisticLockOptions
    ) =>
      updateWithRetry(buildResource(id), readFn, updateFn, {
        ...defaultOptions,
        ...options,
      }),

    /**
     * Initialize or reset version for an entity.
     */
    initialize: async (
      id: string,
      initialVersion: number = 0,
      ttlSeconds?: number
    ) => {
      const key = `${VERSION_PREFIX}${buildResource(id)}`;
      const ttl = ttlSeconds ?? defaultOptions.ttlSeconds ?? DEFAULT_VERSION_TTL;
      await redis.setex(key, ttl, initialVersion.toString());
    },

    /**
     * Delete version tracking for an entity.
     */
    delete: async (id: string) => {
      const key = `${VERSION_PREFIX}${buildResource(id)}`;
      await redis.del(key);
    },
  };
}

/**
 * Lua script for atomic compare-and-swap operation.
 */
const COMPARE_AND_SWAP_SCRIPT = `
local key = KEYS[1]
local expected = ARGV[1]
local new = ARGV[2]
local ttl = tonumber(ARGV[3])

local current = redis.call('GET', key)

-- Handle nil case (no existing value matches empty expected)
if current == false then
  if expected == '' then
    redis.call('SET', key, new, 'EX', ttl)
    return 1
  end
  return 0
end

-- Check if current value matches expected
if current == expected then
  redis.call('SET', key, new, 'EX', ttl)
  return 1
end

return 0
`;

/**
 * Atomic compare-and-swap operation for simple values.
 *
 * Updates a value only if it matches the expected value.
 * Useful for atomic state transitions.
 *
 * @param resource - Resource identifier
 * @param expectedValue - Expected current value
 * @param newValue - New value to set
 * @param ttlSeconds - TTL for the value
 * @returns true if swap succeeded, false if value didn't match
 *
 * @example
 * ```typescript
 * // Only transition from "pending" to "processing"
 * const success = await compareAndSwap(
 *   "job:123:status",
 *   "pending",
 *   "processing"
 * );
 *
 * if (!success) {
 *   console.log("Job was already picked up by another worker");
 * }
 * ```
 */
export async function compareAndSwap(
  resource: string,
  expectedValue: string,
  newValue: string,
  ttlSeconds: number = DEFAULT_VERSION_TTL
): Promise<boolean> {
  const key = `${VERSION_PREFIX}${resource}`;

  try {
    const result = await executeScript(
      COMPARE_AND_SWAP_SCRIPT,
      [key],
      [expectedValue, newValue, ttlSeconds.toString()]
    );
    return result === 1;
  } catch (error) {
    console.error("[optimistic-lock] compareAndSwap error:", error);
    return false;
  }
}
