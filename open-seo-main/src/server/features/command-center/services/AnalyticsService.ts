/**
 * AnalyticsService - Win/Loss Analytics and Pipeline Intelligence
 * Phase 62-08: Win/Loss Analytics and Final Phase Completion
 *
 * Provides:
 * - getDealOutcomes: Get aggregated win/loss counts with total
 * - getLossReasonDistribution: Get loss reasons grouped with percentages
 * - getTopCompetitors: Get competitor names sorted by frequency
 * - getAvgCycleTime: Get average deal cycle duration
 * - getWinLossAnalytics: Combined analytics payload for dashboard
 */
import {
  DealOutcomeRepository,
  getDealOutcomeRepository,
  type DealOutcomeRepositoryInterface,
  type DateRange,
  type OutcomeCounts,
} from "../repositories/DealOutcomeRepository";

/**
 * Extended outcome counts with total.
 */
export interface DealOutcomeCounts extends OutcomeCounts {
  total: number;
}

/**
 * Loss reason with percentage.
 */
export interface LossReasonWithPercentage {
  reason: string;
  count: number;
  percentage: number;
}

/**
 * Competitor frequency item.
 */
export interface CompetitorFrequency {
  name: string;
  count: number;
}

/**
 * Summary metrics for win/loss analytics.
 */
export interface WinLossSummary {
  totalDeals: number;
  won: number;
  lost: number;
  winRate: number;
  avgCycleDays: number;
}

/**
 * Combined win/loss analytics result.
 */
export interface WinLossAnalyticsResult {
  summary: WinLossSummary;
  lossReasons: LossReasonWithPercentage[];
  topCompetitors: CompetitorFrequency[];
}

/**
 * AnalyticsService for win/loss analytics and pipeline intelligence.
 */
export class AnalyticsService {
  constructor(
    private readonly dealOutcomeRepo: DealOutcomeRepositoryInterface
  ) {}

  /**
   * Get aggregated win/loss counts for a workspace.
   * Optionally filter by date range.
   */
  async getDealOutcomes(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<DealOutcomeCounts> {
    const counts = await this.dealOutcomeRepo.countByOutcome(
      workspaceId,
      dateRange
    );

    return {
      won: counts.won,
      lost: counts.lost,
      total: counts.won + counts.lost,
    };
  }

  /**
   * Get loss reasons grouped by frequency with percentages.
   */
  async getLossReasonDistribution(
    workspaceId: string
  ): Promise<LossReasonWithPercentage[]> {
    const [reasonCounts, outcomeCounts] = await Promise.all([
      this.dealOutcomeRepo.groupByLossReason(workspaceId),
      this.dealOutcomeRepo.countByOutcome(workspaceId),
    ]);

    const totalLost = outcomeCounts.lost;

    return reasonCounts.map((item) => ({
      reason: item.reason,
      count: item.count,
      percentage: totalLost > 0 ? Math.round((item.count / totalLost) * 100) : 0,
    }));
  }

  /**
   * Get top competitors by frequency of lost deals.
   * @param limit - Maximum number of competitors to return (default: 5)
   */
  async getTopCompetitors(
    workspaceId: string,
    limit: number = 5
  ): Promise<CompetitorFrequency[]> {
    const competitors = await this.dealOutcomeRepo.getTopCompetitors(
      workspaceId,
      limit
    );

    return competitors.map((item) => ({
      name: item.name,
      count: item.count,
    }));
  }

  /**
   * Get average cycle time for won deals.
   * @param dateRange - Optional date range filter
   */
  async getAvgCycleTime(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<number> {
    return this.dealOutcomeRepo.getAvgCycleDays(workspaceId, dateRange);
  }

  /**
   * Get combined win/loss analytics for dashboard display.
   * Runs all queries in parallel for performance.
   */
  async getWinLossAnalytics(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<WinLossAnalyticsResult> {
    // Run all queries in parallel
    const [outcomeCounts, reasonCounts, competitors, avgCycle] =
      await Promise.all([
        this.dealOutcomeRepo.countByOutcome(workspaceId, dateRange),
        this.dealOutcomeRepo.groupByLossReason(workspaceId),
        this.dealOutcomeRepo.getTopCompetitors(workspaceId, 5),
        this.dealOutcomeRepo.getAvgCycleDays(workspaceId, dateRange),
      ]);

    const total = outcomeCounts.won + outcomeCounts.lost;
    const winRate = total > 0
      ? Math.round((outcomeCounts.won / total) * 10000) / 100
      : 0;

    // Calculate loss reason percentages
    const totalLost = outcomeCounts.lost;
    const lossReasons = reasonCounts.map((item) => ({
      reason: item.reason,
      count: item.count,
      percentage: totalLost > 0
        ? Math.round((item.count / totalLost) * 100)
        : 0,
    }));

    return {
      summary: {
        totalDeals: total,
        won: outcomeCounts.won,
        lost: outcomeCounts.lost,
        winRate,
        avgCycleDays: avgCycle,
      },
      lossReasons,
      topCompetitors: competitors.map((c) => ({
        name: c.name,
        count: c.count,
      })),
    };
  }
}

// Singleton instance
let serviceInstance: AnalyticsService | null = null;

/**
 * Get the singleton service instance.
 */
export function getAnalyticsService(): AnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new AnalyticsService(getDealOutcomeRepository());
  }
  return serviceInstance;
}
