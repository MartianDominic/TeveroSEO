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

/**
 * Phase 96-03: Trend Detection Types
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
  trend: 'growing' | 'decaying' | 'stable';
  confidence: 'high' | 'medium' | 'low';
  topQueries: string[];
}

export interface QueryFilter {
  include?: string[];   // AND terms
  exclude?: string[];   // NOT terms
  pattern?: string;     // Regex pattern
  mode?: 'and' | 'or';  // Combine include terms with AND or OR
}

export interface TrendFilters {
  periodDays?: number;      // default 21 (3 weeks)
  threshold?: number;       // default 0.10 (10%)
  minImpressions?: number;  // default 100
  trend?: 'growing' | 'decaying' | 'all';
  queryFilter?: QueryFilter;
}

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
