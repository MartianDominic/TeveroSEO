/**
 * Pipeline status API endpoint.
 */
import { createServerFn } from "@tanstack/react-start";
import { readCheckpoint, ROADMAP_PATH } from "@/server/pipeline/checkpoint-manager";
import { parseRoadmap } from "@/server/pipeline/roadmap-parser";
import { calculateETA } from "@/server/pipeline/eta-calculator";
import { readFile } from "fs/promises";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

export const getPipelineStatus = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    const workspaceId = context.organizationId;

    const checkpoint = await readCheckpoint();
    const roadmapContent = await readFile(ROADMAP_PATH, "utf-8");
    const phases = parseRoadmap(roadmapContent);

    const completedPlans = countCompletedPlans(checkpoint);
    const totalPlans = phases.reduce((sum, p) => sum + p.planCount, 0);
    const remainingPlans = totalPlans - completedPlans;

    const eta = await calculateETA(workspaceId, remainingPlans);

    return {
      // H-TSK-03 FIX: Include workspaceId for Socket.IO room joins
      workspaceId,
      status: checkpoint?.status ?? "idle",
      currentPhase: checkpoint?.pipelineState?.currentPhaseSlug ?? null,
      lastCompletedPlan: checkpoint?.pipelineState?.lastCompletedPlan ?? null,
      progress: {
        completedPlans,
        totalPlans,
        percentage: totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0,
      },
      eta: {
        eta: eta.eta.toISOString(),
        remainingMinutes: eta.remainingMinutes,
        confidence: eta.confidence,
      },
      phases: phases.map((p) => ({
        number: p.number,
        name: p.name,
        slug: p.slug,
        status: p.status,
        planCount: p.planCount,
      })),
    };
  });

function countCompletedPlans(checkpoint: Awaited<ReturnType<typeof readCheckpoint>>): number {
  if (!checkpoint?.pipelineState?.lastCompletedPlan) return 0;
  const parts = checkpoint.pipelineState.lastCompletedPlan.split("-");
  if (parts.length < 2) return 0;
  const planNum = Number.parseInt(parts[1], 10);
  return Number.isNaN(planNum) ? 0 : planNum;
}
