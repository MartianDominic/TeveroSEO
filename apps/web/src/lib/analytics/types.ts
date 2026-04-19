/**
 * Analytics data types for dashboard and per-client views.
 *
 * Used by:
 * - /dashboard (agency overview)
 * - /clients/[clientId]/analytics (per-client deep dive)
 *
 * Data sourced from:
 * - gsc_snapshots table (Google Search Console)
 * - ga4_snapshots table (Google Analytics 4)
 * - gsc_query_snapshots table (top queries)
 */

/**
 * Client status badge for dashboard display.
 * - good: clicks within 10% of 30-day rolling avg
 * - drop: clicks down >20% WoW (shown in "Needs attention" section)
 * - no_gsc: no active Google token
 * - stale: last sync >48h ago
 */
export type ClientStatus = "good" | "drop" | "no_gsc" | "stale";

/**
 * Dashboard client row data.
 * Returned by GET /api/analytics/dashboard endpoint.
 */
export interface DashboardClient {
  id: string;
  name: string;
  clicks_30d: number;
  impressions_30d: number;
  avg_position: number;
  wow_change: number;
  status: ClientStatus;
  last_sync: string | null;
}

/**
 * GSC daily data point for line charts.
 * date is ISO8601 string (YYYY-MM-DD).
 */
export interface GSCDataPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * GA4 daily data point for line charts.
 * date is ISO8601 string (YYYY-MM-DD).
 */
export interface GA4DataPoint {
  date: string;
  sessions: number;
  users: number;
  bounce_rate: number;
}

/**
 * Top query row for queries table.
 * position_delta: negative = improved (lower position is better).
 */
export interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  position_delta: number;
}

/**
 * GSC summary metrics for a date range.
 */
export interface GSCSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * GA4 summary metrics for a date range.
 */
export interface GA4Summary {
  sessions: number;
  users: number;
  conversions: number;
  bounce_rate: number;
}

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
