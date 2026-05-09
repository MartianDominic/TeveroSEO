/**
 * Analytics Types
 *
 * Phase 96 Type Unification: Single source of truth for analytics types
 * used across apps/web and open-seo-main.
 *
 * Data sourced from:
 * - gsc_snapshots table (Google Search Console)
 * - ga4_snapshots table (Google Analytics 4)
 * - gsc_query_snapshots table (top queries)
 *
 * @module @tevero/types/analytics
 */

import { z } from "zod";
import type { DateRange, ComparisonPeriod } from "./common";

// =============================================================================
// Client Status & Metrics
// =============================================================================

/**
 * Client status badge for dashboard display.
 * - good: clicks within 10% of 30-day rolling avg
 * - drop: clicks down >20% WoW (shown in "Needs attention" section)
 * - no_gsc: no active Google token
 * - stale: last sync >48h ago
 */
export type ClientStatus = "good" | "drop" | "no_gsc" | "stale";

/**
 * Zod schema for ClientStatus.
 */
export const ClientStatusSchema = z.enum(["good", "drop", "no_gsc", "stale"]);

/**
 * Core metrics for a client/site.
 */
export interface ClientMetrics {
  /** Total clicks in period */
  clicks: number;
  /** Total impressions in period */
  impressions: number;
  /** Click-through rate (0-1) */
  ctr: number;
  /** Average position (1.0 = top) */
  position: number;
}

/**
 * Zod schema for ClientMetrics.
 */
export const ClientMetricsSchema = z.object({
  clicks: z.number().int().min(0),
  impressions: z.number().int().min(0),
  ctr: z.number().min(0).max(1),
  position: z.number().min(1),
});

/**
 * Dashboard client row data.
 * Returned by GET /api/analytics/dashboard endpoint.
 */
export interface DashboardClient {
  /** Client UUID */
  id: string;
  /** Client display name */
  name: string;
  /** Total clicks in last 30 days */
  clicks_30d: number;
  /** Total impressions in last 30 days */
  impressions_30d: number;
  /** Average position */
  avg_position: number;
  /** Week-over-week change percentage */
  wow_change: number;
  /** Client status badge */
  status: ClientStatus;
  /** Last GSC sync timestamp (ISO) */
  last_sync: string | null;
}

// =============================================================================
// Site Metrics
// =============================================================================

/**
 * Site metrics with comparison data.
 * Used in dashboard and portfolio views.
 */
export interface SiteMetrics {
  /** Site UUID */
  siteId: string;
  /** Site display name */
  siteName: string;
  /** Site URL */
  siteUrl: string;
  /** Associated tags */
  tags: string[];
  /** Current period metrics */
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  /** Comparison with previous period */
  comparison: {
    /** Percentage change in clicks */
    clicksChange: number;
    /** Percentage change in impressions */
    impressionsChange: number;
    /** Percentage change in CTR */
    ctrChange: number;
    /** Percentage change in position (negative = improvement) */
    positionChange: number;
  };
  /** 7-day sparkline data */
  trend: Array<{ date: string; clicks: number }>;
}

/**
 * Zod schema for SiteMetrics.
 */
export const SiteMetricsSchema = z.object({
  siteId: z.string().uuid(),
  siteName: z.string(),
  siteUrl: z.string().url(),
  tags: z.array(z.string()),
  metrics: z.object({
    clicks: z.number().int().min(0),
    impressions: z.number().int().min(0),
    ctr: z.number().min(0).max(1),
    position: z.number().min(1),
  }),
  comparison: z.object({
    clicksChange: z.number(),
    impressionsChange: z.number(),
    ctrChange: z.number(),
    positionChange: z.number(),
  }),
  trend: z.array(z.object({
    date: z.string(),
    clicks: z.number().int().min(0),
  })),
});

// =============================================================================
// GSC Data Points
// =============================================================================

/**
 * GSC daily data point for line charts.
 */
export interface GSCDataPoint {
  /** Date in ISO8601 format (YYYY-MM-DD) */
  date: string;
  /** Total clicks */
  clicks: number;
  /** Total impressions */
  impressions: number;
  /** Click-through rate */
  ctr: number;
  /** Average position */
  position: number;
}

/**
 * Zod schema for GSCDataPoint.
 */
export const GSCDataPointSchema = z.object({
  date: z.string(),
  clicks: z.number().int().min(0),
  impressions: z.number().int().min(0),
  ctr: z.number().min(0).max(1),
  position: z.number().min(1),
});

/**
 * GSC summary metrics for a date range.
 */
export interface GSCSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// =============================================================================
// GA4 Data Points
// =============================================================================

/**
 * GA4 daily data point for line charts.
 */
export interface GA4DataPoint {
  /** Date in ISO8601 format (YYYY-MM-DD) */
  date: string;
  /** Total sessions */
  sessions: number;
  /** Total users */
  users: number;
  /** Bounce rate (0-1) */
  bounce_rate: number;
}

/**
 * Zod schema for GA4DataPoint.
 */
export const GA4DataPointSchema = z.object({
  date: z.string(),
  sessions: z.number().int().min(0),
  users: z.number().int().min(0),
  bounce_rate: z.number().min(0).max(1),
});

/**
 * GA4 summary metrics for a date range.
 */
export interface GA4Summary {
  sessions: number;
  users: number;
  conversions: number;
  bounce_rate: number;
}

// =============================================================================
// Query Analysis
// =============================================================================

/**
 * Top query row for queries table.
 */
export interface TopQuery {
  /** Search query */
  query: string;
  /** Total clicks */
  clicks: number;
  /** Total impressions */
  impressions: number;
  /** Click-through rate */
  ctr: number;
  /** Average position */
  position: number;
  /** Position change (negative = improved) */
  position_delta: number;
}

/**
 * Zod schema for TopQuery.
 */
export const TopQuerySchema = z.object({
  query: z.string(),
  clicks: z.number().int().min(0),
  impressions: z.number().int().min(0),
  ctr: z.number().min(0).max(1),
  position: z.number().min(1),
  position_delta: z.number(),
});

// =============================================================================
// Full Analytics Data
// =============================================================================

/**
 * Full analytics data for per-client view.
 * Returned by GET /api/analytics/{clientId}/full endpoint.
 */
export interface AnalyticsData {
  gsc_daily: GSCDataPoint[];
  gsc_summary: GSCSummary;
  ga4_daily: GA4DataPoint[];
  ga4_summary: GA4Summary;
  top_queries: TopQuery[];
}

// =============================================================================
// Dashboard Aggregates
// =============================================================================

/**
 * Dashboard filters for analytics queries.
 */
export interface DashboardFilters {
  dateRange: DateRange;
  comparison?: ComparisonPeriod;
  tags?: string[];
  siteIds?: string[];
}

/**
 * Zod schema for DashboardFilters.
 */
export const DashboardFiltersSchema = z.object({
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  comparison: z.enum(["WoW", "MoM", "YoY"]).optional(),
  tags: z.array(z.string()).optional(),
  siteIds: z.array(z.string().uuid()).optional(),
});

/**
 * Dashboard aggregates response.
 */
export interface DashboardAggregates {
  totals: {
    clicks: number;
    impressions: number;
    avgPosition: number;
    avgCtr: number;
  };
  comparison: {
    clicksChange: number;
    impressionsChange: number;
    positionChange: number;
    ctrChange: number;
  };
  sites: SiteMetrics[];
  meta: {
    siteCount: number;
    dateRange: DateRange;
    comparisonPeriod: DateRange | null;
  };
}

// =============================================================================
// Trend Analysis
// =============================================================================

/**
 * Trend type for page analysis.
 */
export type TrendType = "growing" | "decaying" | "stable";

/**
 * Confidence level for trend detection.
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Trend analysis for a page.
 */
export interface TrendAnalysis {
  pageUrl: string;
  pageTitle?: string;
  currentClicks: number;
  previousClicks: number;
  currentImpressions: number;
  previousImpressions: number;
  currentPosition: number;
  previousPosition: number;
  changePercent: number;
  trend: TrendType;
  confidence: ConfidenceLevel;
  topQueries: string[];
}

/**
 * Query filter options.
 */
export interface QueryFilter {
  /** Include terms (AND) */
  include?: string[];
  /** Exclude terms (NOT) */
  exclude?: string[];
  /** Regex pattern */
  pattern?: string;
  /** Combine mode for include terms */
  mode?: "and" | "or";
}

/**
 * Trend detection filters.
 */
export interface TrendFilters {
  /** Period in days (default: 21) */
  periodDays?: number;
  /** Change threshold (default: 0.10 = 10%) */
  threshold?: number;
  /** Minimum impressions (default: 100) */
  minImpressions?: number;
  /** Trend type filter */
  trend?: TrendType | "all";
  /** Query filter */
  queryFilter?: QueryFilter;
}

/**
 * Trend detection result.
 */
export interface TrendResult {
  pages: TrendAnalysis[];
  meta: {
    totalAnalyzed: number;
    growingCount: number;
    decayingCount: number;
    stableCount: number;
    periodDays: number;
    threshold: number;
  };
}

// =============================================================================
// Striking Distance
// =============================================================================

/**
 * Difficulty level for ranking improvement.
 */
export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * Striking distance page (positions 11-20 with high potential).
 */
export interface StrikingDistancePage {
  pageUrl: string;
  pageTitle?: string;
  avgPosition: number;
  impressions: number;
  currentClicks: number;
  /** Estimated clicks if moved to position 1-3 */
  potentialClicks: number;
  /** potentialClicks - currentClicks */
  clickGain: number;
  difficulty: DifficultyLevel;
  topQueries: Array<{
    query: string;
    position: number;
    impressions: number;
    clicks: number;
  }>;
}

/**
 * Striking distance filters.
 */
export interface StrikingDistanceFilters {
  /** Minimum position (default: 11) */
  minPosition?: number;
  /** Maximum position (default: 20) */
  maxPosition?: number;
  /** Minimum impressions (default: 50) */
  minImpressions?: number;
  /** Target position for CTR estimate (default: 3) */
  targetPosition?: number;
  /** Result limit (default: 100) */
  limit?: number;
}

/**
 * Striking distance result.
 */
export interface StrikingDistanceResult {
  pages: StrikingDistancePage[];
  meta: {
    totalPages: number;
    totalPotentialClicks: number;
    /** 1=easy, 2=medium, 3=hard */
    avgDifficulty: number;
  };
}

// =============================================================================
// Portfolio Metrics
// =============================================================================

/**
 * Portfolio summary across all clients.
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
 * Portfolio trend data point.
 */
export interface PortfolioTrend {
  date: string;
  clicks: number;
  impressions: number;
  avgPosition: number;
}

/**
 * Client performance in portfolio view.
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

// =============================================================================
// Branded Split
// =============================================================================

/**
 * Branded/non-branded split metrics.
 */
export interface BrandedSplit<T> {
  branded: T;
  nonBranded: T;
  brandedPercent: number;
  nonBrandedPercent: number;
}

/**
 * CTR comparison with benchmark.
 */
export interface CtrComparison {
  position: number;
  benchmarkCtr: number;
  actualCtr: number;
  delta: number;
  deltaPercent: number;
  status: "above" | "at" | "below";
}
