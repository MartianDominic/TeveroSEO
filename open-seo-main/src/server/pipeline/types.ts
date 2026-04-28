/**
 * Core pipeline types.
 */

export interface PhaseNode {
  number: number; // e.g., 38
  name: string; // e.g., "Autonomous Pipeline Orchestration"
  slug: string; // e.g., "autonomous-pipeline-orchestration"
  dependencies: number[]; // e.g., [37] (phase numbers this depends on)
  requirements: string[]; // e.g., ["AUTO-01", "AUTO-02"]
  status: "not_started" | "in_progress" | "complete";
  planCount: number; // Number of plans in this phase
}

export interface ExecutionOrder {
  phases: number[]; // Phase numbers in topological order
  waves: Map<number, number[]>; // wave number -> phase numbers that can run in parallel
}

export interface PipelineState {
  status: "idle" | "running" | "paused" | "error";
  currentPhase: number | null;
  lastCompletedPhase: number | null;
  lastCompletedPlan: string | null;
  startedAt: string | null;
  updatedAt: string;
}

export class PipelineError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "PipelineError";
  }
}
