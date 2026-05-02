/**
 * Worker exports for startup registration.
 * Phase 22: Goal-Based Metrics System
 * Phase 38: GSD Pipeline Workers
 * Phase 62: Agency Command Center
 * Infrastructure: DLQ workers for failed jobs
 */

export { startGoalWorker, stopGoalWorker } from "./goal-processor";
export { initGoalProcessingScheduler } from "@/server/queues/goalQueue";

// Phase 38: GSD Pipeline Workers
export { startPhaseWorker, stopPhaseWorker } from "./phase-worker";
export { startPlanWorker, stopPlanWorker } from "./plan-worker";

// Phase 62: Agency Command Center - Engagement Workflow
export { startWorkflowWorker, stopWorkflowWorker } from "./workflow-worker";

// Infrastructure: Dead Letter Queue Workers
export { startFailedAuditsWorker, stopFailedAuditsWorker } from "./failed-audits-worker";
