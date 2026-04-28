/**
 * Pipeline resume API endpoint.
 */
import { createServerFn } from "@tanstack/react-start";
import { writeCheckpoint, readCheckpoint, getResumePoint } from "@/server/pipeline/checkpoint-manager";
import { parseRoadmap } from "@/server/pipeline/roadmap-parser";
import { schedulePhase } from "@/server/pipeline/pipeline-scheduler";
import { phaseQueue, planQueue } from "@/server/queues/pipelineQueue";
import { readFile } from "fs/promises";
import { createLogger } from "@/server/lib/logger";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

const log = createLogger({ module: "api:pipeline:resume" });

export const resumePipeline = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    const workspaceId = context.organizationId;
    const checkpoint = await readCheckpoint();

    if (checkpoint?.status !== "paused" && checkpoint?.status !== "error") {
      return { success: false, error: "Pipeline is not paused or in error state" };
    }

    // Resume queues
    await phaseQueue.resume();
    await planQueue.resume();

    // Get resume point
    const roadmapContent = await readFile(".planning/ROADMAP.md", "utf-8");
    const phases = parseRoadmap(roadmapContent);
    const resumePoint = await getResumePoint(
      phases.map((p) => ({ slug: p.slug, planCount: p.planCount }))
    );

    if (!resumePoint) {
      await writeCheckpoint({ status: "idle", stoppedAt: "Pipeline complete" });
      return { success: true, message: "Pipeline already complete" };
    }

    // Update checkpoint and schedule from resume point
    await writeCheckpoint({
      status: "running",
      stoppedAt: undefined,
    });

    const phase = phases.find((p) => p.slug === resumePoint.phaseSlug);
    if (phase) {
      await schedulePhase(phase, workspaceId);
    }

    log.info("Pipeline resumed", { resumePoint });

    return { success: true, resumePoint };
  });
