/**
 * PixelAnalyticsService - Analytics aggregation and query for TeveroPixel
 * Phase 66-08: Pixel Analytics Dashboard
 *
 * Aggregates daily analytics data for dashboard display.
 * Applies Google CWV thresholds for metric ratings.
 */
import { eq, and, between, sql } from "drizzle-orm";
import { db } from "@/db";
import { pixelInstallations, pixelAnalyticsDaily } from "@/db/pixel-schema";

// ============================================================================
// Types
// ============================================================================

export type CwvRating = "good" | "needs-improvement" | "poor";
export type CwvMetric = "lcp" | "cls" | "inp";
export type Granularity = "daily" | "weekly" | "monthly";

export interface AnalyticsQuery {
  siteId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  granularity?: Granularity;
}

export interface AnalyticsSummary {
  totalPageviews: number;
  totalSessions: number;
  totalUniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;
}

export interface CwvMetricResult {
  p75: number;
  rating: CwvRating;
}

export interface CwvResult {
  lcp: CwvMetricResult;
  cls: CwvMetricResult;
  inp: CwvMetricResult;
}

export interface TimeseriesDataPoint {
  date: string;
  pageviews: number;
  sessions: number;
  uniqueVisitors: number;
}

export interface TopPage {
  url: string;
  views: number;
  avgTimeOnPage: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  cwv: CwvResult;
  timeseries: TimeseriesDataPoint[];
  topPages: TopPage[];
}

export interface CwvTrendPoint {
  date: string;
  lcp: number;
  cls: number;
  inp: number;
}

// ============================================================================
// CWV Thresholds (Google standards)
// ============================================================================

const CWV_THRESHOLDS = {
  lcp: {
    good: 2500, // < 2500ms
    needsImprovement: 4000, // < 4000ms
  },
  cls: {
    good: 0.1, // < 0.1
    needsImprovement: 0.25, // < 0.25
  },
  inp: {
    good: 200, // < 200ms
    needsImprovement: 500, // < 500ms
  },
} as const;

// ============================================================================
// PixelAnalyticsService
// ============================================================================

export class PixelAnalyticsService {
  /**
   * Get analytics summary and timeseries for a date range.
   */
  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResponse> {
    const { siteId, startDate, endDate, granularity = "daily" } = query;

    // Fetch daily analytics data for the date range
    const dailyData = await this.fetchDailyData(siteId, startDate, endDate);

    if (dailyData.length === 0) {
      return this.emptyResponse();
    }

    // Calculate summary
    const summary = this.calculateSummary(dailyData);

    // Calculate CWV averages and ratings
    const cwv = this.calculateCwv(dailyData);

    // Build timeseries based on granularity
    const timeseries = this.buildTimeseries(dailyData, granularity);

    // Merge and sort top pages
    const topPages = this.mergeTopPages(dailyData);

    return {
      summary,
      cwv,
      timeseries,
      topPages,
    };
  }

  /**
   * Get top pages for a date range.
   */
  async getTopPages(
    siteId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<TopPage[]> {
    const dailyData = await this.fetchDailyData(siteId, startDate, endDate);
    const topPages = this.mergeTopPages(dailyData);
    return topPages.slice(0, limit);
  }

  /**
   * Get CWV trend over time.
   */
  async getCwvTrend(
    siteId: string,
    startDate: string,
    endDate: string
  ): Promise<CwvTrendPoint[]> {
    const dailyData = await this.fetchDailyData(siteId, startDate, endDate);

    return dailyData.map((day) => ({
      date: this.formatDate(day.date),
      lcp: parseFloat(day.lcpP75 || "0"),
      cls: parseFloat(day.clsP75 || "0"),
      inp: parseFloat(day.inpP75 || "0"),
    }));
  }

  /**
   * Calculate CWV rating based on Google thresholds.
   */
  getCwvRating(metric: CwvMetric, value: number): CwvRating {
    const thresholds = CWV_THRESHOLDS[metric];

    if (value < thresholds.good) {
      return "good";
    } else if (value < thresholds.needsImprovement) {
      return "needs-improvement";
    } else {
      return "poor";
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fetch daily analytics data from database.
   */
  private async fetchDailyData(
    siteId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyDataRow[]> {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    const result = await db
      .select({
        id: pixelAnalyticsDaily.id,
        installationId: pixelAnalyticsDaily.installationId,
        date: pixelAnalyticsDaily.date,
        pageviews: pixelAnalyticsDaily.pageviews,
        sessions: pixelAnalyticsDaily.sessions,
        uniqueVisitors: pixelAnalyticsDaily.uniqueVisitors,
        avgTimeOnPage: pixelAnalyticsDaily.avgTimeOnPage,
        bounceRate: pixelAnalyticsDaily.bounceRate,
        lcpP75: pixelAnalyticsDaily.lcpP75,
        clsP75: pixelAnalyticsDaily.clsP75,
        inpP75: pixelAnalyticsDaily.inpP75,
        topPages: pixelAnalyticsDaily.topPages,
      })
      .from(pixelAnalyticsDaily)
      .innerJoin(
        pixelInstallations,
        eq(pixelAnalyticsDaily.installationId, pixelInstallations.id)
      )
      .where(
        and(
          eq(pixelInstallations.siteId, siteId),
          between(pixelAnalyticsDaily.date, startDateObj, endDateObj)
        )
      )
      .orderBy(pixelAnalyticsDaily.date);

    return result as DailyDataRow[];
  }

  /**
   * Calculate summary metrics from daily data.
   */
  private calculateSummary(dailyData: DailyDataRow[]): AnalyticsSummary {
    const totalPageviews = dailyData.reduce((sum, d) => sum + (d.pageviews || 0), 0);
    const totalSessions = dailyData.reduce((sum, d) => sum + (d.sessions || 0), 0);
    const totalUniqueVisitors = dailyData.reduce(
      (sum, d) => sum + (d.uniqueVisitors || 0),
      0
    );

    // Average time on page (weighted by pageviews would be more accurate, but simple avg for now)
    const avgTimeOnPageValues = dailyData
      .filter((d) => d.avgTimeOnPage)
      .map((d) => parseFloat(d.avgTimeOnPage || "0"));
    const avgTimeOnPage =
      avgTimeOnPageValues.length > 0
        ? avgTimeOnPageValues.reduce((sum, v) => sum + v, 0) / avgTimeOnPageValues.length
        : 0;

    // Average bounce rate
    const bounceRateValues = dailyData
      .filter((d) => d.bounceRate)
      .map((d) => parseFloat(d.bounceRate || "0"));
    const bounceRate =
      bounceRateValues.length > 0
        ? bounceRateValues.reduce((sum, v) => sum + v, 0) / bounceRateValues.length
        : 0;

    return {
      totalPageviews,
      totalSessions,
      totalUniqueVisitors,
      avgTimeOnPage,
      bounceRate,
    };
  }

  /**
   * Calculate CWV metrics with ratings.
   */
  private calculateCwv(dailyData: DailyDataRow[]): CwvResult {
    // Calculate average p75 across all days
    const lcpValues = dailyData
      .filter((d) => d.lcpP75)
      .map((d) => parseFloat(d.lcpP75 || "0"));
    const clsValues = dailyData
      .filter((d) => d.clsP75)
      .map((d) => parseFloat(d.clsP75 || "0"));
    const inpValues = dailyData
      .filter((d) => d.inpP75)
      .map((d) => parseFloat(d.inpP75 || "0"));

    const lcpP75 =
      lcpValues.length > 0
        ? lcpValues.reduce((sum, v) => sum + v, 0) / lcpValues.length
        : 0;
    const clsP75 =
      clsValues.length > 0
        ? clsValues.reduce((sum, v) => sum + v, 0) / clsValues.length
        : 0;
    const inpP75 =
      inpValues.length > 0
        ? inpValues.reduce((sum, v) => sum + v, 0) / inpValues.length
        : 0;

    return {
      lcp: { p75: lcpP75, rating: this.getCwvRating("lcp", lcpP75) },
      cls: { p75: clsP75, rating: this.getCwvRating("cls", clsP75) },
      inp: { p75: inpP75, rating: this.getCwvRating("inp", inpP75) },
    };
  }

  /**
   * Build timeseries data with optional aggregation by granularity.
   */
  private buildTimeseries(
    dailyData: DailyDataRow[],
    granularity: Granularity
  ): TimeseriesDataPoint[] {
    if (granularity === "daily") {
      return dailyData.map((d) => ({
        date: this.formatDate(d.date),
        pageviews: d.pageviews || 0,
        sessions: d.sessions || 0,
        uniqueVisitors: d.uniqueVisitors || 0,
      }));
    }

    // Group by week or month
    const groups = new Map<string, DailyDataRow[]>();

    for (const day of dailyData) {
      const key = this.getGroupKey(day.date, granularity);
      const existing = groups.get(key) || [];
      existing.push(day);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([key, days]) => ({
      date: key,
      pageviews: days.reduce((sum, d) => sum + (d.pageviews || 0), 0),
      sessions: days.reduce((sum, d) => sum + (d.sessions || 0), 0),
      uniqueVisitors: days.reduce((sum, d) => sum + (d.uniqueVisitors || 0), 0),
    }));
  }

  /**
   * Get grouping key for a date based on granularity.
   */
  private getGroupKey(date: Date, granularity: Granularity): string {
    const d = new Date(date);

    if (granularity === "weekly") {
      // ISO week start (Monday)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d);
      weekStart.setDate(diff);
      return this.formatDate(weekStart);
    }

    if (granularity === "monthly") {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    return this.formatDate(d);
  }

  /**
   * Merge top pages from all days, summing views per URL.
   */
  private mergeTopPages(dailyData: DailyDataRow[]): TopPage[] {
    const pageMap = new Map<string, { views: number; timeOnPageSum: number; count: number }>();

    for (const day of dailyData) {
      const topPages = day.topPages || [];
      for (const page of topPages) {
        const existing = pageMap.get(page.url) || {
          views: 0,
          timeOnPageSum: 0,
          count: 0,
        };
        existing.views += page.pageviews || 0;
        // We don't have per-page time data in the schema, use 0 for now
        existing.count += 1;
        pageMap.set(page.url, existing);
      }
    }

    return Array.from(pageMap.entries())
      .map(([url, data]) => ({
        url,
        views: data.views,
        avgTimeOnPage: data.count > 0 ? data.timeOnPageSum / data.count : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  /**
   * Format date to YYYY-MM-DD string.
   */
  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Return empty response for no data.
   */
  private emptyResponse(): AnalyticsResponse {
    return {
      summary: {
        totalPageviews: 0,
        totalSessions: 0,
        totalUniqueVisitors: 0,
        avgTimeOnPage: 0,
        bounceRate: 0,
      },
      cwv: {
        lcp: { p75: 0, rating: "good" },
        cls: { p75: 0, rating: "good" },
        inp: { p75: 0, rating: "good" },
      },
      timeseries: [],
      topPages: [],
    };
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface DailyDataRow {
  id: string;
  installationId: string;
  date: Date;
  pageviews: number;
  sessions: number;
  uniqueVisitors: number;
  avgTimeOnPage: string | null;
  bounceRate: string | null;
  lcpP75: string | null;
  clsP75: string | null;
  inpP75: string | null;
  topPages: Array<{ url: string; pageviews: number; uniqueVisitors: number }> | null;
}

// ============================================================================
// Singleton & Convenience Export
// ============================================================================

let analyticsInstance: PixelAnalyticsService | null = null;

export function getPixelAnalyticsService(): PixelAnalyticsService {
  if (!analyticsInstance) {
    analyticsInstance = new PixelAnalyticsService();
  }
  return analyticsInstance;
}

/**
 * Convenience function for getting analytics.
 */
export async function getAnalytics(
  query: AnalyticsQuery
): Promise<AnalyticsResponse> {
  return getPixelAnalyticsService().getAnalytics(query);
}

/**
 * Convenience function for getting top pages.
 */
export async function getTopPages(
  siteId: string,
  startDate: string,
  endDate: string,
  limit?: number
): Promise<TopPage[]> {
  return getPixelAnalyticsService().getTopPages(siteId, startDate, endDate, limit);
}
