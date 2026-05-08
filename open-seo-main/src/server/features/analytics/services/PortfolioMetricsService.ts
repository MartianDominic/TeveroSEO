/**
 * PortfolioMetricsService
 * Phase 96-05: Cross-client portfolio aggregation
 *
 * Aggregates analytics metrics across all clients in a workspace
 * for portfolio-level reporting and comparison.
 *
 * Key features:
 * - Workspace-level metric aggregation
 * - Trend analysis (daily/weekly/monthly)
 * - Top performing clients
 * - Underperforming client identification
 */
import { sql } from "drizzle-orm";
import type { DbClient } from "@/db";

/**
 * Date range filter
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Portfolio summary metrics
 */
export interface PortfolioSummary {
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  avgCtr: number;
  clientCount: number;
  totalQueries: number;
  totalPages: number;
}

/**
 * Portfolio trend data point
 */
export interface PortfolioTrend {
  date: string;
  clicks: number;
  impressions: number;
  avgPosition: number;
}

/**
 * Client performance data
 */
export interface ClientPerformance {
  clientId: string;
  clientName: string;
  domain: string;
  clicks: number;
  impressions: number;
  position: number;
  changePercent: number;
}

/**
 * Client comparison data
 */
export interface ClientComparison {
  clientId: string;
  clientName: string;
  domain: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
}

export class PortfolioMetricsService {
  constructor(private db: DbClient) {}

  /**
   * Get aggregated portfolio summary for a workspace.
   */
  async getPortfolioSummary(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<PortfolioSummary> {
    // Build date filter if provided
    const dateFilter = dateRange
      ? sql`AND date >= ${dateRange.startDate} AND date <= ${dateRange.endDate}`
      : sql``;

    const result = await this.db.execute(sql`
      SELECT
        COALESCE(SUM(clicks), 0) as "totalClicks",
        COALESCE(SUM(impressions), 0) as "totalImpressions",
        COALESCE(AVG(position), 0) as "avgPosition",
        CASE
          WHEN SUM(impressions) > 0
          THEN SUM(clicks)::float / SUM(impressions)
          ELSE 0
        END as "avgCtr",
        COUNT(DISTINCT client_id) as "clientCount",
        COUNT(DISTINCT query) as "totalQueries",
        COUNT(DISTINCT page_url) as "totalPages"
      FROM gsc_query_analytics ga
      INNER JOIN clients c ON ga.site_id = c.gsc_site_id
      WHERE c.workspace_id = ${workspaceId}
        AND c.is_deleted = false
        ${dateFilter}
    `);

    const row = result.rows[0] as Record<string, unknown>;

    return {
      totalClicks: Number(row.totalClicks) || 0,
      totalImpressions: Number(row.totalImpressions) || 0,
      avgPosition: Number(row.avgPosition) || 0,
      avgCtr: Number(row.avgCtr) || 0,
      clientCount: Number(row.clientCount) || 0,
      totalQueries: Number(row.totalQueries) || 0,
      totalPages: Number(row.totalPages) || 0,
    };
  }

  /**
   * Get portfolio trends over time.
   */
  async getPortfolioTrends(
    workspaceId: string,
    period: "day" | "week" | "month",
    dateRange?: DateRange
  ): Promise<PortfolioTrend[]> {
    // Build date grouping based on period
    const dateGroup = period === "day"
      ? sql`date::text`
      : period === "week"
        ? sql`to_char(date, 'IYYY-"W"IW')`
        : sql`to_char(date, 'YYYY-MM')`;

    const dateFilter = dateRange
      ? sql`AND date >= ${dateRange.startDate} AND date <= ${dateRange.endDate}`
      : sql``;

    const result = await this.db.execute(sql`
      SELECT
        ${dateGroup} as date,
        SUM(clicks) as clicks,
        SUM(impressions) as impressions,
        AVG(position) as "avgPosition"
      FROM gsc_query_analytics ga
      INNER JOIN clients c ON ga.site_id = c.gsc_site_id
      WHERE c.workspace_id = ${workspaceId}
        AND c.is_deleted = false
        ${dateFilter}
      GROUP BY ${dateGroup}
      ORDER BY date ASC
    `);

    return result.rows.map((row: Record<string, unknown>) => ({
      date: String(row.date),
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      avgPosition: Number(row.avgPosition) || 0,
    }));
  }

  /**
   * Get top performing clients by clicks.
   */
  async getTopPerformingClients(
    workspaceId: string,
    limit: number = 10
  ): Promise<ClientPerformance[]> {
    const result = await this.db.execute(sql`
      WITH current_period AS (
        SELECT
          c.id as client_id,
          c.name as client_name,
          c.domain,
          SUM(ga.clicks) as clicks,
          SUM(ga.impressions) as impressions,
          AVG(ga.position) as position
        FROM gsc_query_analytics ga
        INNER JOIN clients c ON ga.site_id = c.gsc_site_id
        WHERE c.workspace_id = ${workspaceId}
          AND c.is_deleted = false
          AND ga.date >= NOW() - INTERVAL '30 days'
        GROUP BY c.id, c.name, c.domain
      ),
      previous_period AS (
        SELECT
          c.id as client_id,
          SUM(ga.clicks) as prev_clicks
        FROM gsc_query_analytics ga
        INNER JOIN clients c ON ga.site_id = c.gsc_site_id
        WHERE c.workspace_id = ${workspaceId}
          AND c.is_deleted = false
          AND ga.date >= NOW() - INTERVAL '60 days'
          AND ga.date < NOW() - INTERVAL '30 days'
        GROUP BY c.id
      )
      SELECT
        cp.client_id as "clientId",
        cp.client_name as "clientName",
        cp.domain,
        cp.clicks,
        cp.impressions,
        cp.position,
        CASE
          WHEN COALESCE(pp.prev_clicks, 0) > 0
          THEN ((cp.clicks - pp.prev_clicks)::float / pp.prev_clicks) * 100
          ELSE 0
        END as "changePercent"
      FROM current_period cp
      LEFT JOIN previous_period pp ON cp.client_id = pp.client_id
      ORDER BY cp.clicks DESC
      LIMIT ${limit}
    `);

    return result.rows.map((row: Record<string, unknown>) => ({
      clientId: String(row.clientId),
      clientName: String(row.clientName),
      domain: String(row.domain),
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      position: Number(row.position) || 0,
      changePercent: Number(row.changePercent) || 0,
    }));
  }

  /**
   * Get clients with declining metrics.
   */
  async getUnderperformingClients(
    workspaceId: string,
    limit: number = 10
  ): Promise<ClientPerformance[]> {
    const result = await this.db.execute(sql`
      WITH current_period AS (
        SELECT
          c.id as client_id,
          c.name as client_name,
          c.domain,
          SUM(ga.clicks) as clicks,
          SUM(ga.impressions) as impressions,
          AVG(ga.position) as position
        FROM gsc_query_analytics ga
        INNER JOIN clients c ON ga.site_id = c.gsc_site_id
        WHERE c.workspace_id = ${workspaceId}
          AND c.is_deleted = false
          AND ga.date >= NOW() - INTERVAL '30 days'
        GROUP BY c.id, c.name, c.domain
      ),
      previous_period AS (
        SELECT
          c.id as client_id,
          SUM(ga.clicks) as prev_clicks
        FROM gsc_query_analytics ga
        INNER JOIN clients c ON ga.site_id = c.gsc_site_id
        WHERE c.workspace_id = ${workspaceId}
          AND c.is_deleted = false
          AND ga.date >= NOW() - INTERVAL '60 days'
          AND ga.date < NOW() - INTERVAL '30 days'
        GROUP BY c.id
      )
      SELECT
        cp.client_id as "clientId",
        cp.client_name as "clientName",
        cp.domain,
        cp.clicks,
        cp.impressions,
        cp.position,
        CASE
          WHEN COALESCE(pp.prev_clicks, 0) > 0
          THEN ((cp.clicks - pp.prev_clicks)::float / pp.prev_clicks) * 100
          ELSE 0
        END as "changePercent"
      FROM current_period cp
      LEFT JOIN previous_period pp ON cp.client_id = pp.client_id
      WHERE
        CASE
          WHEN COALESCE(pp.prev_clicks, 0) > 0
          THEN ((cp.clicks - pp.prev_clicks)::float / pp.prev_clicks) * 100
          ELSE 0
        END < 0
      ORDER BY "changePercent" ASC
      LIMIT ${limit}
    `);

    return result.rows.map((row: Record<string, unknown>) => ({
      clientId: String(row.clientId),
      clientName: String(row.clientName),
      domain: String(row.domain),
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      position: Number(row.position) || 0,
      changePercent: Number(row.changePercent) || 0,
    }));
  }

  /**
   * Get all clients with metrics for comparison view.
   */
  async getClientComparison(workspaceId: string): Promise<ClientComparison[]> {
    const result = await this.db.execute(sql`
      SELECT
        c.id as "clientId",
        c.name as "clientName",
        c.domain,
        COALESCE(SUM(ga.clicks), 0) as clicks,
        COALESCE(SUM(ga.impressions), 0) as impressions,
        COALESCE(AVG(ga.position), 0) as position,
        CASE
          WHEN SUM(ga.impressions) > 0
          THEN SUM(ga.clicks)::float / SUM(ga.impressions)
          ELSE 0
        END as ctr
      FROM clients c
      LEFT JOIN gsc_query_analytics ga ON ga.site_id = c.gsc_site_id
        AND ga.date >= NOW() - INTERVAL '30 days'
      WHERE c.workspace_id = ${workspaceId}
        AND c.is_deleted = false
      GROUP BY c.id, c.name, c.domain
      ORDER BY clicks DESC
    `);

    return result.rows.map((row: Record<string, unknown>) => ({
      clientId: String(row.clientId),
      clientName: String(row.clientName),
      domain: String(row.domain),
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      position: Number(row.position) || 0,
      ctr: Number(row.ctr) || 0,
    }));
  }
}

// Singleton instance with lazy db import
let instance: PortfolioMetricsService | null = null;

export async function getPortfolioMetricsService(): Promise<PortfolioMetricsService> {
  if (!instance) {
    const { db } = await import("@/db");
    instance = new PortfolioMetricsService(db);
  }
  return instance;
}

// Reset singleton for testing
export function resetPortfolioMetricsService(): void {
  instance = null;
}
