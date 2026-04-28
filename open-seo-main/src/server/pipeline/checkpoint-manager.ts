/**
 * Checkpoint manager for pipeline execution state.
 * 
 * Persists progress to STATE.md after each plan completion.
 * Enables crash recovery by reading last checkpoint on resume.
 */
import { readFile, writeFile } from "fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { PipelineState } from "./types";
import { PipelineError } from "./types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "checkpoint-manager" });

const STATE_PATH = ".planning/STATE.md";

export interface Checkpoint {
  status: "idle" | "running" | "paused" | "verifying" | "error";
  stoppedAt: string | null;
  lastUpdated: string;
  pipelineState?: {
    currentPhaseSlug: string | null;
    lastCompletedPhaseSlug: string | null;
    lastCompletedPlan: string | null;
    startedAt: string | null;
  };
}

export interface ResumePoint {
  phaseSlug: string;
  planId: string;
  planIndex: number; // 0-based index within phase
}

/**
 * Read current checkpoint from STATE.md frontmatter.
 */
export async function readCheckpoint(): Promise<Checkpoint | null> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const match = raw.match(/^---\n([\s\S]+?)\n---/);
    
    if (!match) {
      log.warn("STATE.md missing YAML frontmatter");
      return null;
    }

    const frontmatter = parseYaml(match[1]);
    
    return {
      status: frontmatter.status ?? "idle",
      stoppedAt: frontmatter.stopped_at ?? null,
      lastUpdated: frontmatter.last_updated ?? new Date().toISOString(),
      pipelineState: frontmatter.pipeline_state ? {
        currentPhaseSlug: frontmatter.pipeline_state.current_phase_slug ?? null,
        lastCompletedPhaseSlug: frontmatter.pipeline_state.last_completed_phase_slug ?? null,
        lastCompletedPlan: frontmatter.pipeline_state.last_completed_plan ?? null,
        startedAt: frontmatter.pipeline_state.started_at ?? null,
      } : undefined,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      log.info("STATE.md not found, fresh start");
      return null;
    }
    throw new PipelineError(
      `Failed to read checkpoint: ${err instanceof Error ? err.message : String(err)}`,
      "CHECKPOINT_READ_ERROR"
    );
  }
}

/**
 * Write checkpoint to STATE.md frontmatter.
 * Preserves all existing frontmatter fields not being updated.
 */
export async function writeCheckpoint(update: {
  status?: Checkpoint["status"];
  stoppedAt?: string;
  pipelineState?: Checkpoint["pipelineState"];
}): Promise<void> {
  const raw = await readFile(STATE_PATH, "utf-8");
  const match = raw.match(/^---\n([\s\S]+?)\n---/);
  
  if (!match) {
    throw new PipelineError("STATE.md missing YAML frontmatter", "INVALID_STATE_FORMAT");
  }

  const frontmatter = parseYaml(match[1]);
  
  // Update fields
  if (update.status !== undefined) {
    frontmatter.status = update.status;
  }
  if (update.stoppedAt !== undefined) {
    frontmatter.stopped_at = update.stoppedAt;
  }
  frontmatter.last_updated = new Date().toISOString();
  frontmatter.last_activity = new Date().toISOString().split("T")[0];
  
  if (update.pipelineState !== undefined) {
    frontmatter.pipeline_state = {
      current_phase_slug: update.pipelineState.currentPhaseSlug,
      last_completed_phase_slug: update.pipelineState.lastCompletedPhaseSlug,
      last_completed_plan: update.pipelineState.lastCompletedPlan,
      started_at: update.pipelineState.startedAt,
    };
  }

  // Reconstruct STATE.md with updated frontmatter
  const updatedFrontmatter = stringifyYaml(frontmatter).trim();
  const updatedContent = raw.replace(
    /^---\n[\s\S]+?\n---/,
    `---\n${updatedFrontmatter}\n---`
  );

  await writeFile(STATE_PATH, updatedContent, "utf-8");
  
  log.info("Checkpoint written", {
    status: update.status,
    stoppedAt: update.stoppedAt,
  });
}

/**
 * Get the resume point from the last checkpoint.
 * Returns the next plan to execute after the last completed plan.
 */
export async function getResumePoint(
  phases: Array<{ slug: string; planCount: number }>
): Promise<ResumePoint | null> {
  const checkpoint = await readCheckpoint();
  
  if (!checkpoint?.pipelineState?.lastCompletedPlan) {
    // No checkpoint or no completed plans — start from beginning
    const firstPhase = phases[0];
    if (!firstPhase) return null;
    return {
      phaseSlug: firstPhase.slug,
      planId: generatePlanId(firstPhase.slug, 0),
      planIndex: 0,
    };
  }

  const lastPlanId = checkpoint.pipelineState.lastCompletedPlan;
  const [phaseNum, planNum] = lastPlanId.split("-").map(Number);
  
  // Find current phase
  const currentPhaseIndex = phases.findIndex(
    (p) => extractPhaseNumber(p.slug) === phaseNum
  );
  
  if (currentPhaseIndex === -1) {
    log.warn("Last completed plan references unknown phase", { lastPlanId });
    return null;
  }

  const currentPhase = phases[currentPhaseIndex];
  const nextPlanIndex = planNum; // planNum is 1-based, so it's already the next index

  if (nextPlanIndex < currentPhase.planCount) {
    // More plans in current phase
    return {
      phaseSlug: currentPhase.slug,
      planId: generatePlanId(currentPhase.slug, nextPlanIndex),
      planIndex: nextPlanIndex,
    };
  }

  // Move to next phase
  const nextPhase = phases[currentPhaseIndex + 1];
  if (!nextPhase) {
    // Pipeline complete
    return null;
  }

  return {
    phaseSlug: nextPhase.slug,
    planId: generatePlanId(nextPhase.slug, 0),
    planIndex: 0,
  };
}

function generatePlanId(phaseSlug: string, planIndex: number): string {
  const phaseNum = extractPhaseNumber(phaseSlug);
  const paddedPhase = String(phaseNum).padStart(2, "0");
  const paddedPlan = String(planIndex + 1).padStart(2, "0");
  return `${paddedPhase}-${paddedPlan}`;
}

function extractPhaseNumber(slug: string): number {
  // Slug format: "38-autonomous-pipeline-orchestration"
  const match = slug.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}
