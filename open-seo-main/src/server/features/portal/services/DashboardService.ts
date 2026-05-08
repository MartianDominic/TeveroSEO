/**
 * DashboardService - GSC data aggregation for client portal.
 * Phase 90-01: Trust Foundation
 *
 * Aggregates verified GSC data for portal dashboard display.
 * Per D-01 (trust hierarchy): Only uses verified GSC data, no estimated values.
 *
 * Data sources:
 * - seo_gsc_daily_snapshots: Daily aggregate metrics per client
 * - seo_gsc_query_snapshots: Top queries per client per day
 */
import { db, seoGscSnapshots, gscQuerySnapshots } from "@/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "DashboardService" });

/**
 * Dashboard metrics with deltas vs previous period.
 */
export interface DashboardMetrics {
  /** Total clicks in current period */
  clicks: number;
  /** Total impressions in current period */
  impressions: number;
  /** Average position in current period */
  avgPosition: number;
  /** Click-through rate (clicks/impressions * 100) */
  ctr: number;
  /** Count of keywords in top 10 */
  top10Count: number;
  /** Clicks delta vs previous period (percentage) */
  clicksDelta: number;
  /** Impressions delta vs previous period (percentage) */
  impressionsDelta: number;
  /** Position delta vs previous period (percentage, negative = improvement) */
  positionDelta: number;
}

/**
 * Keyword win entry - keyword that entered top 10.
 */
export interface KeywordWin {
  keyword: string;
  currentPosition: number;
  previousPosition: number;
  clicks: number;
  impressions: number;
  /** Whether position data is from estimated source (always false for GSC) */
  isEstimated: boolean;
}

/**
 * Keyword needing attention - significant position drop.
 */
export interface KeywordAttention {
  keyword: string;
  currentPosition: number;
  previousPosition: number;
  positionDrop: number;
  clicks: number;
  impressions: number;
}

/**
 * DashboardService provides aggregated GSC data for the client portal.
 *
 * All data is verified from GSC snapshots - no estimated values.
 * Handles 3-day GSC data delay per research/CONTEXT.md.
 */
export class DashboardService {
  /**
   * Get dashboard metrics for a client.
   *
   * @param clientId - Client UUID
   * @param days - Number of days for current period (default: 30)
   * @returns Aggregated metrics with deltas vs previous period
   */
  static async getDashboardMetrics(
    clientId: string,
    days: number = 30
  ): Promise<DashboardMetrics> {
    const now = new Date();
    // GSC data is delayed 3 days
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 3);

    // Current period: last N days
    const currentStartDate = new Date(endDate);
    currentStartDate.setDate(currentStartDate.getDate() - days);

    // Previous period: N days before current period
    const previousEndDate = new Date(currentStartDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    log.debug("Fetching dashboard metrics", {
      clientId,
      currentPeriod: {
        start: currentStartDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
      previousPeriod: {
        start: previousStartDate.toISOString().split("T")[0],
        end: previousEndDate.toISOString().split("T")[0],
      },
    });

    // Fetch current period data
    const currentData = await db
      .select()
      .from(seoGscSnapshots)
      .where(
        and(
          eq(seoGscSnapshots.clientId, clientId),
          gte(seoGscSnapshots.date, currentStartDate.toISOString().split("T")[0]),
          lte(seoGscSnapshots.date, endDate.toISOString().split("T")[0]),
          eq(seoGscSnapshots.isDeleted, false)
        )
      );

    // Fetch previous period data
    const previousData = await db
      .select()
      .from(seoGscSnapshots)
      .where(
        and(
          eq(seoGscSnapshots.clientId, clientId),
          gte(seoGscSnapshots.date, previousStartDate.toISOString().split("T")[0]),
          lte(seoGscSnapshots.date, previousEndDate.toISOString().split("T")[0]),
          eq(seoGscSnapshots.isDeleted, false)
        )
      );

    // Aggregate current period
    const current = aggregateMetrics(currentData);
    const previous = aggregateMetrics(previousData);

    // Calculate deltas (percentage change)
    const clicksDelta = calculateDelta(current.clicks, previous.clicks);
    const impressionsDelta = calculateDelta(current.impressions, previous.impressions);
    const positionDelta = calculateDelta(current.avgPosition, previous.avgPosition);

    // Get top 10 count from query snapshots
    const top10Count = await getTop10Count(clientId, endDate);

    return {
      clicks: current.clicks,
      impressions: current.impressions,
      avgPosition: current.avgPosition,
      ctr: current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0,
      top10Count,
      clicksDelta,
      impressionsDelta,
      positionDelta,
    };
  }

  /**
   * Get recent keyword wins - keywords that entered top 10 in the given period.
   *
   * @param clientId - Client UUID
   * @param days - Number of days to look back (default: 7)
   * @returns List of keyword wins sorted by position improvement
   */
  static async getRecentWins(
    clientId: string,
    days: number = 7
  ): Promise<KeywordWin[]> {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 3); // GSC delay

    const recentStartDate = new Date(endDate);
    recentStartDate.setDate(recentStartDate.getDate() - days);

    const previousEndDate = new Date(recentStartDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    log.debug("Fetching recent wins", { clientId, days });

    // Fetch recent query snapshots
    const recentData = await db
      .select()
      .from(gscQuerySnapshots)
      .where(
        and(
          eq(gscQuerySnapshots.clientId, clientId),
          gte(gscQuerySnapshots.date, recentStartDate.toISOString().split("T")[0]),
          lte(gscQuerySnapshots.date, endDate.toISOString().split("T")[0])
        )
      );

    // Fetch previous period query snapshots
    const previousData = await db
      .select()
      .from(gscQuerySnapshots)
      .where(
        and(
          eq(gscQuerySnapshots.clientId, clientId),
          gte(gscQuerySnapshots.date, previousStartDate.toISOString().split("T")[0]),
          lte(gscQuerySnapshots.date, previousEndDate.toISOString().split("T")[0])
        )
      );

    // Aggregate by query - get best (lowest) position for each
    const recentByQuery = aggregateQueryMetrics(recentData);
    const previousByQuery = aggregateQueryMetrics(previousData);

    // Find keywords that entered top 10 (were >10, now <=10)
    const wins: KeywordWin[] = [];

    for (const [query, current] of recentByQuery.entries()) {
      if (current.position <= 10) {
        const previous = previousByQuery.get(query);
        const previousPosition = previous?.position ?? 100; // Assume not ranking if no data

        if (previousPosition > 10) {
          wins.push({
            keyword: query,
            currentPosition: current.position,
            previousPosition,
            clicks: current.clicks,
            impressions: current.impressions,
            isEstimated: false,
          });
        }
      }
    }

    // Sort by position improvement (biggest jump first)
    return wins.sort((a, b) =>
      (b.previousPosition - b.currentPosition) - (a.previousPosition - a.currentPosition)
    );
  }

  /**
   * Get keywords needing attention - keywords with significant position drops.
   *
   * @param clientId - Client UUID
   * @param minDrop - Minimum position drop to flag (default: 5)
   * @returns List of keywords needing attention sorted by drop magnitude
   */
  static async getNeedsAttention(
    clientId: string,
    minDrop: number = 5
  ): Promise<KeywordAttention[]> {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 3); // GSC delay

    const recentStartDate = new Date(endDate);
    recentStartDate.setDate(recentStartDate.getDate() - 7);

    const previousEndDate = new Date(recentStartDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - 7);

    log.debug("Fetching keywords needing attention", { clientId, minDrop });

    // Fetch recent query snapshots
    const recentData = await db
      .select()
      .from(gscQuerySnapshots)
      .where(
        and(
          eq(gscQuerySnapshots.clientId, clientId),
          gte(gscQuerySnapshots.date, recentStartDate.toISOString().split("T")[0]),
          lte(gscQuerySnapshots.date, endDate.toISOString().split("T")[0])
        )
      );

    // Fetch previous period query snapshots
    const previousData = await db
      .select()
      .from(gscQuerySnapshots)
      .where(
        and(
          eq(gscQuerySnapshots.clientId, clientId),
          gte(gscQuerySnapshots.date, previousStartDate.toISOString().split("T")[0]),
          lte(gscQuerySnapshots.date, previousEndDate.toISOString().split("T")[0])
        )
      );

    // Aggregate by query
    const recentByQuery = aggregateQueryMetrics(recentData);
    const previousByQuery = aggregateQueryMetrics(previousData);

    // Find keywords with significant drops
    const attention: KeywordAttention[] = [];

    for (const [query, current] of recentByQuery.entries()) {
      const previous = previousByQuery.get(query);
      if (previous) {
        const positionDrop = current.position - previous.position;
        if (positionDrop > minDrop) {
          attention.push({
            keyword: query,
            currentPosition: current.position,
            previousPosition: previous.position,
            positionDrop,
            clicks: current.clicks,
            impressions: current.impressions,
          });
        }
      }
    }

    // Sort by drop magnitude (biggest drop first)
    return attention.sort((a, b) => b.positionDrop - a.positionDrop);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

interface AggregatedMetrics {
  clicks: number;
  impressions: number;
  avgPosition: number;
}

/**
 * Aggregate daily snapshot data into totals.
 */
function aggregateMetrics(
  data: { clicks: number; impressions: number; position: number }[]
): AggregatedMetrics {
  if (data.length === 0) {
    return { clicks: 0, impressions: 0, avgPosition: 0 };
  }

  const totalClicks = data.reduce((sum, d) => sum + (d.clicks ?? 0), 0);
  const totalImpressions = data.reduce((sum, d) => sum + (d.impressions ?? 0), 0);
  const avgPosition =
    data.reduce((sum, d) => sum + (d.position ?? 0), 0) / data.length;

  return {
    clicks: totalClicks,
    impressions: totalImpressions,
    avgPosition: Math.round(avgPosition * 10) / 10, // Round to 1 decimal
  };
}

interface QueryMetrics {
  position: number;
  clicks: number;
  impressions: number;
}

/**
 * Aggregate query snapshot data - get best position per query.
 */
function aggregateQueryMetrics(
  data: { query: string; position: number | null; clicks: number | null; impressions: number | null }[]
): Map<string, QueryMetrics> {
  const byQuery = new Map<string, QueryMetrics>();

  for (const row of data) {
    const existing = byQuery.get(row.query);
    const position = row.position ?? 100;
    const clicks = row.clicks ?? 0;
    const impressions = row.impressions ?? 0;

    if (!existing || position < existing.position) {
      byQuery.set(row.query, { position, clicks, impressions });
    } else if (existing) {
      // Accumulate clicks/impressions even if position is worse
      existing.clicks += clicks;
      existing.impressions += impressions;
    }
  }

  return byQuery;
}

/**
 * Calculate percentage delta between current and previous values.
 */
function calculateDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Get count of keywords in top 10 positions.
 */
async function getTop10Count(clientId: string, endDate: Date): Promise<number> {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  const result = await db
    .select({ count: sql<number>`count(distinct ${gscQuerySnapshots.query})` })
    .from(gscQuerySnapshots)
    .where(
      and(
        eq(gscQuerySnapshots.clientId, clientId),
        gte(gscQuerySnapshots.date, startDate.toISOString().split("T")[0]),
        lte(gscQuerySnapshots.date, endDate.toISOString().split("T")[0]),
        lte(gscQuerySnapshots.position, 10)
      )
    );

  return Number(result[0]?.count ?? 0);
}
