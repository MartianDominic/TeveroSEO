/**
 * Pipeline start API endpoint.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { schedulePipeline } from "@/server/pipeline/pipeline-scheduler";
import { writeCheckpoint } from "@/server/pipeline/checkpoint-manager";
import { createLogger } from "@/server/lib/logger";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

const log = createLogger({ module: "api:pipeline:start" });

const StartPipelineSchema = z.object({
  startFromPhase: z.number().optional(),
});

export const startPipeline = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => StartPipelineSchema.parse(data))
  .handler(async ({ data, context }) => {
    const workspaceId = context.organizationId;

    log.info("Starting pipeline", { workspaceId, startFromPhase: data.startFromPhase });

    // Update checkpoint to running
    await writeCheckpoint({
      status: "running",
      stoppedAt: undefined,
      pipelineState: {
        currentPhaseSlug: null,
        lastCompletedPhaseSlug: null,
        lastCompletedPlan: null,
        startedAt: new Date().toISOString(),
      },
    });

    // Schedule pipeline execution
    const result = await schedulePipeline({
      workspaceId,
      startFromPhase: data.startFromPhase,
    });

    return {
      success: true,
      scheduledPhases: result.scheduledPhases,
    };
  });
