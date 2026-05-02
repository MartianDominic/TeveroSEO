/**
 * MetricsService - Pipeline metrics computation and retrieval
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * Provides:
 * - getMetrics: Get cached metrics for dashboard display
 * - computeWorkspaceMetrics: Compute all metrics for a workspace
 *
 * Metrics computed:
 * - Prospect counts by pipeline stage
 * - Proposal counts by status
 * - Contract counts by status
 * - Invoice counts by status
 * - Financial metrics (pipeline values, revenue, outstanding, overdue)
 * - Conversion rates (win rate, stage-to-stage)
 * - Cycle times (average deal cycle, collection time)
 */
import { eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  pipelineMetrics,
  prospects,
  proposals,
  contracts,
  invoices,
  dealOutcomes,
  type PipelineMetricsSelect,
  type PipelineMetricsInsert,
} from "@/db";
import {
  PipelineMetricsRepository,
  type PipelineMetricsRepositoryInterface,
} from "../repositories/PipelineMetricsRepository";
import { createLogger } from "@/server/lib/logger";

// Type for the Drizzle database client
type DrizzleClient = typeof db;

const log = createLogger({ module: "MetricsService" });

/**
 * Prospect counts by pipeline stage.
 */
export interface ProspectCounts {
  prospectsNew: number;
  prospectsAnalyzing: number;
  prospectsScored: number;
  prospectsQualified: number;
  prospectsContacted: number;
  prospectsNegotiating: number;
  prospectsConverted30d: number;
  prospectsArchived30d: number;
}

/**
 * Proposal counts by status.
 */
export interface ProposalCounts {
  proposalsDraft: number;
  proposalsSent: number;
  proposalsViewed: number;
  proposalsAccepted: number;
  proposalsDeclined30d: number;
  proposalsExpired30d: number;
}

/**
 * Contract counts by status.
 */
export interface ContractCounts {
  contractsDraft: number;
  contractsSent: number;
  contractsPendingSignature: number;
  contractsSigned: number;
  contractsExecuted: number;
  contractsExpiring7d: number;
}

/**
 * Invoice counts by status.
 */
export interface InvoiceCounts {
  invoicesDraft: number;
  invoicesSent: number;
  invoicesPaid30d: number;
  invoicesOverdue: number;
}

/**
 * Financial metrics (all in cents).
 */
export interface FinancialMetrics {
  pipelineValueDraftCents: number;
  pipelineValueSentCents: number;
  pipelineValueSignedCents: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  outstandingCents: number;
  overdueAmountCents: number;
}

/**
 * Conversion rates (percentage * 100 for precision).
 */
export interface ConversionRates {
  winRatePct: number;
  prospectToQualifiedPct: number;
  qualifiedToProposalPct: number;
  proposalToSignedPct: number;
}

/**
 * Cycle times (in days).
 */
export interface CycleTimes {
  avgCycleDays: number;
  avgCollectionDays: number;
}

/**
 * MetricsService for computing and retrieving pipeline metrics.
 */
export class MetricsService {
  constructor(
    private readonly metricsRepo: PipelineMetricsRepositoryInterface,
    private readonly dbClient: DrizzleClient = db
  ) {}

  /**
   * Get cached metrics for a workspace.
   * Returns null if no metrics exist.
   */
  async getMetrics(workspaceId: string): Promise<PipelineMetricsSelect | null> {
    return this.metricsRepo.getByWorkspace(workspaceId);
  }

  /**
   * Compute all metrics for a workspace and store them.
   * Runs parallel queries for performance.
   */
  async computeWorkspaceMetrics(
    workspaceId: string
  ): Promise<PipelineMetricsSelect> {
    const startTime = Date.now();
    log.info("Computing metrics for workspace", { workspaceId });

    // Parallel queries for all metric categories
    const [
      prospectCounts,
      proposalCounts,
      contractCounts,
      invoiceCounts,
      financialMetrics,
      conversionRates,
      cycleTimes,
    ] = await Promise.all([
      this.countProspects(workspaceId),
      this.countProposals(workspaceId),
      this.countContracts(workspaceId),
      this.countInvoices(workspaceId),
      this.computeFinancials(workspaceId),
      this.computeConversionRates(workspaceId),
      this.computeCycleTimes(workspaceId),
    ]);

    const computationDurationMs = Date.now() - startTime;

    const metrics: Omit<PipelineMetricsInsert, "id"> = {
      workspaceId,
      ...prospectCounts,
      ...proposalCounts,
      ...contractCounts,
      ...invoiceCounts,
      ...financialMetrics,
      ...conversionRates,
      ...cycleTimes,
      currency: "EUR",
      computedAt: new Date(),
      computationDurationMs,
    };

    // Upsert metrics
    await this.metricsRepo.upsert(workspaceId, metrics);

    log.info("Metrics computed successfully", {
      workspaceId,
      computationDurationMs,
    });

    // Return the computed metrics
    const stored = await this.metricsRepo.getByWorkspace(workspaceId);
    if (!stored) {
      throw new Error(`Failed to retrieve metrics after upsert for ${workspaceId}`);
    }
    return stored;
  }

  /**
   * Count prospects by pipeline stage.
   */
  private async countProspects(workspaceId: string): Promise<ProspectCounts> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count by pipeline_stage using GROUP BY
    const stageCountsResult = await this.dbClient
      .select({
        stage: prospects.pipelineStage,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(prospects)
      .where(eq(prospects.workspaceId, workspaceId))
      .groupBy(prospects.pipelineStage);

    const stageCounts: Record<string, number> = {};
    for (const row of stageCountsResult) {
      stageCounts[row.stage] = row.count;
    }

    // Count converted in last 30 days
    const converted30dResult = await this.dbClient
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(prospects)
      .where(
        and(
          eq(prospects.workspaceId, workspaceId),
          eq(prospects.pipelineStage, "converted"),
          gte(prospects.updatedAt, thirtyDaysAgo)
        )
      );

    // Count archived in last 30 days
    const archived30dResult = await this.dbClient
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(prospects)
      .where(
        and(
          eq(prospects.workspaceId, workspaceId),
          eq(prospects.pipelineStage, "archived"),
          gte(prospects.updatedAt, thirtyDaysAgo)
        )
      );

    return {
      prospectsNew: stageCounts["new"] ?? 0,
      prospectsAnalyzing: stageCounts["analyzing"] ?? 0,
      prospectsScored: stageCounts["scored"] ?? 0,
      prospectsQualified: stageCounts["qualified"] ?? 0,
      prospectsContacted: stageCounts["contacted"] ?? 0,
      prospectsNegotiating: stageCounts["negotiating"] ?? 0,
      prospectsConverted30d: converted30dResult[0]?.count ?? 0,
      prospectsArchived30d: archived30dResult[0]?.count ?? 0,
    };
  }

  /**
   * Count proposals by status.
   */
  private async countProposals(workspaceId: string): Promise<ProposalCounts> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count by status using GROUP BY
    const statusCountsResult = await this.dbClient
      .select({
        status: proposals.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(proposals)
      .where(eq(proposals.workspaceId, workspaceId))
      .groupBy(proposals.status);

    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsResult) {
      statusCounts[row.status] = row.count;
    }

    // Count declined in last 30 days
    const declined30dResult = await this.dbClient
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.workspaceId, workspaceId),
          eq(proposals.status, "declined"),
          gte(proposals.updatedAt, thirtyDaysAgo)
        )
      );

    // Count expired in last 30 days
    const expired30dResult = await this.dbClient
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.workspaceId, workspaceId),
          eq(proposals.status, "expired"),
          gte(proposals.updatedAt, thirtyDaysAgo)
        )
      );

    return {
      proposalsDraft: statusCounts["draft"] ?? 0,
      proposalsSent: statusCounts["sent"] ?? 0,
      proposalsViewed: statusCounts["viewed"] ?? 0,
      proposalsAccepted: statusCounts["accepted"] ?? 0,
      proposalsDeclined30d: declined30dResult[0]?.count ?? 0,
      proposalsExpired30d: expired30dResult[0]?.count ?? 0,
    };
  }

  /**
   * Count contracts by status.
   */
  private async countContracts(workspaceId: string): Promise<ContractCounts> {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Count by status using GROUP BY
    const statusCountsResult = await this.dbClient
      .select({
        status: contracts.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(contracts)
      .where(eq(contracts.workspaceId, workspaceId))
      .groupBy(contracts.status);

    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsResult) {
      statusCounts[row.status] = row.count;
    }

    // Count contracts expiring in next 7 days
    const expiring7dResult = await this.dbClient
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(contracts)
      .where(
        and(
          eq(contracts.workspaceId, workspaceId),
          eq(contracts.status, "executed"),
          gte(contracts.expiresAt, now),
          lte(contracts.expiresAt, sevenDaysFromNow)
        )
      );

    return {
      contractsDraft: statusCounts["draft"] ?? 0,
      contractsSent: statusCounts["sent"] ?? 0,
      contractsPendingSignature: statusCounts["sent"] ?? 0, // Sent = pending signature
      contractsSigned: statusCounts["signed"] ?? 0,
      contractsExecuted: statusCounts["executed"] ?? 0,
      contractsExpiring7d: expiring7dResult[0]?.count ?? 0,
    };
  }

  /**
   * Count invoices by status.
   */
  private async countInvoices(workspaceId: string): Promise<InvoiceCounts> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count by status using GROUP BY
    const statusCountsResult = await this.dbClient
      .select({
        status: invoices.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .where(eq(invoices.workspaceId, workspaceId))
      .groupBy(invoices.status);

    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsResult) {
      statusCounts[row.status] = row.count;
    }

    // Count paid in last 30 days
    const paid30dResult = await this.dbClient
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, thirtyDaysAgo)
        )
      );

    return {
      invoicesDraft: statusCounts["draft"] ?? 0,
      invoicesSent: statusCounts["sent"] ?? 0,
      invoicesPaid30d: paid30dResult[0]?.count ?? 0,
      invoicesOverdue: statusCounts["overdue"] ?? 0,
    };
  }

  /**
   * Compute financial metrics.
   */
  private async computeFinancials(
    workspaceId: string
  ): Promise<FinancialMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Proposal pipeline values by status
    const proposalValuesResult = await this.dbClient
      .select({
        status: proposals.status,
        total: sql<number>`COALESCE(SUM(COALESCE(${proposals.setupFeeCents}, 0) + COALESCE(${proposals.monthlyFeeCents}, 0) * 12), 0)::int`,
      })
      .from(proposals)
      .where(eq(proposals.workspaceId, workspaceId))
      .groupBy(proposals.status);

    const proposalValues: Record<string, number> = {};
    for (const row of proposalValuesResult) {
      proposalValues[row.status] = row.total;
    }

    // Revenue this month (paid invoices)
    const revenueThisMonthResult = await this.dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, startOfMonth)
        )
      );

    // Revenue last month
    const revenueLastMonthResult = await this.dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, startOfLastMonth),
          lte(invoices.paidAt, endOfLastMonth)
        )
      );

    // Outstanding (sent but not paid)
    const outstandingResult = await this.dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "sent")
        )
      );

    // Overdue amount
    const overdueResult = await this.dbClient
      .select({
        total: sql<number>`COALESCE(SUM(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "overdue")
        )
      );

    return {
      pipelineValueDraftCents: proposalValues["draft"] ?? 0,
      pipelineValueSentCents: proposalValues["sent"] ?? 0,
      pipelineValueSignedCents:
        (proposalValues["signed"] ?? 0) + (proposalValues["accepted"] ?? 0),
      revenueThisMonthCents: revenueThisMonthResult[0]?.total ?? 0,
      revenueLastMonthCents: revenueLastMonthResult[0]?.total ?? 0,
      outstandingCents: outstandingResult[0]?.total ?? 0,
      overdueAmountCents: overdueResult[0]?.total ?? 0,
    };
  }

  /**
   * Compute conversion rates from deal_outcomes table.
   */
  private async computeConversionRates(
    workspaceId: string
  ): Promise<ConversionRates> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Win rate from deal_outcomes in last 90 days
    const winRateResult = await this.dbClient
      .select({
        total: sql<number>`COUNT(*)::int`,
        won: sql<number>`COUNT(*) FILTER (WHERE ${dealOutcomes.outcome} = 'won')::int`,
      })
      .from(dealOutcomes)
      .where(
        and(
          eq(dealOutcomes.workspaceId, workspaceId),
          gte(dealOutcomes.outcomeAt, ninetyDaysAgo)
        )
      );

    const total = winRateResult[0]?.total ?? 0;
    const won = winRateResult[0]?.won ?? 0;
    const winRatePct = total > 0 ? Math.round((won / total) * 10000) : 0;

    // Prospect to qualified rate (based on current data)
    const prospectCounts = await this.dbClient
      .select({
        total: sql<number>`COUNT(*)::int`,
        qualified: sql<number>`COUNT(*) FILTER (WHERE ${prospects.pipelineStage} IN ('qualified', 'contacted', 'negotiating', 'converted'))::int`,
      })
      .from(prospects)
      .where(eq(prospects.workspaceId, workspaceId));

    const prospectTotal = prospectCounts[0]?.total ?? 0;
    const prospectQualified = prospectCounts[0]?.qualified ?? 0;
    const prospectToQualifiedPct =
      prospectTotal > 0
        ? Math.round((prospectQualified / prospectTotal) * 10000)
        : 0;

    // Qualified to proposal rate (prospects with proposals)
    const qualifiedWithProposals = await this.dbClient
      .select({
        qualified: sql<number>`COUNT(DISTINCT ${prospects.id})::int`,
        withProposal: sql<number>`COUNT(DISTINCT ${proposals.prospectId})::int`,
      })
      .from(prospects)
      .leftJoin(proposals, eq(prospects.id, proposals.prospectId))
      .where(
        and(
          eq(prospects.workspaceId, workspaceId),
          inArray(prospects.pipelineStage, [
            "qualified",
            "contacted",
            "negotiating",
            "converted",
          ])
        )
      );

    const qualifiedTotal = qualifiedWithProposals[0]?.qualified ?? 0;
    const withProposal = qualifiedWithProposals[0]?.withProposal ?? 0;
    const qualifiedToProposalPct =
      qualifiedTotal > 0
        ? Math.round((withProposal / qualifiedTotal) * 10000)
        : 0;

    // Proposal to signed rate
    const proposalCounts = await this.dbClient
      .select({
        total: sql<number>`COUNT(*)::int`,
        signed: sql<number>`COUNT(*) FILTER (WHERE ${proposals.status} IN ('signed', 'paid', 'onboarded'))::int`,
      })
      .from(proposals)
      .where(eq(proposals.workspaceId, workspaceId));

    const proposalTotal = proposalCounts[0]?.total ?? 0;
    const proposalSigned = proposalCounts[0]?.signed ?? 0;
    const proposalToSignedPct =
      proposalTotal > 0
        ? Math.round((proposalSigned / proposalTotal) * 10000)
        : 0;

    return {
      winRatePct,
      prospectToQualifiedPct,
      qualifiedToProposalPct,
      proposalToSignedPct,
    };
  }

  /**
   * Compute cycle times (average days for deals and collections).
   */
  private async computeCycleTimes(workspaceId: string): Promise<CycleTimes> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Average deal cycle from deal_outcomes
    const cycleDaysResult = await this.dbClient
      .select({
        avgDays: sql<number>`COALESCE(AVG(${dealOutcomes.cycleDays}), 0)::int`,
      })
      .from(dealOutcomes)
      .where(
        and(
          eq(dealOutcomes.workspaceId, workspaceId),
          eq(dealOutcomes.outcome, "won"),
          gte(dealOutcomes.outcomeAt, ninetyDaysAgo)
        )
      );

    // Average collection time (sent to paid for invoices)
    const collectionDaysResult = await this.dbClient
      .select({
        avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${invoices.paidAt} - ${invoices.sentAt})) / 86400), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "paid"),
          sql`${invoices.sentAt} IS NOT NULL`,
          sql`${invoices.paidAt} IS NOT NULL`
        )
      );

    return {
      avgCycleDays: cycleDaysResult[0]?.avgDays ?? 0,
      avgCollectionDays: collectionDaysResult[0]?.avgDays ?? 0,
    };
  }

  // Test helper methods (only used in tests)
  async testCountProspects(workspaceId: string): Promise<ProspectCounts> {
    return this.countProspects(workspaceId);
  }

  async testComputeFinancials(workspaceId: string): Promise<FinancialMetrics> {
    return this.computeFinancials(workspaceId);
  }

  async testComputeConversionRates(
    workspaceId: string
  ): Promise<ConversionRates> {
    return this.computeConversionRates(workspaceId);
  }
}

// Singleton instance
let serviceInstance: MetricsService | null = null;

/**
 * Get the singleton service instance.
 */
export function getMetricsService(): MetricsService {
  if (!serviceInstance) {
    const { getPipelineMetricsRepository } = require("../repositories/PipelineMetricsRepository");
    serviceInstance = new MetricsService(getPipelineMetricsRepository());
  }
  return serviceInstance;
}
