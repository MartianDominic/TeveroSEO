/**
 * Concurrency control utilities for distributed systems.
 *
 * This module provides:
 * - Distributed locking with atomic operations
 * - Idempotency for preventing duplicate processing
 * - Optimistic locking for preventing lost updates
 *
 * All utilities are Redis-backed for use across multiple server instances.
 */

// Distributed locking
export {
  acquireLock,
  tryAcquireLock,
  withLock,
  tryWithLock,
  isLocked,
  forceReleaseLock,
  type LockOptions,
  type LockHandle,
} from "./distributed-lock";

// Idempotency
export {
  withIdempotency,
  generateIdempotencyKey,
  generateRandomKey,
  getIdempotencyStatus,
  clearIdempotencyKey,
  createIdempotentAction,
  extractIdempotencyKey,
  IdempotencyConflictError,
  type IdempotencyResult,
  type IdempotencyOptions,
} from "./idempotency";

// Optimistic locking
export {
  getVersion,
  checkAndIncrementVersion,
  updateWithVersion,
  updateWithRetry,
  createVersionedEntity,
  compareAndSwap,
  OptimisticLockError,
  type OptimisticLockOptions,
  type VersionedData,
  type UpdateResult,
} from "./optimistic-lock";
