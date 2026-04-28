/**
 * Automation engine for prospect pipeline.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Similar pattern to proposal automation but for prospect stage transitions.
 */
import { eq, and, gte, lt } from "drizzle-orm";
import { db } from "@/db/index";
import { prospects, type PipelineStage } from "@/db/prospect-schema";
import { pipelineAutomationLogs } from "@/db/pipeline-rules-schema";
import { PipelineService } from "../services/PipelineService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "prospect-automation" });

/**
 * Trigger types for prospect automation.
 */
export const PROSPECT_TRIGGER_TYPES = [
  "score_threshold", // Priority score reaches threshold
  "time_in_stage", // Days spent in a stage
  "analysis_complete", // Analysis just finished
] as const;
export type ProspectTriggerType = (typeof PROSPECT_TRIGGER_TYPES)[number];

/**
 * Action types for prospect automation.
 */
export const PROSPECT_ACTION_TYPES = [
  "update_stage", // Move to new pipeline stage
  "notify", // Send notification (future)
  "tag", // Add tag (future)
] as const;
export type ProspectActionType = (typeof PROSPECT_ACTION_TYPES)[number];

export interface ProspectAutomationTrigger {
  type: ProspectTriggerType;
  stage?: PipelineStage;
  scoreThreshold?: number;
  daysInStage?: number;
}

export interface ProspectAutomationAction {
  type: ProspectActionType;
  newStage?: PipelineStage;
  message?: string;
}

export interface ProspectAutomationRule {
  id: string;
  name: string;
  trigger: ProspectAutomationTrigger;
  action: ProspectAutomationAction;
  enabled: boolean;
}

/**
 * Default automation rules for prospect pipeline.
 * These run via PipelineService.handleAnalysisComplete hook.
 */
export const DEFAULT_PROSPECT_RULES: ProspectAutomationRule[] = [
  {
    id: "auto_qualify_high_score",
    name: "Auto-qualify prospects with score >= 70",
    trigger: { type: "score_threshold", stage: "scored", scoreThreshold: 70 },
    action: { type: "update_stage", newStage: "qualified" },
    enabled: true,
  },
  // Future rules can be added here:
  // - Notify on high score
  // - Archive stale prospects
  // - Auto-contact qualified after X days
];

/**
 * Check if an automation has already been executed for a prospect.
 */
export async function hasBeenExecutedForProspect(
  prospectId: string,
  ruleId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: pipelineAutomationLogs.id })
    .from(pipelineAutomationLogs)
    .where(
      and(
        eq(pipelineAutomationLogs.prospectId, prospectId),
        eq(pipelineAutomationLogs.ruleId, ruleId)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Find prospects matching a score threshold trigger.
 */
async function findScoreThresholdMatches(
  trigger: ProspectAutomationTrigger,
  workspaceId: string
): Promise<typeof prospects.$inferSelect[]> {
  if (!trigger.stage || trigger.scoreThreshold === undefined) {
    return [];
  }

  return db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.workspaceId, workspaceId),
        eq(prospects.pipelineStage, trigger.stage),
        gte(prospects.priorityScore, trigger.scoreThreshold)
      )
    );
}

/**
 * Find prospects matching a time_in_stage trigger.
 * Returns prospects that have been in a specific stage longer than daysInStage.
 */
async function findTimeInStageMatches(
  trigger: ProspectAutomationTrigger,
  workspaceId: string
): Promise<typeof prospects.$inferSelect[]> {
  if (!trigger.stage || !trigger.daysInStage) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - trigger.daysInStage);

  return db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.workspaceId, workspaceId),
        eq(prospects.pipelineStage, trigger.stage),
        lt(prospects.updatedAt, cutoff)
      )
    );
}

/**
 * Process automation rules for a workspace.
 * Called periodically via cron or after analysis completion.
 */
export async function processProspectAutomations(workspaceId: string): Promise<{
  processed: number;
  executed: number;
  errors: number;
}> {
  log.info("Processing prospect automations", { workspaceId });

  const rules = DEFAULT_PROSPECT_RULES.filter((r) => r.enabled);

  let processed = 0;
  let executed = 0;
  let errors = 0;

  for (const rule of rules) {
    try {
      let matchingProspects: typeof prospects.$inferSelect[] = [];

      switch (rule.trigger.type) {
        case "score_threshold":
          matchingProspects = await findScoreThresholdMatches(
            rule.trigger,
            workspaceId
          );
          break;
        case "time_in_stage":
          matchingProspects = await findTimeInStageMatches(
            rule.trigger,
            workspaceId
          );
          break;
        // Future: analysis_complete
        default:
          continue;
      }

      processed += matchingProspects.length;

      for (const prospect of matchingProspects) {
        const alreadyExecuted = await hasBeenExecutedForProspect(
          prospect.id,
          rule.id
        );
        if (alreadyExecuted) {
          continue;
        }

        try {
          if (rule.action.type === "update_stage" && rule.action.newStage) {
            await PipelineService.transitionStage(
              prospect.id,
              rule.action.newStage,
              rule.id
            );
          }

          executed++;
          log.info("Prospect automation executed", {
            ruleId: rule.id,
            prospectId: prospect.id,
          });
        } catch (error) {
          errors++;
          log.error(
            "Prospect automation failed",
            error instanceof Error ? error : new Error(String(error)),
            { ruleId: rule.id, prospectId: prospect.id }
          );
        }
      }
    } catch (error) {
      errors++;
      log.error(
        "Rule processing failed",
        error instanceof Error ? error : new Error(String(error)),
        { ruleId: rule.id }
      );
    }
  }

  const result = { processed, executed, errors };
  log.info("Prospect automations complete", result);

  return result;
}
