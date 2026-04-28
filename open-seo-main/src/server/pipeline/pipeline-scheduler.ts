/**
 * Pipeline scheduler with BullMQ Flow Producer.
 *
 * Schedules phases and plans for autonomous execution.
 * Uses BullMQ Flow Producer to create parent-child job trees
 * where phase jobs wait for all child plan jobs to complete.
 *
 * @module pipeline-scheduler
 */
import { readFile } from "fs/promises";
import {
  pipelineFlowProducer,
  PHASE_QUEUE_NAME,
  PLAN_QUEUE_NAME,
  PLAN_STEP,
  type PhaseJobData,
  type PlanJobData,
} from "@/server/queues/pipelineQueue";
import { parseRoadmap } from "./roadmap-parser";
import { resolveExecutionOrder } from "./dependency-resolver";
import type { PhaseNode, ExecutionOrder } from "./types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "pipeline-scheduler" });

export interface SchedulePhaseOptions {
  phaseNumber: number;
  workspaceId: string;
}

export interface SchedulePipelineOptions {
  workspaceId: string;
  startFromPhase?: number; // For resume scenarios
}

/**
 * Schedule a single phase for execution.
 * Creates a BullMQ Flow with phase as parent and plans as children.
 *
 * @param phase - The phase node to schedule
 * @param workspaceId - Workspace ID for job scoping
 * @returns The flow job ID
 */
export async function schedulePhase(
  phase: PhaseNode,
  workspaceId: string
): Promise<string> {
  const planIds = generatePlanIds(phase);
  const phaseSlug = phase.slug;
  const phaseDirName = `${String(phase.number).padStart(2, "0")}-${phaseSlug}`;

  const children = planIds.map((planId) => ({
    name: `plan-${planId}`,
    queueName: PLAN_QUEUE_NAME,
    data: {
      planId,
      phaseNumber: phase.number,
      phaseName: phase.name,
      workspaceId,
      planPath: `.planning/phases/${phaseDirName}/${planId}-PLAN.md`,
      step: PLAN_STEP.INITIAL,
    } satisfies PlanJobData,
    opts: {
      jobId: `plan-${planId}-${Date.now()}`,
    },
  }));

  const flow = await pipelineFlowProducer.add({
    name: `phase-${phase.number}`,
    queueName: PHASE_QUEUE_NAME,
    data: {
      phaseNumber: phase.number,
      phaseName: phase.name,
      phaseSlug,
      workspaceId,
      planIds,
      startedAt: new Date().toISOString(),
    } satisfies PhaseJobData,
    opts: {
      jobId: `phase-${phase.number}-${Date.now()}`,
    },
    children,
  });

  log.info("Scheduled phase", {
    phaseNumber: phase.number,
    planCount: planIds.length,
    flowJobId: flow.job.id,
  });

  return flow.job.id!;
}

/**
 * Schedule an entire pipeline for execution.
 * Reads ROADMAP.md, resolves dependencies, and schedules phases in order.
 *
 * @param options - Scheduling options including workspaceId and optional startFromPhase
 * @returns Execution order and list of scheduled phase numbers
 */
export async function schedulePipeline(
  options: SchedulePipelineOptions
): Promise<{ executionOrder: ExecutionOrder; scheduledPhases: number[] }> {
  const roadmapContent = await readFile(".planning/ROADMAP.md", "utf-8");
  const phases = parseRoadmap(roadmapContent);
  const executionOrder = resolveExecutionOrder(phases);

  // Filter to phases that need execution (not complete)
  const pendingPhases = phases.filter(
    (p) =>
      p.status !== "complete" &&
      (!options.startFromPhase || p.number >= options.startFromPhase)
  );

  if (pendingPhases.length === 0) {
    log.info("No pending phases to schedule");
    return { executionOrder, scheduledPhases: [] };
  }

  // Schedule phases in topological order
  // Note: For now, we schedule sequentially. Future: parallel waves.
  const scheduledPhases: number[] = [];
  for (const phaseNum of executionOrder.phases) {
    const phase = phases.find((p) => p.number === phaseNum);
    if (!phase || phase.status === "complete") continue;
    if (options.startFromPhase && phaseNum < options.startFromPhase) continue;

    await schedulePhase(phase, options.workspaceId);
    scheduledPhases.push(phaseNum);
  }

  log.info("Scheduled pipeline", {
    totalPhases: scheduledPhases.length,
    phases: scheduledPhases,
  });

  return { executionOrder, scheduledPhases };
}

/**
 * Generate plan IDs for a phase based on planCount.
 * E.g., phase 38 with 4 plans -> ["38-01", "38-02", "38-03", "38-04"]
 *
 * @param phase - The phase node
 * @returns Array of plan IDs in the format "NN-PP"
 */
function generatePlanIds(phase: PhaseNode): string[] {
  const paddedPhase = String(phase.number).padStart(2, "0");
  return Array.from({ length: phase.planCount }, (_, i) => {
    const paddedPlan = String(i + 1).padStart(2, "0");
    return `${paddedPhase}-${paddedPlan}`;
  });
}
