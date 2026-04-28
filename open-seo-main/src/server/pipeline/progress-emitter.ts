/**
 * Socket.IO event emitter for pipeline progress updates.
 *
 * Streams real-time progress to dashboard clients.
 */
import { nanoid } from "nanoid";
import { emitActivityEvent, type ActivityEvent } from "@/server/websocket/socket-server";
import type { ETAResult } from "./eta-calculator";
import type { BlockerInfo } from "./blocker-detector";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "progress-emitter" });

export interface PipelineProgressData {
  status: "running" | "paused" | "completed" | "error";
  currentPhase: {
    number: number;
    name: string;
    slug: string;
  };
  currentPlan: {
    id: string;
    index: number;
    total: number;
  } | null;
  progress: {
    completedPlans: number;
    totalPlans: number;
    percentage: number;
  };
  eta: ETAResult | null;
}

export interface PipelineBlockerData {
  blocker: BlockerInfo;
  phaseNumber: number;
  planId: string;
}

/**
 * Emit pipeline progress event to workspace.
 */
export function emitPipelineProgress(
  workspaceId: string,
  data: PipelineProgressData
): void {
  const event: ActivityEvent = {
    id: nanoid(),
    type: "pipeline:progress",
    data: {
      status: data.status,
      currentPhase: data.currentPhase,
      currentPlan: data.currentPlan,
      progress: data.progress,
      eta: data.eta
        ? {
            eta: data.eta.eta.toISOString(),
            remainingMinutes: data.eta.remainingMinutes,
            confidence: data.eta.confidence,
          }
        : null,
    },
    timestamp: new Date().toISOString(),
  };

  emitActivityEvent(workspaceId, event);

  log.debug("Emitted pipeline progress", {
    workspaceId,
    status: data.status,
    percentage: data.progress.percentage,
  });
}

/**
 * Emit pipeline blocker event to workspace.
 */
export function emitPipelineBlocker(
  workspaceId: string,
  data: PipelineBlockerData
): void {
  const event: ActivityEvent = {
    id: nanoid(),
    type: "pipeline:blocker",
    data: {
      blocker: {
        type: data.blocker.type,
        message: data.blocker.message,
        suggestedAction: data.blocker.suggestedAction,
        recoverable: data.blocker.recoverable,
      },
      phaseNumber: data.phaseNumber,
      planId: data.planId,
    },
    timestamp: new Date().toISOString(),
  };

  emitActivityEvent(workspaceId, event);

  log.info("Emitted pipeline blocker", {
    workspaceId,
    blockerType: data.blocker.type,
    planId: data.planId,
  });
}

/**
 * Emit plan completion event.
 */
export function emitPlanComplete(
  workspaceId: string,
  planId: string,
  phaseNumber: number,
  durationMinutes: number
): void {
  const event: ActivityEvent = {
    id: nanoid(),
    type: "pipeline:plan-complete",
    data: {
      planId,
      phaseNumber,
      durationMinutes,
    },
    timestamp: new Date().toISOString(),
  };

  emitActivityEvent(workspaceId, event);

  log.info("Emitted plan complete", { workspaceId, planId });
}

/**
 * Emit phase completion event.
 */
export function emitPhaseComplete(
  workspaceId: string,
  phaseNumber: number,
  phaseName: string
): void {
  const event: ActivityEvent = {
    id: nanoid(),
    type: "pipeline:phase-complete",
    data: {
      phaseNumber,
      phaseName,
    },
    timestamp: new Date().toISOString(),
  };

  emitActivityEvent(workspaceId, event);

  log.info("Emitted phase complete", { workspaceId, phaseNumber });
}
