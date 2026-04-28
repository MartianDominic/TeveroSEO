/**
 * Worker utilities for BullMQ error handling and lifecycle management.
 *
 * @module workers/utils
 */

export {
  createErrorContext,
  logWorkerError,
  withErrorHandling,
  withTransaction,
  fireAndForget,
  createFireAndForget,
  withRetry,
  type WorkerError,
  type ErrorLogResult,
} from "./error-handler";

export {
  BaseWorker,
  createWorker,
  type WorkerConfig,
  type DLQJobData,
} from "./base-worker";
