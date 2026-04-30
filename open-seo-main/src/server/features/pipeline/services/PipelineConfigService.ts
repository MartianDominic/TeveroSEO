/**
 * Pipeline Configuration Service
 * Phase 50: Pipeline Kanban
 *
 * Manages per-workspace pipeline stage configuration.
 * Implements D-06 (configurable stages with add/remove/reorder/color).
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  pipelineConfigs,
  DEFAULT_PIPELINE_STAGES,
  type PipelineStageConfig,
  type PipelineConfigSelect,
} from "@/db/pipeline-config-schema";
import { nanoid } from "nanoid";

/**
 * Get or create pipeline configuration for a workspace.
 * Creates default stages for new workspaces per D-05.
 */
export async function getOrCreateConfig(
  workspaceId: string,
): Promise<PipelineConfigSelect> {
  const [existing] = await db
    .select()
    .from(pipelineConfigs)
    .where(eq(pipelineConfigs.workspaceId, workspaceId))
    .limit(1);

  if (existing) return existing;

  // D-06: Create default stages for new workspace
  const [created] = await db
    .insert(pipelineConfigs)
    .values({
      id: nanoid(),
      workspaceId,
      stages: DEFAULT_PIPELINE_STAGES,
    })
    .returning();

  return created;
}

/**
 * Get pipeline configuration by workspace ID.
 * Returns undefined if no configuration exists.
 */
export async function getConfigByWorkspace(
  workspaceId: string,
): Promise<PipelineConfigSelect | undefined> {
  const [config] = await db
    .select()
    .from(pipelineConfigs)
    .where(eq(pipelineConfigs.workspaceId, workspaceId))
    .limit(1);

  return config;
}

/**
 * Validate stage array for consistency.
 * Checks for unique IDs and sequential order.
 */
function validateStages(stages: PipelineStageConfig[]): void {
  // Check for minimum stages
  if (stages.length < 2) {
    throw new Error("Pipeline must have at least 2 stages");
  }

  // Check for unique IDs
  const ids = stages.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate stage IDs");
  }

  // Check for empty names
  if (stages.some((s) => !s.name.trim())) {
    throw new Error("Stage names cannot be empty");
  }

  // Check for valid colors (hex format)
  const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
  if (stages.some((s) => !hexColorRegex.test(s.color))) {
    throw new Error("Stage colors must be valid hex colors (e.g., #10b981)");
  }
}

/**
 * Update pipeline stages for a workspace.
 * Validates stage array and updates configuration.
 */
export async function updateStages(
  workspaceId: string,
  stages: PipelineStageConfig[],
): Promise<PipelineConfigSelect> {
  // Validate stages
  validateStages(stages);

  // Normalize order to be sequential
  const normalizedStages = stages.map((stage, index) => ({
    ...stage,
    order: index,
  }));

  const [updated] = await db
    .update(pipelineConfigs)
    .set({ stages: normalizedStages })
    .where(eq(pipelineConfigs.workspaceId, workspaceId))
    .returning();

  if (!updated) {
    throw new Error("Pipeline configuration not found");
  }

  return updated;
}

/**
 * Check if a stage ID is valid for a workspace.
 */
export async function isValidStage(
  workspaceId: string,
  stageId: string,
): Promise<boolean> {
  const config = await getOrCreateConfig(workspaceId);
  return config.stages.some((s) => s.id === stageId);
}

/**
 * Get valid stage IDs for a workspace.
 */
export async function getValidStageIds(workspaceId: string): Promise<string[]> {
  const config = await getOrCreateConfig(workspaceId);
  return config.stages.map((s) => s.id);
}

export const PipelineConfigService = {
  getOrCreateConfig,
  getConfigByWorkspace,
  updateStages,
  isValidStage,
  getValidStageIds,
};
