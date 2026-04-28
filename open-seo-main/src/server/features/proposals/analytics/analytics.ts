/**
 * Sales Analytics for proposals.
 * Phase 30-08: Pipeline & Automation
 *
 * Provides:
 * - Pipeline value calculation
 * - Win rate metrics
 * - Average deal size
 * - Time to close
 * - Loss reason aggregation
 */

import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/db/index";
import { proposals, type ProposalSelect } from "@/db/proposal-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "proposal-analytics" });

/**
 * Predefined loss reasons with Lithuanian labels.
 */
export const LOSS_REASONS = [
  { id: "price", label: "Kaina per didele" },
  { id: "competitor", label: "Pasirinko konkurenta" },
  { id: "timing", label: "Netinkamas laikas" },
  { id: "no_response", label: "Neatsake" },
  { id: "internal", label: "Vidinis sprendimas" },
  { id: "other", label: "Kita" },
] as const;

export type LossReasonId = (typeof LOSS_REASONS)[number]["id"];

/**
 * Sales analytics result structure.
 */
export interface SalesAnalytics {
  /** Total value of active proposals in EUR */
  pipelineValue: number;
  /** Count of proposals sent in the period */
  proposalsSent: number;
  /** Percentage of sent proposals that were viewed */
  viewRate: number;
  /** Percentage of closed deals that were won */
  winRate: number;
  /** Average monthly fee of won deals in EUR */
  avgDealSize: number;
  /** Average days from sent to paid */
  avgTimeToClose: number;
  /** Aggregated loss reasons with counts */
  lossReasons: Array<{ reason: string; count: number }>;
}

/**
 * Time period for analytics queries.
 */
export interface AnalyticsPeriod {
  start: Date;
  end: Date;
}

/**
 * Terminal statuses - proposals that have completed their lifecycle.
 */
const TERMINAL_STATUSES = ["paid", "onboarded", "declined", "expired"];

/**
 * Won statuses - proposals that resulted in a deal.
 */
const WON_STATUSES = ["paid", "onboarded"];

/**
 * Active statuses - proposals still in the pipeline.
 */
const ACTIVE_STATUSES = ["draft", "sent", "viewed", "accepted", "signed"];

/**
 * Calculate sales analytics for a workspace within a time period.
 */
export async function calculateSalesAnalytics(
  workspaceId: string,
  period: AnalyticsPeriod
): Promise<SalesAnalytics> {
  // Fetch all proposals for the workspace within the period
  const allProposals = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.workspaceId, workspaceId),
        gte(proposals.createdAt, period.start),
        lte(proposals.createdAt, period.end)
      )
    );

  if (allProposals.length === 0) {
    log.info("No proposals found for analytics", { workspaceId, period });
    return {
      pipelineValue: 0,
      proposalsSent: 0,
      viewRate: 0,
      winRate: 0,
      avgDealSize: 0,
      avgTimeToClose: 0,
      lossReasons: [],
    };
  }

  // Filter by different criteria
  const sent = allProposals.filter((p) => p.sentAt !== null);
  const viewed = allProposals.filter((p) => p.firstViewedAt !== null);
  const won = allProposals.filter((p) => WON_STATUSES.includes(p.status));
  const lost = allProposals.filter((p) => p.status === "declined");
  const active = allProposals.filter((p) => ACTIVE_STATUSES.includes(p.status));

  // Calculate pipeline value (sum of monthly fees for active proposals)
  const pipelineValueCents = active.reduce(
    (sum, p) => sum + (p.monthlyFeeCents ?? 0),
    0
  );
  const pipelineValue = pipelineValueCents / 100;

  // Calculate view rate
  const viewRate = sent.length > 0 ? (viewed.length / sent.length) * 100 : 0;

  // Calculate win rate (won / (won + lost))
  const closedCount = won.length + lost.length;
  const winRate = closedCount > 0 ? (won.length / closedCount) * 100 : 0;

  // Calculate average deal size
  const totalWonValue = won.reduce(
    (sum, p) => sum + (p.monthlyFeeCents ?? 0),
    0
  );
  const avgDealSize = won.length > 0 ? totalWonValue / won.length / 100 : 0;

  // Calculate average time to close
  const avgTimeToClose = calculateAvgTimeToClose(won);

  // Aggregate loss reasons
  const lossReasons = aggregateLossReasons(
    lost as Array<{ declinedReason: string | null }>
  );

  const analytics: SalesAnalytics = {
    pipelineValue,
    proposalsSent: sent.length,
    viewRate,
    winRate,
    avgDealSize,
    avgTimeToClose,
    lossReasons,
  };

  log.info("Sales analytics calculated", {
    workspaceId,
    period,
    proposalCount: allProposals.length,
    analytics,
  });

  return analytics;
}

/**
 * Calculate average time to close in days.
 * Measures days from sentAt to paidAt for won proposals.
 */
export function calculateAvgTimeToClose(
  wonProposals: Array<{ sentAt: Date | null; paidAt: Date | null }>
): number {
  const validProposals = wonProposals.filter(
    (p) => p.sentAt !== null && p.paidAt !== null
  );

  if (validProposals.length === 0) {
    return 0;
  }

  const totalDays = validProposals.reduce((sum, p) => {
    const sentTime = new Date(p.sentAt!).getTime();
    const paidTime = new Date(p.paidAt!).getTime();
    const diffMs = paidTime - sentTime;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return sum + diffDays;
  }, 0);

  return totalDays / validProposals.length;
}

/**
 * Aggregate loss reasons from declined proposals.
 * Returns sorted array by count descending.
 */
export function aggregateLossReasons(
  declinedProposals: Array<{ declinedReason: string | null }>
): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();

  for (const proposal of declinedProposals) {
    if (proposal.declinedReason) {
      const current = counts.get(proposal.declinedReason) ?? 0;
      counts.set(proposal.declinedReason, current + 1);
    }
  }

  const result = Array.from(counts.entries()).map(([reason, count]) => ({
    reason,
    count,
  }));

  // Sort by count descending
  result.sort((a, b) => b.count - a.count);

  return result;
}

/**
 * Get pipeline stage distribution for a workspace.
 */
export async function getPipelineDistribution(
  workspaceId: string
): Promise<Record<string, number>> {
  const allProposals = await db
    .select()
    .from(proposals)
    .where(eq(proposals.workspaceId, workspaceId));

  const distribution: Record<string, number> = {};

  for (const proposal of allProposals) {
    distribution[proposal.status] = (distribution[proposal.status] ?? 0) + 1;
  }

  return distribution;
}

/**
 * Get pipeline value by stage.
 */
export async function getPipelineValueByStage(
  workspaceId: string
): Promise<Record<string, number>> {
  const allProposals = await db
    .select()
    .from(proposals)
    .where(eq(proposals.workspaceId, workspaceId));

  const valueByStage: Record<string, number> = {};

  for (const proposal of allProposals) {
    const value = (proposal.monthlyFeeCents ?? 0) / 100;
    valueByStage[proposal.status] = (valueByStage[proposal.status] ?? 0) + value;
  }

  return valueByStage;
}
