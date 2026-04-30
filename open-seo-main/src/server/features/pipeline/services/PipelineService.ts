/**
 * Pipeline Service
 * Phase 50: Pipeline Kanban
 *
 * Manages prospect stage transitions and grouping for the kanban board.
 * Implements D-05 (pipeline stages), D-08 (quick actions).
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { prospects, type ProspectSelect } from "@/db/prospect-schema";
import { PipelineConfigService } from "./PipelineConfigService";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import { nanoid } from "nanoid";
import type { PipelineStageConfig } from "@/db/pipeline-config-schema";

/**
 * Move a prospect to a new pipeline stage.
 * Validates target stage exists in workspace config per T-50-01.
 */
export async function moveProspectToStage(
  workspaceId: string,
  prospectId: string,
  targetStage: string,
  actorId?: string,
): Promise<ProspectSelect> {
  // T-50-01: Validate target stage exists in workspace config
  const config = await PipelineConfigService.getOrCreateConfig(workspaceId);
  const validStages = config.stages.map((s) => s.id);

  if (!validStages.includes(targetStage)) {
    throw new Error(`Invalid stage: ${targetStage}`);
  }

  // Get current prospect to record stage change
  const [currentProspect] = await db
    .select()
    .from(prospects)
    .where(
      and(eq(prospects.id, prospectId), eq(prospects.workspaceId, workspaceId)),
    )
    .limit(1);

  if (!currentProspect) {
    throw new Error("Prospect not found");
  }

  const fromStage = currentProspect.pipelineStage;

  // Skip if already in target stage
  if (fromStage === targetStage) {
    return currentProspect;
  }

  // Update prospect stage
  const [updated] = await db
    .update(prospects)
    .set({
      pipelineStage: targetStage,
      updatedAt: new Date(),
    })
    .where(
      and(eq(prospects.id, prospectId), eq(prospects.workspaceId, workspaceId)),
    )
    .returning();

  if (!updated) {
    throw new Error("Prospect not found");
  }

  // Log activity for stage change
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "prospect",
    entityId: prospectId,
    activityType: "status_changed",
    activityData: {
      fromStage,
      toStage: targetStage,
    },
    actorId: actorId ?? null,
  });

  return updated;
}

/**
 * Get all prospects grouped by pipeline stage.
 * Returns { [stageId]: ProspectSelect[] } structure for kanban.
 */
export async function getProspectsGroupedByStage(
  workspaceId: string,
): Promise<Record<string, ProspectSelect[]>> {
  const config = await PipelineConfigService.getOrCreateConfig(workspaceId);

  // Get all non-archived prospects for workspace
  const allProspects = await db
    .select()
    .from(prospects)
    .where(eq(prospects.workspaceId, workspaceId));

  // Initialize all stages with empty arrays
  const grouped: Record<string, ProspectSelect[]> = {};
  for (const stage of config.stages) {
    grouped[stage.id] = [];
  }

  // Group prospects by stage
  for (const prospect of allProspects) {
    const stage = prospect.pipelineStage;
    if (grouped[stage]) {
      grouped[stage].push(prospect);
    } else {
      // Prospect has stage not in config (stale data) - put in "new"
      grouped["new"] = grouped["new"] || [];
      grouped["new"].push(prospect);
    }
  }

  return grouped;
}

/**
 * Get prospects in a specific stage.
 */
export async function getProspectsByStage(
  workspaceId: string,
  stageId: string,
): Promise<ProspectSelect[]> {
  return await db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.workspaceId, workspaceId),
        eq(prospects.pipelineStage, stageId),
      ),
    );
}

/**
 * Archive a prospect (D-08 quick action).
 * Moves prospect to "archived" stage if it exists, otherwise sets status.
 */
export async function archiveProspect(
  workspaceId: string,
  prospectId: string,
  actorId?: string,
): Promise<ProspectSelect> {
  const config = await PipelineConfigService.getOrCreateConfig(workspaceId);
  const hasArchivedStage = config.stages.some((s) => s.id === "archived");

  if (hasArchivedStage) {
    return moveProspectToStage(workspaceId, prospectId, "archived", actorId);
  }

  // Update status directly if no archived stage
  const [updated] = await db
    .update(prospects)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(
      and(eq(prospects.id, prospectId), eq(prospects.workspaceId, workspaceId)),
    )
    .returning();

  if (!updated) {
    throw new Error("Prospect not found");
  }

  // Log activity
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "prospect",
    entityId: prospectId,
    activityType: "archived",
    activityData: {},
    actorId: actorId ?? null,
  });

  return updated;
}

/**
 * Get pipeline stages with prospect counts for summary view.
 */
export async function getStageCounts(
  workspaceId: string,
): Promise<Array<PipelineStageConfig & { count: number }>> {
  const config = await PipelineConfigService.getOrCreateConfig(workspaceId);
  const grouped = await getProspectsGroupedByStage(workspaceId);

  return config.stages.map((stage) => ({
    ...stage,
    count: grouped[stage.id]?.length ?? 0,
  }));
}

export const PipelineService = {
  moveProspectToStage,
  getProspectsGroupedByStage,
  getProspectsByStage,
  archiveProspect,
  getStageCounts,
};
