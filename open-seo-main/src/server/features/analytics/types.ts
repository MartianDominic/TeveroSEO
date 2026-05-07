/**
 * Analytics Feature Types
 * Phase 96-01: GSC Analytics Infrastructure
 */

export interface GscQueryRow {
  query: string;
  pageUrl?: string;
  country?: string;
  device?: string;
  searchAppearance?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PaginationOptions {
  siteId: string;
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: string[];
  rowLimit?: number; // default 25000
}

export type DimensionCombination =
  | ["query"]
  | ["query", "page"]
  | ["query", "country"]
  | ["page"];

export const DIMENSION_COMBINATIONS: DimensionCombination[] = [
  ["query"],
  ["query", "page"],
  ["query", "country"],
  ["page"],
];

/**
 * Phase 96-02: Master Dashboard Types
 */

export type ComparisonPeriod = 'WoW' | 'MoM' | 'YoY';

export interface DateRange {
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
}

export interface DashboardFilters {
  dateRange: DateRange;
  comparison?: ComparisonPeriod;
  tags?: string[];
  siteIds?: string[];
}

export interface SiteMetrics {
  siteId: string;
  siteName: string;
  siteUrl: string;
  tags: string[];
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  comparison: {
    clicksChange: number;      // Percentage change from comparison period
    impressionsChange: number;
    ctrChange: number;
    positionChange: number;    // Negative = improvement (lower position is better)
  };
  trend: Array<{ date: string; clicks: number }>;  // 7-day sparkline
}

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
