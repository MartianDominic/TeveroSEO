/**
 * Core Web Vitals Types
 * Phase 95-07: Core Web Vitals Integration
 * Phase 95-12: CWV Consolidation (threshold exports)
 */

// =============================================================================
// CWV Thresholds (Google's official thresholds)
// =============================================================================

/**
 * Core Web Vitals thresholds per Google's standards.
 * Reference: https://web.dev/vitals/
 */
export const CWV_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },      // milliseconds
  fid: { good: 100, poor: 300 },        // milliseconds (deprecated, use INP)
  cls: { good: 0.1, poor: 0.25 },       // unitless score
  inp: { good: 200, poor: 500 },        // milliseconds
  ttfb: { good: 800, poor: 1800 },      // milliseconds
} as const;

/**
 * Type-safe metric name derived from threshold keys.
 */
export type CwvMetricName = keyof typeof CWV_THRESHOLDS;

/**
 * Rating type for all CWV metrics.
 */
export type CwvRating = 'good' | 'needs-improvement' | 'poor';

// =============================================================================
// Metric Types
// =============================================================================

/**
 * Individual metric data with P75 and distribution.
 */
export interface CwvMetric {
  /** P75 value (75th percentile) */
  p75: number;
  /** Percentage of users with "good" experience */
  good: number;
  /** Percentage of users with "needs improvement" experience */
  needsImprovement: number;
  /** Percentage of users with "poor" experience */
  poor: number;
  /** Optional histogram bins */
  histogram?: HistogramBin[];
}

/**
 * Histogram bin for detailed distribution.
 */
export interface HistogramBin {
  start: number;
  end?: number;
  density: number;
}

// =============================================================================
// Main CWV Metrics Interface
// =============================================================================

export interface CwvMetrics {
  /** Data source */
  source: 'crux' | 'psi' | 'unavailable';

  /** When the data was fetched */
  fetchedAt: Date;

  // Core Web Vitals (P75 values)
  /** Largest Contentful Paint (ms) */
  lcp?: number;

  /** First Input Delay (ms) - CrUX only, deprecated in favor of INP */
  fid?: number;

  /** Interaction to Next Paint (ms) */
  inp?: number;

  /** Cumulative Layout Shift (score) */
  cls?: number;

  // Additional metrics from PSI
  /** First Contentful Paint (ms) */
  fcp?: number;

  /** Time to First Byte (ms) */
  ttfb?: number;

  /** Speed Index (ms) */
  si?: number;

  /** Total Blocking Time (ms) */
  tbt?: number;

  /** Performance score 0-100 (PSI only) */
  performanceScore?: number;

  // Ratings based on Google's thresholds
  lcpRating: CwvRating;
  inpRating: CwvRating;
  clsRating: CwvRating;

  // Optional detailed metrics (Phase 95-12)
  /** Detailed LCP metric with distribution */
  lcpMetric?: CwvMetric;
  /** Detailed FID metric with distribution */
  fidMetric?: CwvMetric;
  /** Detailed CLS metric with distribution */
  clsMetric?: CwvMetric;
  /** Detailed INP metric with distribution */
  inpMetric?: CwvMetric;
  /** Detailed TTFB metric with distribution */
  ttfbMetric?: CwvMetric;
}

// =============================================================================
// CWV Result Type (for consolidated service responses)
// =============================================================================

/**
 * Consolidated CWV result for Tier 3 check adapter.
 */
export interface CwvResult {
  /** Origin URL (normalized) */
  origin: string;
  /** Specific URL if page-level data */
  url?: string;
  /** Metrics data */
  metrics: CwvMetrics;
  /** Data source */
  source: 'crux_origin' | 'crux_url' | 'psi' | 'cache';
  /** CrUX record date */
  recordDate?: string;
  /** CrUX collection period */
  collectionPeriod?: {
    firstDate: string;
    lastDate: string;
  };
}
