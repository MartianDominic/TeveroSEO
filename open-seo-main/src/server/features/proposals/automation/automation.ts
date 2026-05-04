/**
 * Automation engine for proposal follow-ups.
 * Phase 30-08: Pipeline & Automation
 *
 * Provides:
 * - Trigger-based automation rules
 * - Time-since-stage triggers
 * - Engagement signal triggers
 * - Email and notification actions
 * - Execution logging to prevent duplicates
 */

import { eq, and, lt, inArray } from "drizzle-orm";
import { db } from "@/db/index";
import { proposals, type ProposalSelect, proposalViews } from "@/db/proposal-schema";
import { automationLogs } from "@/db/automation-schema";
import { notifyAgencySlack } from "@/server/features/proposals/onboarding/notifications";
import { sendFollowUpEmail } from "./email";
import { createLogger } from "@/server/lib/logger";
import type { EngagementSignals } from "@/server/features/proposals/tracking/EngagementSignals";

const log = createLogger({ module: "proposal-automation" });

/**
 * Trigger types for automation rules.
 */
export const TRIGGER_TYPES = [
  "time_since_stage",
  "engagement_signal",
  "manual",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/**
 * Action types for automation rules.
 */
export const ACTION_TYPES = [
  "send_email",
  "notify_agency",
  "update_status",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/**
 * Automation rule trigger configuration.
 */
export interface AutomationTrigger {
  type: TriggerType;
  stage?: string;
  days?: number;
  signal?: string;
}

/**
 * Automation rule action configuration.
 */
export interface AutomationAction {
  type: ActionType;
  template?: string;
  message?: string;
  newStatus?: string;
}

/**
 * Automation rule definition.
 */
export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled: boolean;
}

/**
 * Default automation rules.
 * These are used when no custom rules are configured.
 */
export const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  {
    id: "not_viewed_3d",
    name: "Priminimas: neperzureta 3 dienas",
    trigger: { type: "time_since_stage", stage: "sent", days: 3 },
    action: { type: "send_email", template: "proposal_reminder" },
    enabled: true,
  },
  {
    id: "viewed_no_action_5d",
    name: "Klausimai: perzureta, bet nepriimta",
    trigger: { type: "time_since_stage", stage: "viewed", days: 5 },
    action: { type: "send_email", template: "any_questions" },
    enabled: true,
  },
  {
    id: "hot_prospect",
    name: "Pranesimas: karstas prospektas",
    trigger: { type: "engagement_signal", signal: "hot" },
    action: { type: "notify_agency", message: "Karstas prospektas!" },
    enabled: true,
  },
];

/**
 * Check if an automation has already been executed for a proposal.
 * Queries the database to check for existing execution logs.
 */
export async function hasBeenExecuted(
  proposalId: string,
  ruleId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: automationLogs.id })
    .from(automationLogs)
    .where(
      and(
        eq(automationLogs.proposalId, proposalId),
        eq(automationLogs.ruleId, ruleId)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Batch check if automations have been executed for multiple proposals.
 * Returns a Set of `${proposalId}:${ruleId}` keys that have been executed.
 * FIX: HIGH-17-01 - Eliminates N+1 queries by batching execution checks.
 */
export async function batchHasBeenExecuted(
  proposalIds: string[],
  ruleId: string
): Promise<Set<string>> {
  if (proposalIds.length === 0) {
    return new Set();
  }

  const existing = await db
    .select({ proposalId: automationLogs.proposalId })
    .from(automationLogs)
    .where(
      and(
        inArray(automationLogs.proposalId, proposalIds),
        eq(automationLogs.ruleId, ruleId)
      )
    );

  return new Set(existing.map((e) => `${e.proposalId}:${ruleId}`));
}

/**
 * Log an automation execution to the database.
 * Persists the execution record to prevent duplicate executions after server restart.
 */
export async function logAutomationExecution(
  proposalId: string,
  ruleId: string,
  actionType: string
): Promise<void> {
  const id = `${proposalId}:${ruleId}`;

  await db.insert(automationLogs).values({
    id,
    proposalId,
    ruleId,
    actionType,
    executedAt: new Date(),
  });

  log.info("Automation execution logged", { proposalId, ruleId, actionType });
}

/**
 * Proposal with prospect data for automation actions.
 */
export interface ProposalWithProspect extends ProposalSelect {
  prospect?: {
    contactEmail: string | null;
    companyName: string | null;
    domain: string;
  };
}

/**
 * Find proposals matching a time-since-stage trigger.
 */
async function findTimeSinceStageMatches(
  trigger: AutomationTrigger,
  workspaceId: string
): Promise<ProposalWithProspect[]> {
  if (!trigger.stage || !trigger.days) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - trigger.days);

  const matches = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.workspaceId, workspaceId),
        eq(proposals.status, trigger.stage),
        lt(proposals.updatedAt, cutoff)
      )
    );

  return matches as ProposalWithProspect[];
}

// Constants for engagement signal calculation (imported from EngagementSignals)
const HOT_PROSPECT_VIEWS_THRESHOLD = 3;
const HOT_PROSPECT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const PRICING_FOCUSED_THRESHOLD = 3;
const READY_TO_CLOSE_CTA_THRESHOLD = 2;
const READY_TO_CLOSE_PRICING_THRESHOLD = 2;

/**
 * Calculate engagement signals for multiple proposals in a batch.
 * FIX: HIGH-17-01 - Eliminates N+1 queries by fetching all views in one query.
 */
async function batchCalculateEngagementSignals(
  proposalIds: string[]
): Promise<Map<string, EngagementSignals>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  // Fetch all views for all proposals in one query
  const allViews = await db
    .select()
    .from(proposalViews)
    .where(inArray(proposalViews.proposalId, proposalIds));

  // Group views by proposal ID
  const viewsByProposal = new Map<string, typeof allViews>();
  for (const view of allViews) {
    const existing = viewsByProposal.get(view.proposalId) || [];
    existing.push(view);
    viewsByProposal.set(view.proposalId, existing);
  }

  // Calculate signals for each proposal
  const results = new Map<string, EngagementSignals>();
  const now = Date.now();
  const recentWindowStart = now - HOT_PROSPECT_WINDOW_MS;

  for (const proposalId of proposalIds) {
    const views = viewsByProposal.get(proposalId) || [];

    if (views.length === 0) {
      results.set(proposalId, {
        hot: false,
        pricingFocused: false,
        calculatedRoi: false,
        readyToClose: false,
        score: 0,
      });
      continue;
    }

    // Count views in last 24 hours
    const recentViews = views.filter(
      (v) => new Date(v.viewedAt).getTime() > recentWindowStart
    );

    // Count pricing/investment section views
    const pricingSectionViews = views.filter((v) =>
      v.sectionsViewed?.includes("investment")
    ).length;

    // Count CTA section views
    const ctaSectionViews = views.filter((v) =>
      v.sectionsViewed?.includes("cta")
    ).length;

    // Check if ROI calculator was ever used
    const roiCalculatorUsed = views.some((v) => v.roiCalculatorUsed === true);

    results.set(proposalId, {
      hot: recentViews.length >= HOT_PROSPECT_VIEWS_THRESHOLD,
      pricingFocused: pricingSectionViews >= PRICING_FOCUSED_THRESHOLD,
      calculatedRoi: roiCalculatorUsed,
      readyToClose:
        ctaSectionViews >= READY_TO_CLOSE_CTA_THRESHOLD &&
        pricingSectionViews >= READY_TO_CLOSE_PRICING_THRESHOLD,
      score: 0, // Score not needed for automation matching
    });
  }

  return results;
}

/**
 * Find proposals matching an engagement signal trigger.
 * FIX: HIGH-17-01 - Uses batched engagement signal calculation.
 */
async function findEngagementSignalMatches(
  trigger: AutomationTrigger,
  workspaceId: string
): Promise<ProposalWithProspect[]> {
  if (!trigger.signal) {
    return [];
  }

  // Get all proposals in viewed status (most relevant for engagement signals)
  // Filtered by workspaceId to ensure we only process proposals from the correct organization
  const viewedProposals = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.workspaceId, workspaceId),
        eq(proposals.status, "viewed")
      )
    );

  if (viewedProposals.length === 0) {
    return [];
  }

  // Batch calculate engagement signals for all proposals
  const signalsMap = await batchCalculateEngagementSignals(
    viewedProposals.map((p) => p.id)
  );

  const matching: ProposalWithProspect[] = [];

  for (const proposal of viewedProposals) {
    const signals = signalsMap.get(proposal.id);
    if (!signals) continue;

    // Check if the specified signal is true
    if (trigger.signal === "hot" && signals.hot) {
      matching.push(proposal as ProposalWithProspect);
    } else if (trigger.signal === "pricingFocused" && signals.pricingFocused) {
      matching.push(proposal as ProposalWithProspect);
    } else if (trigger.signal === "readyToClose" && signals.readyToClose) {
      matching.push(proposal as ProposalWithProspect);
    }
  }

  return matching;
}

/**
 * Find proposals matching an automation rule trigger.
 * Filters by workspaceId to ensure we only process proposals from the correct organization.
 */
export async function findMatchingProposals(
  rule: AutomationRule,
  workspaceId: string
): Promise<ProposalWithProspect[]> {
  switch (rule.trigger.type) {
    case "time_since_stage":
      return findTimeSinceStageMatches(rule.trigger, workspaceId);

    case "engagement_signal":
      return findEngagementSignalMatches(rule.trigger, workspaceId);

    case "manual":
      // Manual triggers don't auto-match proposals
      return [];

    default:
      log.warn("Unknown trigger type", { type: rule.trigger.type });
      return [];
  }
}

/**
 * Execute an automation action for a proposal.
 */
export async function executeAction(
  action: AutomationAction,
  proposal: ProposalWithProspect
): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://app.tevero.io";
  const proposalUrl = `${appUrl}/p/${proposal.token}`;

  switch (action.type) {
    case "send_email":
      if (!proposal.prospect?.contactEmail) {
        log.warn("Cannot send email - no contact email", {
          proposalId: proposal.id,
        });
        return;
      }

      await sendFollowUpEmail({
        to: proposal.prospect.contactEmail,
        template: action.template as "proposal_reminder" | "any_questions",
        companyName: proposal.prospect.companyName ?? proposal.prospect.domain,
        proposalUrl,
        recipientName: undefined,
      });
      break;

    case "notify_agency":
      await notifyAgencySlack({
        clientName: proposal.prospect?.companyName ?? "Unknown",
        domain: proposal.prospect?.domain ?? "unknown.com",
        monthlyValue: (proposal.monthlyFeeCents ?? 0) / 100,
        projectId: proposal.id,
      });
      break;

    case "update_status":
      if (action.newStatus) {
        await db
          .update(proposals)
          .set({
            status: action.newStatus,
            updatedAt: new Date(),
          })
          .where(eq(proposals.id, proposal.id));

        log.info("Proposal status updated by automation", {
          proposalId: proposal.id,
          newStatus: action.newStatus,
        });
      }
      break;

    default:
      log.warn("Unknown action type", { type: action.type });
  }
}

/**
 * Process all automation rules for a specific workspace.
 * This should be called periodically (e.g., hourly via cron) with the workspace to process.
 *
 * @param workspaceId - The workspace ID to filter proposals by. Required to ensure
 *                      automations only process proposals belonging to the correct organization.
 */
export async function processAutomations(workspaceId: string): Promise<{
  processed: number;
  executed: number;
  errors: number;
}> {
  log.info("Processing automations", { workspaceId });

  // Use default automations (in production, these would come from database)
  const rules = DEFAULT_AUTOMATIONS.filter((r) => r.enabled);

  let processed = 0;
  let executed = 0;
  let errors = 0;

  for (const rule of rules) {
    try {
      const matchingProposals = await findMatchingProposals(rule, workspaceId);
      processed += matchingProposals.length;

      if (matchingProposals.length === 0) {
        continue;
      }

      // FIX: HIGH-17-01 - Batch check execution status for all proposals
      const executedSet = await batchHasBeenExecuted(
        matchingProposals.map((p) => p.id),
        rule.id
      );

      for (const proposal of matchingProposals) {
        // Check if already executed using the batched result
        if (executedSet.has(`${proposal.id}:${rule.id}`)) {
          continue;
        }

        try {
          // Execute the action
          await executeAction(rule.action, proposal);

          // Log the execution
          await logAutomationExecution(proposal.id, rule.id, rule.action.type);

          executed++;
          log.info("Automation executed", {
            ruleId: rule.id,
            proposalId: proposal.id,
          });
        } catch (error) {
          errors++;
          log.error(
            "Automation execution failed",
            error instanceof Error ? error : new Error(String(error)),
            { ruleId: rule.id, proposalId: proposal.id }
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
  log.info("Automations processing complete", result);

  return result;
}

/**
 * Clear execution logs for a specific proposal (for testing).
 * Deletes all automation logs for the given proposal ID from the database.
 */
export async function clearExecutionLogs(proposalId?: string): Promise<void> {
  if (proposalId) {
    await db
      .delete(automationLogs)
      .where(eq(automationLogs.proposalId, proposalId));
  } else {
    await db.delete(automationLogs);
  }
}
