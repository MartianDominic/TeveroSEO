/**
 * Worker exports for startup registration.
 * Phase 22: Goal-Based Metrics System
 * Phase 38: GSD Pipeline Workers
 */

export { startGoalWorker, stopGoalWorker } from "./goal-processor";
export { initGoalProcessingScheduler } from "@/server/queues/goalQueue";

// Phase 38: GSD Pipeline Workers
export { startPhaseWorker, stopPhaseWorker } from "./phase-worker";
export { startPlanWorker, stopPlanWorker } from "./plan-worker";
