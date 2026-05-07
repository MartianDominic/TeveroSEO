/**
 * DataForSEO Cost Tracker
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Tracks DataForSEO API costs for:
 * - Real-time cost monitoring
 * - Per-client/workspace attribution
 * - Daily aggregation for dashboard
 * - Budget enforcement
 */

import { eq, sql, and, gte, lte, sum, count, avg } from "drizzle-orm";
import type { DbClient } from "@/db";
import {
  dfsCostRecords,
  dfsCostDailyAggregates,
  type DfsCostRecordInsert,
  type DfsCostDailyAggregateInsert,
  type DfsMode,
  DFS_STANDARD_COSTS,
  DFS_LIVE_COSTS,
} from "@/db/dfs-cost-tracking-schema";
import type { DfsUsageStats } from "./DataForSEOFetcher.types";

// =============================================================================
// Cost Tracker Service
// =============================================================================

/**
 * Service for tracking DataForSEO API costs.
 */
export class DfsCostTracker {
  constructor(private db: DbClient) {}

  /**
   * Record a single API request cost.
   *
   * @param record - Cost record details
   * @returns Inserted record ID
   */
  async recordCost(record: {
    url: string;
    domain: string;
    mode: DfsMode;
    usedStandardQueue: boolean;
    estimatedCost: number;
    actualCost?: number;
    success: boolean;
    statusCode?: number;
    dfsErrorCode?: number;
    errorMessage?: string;
    responseSizeBytes?: number;
    responseTimeMs?: number;
    clientId?: string;
    workspaceId?: string;
    jobId?: string;
    taskId?: string;
  }): Promise<number> {
    const [inserted] = await this.db
      .insert(dfsCostRecords)
      .values({
        url: record.url,
        domain: record.domain,
        mode: record.mode,
        usedStandardQueue: record.usedStandardQueue,
        estimatedCost: record.estimatedCost,
        actualCost: record.actualCost,
        success: record.success,
        statusCode: record.statusCode,
        dfsErrorCode: record.dfsErrorCode,
        errorMessage: record.errorMessage,
        responseSizeBytes: record.responseSizeBytes,
        responseTimeMs: record.responseTimeMs,
        clientId: record.clientId,
        workspaceId: record.workspaceId,
        jobId: record.jobId,
        taskId: record.taskId,
      })
      .returning({ id: dfsCostRecords.id });

    return inserted.id;
  }

  /**
   * Record multiple API request costs in a batch.
   *
   * @param records - Array of cost records
   * @returns Array of inserted record IDs
   */
  async recordCostBatch(
    records: Array<{
      url: string;
      domain: string;
      mode: DfsMode;
      usedStandardQueue: boolean;
      estimatedCost: number;
      actualCost?: number;
      success: boolean;
      statusCode?: number;
      dfsErrorCode?: number;
      errorMessage?: string;
      responseSizeBytes?: number;
      responseTimeMs?: number;
      clientId?: string;
      workspaceId?: string;
      jobId?: string;
      taskId?: string;
    }>
  ): Promise<number[]> {
    if (records.length === 0) return [];

    const inserted = await this.db
      .insert(dfsCostRecords)
      .values(
        records.map((r) => ({
          url: r.url,
          domain: r.domain,
          mode: r.mode,
          usedStandardQueue: r.usedStandardQueue,
          estimatedCost: r.estimatedCost,
          actualCost: r.actualCost,
          success: r.success,
          statusCode: r.statusCode,
          dfsErrorCode: r.dfsErrorCode,
          errorMessage: r.errorMessage,
          responseSizeBytes: r.responseSizeBytes,
          responseTimeMs: r.responseTimeMs,
          clientId: r.clientId,
          workspaceId: r.workspaceId,
          jobId: r.jobId,
          taskId: r.taskId,
        }))
      )
      .returning({ id: dfsCostRecords.id });

    return inserted.map((r: { id: number }) => r.id);
  }

  /**
   * Get today's spend for a workspace.
   *
   * @param workspaceId - Workspace ID (optional, null for global)
   * @returns Today's total spend
   */
  async getTodaySpend(workspaceId?: string): Promise<number> {
    const today = new Date().toISOString().split("T")[0];

    const conditions = [
      sql`date(${dfsCostRecords.createdAt}) = ${today}`,
    ];

    if (workspaceId) {
      conditions.push(eq(dfsCostRecords.workspaceId, workspaceId));
    }

    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
      })
      .from(dfsCostRecords)
      .where(and(...conditions));

    return result?.total ?? 0;
  }

  /**
   * Get this month's spend for a workspace.
   *
   * @param workspaceId - Workspace ID (optional, null for global)
   * @returns This month's total spend
   */
  async getMonthSpend(workspaceId?: string): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const conditions = [
      gte(dfsCostRecords.createdAt, monthStart),
    ];

    if (workspaceId) {
      conditions.push(eq(dfsCostRecords.workspaceId, workspaceId));
    }

    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
      })
      .from(dfsCostRecords)
      .where(and(...conditions));

    return result?.total ?? 0;
  }

  /**
   * Get detailed usage statistics.
   *
   * @param workspaceId - Workspace ID (optional)
   * @returns Usage statistics
   */
  async getUsageStats(workspaceId?: string): Promise<DfsUsageStats> {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Build base conditions
    const todayConditions = [sql`date(${dfsCostRecords.createdAt}) = ${today}`];
    const monthConditions = [gte(dfsCostRecords.createdAt, monthStart)];

    if (workspaceId) {
      todayConditions.push(eq(dfsCostRecords.workspaceId, workspaceId));
      monthConditions.push(eq(dfsCostRecords.workspaceId, workspaceId));
    }

    // Get today's stats
    const [todayStats] = await this.db
      .select({
        count: count(),
        total: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
      })
      .from(dfsCostRecords)
      .where(and(...todayConditions));

    // Get month stats with breakdown
    const monthResults = await this.db
      .select({
        mode: dfsCostRecords.mode,
        usedStandardQueue: dfsCostRecords.usedStandardQueue,
        count: count(),
        total: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
      })
      .from(dfsCostRecords)
      .where(and(...monthConditions))
      .groupBy(dfsCostRecords.mode, dfsCostRecords.usedStandardQueue);

    // Build tier distribution
    const tierDistribution = {
      basic: { cost: 0, count: 0 },
      js: { cost: 0, count: 0 },
      browser: { cost: 0, count: 0 },
    };

    const queueDistribution = {
      standard: { cost: 0, count: 0 },
      live: { cost: 0, count: 0 },
    };

    let monthSpend = 0;
    let monthCount = 0;
    let savingsFromStandardQueue = 0;

    for (const row of monthResults) {
      const mode = row.mode as DfsMode;
      const total = row.total;
      const cnt = row.count;

      tierDistribution[mode].cost += total;
      tierDistribution[mode].count += cnt;

      if (row.usedStandardQueue) {
        queueDistribution.standard.cost += total;
        queueDistribution.standard.count += cnt;

        // Calculate savings (what it would have cost using Live)
        const liveEquivalent = cnt * DFS_LIVE_COSTS[mode];
        savingsFromStandardQueue += liveEquivalent - total;
      } else {
        queueDistribution.live.cost += total;
        queueDistribution.live.count += cnt;
      }

      monthSpend += total;
      monthCount += cnt;
    }

    return {
      todaySpend: todayStats?.total ?? 0,
      monthSpend,
      requestsToday: todayStats?.count ?? 0,
      requestsMonth: monthCount,
      averageCostPerRequest: monthCount > 0 ? monthSpend / monthCount : 0,
      tierDistribution,
      queueDistribution,
      savingsFromStandardQueue,
    };
  }

  /**
   * Compute and store daily aggregate for a specific date.
   *
   * @param date - Date to aggregate (YYYY-MM-DD)
   * @param workspaceId - Workspace ID (optional, null for global)
   */
  async computeDailyAggregate(date: string, workspaceId?: string): Promise<void> {
    const dateStart = new Date(`${date}T00:00:00Z`);
    const dateEnd = new Date(`${date}T23:59:59Z`);

    // Build conditions
    const conditions = [
      gte(dfsCostRecords.createdAt, dateStart),
      lte(dfsCostRecords.createdAt, dateEnd),
    ];

    if (workspaceId) {
      conditions.push(eq(dfsCostRecords.workspaceId, workspaceId));
    }

    // Get breakdown by mode and queue
    const results = await this.db
      .select({
        mode: dfsCostRecords.mode,
        usedStandardQueue: dfsCostRecords.usedStandardQueue,
        success: dfsCostRecords.success,
        count: count(),
        totalCost: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
        avgResponseTime: avg(dfsCostRecords.responseTimeMs),
        totalBytes: sum(dfsCostRecords.responseSizeBytes),
      })
      .from(dfsCostRecords)
      .where(and(...conditions))
      .groupBy(dfsCostRecords.mode, dfsCostRecords.usedStandardQueue, dfsCostRecords.success);

    // Build aggregate record using accumulator values
    let totalCost = 0;
    let requestCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let basicCost = 0;
    let basicCount = 0;
    let jsCost = 0;
    let jsCount = 0;
    let browserCost = 0;
    let browserCount = 0;
    let standardQueueCost = 0;
    let standardQueueCount = 0;
    let liveCost = 0;
    let liveCount = 0;
    let hypotheticalLiveCost = 0;
    let savingsFromStandardQueue = 0;
    let totalResponseTimeSum = 0;
    let responseTimeCount = 0;
    let totalBytes = 0;

    for (const row of results) {
      const mode = row.mode as DfsMode;
      const cnt = row.count;
      const cost = row.totalCost;

      totalCost += cost;
      requestCount += cnt;

      if (row.success) {
        successCount += cnt;
      } else {
        failureCount += cnt;
      }

      // Mode breakdown
      switch (mode) {
        case "basic":
          basicCost += cost;
          basicCount += cnt;
          break;
        case "js":
          jsCost += cost;
          jsCount += cnt;
          break;
        case "browser":
          browserCost += cost;
          browserCount += cnt;
          break;
      }

      // Queue breakdown
      if (row.usedStandardQueue) {
        standardQueueCost += cost;
        standardQueueCount += cnt;

        // Calculate hypothetical live cost
        const liveEquivalent = cnt * DFS_LIVE_COSTS[mode];
        hypotheticalLiveCost += liveEquivalent;
        savingsFromStandardQueue += liveEquivalent - cost;
      } else {
        liveCost += cost;
        liveCount += cnt;
        hypotheticalLiveCost += cost;
      }

      // Performance metrics
      if (row.avgResponseTime) {
        totalResponseTimeSum += Number(row.avgResponseTime) * cnt;
        responseTimeCount += cnt;
      }
      if (row.totalBytes) {
        totalBytes += Number(row.totalBytes);
      }
    }

    // Build final aggregate record
    const aggregate: DfsCostDailyAggregateInsert = {
      date,
      workspaceId: workspaceId ?? null,
      totalCost,
      requestCount,
      successCount,
      failureCount,
      basicCost,
      basicCount,
      jsCost,
      jsCount,
      browserCost,
      browserCount,
      standardQueueCost,
      standardQueueCount,
      liveCost,
      liveCount,
      hypotheticalLiveCost,
      savingsFromStandardQueue,
      avgResponseTimeMs: responseTimeCount > 0 ? Math.round(totalResponseTimeSum / responseTimeCount) : null,
      totalBytesTransferred: totalBytes > 0 ? totalBytes : null,
    };

    // Delete any existing aggregate for this date/workspace, then insert
    // (simpler than complex upsert without unique constraint)
    const deleteConditions = [eq(dfsCostDailyAggregates.date, date)];
    if (workspaceId) {
      deleteConditions.push(eq(dfsCostDailyAggregates.workspaceId, workspaceId));
    } else {
      deleteConditions.push(sql`${dfsCostDailyAggregates.workspaceId} IS NULL`);
    }

    await this.db.delete(dfsCostDailyAggregates).where(and(...deleteConditions));
    await this.db.insert(dfsCostDailyAggregates).values(aggregate);
  }

  /**
   * Get daily aggregates for a date range.
   *
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @param workspaceId - Workspace ID (optional)
   * @returns Array of daily aggregates
   */
  async getDailyAggregates(
    startDate: string,
    endDate: string,
    workspaceId?: string
  ): Promise<Array<{
    date: string;
    totalCost: number;
    requestCount: number;
    savingsFromStandardQueue: number;
  }>> {
    const conditions = [
      gte(dfsCostDailyAggregates.date, startDate),
      lte(dfsCostDailyAggregates.date, endDate),
    ];

    if (workspaceId) {
      conditions.push(eq(dfsCostDailyAggregates.workspaceId, workspaceId));
    }

    const results = await this.db
      .select({
        date: dfsCostDailyAggregates.date,
        totalCost: dfsCostDailyAggregates.totalCost,
        requestCount: dfsCostDailyAggregates.requestCount,
        savingsFromStandardQueue: dfsCostDailyAggregates.savingsFromStandardQueue,
      })
      .from(dfsCostDailyAggregates)
      .where(and(...conditions))
      .orderBy(dfsCostDailyAggregates.date);

    return results;
  }

  /**
   * Get cost records for a specific job.
   *
   * @param jobId - Job ID
   * @returns Array of cost records
   */
  async getCostRecordsForJob(jobId: string): Promise<Array<{
    url: string;
    mode: DfsMode;
    cost: number;
    success: boolean;
    responseTimeMs: number | null;
  }>> {
    const results = await this.db
      .select({
        url: dfsCostRecords.url,
        mode: dfsCostRecords.mode,
        cost: sql<number>`COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})`,
        success: dfsCostRecords.success,
        responseTimeMs: dfsCostRecords.responseTimeMs,
      })
      .from(dfsCostRecords)
      .where(eq(dfsCostRecords.jobId, jobId));

    return results.map((r: { url: string; mode: string; cost: number; success: boolean; responseTimeMs: number | null }) => ({
      url: r.url,
      mode: r.mode as DfsMode,
      cost: r.cost,
      success: r.success,
      responseTimeMs: r.responseTimeMs,
    }));
  }

  /**
   * Get total cost for a job.
   *
   * @param jobId - Job ID
   * @returns Total cost
   */
  async getJobTotalCost(jobId: string): Promise<number> {
    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(${dfsCostRecords.actualCost}, ${dfsCostRecords.estimatedCost})), 0)`,
      })
      .from(dfsCostRecords)
      .where(eq(dfsCostRecords.jobId, jobId));

    return result?.total ?? 0;
  }

  /**
   * Cleanup old cost records (older than retention days).
   *
   * @param retentionDays - Number of days to retain
   * @returns Number of deleted records
   */
  async cleanupOldRecords(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db
      .delete(dfsCostRecords)
      .where(lte(dfsCostRecords.createdAt, cutoffDate));

    return result.rowCount ?? 0;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

let _costTrackerInstance: DfsCostTracker | null = null;

/**
 * Get or create the cost tracker singleton.
 *
 * @param db - Database connection
 * @returns Cost tracker instance
 */
export function getDfsCostTracker(db: DbClient): DfsCostTracker {
  if (!_costTrackerInstance) {
    _costTrackerInstance = new DfsCostTracker(db);
  }
  return _costTrackerInstance;
}

/**
 * Reset the cost tracker singleton (for testing).
 */
export function resetDfsCostTracker(): void {
  _costTrackerInstance = null;
}

// =============================================================================
// Helper: Extract Domain from URL
// =============================================================================

/**
 * Extract normalized domain from URL.
 *
 * @param url - Full URL
 * @returns Normalized domain (no protocol, no www, no path)
 */
export function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
