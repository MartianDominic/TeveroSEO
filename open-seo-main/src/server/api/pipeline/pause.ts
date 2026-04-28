/**
 * Pipeline pause API endpoint.
 */
import { createServerFn } from "@tanstack/react-start";
import { writeCheckpoint, readCheckpoint } from "@/server/pipeline/checkpoint-manager";
import { phaseQueue, planQueue } from "@/server/queues/pipelineQueue";
import { createLogger } from "@/server/lib/logger";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

const log = createLogger({ module: "api:pipeline:pause" });

export const pausePipeline = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => {
    const checkpoint = await readCheckpoint();

    if (checkpoint?.status !== "running") {
      return { success: false, error: "Pipeline is not running" };
    }

    // Pause queues
    await phaseQueue.pause();
    await planQueue.pause();

    // Update checkpoint
    await writeCheckpoint({
      status: "paused",
      stoppedAt: `Paused at ${new Date().toISOString()}`,
    });

    log.info("Pipeline paused");

    return { success: true };
  });
