/**
 * AlertDetectionService - Smart alert detection and management
 * Phase 62-07: Smart Alert Detection
 *
 * Implements 5 alert rules per DESIGN.md Section 4.1:
 * - high_value_stuck: Proposals > 5000 EUR with no update in 7+ days
 * - win_rate_declining: Win rate dropped > 5%
 * - contract_expiring_soon: Contracts expiring within 14 days
 * - unassigned_prospects: 3+ prospects without an owner in last 2 days
 * - collection_velocity_drop: Average collection time increased > 5 days
 */
import { eq, and, inArray, gte, lte, isNull, desc } from "drizzle-orm";
import {
  db,
  proposals,
  contracts,
  prospects,
  organization,
  type PipelineMetricsSelect,
  type SmartAlertInsert,
} from "@/db";
import type { SmartAlertRepositoryInterface } from "../repositories/SmartAlertRepository";
import { createLogger } from "@/server/lib/logger";

// Type for the Drizzle database client
type DrizzleClient = typeof db;

const log = createLogger({ module: "AlertDetectionService" });

/**
 * Extended metrics interface with historical comparison fields.
 * These fields are computed by the metrics worker.
 */
export interface ExtendedPipelineMetrics extends PipelineMetricsSelect {
  winRatePreviousPct?: number;
  avgCollectionDaysHistorical?: number;
}

/**
 * Workspace info for alert context.
 */
export interface Workspace {
  id: string;
  name?: string;
}

/**
 * Alert rule definition.
 */
export interface AlertRule {
  type: string;
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  detectFn: (
    metrics: ExtendedPipelineMetrics,
    workspace: Workspace,
    db: DrizzleClient
  ) => Promise<Omit<SmartAlertInsert, "id" | "createdAt"> | null>;
}

/**
 * Notification service interface for sending alert notifications.
 */
export interface NotificationServiceInterface {
  sendAlertNotification(
    workspaceId: string,
    alert: Omit<SmartAlertInsert, "id" | "createdAt">
  ): Promise<void>;
}

/**
 * Format cents as currency string.
 */
function formatCurrency(cents: number, currency = "EUR"): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate days since a given date.
 */
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtract days from a date.
 */
function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Alert rules per DESIGN.md Section 4.1.
 */
export const ALERT_RULES: AlertRule[] = [
  {
    type: "high_value_stuck",
    name: "High-value deal stuck",
    severity: "high",
    detectFn: async (metrics, workspace, dbClient) => {
      const sevenDaysAgo = subDays(new Date(), 7);

      // Find proposals > 5000 EUR with no update in 7+ days
      // Use setupFeeCents + (monthlyFeeCents * 12) as annual value approximation
      const stuckDeals = await dbClient.query.proposals.findMany({
        where: and(
          eq(proposals.workspaceId, workspace.id),
          inArray(proposals.status, ["sent", "viewed"]),
          lte(proposals.updatedAt, sevenDaysAgo)
        ),
        with: {
          prospect: {
            columns: { companyName: true },
          },
        },
        orderBy: [desc(proposals.monthlyFeeCents)],
        limit: 10, // Get more candidates, filter in JS
      });

      // Filter for high-value deals (> 5000 EUR annual value)
      const highValueStuck = stuckDeals.filter((deal) => {
        const setupFee = deal.setupFeeCents ?? 0;
        const monthlyFee = deal.monthlyFeeCents ?? 0;
        const annualValue = setupFee + monthlyFee * 12;
        return annualValue >= 500000; // 5000 EUR
      });

      if (highValueStuck.length === 0) return null;

      const deal = highValueStuck[0];
      const daysSinceUpdate = daysSince(deal.updatedAt);
      const totalValueCents =
        (deal.setupFeeCents ?? 0) + (deal.monthlyFeeCents ?? 0) * 12;
      const clientName = deal.prospect?.companyName ?? "Unknown";

      return {
        workspaceId: workspace.id,
        alertType: "high_value_stuck",
        severity: "high",
        title: "High-value deal stuck",
        description: `Proposal for ${clientName} (${formatCurrency(totalValueCents)}) has no activity in ${daysSinceUpdate} days`,
        entityType: "proposal",
        entityId: deal.id,
        metricCurrent: daysSinceUpdate.toString(),
        metricUnit: "days",
        suggestedAction: "Review and follow up",
        actionUrl: `/proposals/${deal.id}`,
      };
    },
  },
  {
    type: "win_rate_declining",
    name: "Win rate declining",
    severity: "medium",
    detectFn: async (metrics, workspace) => {
      const extMetrics = metrics as ExtendedPipelineMetrics;

      // Need previous win rate for comparison
      if (!extMetrics.winRatePreviousPct) return null;

      // Check if current rate is more than 5% (500 basis points) lower
      if (metrics.winRatePct >= extMetrics.winRatePreviousPct - 500) return null;

      const currentPct = (metrics.winRatePct / 100).toFixed(1);
      const previousPct = (extMetrics.winRatePreviousPct / 100).toFixed(1);

      return {
        workspaceId: workspace.id,
        alertType: "win_rate_declining",
        severity: "medium",
        title: "Win rate declining",
        description: `Win rate dropped from ${previousPct}% to ${currentPct}%`,
        metricCurrent: currentPct,
        metricPrevious: previousPct,
        metricUnit: "%",
        suggestedAction: "Review recent lost deals for patterns",
      };
    },
  },
  {
    type: "contract_expiring_soon",
    name: "Contracts expiring soon",
    severity: "high",
    detectFn: async (metrics, workspace, dbClient) => {
      const now = new Date();
      const fourteenDaysFromNow = addDays(now, 14);

      // Find contracts expiring in the next 14 days
      const expiring = await dbClient.query.contracts.findMany({
        where: and(
          eq(contracts.workspaceId, workspace.id),
          eq(contracts.status, "executed"),
          lte(contracts.expiresAt, fourteenDaysFromNow),
          gte(contracts.expiresAt, now)
        ),
      });

      if (expiring.length === 0) return null;

      return {
        workspaceId: workspace.id,
        alertType: "contract_expiring_soon",
        severity: "high",
        title: `${expiring.length} contract(s) expiring soon`,
        description: `${expiring.length} contracts will expire in the next 14 days`,
        metricCurrent: expiring.length.toString(),
        metricUnit: "contracts",
        suggestedAction: "Review and send renewal proposals",
      };
    },
  },
  {
    type: "unassigned_prospects",
    name: "Unassigned prospects",
    severity: "low",
    detectFn: async (metrics, workspace, dbClient) => {
      const twoDaysAgo = subDays(new Date(), 2);

      // Find recent prospects without an owner
      const unassigned = await dbClient.query.prospects.findMany({
        where: and(
          eq(prospects.workspaceId, workspace.id),
          isNull(prospects.assignedTo),
          gte(prospects.createdAt, twoDaysAgo)
        ),
      });

      // Only alert if 3+ unassigned
      if (unassigned.length < 3) return null;

      return {
        workspaceId: workspace.id,
        alertType: "unassigned_prospects",
        severity: "low",
        title: "Unassigned prospects",
        description: `${unassigned.length} prospects without an owner`,
        metricCurrent: unassigned.length.toString(),
        metricUnit: "prospects",
        suggestedAction: "Assign team members to new prospects",
      };
    },
  },
  {
    type: "collection_velocity_drop",
    name: "Payment velocity drop",
    severity: "medium",
    detectFn: async (metrics, workspace) => {
      const extMetrics = metrics as ExtendedPipelineMetrics;

      // Need historical average for comparison
      if (!extMetrics.avgCollectionDaysHistorical) return null;

      // Check if current is more than 5 days slower
      if (
        metrics.avgCollectionDays <=
        extMetrics.avgCollectionDaysHistorical + 5
      )
        return null;

      return {
        workspaceId: workspace.id,
        alertType: "collection_velocity_drop",
        severity: "medium",
        title: "Payment velocity drop",
        description: `Average collection time increased from ${extMetrics.avgCollectionDaysHistorical} to ${metrics.avgCollectionDays} days`,
        metricCurrent: metrics.avgCollectionDays.toString(),
        metricPrevious: extMetrics.avgCollectionDaysHistorical.toString(),
        metricUnit: "days",
        suggestedAction: "Review overdue invoices and follow up",
      };
    },
  },
];

/**
 * AlertDetectionService for evaluating alert rules and managing alerts.
 */
export class AlertDetectionService {
  constructor(
    private readonly alertRepo: SmartAlertRepositoryInterface,
    private readonly dbClient: DrizzleClient,
    private readonly notificationService?: NotificationServiceInterface
  ) {}

  /**
   * Detect alerts for a workspace.
   * Evaluates all rules and creates/resolves alerts as needed.
   */
  async detectAlerts(
    workspaceId: string,
    metrics?: ExtendedPipelineMetrics
  ): Promise<void> {
    log.info("Detecting alerts for workspace", { workspaceId });

    // Get workspace info
    const workspace = await this.dbClient.query.organization.findFirst({
      where: eq(organization.id, workspaceId),
    });

    if (!workspace) {
      log.warn("Workspace not found, skipping alert detection", { workspaceId });
      return;
    }

    // Use provided metrics or create a minimal placeholder
    // In production, metrics should be passed from the worker
    const workspaceMetrics: ExtendedPipelineMetrics = metrics ?? {
      id: "",
      workspaceId,
      prospectsNew: 0,
      prospectsAnalyzing: 0,
      prospectsScored: 0,
      prospectsQualified: 0,
      prospectsContacted: 0,
      prospectsNegotiating: 0,
      prospectsConverted30d: 0,
      prospectsArchived30d: 0,
      proposalsDraft: 0,
      proposalsSent: 0,
      proposalsViewed: 0,
      proposalsAccepted: 0,
      proposalsDeclined30d: 0,
      proposalsExpired30d: 0,
      contractsDraft: 0,
      contractsSent: 0,
      contractsPendingSignature: 0,
      contractsSigned: 0,
      contractsExecuted: 0,
      contractsExpiring7d: 0,
      invoicesDraft: 0,
      invoicesSent: 0,
      invoicesPaid30d: 0,
      invoicesOverdue: 0,
      pipelineValueDraftCents: 0,
      pipelineValueSentCents: 0,
      pipelineValueSignedCents: 0,
      revenueThisMonthCents: 0,
      revenueLastMonthCents: 0,
      outstandingCents: 0,
      overdueAmountCents: 0,
      winRatePct: 0,
      prospectToQualifiedPct: 0,
      qualifiedToProposalPct: 0,
      proposalToSignedPct: 0,
      avgCycleDays: 0,
      avgCollectionDays: 0,
      currency: "EUR",
      computedAt: new Date(),
      computationDurationMs: null,
    };

    // Evaluate each rule
    for (const rule of ALERT_RULES) {
      await this.evaluateRule(rule, workspaceMetrics, workspace as Workspace);
    }

    log.info("Alert detection complete", { workspaceId });
  }

  /**
   * Evaluate a single alert rule.
   * Creates alert if condition detected and no existing active alert.
   * Resolves alert if condition cleared.
   */
  private async evaluateRule(
    rule: AlertRule,
    metrics: ExtendedPipelineMetrics,
    workspace: Workspace
  ): Promise<void> {
    try {
      // Check for existing active alert of this type
      const existing = await this.alertRepo.findActiveByType(
        workspace.id,
        rule.type
      );

      // Detect if condition applies
      const newAlert = await rule.detectFn(metrics, workspace, this.dbClient);

      if (newAlert && !existing) {
        // Create new alert
        await this.alertRepo.create(newAlert as any);

        // Send notification
        if (this.notificationService) {
          await this.notificationService.sendAlertNotification(
            workspace.id,
            newAlert
          );
        }

        log.info("Created alert", {
          workspaceId: workspace.id,
          alertType: rule.type,
          severity: rule.severity,
        });
      } else if (!newAlert && existing) {
        // Auto-resolve existing alert
        await this.alertRepo.resolve(existing.id);

        log.info("Auto-resolved alert", {
          workspaceId: workspace.id,
          alertType: rule.type,
          alertId: existing.id,
        });
      }
    } catch (error) {
      log.error(
        `Alert rule ${rule.type} failed`,
        error instanceof Error ? error : new Error(String(error)),
        { workspaceId: workspace.id }
      );
    }
  }

  /**
   * Dismiss an alert (user action).
   */
  async dismissAlert(alertId: string, userId: string): Promise<void> {
    await this.alertRepo.dismiss(alertId, userId);
  }

  /**
   * Get active alerts for a workspace.
   */
  async getActiveAlerts(workspaceId: string) {
    return this.alertRepo.findByWorkspace(workspaceId, true);
  }

  /**
   * Expire old alerts.
   */
  async expireOldAlerts(): Promise<number> {
    return this.alertRepo.expireOld();
  }
}

// Singleton instance
let serviceInstance: AlertDetectionService | null = null;

/**
 * Get the singleton service instance.
 */
export function getAlertDetectionService(): AlertDetectionService {
  if (!serviceInstance) {
    const { getSmartAlertRepository } = require("../repositories/SmartAlertRepository");
    serviceInstance = new AlertDetectionService(getSmartAlertRepository(), db);
  }
  return serviceInstance;
}
