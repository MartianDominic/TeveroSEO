/**
 * Queue Module Exports.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
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

// Re-export DLQ types and constants explicitly for clarity
export type {
  DlqJobData,
  DlqEnqueueResult,
  DlqJobStatus,
  AllQueueName,
} from "./queue.types";

export { DLQ_QUEUE_NAME } from "./queue.types";
