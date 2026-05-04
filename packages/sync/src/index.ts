/**
 * Cross-Service Synchronization Package
 * FIX-08: Cross-Service Synchronization Fixes
 */

export {
  // Types
  type RetryConfig,
  type SyncResult,
  type SyncProgressEvent,
  type ClientSyncData,
  type SyncConfirmation,
  type SyncFunction,
  // Enums
  SyncStatus,
  // Schemas
  ClientSyncDataSchema,
  SyncConfirmationSchema,
  // Functions
  createConfirmedSync,
  generateIdempotencyKey,
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
} from "./confirmed-sync";
