/**
 * Client sync service exports.
 * Phase 40: Gap Closure - CRIT-SYNC-01
 * FIX-03: Client Sync Architecture fixes
 */
export {
  ClientSyncService,
  ensureClient,
  syncClient,
  type AIWriterClient,
  type LocalClient,
} from "./ClientSyncService";

// Re-export UUID normalization utilities for cross-service consistency
// These are defined in ClientSyncService.ts for use by other modules
