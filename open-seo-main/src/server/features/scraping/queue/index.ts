/**
 * Queue Module Exports.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * DLQ: Uses platform PostgreSQL-based DLQ (dead_letter_jobs table).
 * See SCR-01 CONSOLIDATION in @/server/lib/dead-letter-queue.ts.
 */

// Types (includes DLQ types)
export * from "./queue.types";

// Configuration
export * from "./retry.config";

// Services
export { QueueManager, getQueueManager } from "./QueueManager";
export { QueueOrchestrator, type OrchestratorConfig } from "./QueueOrchestrator";

// Priority
export {
  assignPriority,
  selectQueue,
  toBullMQPriority,
  fromBullMQPriority,
  getPrioritySLA,
  getPriorityDescription,
  BULLMQ_PRIORITY_VALUES,
} from "./PriorityAssigner";

// Re-export DLQ types explicitly for clarity
// NOTE: DLQ now uses PostgreSQL (dead_letter_jobs table) instead of Redis queue
export type {
  DlqEnqueueResult,
  DlqJobStatus,
} from "./queue.types";
