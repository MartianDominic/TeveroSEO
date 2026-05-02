/**
 * Dashboard metrics API handler.
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * Provides:
 * - getDashboardMetrics: Returns formatted metrics for dashboard display
 * - Triggers background refresh for stale/missing metrics
 *
 * Threat mitigations:
 * - T-62-04-01: Workspace scoping via session validation
 * - T-62-04-02: Rate limiting via queue (1 computation per workspace per minute)
 */
import { getMetricsService } from "../services/MetricsService";
import { enqueueWorkspaceMetrics } from "@/server/queues/pipelineMetricsQueue";
import type { PipelineMetricsSelect } from "@/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "command-center-metrics-api" });

// Rate limit tracking (simple in-memory, resets on restart)
const computeRequestTimes = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 minute between compute requests per workspace

/**
 * Dashboard metrics response structure.
 */
export interface DashboardMetricsResponse {
  pending: boolean;
  metrics: DashboardMetrics | null;
  computedAt?: Date;
  isStale?: boolean;
}

/**
 * Formatted metrics for dashboard display.
 */
export interface DashboardMetrics {
  today: {
    overdue: number;
    dueToday: number;
    awaitingYou: number;
    new: number;
  };
  pipeline: {
    prospects: {
      new: number;
      analyzing: number;
      scored: number;
      qualified: number;
      contacted: number;
      negotiating: number;
    };
    proposals: {
      draft: number;
      sent: number;
      viewed: number;
      accepted: number;
    };
    agreements: {
      draft: number;
      sent: number;
      pending: number;
      signed: number;
      executed: number;
    };
    payments: {
      draft: number;
      sent: number;
      overdue: number;
      paid30d: number;
    };
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    outstanding: number;
    overdue: number;
  };
  conversions: {
    winRate: number;
    avgCycleDays: number;
    prospectToQualified: number;
    qualifiedToProposal: number;
    proposalToSigned: number;
  };
}

/**
 * Get dashboard metrics for a workspace.
 * Returns cached metrics if fresh, triggers background refresh if stale.
 *
 * @param workspaceId - The workspace to get metrics for
 * @returns Dashboard metrics response
 */
export async function getDashboardMetrics(
  workspaceId: string
): Promise<DashboardMetricsResponse> {
  const metricsService = getMetricsService();
  const metrics = await metricsService.getMetrics(workspaceId);

  if (!metrics) {
    // No metrics exist - trigger computation and return pending
    await triggerComputeIfAllowed(workspaceId);
    return { pending: true, metrics: null };
  }

  // Check if metrics are stale (> 10 minutes old)
  const isStale = Date.now() - metrics.computedAt.getTime() > 10 * 60 * 1000;
  if (isStale) {
    // Trigger refresh in background, return current data
    await triggerComputeIfAllowed(workspaceId);
  }

  return {
    pending: false,
    metrics: formatMetricsForDashboard(metrics),
    computedAt: metrics.computedAt,
    isStale,
  };
}

/**
 * Trigger metrics computation if rate limit allows.
 * Rate limit: 1 request per workspace per minute.
 *
 * @param workspaceId - The workspace to compute metrics for
 */
async function triggerComputeIfAllowed(workspaceId: string): Promise<void> {
  const lastRequest = computeRequestTimes.get(workspaceId) ?? 0;
  const now = Date.now();

  if (now - lastRequest < RATE_LIMIT_MS) {
    log.debug("Rate limited metrics computation", { workspaceId });
    return;
  }

  computeRequestTimes.set(workspaceId, now);
  await enqueueWorkspaceMetrics(workspaceId);
  log.debug("Enqueued metrics computation", { workspaceId });
}

/**
 * Format raw metrics for dashboard display.
 * Converts cents to display values and structures data for UI components.
 *
 * @param metrics - Raw pipeline metrics from database
 * @returns Formatted dashboard metrics
 */
function formatMetricsForDashboard(
  metrics: PipelineMetricsSelect
): DashboardMetrics {
  return {
    today: {
      // Combine overdue items
      overdue: metrics.invoicesOverdue + metrics.contractsExpiring7d,
      dueToday: 0, // TODO: Would need follow_ups integration
      // Awaiting user action
      awaitingYou:
        metrics.proposalsViewed + metrics.contractsPendingSignature,
      new: metrics.prospectsNew,
    },
    pipeline: {
      prospects: {
        new: metrics.prospectsNew,
        analyzing: metrics.prospectsAnalyzing,
        scored: metrics.prospectsScored,
        qualified: metrics.prospectsQualified,
        contacted: metrics.prospectsContacted,
        negotiating: metrics.prospectsNegotiating,
      },
      proposals: {
        draft: metrics.proposalsDraft,
        sent: metrics.proposalsSent,
        viewed: metrics.proposalsViewed,
        accepted: metrics.proposalsAccepted,
      },
      agreements: {
        draft: metrics.contractsDraft,
        sent: metrics.contractsSent,
        pending: metrics.contractsPendingSignature,
        signed: metrics.contractsSigned,
        executed: metrics.contractsExecuted,
      },
      payments: {
        draft: metrics.invoicesDraft,
        sent: metrics.invoicesSent,
        overdue: metrics.invoicesOverdue,
        paid30d: metrics.invoicesPaid30d,
      },
    },
    revenue: {
      // Return cents (frontend will format)
      thisMonth: metrics.revenueThisMonthCents,
      lastMonth: metrics.revenueLastMonthCents,
      outstanding: metrics.outstandingCents,
      overdue: metrics.overdueAmountCents,
    },
    conversions: {
      // Convert from percentage * 100 to decimal
      winRate: metrics.winRatePct / 10000,
      avgCycleDays: metrics.avgCycleDays,
      prospectToQualified: metrics.prospectToQualifiedPct / 10000,
      qualifiedToProposal: metrics.qualifiedToProposalPct / 10000,
      proposalToSigned: metrics.proposalToSignedPct / 10000,
    },
  };
}
