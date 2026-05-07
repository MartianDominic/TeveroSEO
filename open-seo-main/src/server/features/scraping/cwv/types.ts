/**
 * Core Web Vitals Types
 * Phase 95-07: Core Web Vitals Integration
 */

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
  lcpRating: 'good' | 'needs-improvement' | 'poor';
  inpRating: 'good' | 'needs-improvement' | 'poor';
  clsRating: 'good' | 'needs-improvement' | 'poor';
}
