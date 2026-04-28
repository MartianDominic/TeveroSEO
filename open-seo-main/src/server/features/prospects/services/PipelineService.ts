/**
 * Pipeline stage management service.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Handles stage transitions with logging and validation.
 */
import { eq, and, count } from "drizzle-orm";
import { db } from "@/db/index";
import {
  prospects,
  PIPELINE_STAGES,
  type PipelineStage,
} from "@/db/prospect-schema";
import { pipelineAutomationLogs } from "@/db/pipeline-rules-schema";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "PipelineService" });

// Valid stage transitions - key is "from", value is array of valid "to" stages
const VALID_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  new: ["analyzing", "archived"],
  analyzing: ["scored", "new"], // can go back to new on failure
  scored: ["qualified", "contacted", "archived"],
  qualified: ["contacted", "archived"],
  contacted: ["negotiating", "archived"],
  negotiating: ["converted", "contacted", "archived"],
  converted: [], // terminal state
  archived: ["new"], // can re-activate
};

export interface StageDistribution {
  stage: PipelineStage;
  count: number;
}

export const PipelineService = {
  /**
   * Transition a prospect to a new pipeline stage.
   * Validates the transition and logs it.
   *
   * @throws VALIDATION_ERROR if transition is invalid
   */
  async transitionStage(
    prospectId: string,
    toStage: PipelineStage,
    ruleId: string = "manual"
  ): Promise<void> {
    // Get current stage
    const [prospect] = await db
      .select({ pipelineStage: prospects.pipelineStage })
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);

    if (!prospect) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${prospectId}`);
    }

    const fromStage = prospect.pipelineStage as PipelineStage;

    // Validate transition (allow same-stage for idempotency)
    if (fromStage !== toStage) {
      const validTargets = VALID_TRANSITIONS[fromStage] || [];
      if (!validTargets.includes(toStage)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Invalid stage transition: ${fromStage} -> ${toStage}`
        );
      }
    }

    const now = new Date();

    // Update prospect stage
    await db
      .update(prospects)
      .set({
        pipelineStage: toStage,
        updatedAt: now,
      })
      .where(eq(prospects.id, prospectId));

    // Log the transition (skip if same stage)
    if (fromStage !== toStage) {
      await db.insert(pipelineAutomationLogs).values({
        id: nanoid(),
        prospectId,
        ruleId,
        fromStage,
        toStage,
        executedAt: now,
      });

      log.info("Pipeline stage transition", {
        prospectId,
        fromStage,
        toStage,
        ruleId,
      });
    }
  },

  /**
   * Get all prospects in a specific pipeline stage.
   */
  async getProspectsByStage(
    workspaceId: string,
    stage: PipelineStage
  ): Promise<typeof prospects.$inferSelect[]> {
    return db
      .select()
      .from(prospects)
      .where(
        and(
          eq(prospects.workspaceId, workspaceId),
          eq(prospects.pipelineStage, stage)
        )
      );
  },

  /**
   * Get distribution of prospects across pipeline stages.
   */
  async getStageDistribution(workspaceId: string): Promise<StageDistribution[]> {
    const result = await db
      .select({
        stage: prospects.pipelineStage,
        count: count(),
      })
      .from(prospects)
      .where(eq(prospects.workspaceId, workspaceId))
      .groupBy(prospects.pipelineStage);

    // Ensure all stages are represented (even if 0)
    const distribution: StageDistribution[] = PIPELINE_STAGES.map((stage) => {
      const found = result.find((r) => r.stage === stage);
      return { stage, count: found?.count ?? 0 };
    });

    return distribution;
  },

  /**
   * Auto-transition based on analysis completion and score.
   * Called by analysis worker after updating results.
   */
  async handleAnalysisComplete(
    prospectId: string,
    priorityScore: number | null
  ): Promise<void> {
    // First, move to scored
    await this.transitionStage(prospectId, "scored", "analysis_complete");

    // If high score, auto-qualify
    if (priorityScore !== null && priorityScore >= 70) {
      await this.transitionStage(
        prospectId,
        "qualified",
        "auto_qualify_high_score"
      );
      log.info("Auto-qualified high-scoring prospect", {
        prospectId,
        priorityScore,
      });
    }
  },
};
