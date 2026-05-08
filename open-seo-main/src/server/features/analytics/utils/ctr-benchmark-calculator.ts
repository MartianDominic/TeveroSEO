/**
 * CTR Benchmark Calculator
 * Shared utility for industry-standard CTR benchmarks by search position.
 *
 * Consolidates CTR benchmark logic from:
 * - CtrBenchmarkService (Phase 96-05)
 * - CannibalizationService (Phase 35-05/96-03)
 * - StrikingDistanceService (Phase 96-03)
 *
 * Data sources:
 * - Advanced Web Rankings CTR Study (2024)
 * - Industry aggregate data
 */
import { createLogger } from '@/server/lib/logger';

const logger = createLogger({ module: 'ctr-benchmark' });

// =============================================================================
// Industry-Standard CTR Benchmarks by Position
// Source: Advanced Web Rankings CTR Study (2024 aggregate)
// =============================================================================

/**
 * Position-based CTR benchmarks for positions 1-20.
 * Based on AWR aggregate data across multiple industries.
 */
export const POSITION_CTR_BENCHMARKS: Readonly<Record<number, number>> = Object.freeze({
  1: 0.2851,   // 28.51% - Position 1
  2: 0.1574,   // 15.74% - Position 2
  3: 0.1101,   // 11.01% - Position 3
  4: 0.0803,   // 8.03% - Position 4
  5: 0.0573,   // 5.73% - Position 5
  6: 0.0441,   // 4.41% - Position 6
  7: 0.0348,   // 3.48% - Position 7
  8: 0.0295,   // 2.95% - Position 8
  9: 0.0242,   // 2.42% - Position 9
  10: 0.0207,  // 2.07% - Position 10
  11: 0.0199,  // 1.99% - Position 11 (page 2 start)
  12: 0.0168,  // 1.68%
  13: 0.0152,  // 1.52%
  14: 0.0140,  // 1.40%
  15: 0.0130,  // 1.30%
  16: 0.0120,  // 1.20%
  17: 0.0112,  // 1.12%
  18: 0.0105,  // 1.05%
  19: 0.0099,  // 0.99%
  20: 0.0093,  // 0.93% - Position 20
});

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Result of comparing actual CTR to benchmark.
 */
export interface CtrBenchmarkResult {
  /** Expected CTR based on position */
  expectedCtr: number;
  /** Actual observed CTR */
  actualCtr: number;
  /** Performance relative to benchmark */
  performance: 'above' | 'at' | 'below';
  /** Percentage difference from benchmark: (actual - expected) / expected * 100 */
  percentDifference: number;
  /** Absolute difference: actual - expected */
  absoluteDifference: number;
}

/**
 * CTR curve data point for charting.
 */
export interface CtrCurvePoint {
  position: number;
  ctr: number;
}

/**
 * Impact estimate based on CTR benchmark.
 */
export interface CtrImpactEstimate {
  /** Potential clicks if page achieved target position */
  potentialClicks: number;
  /** Current clicks */
  currentClicks: number;
  /** Click gain from optimization */
  clickGain: number;
  /** Target position used for calculation */
  targetPosition: number;
  /** Target CTR at that position */
  targetCtr: number;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get the expected CTR for a given search position.
 *
 * Uses industry-standard data for positions 1-20.
 * For positions beyond 20, uses exponential decay model.
 *
 * @param position - Search position (1-based)
 * @returns Expected CTR as decimal (e.g., 0.2851 for 28.51%)
 *
 * @example
 * getExpectedCtr(1)  // 0.2851 (28.51%)
 * getExpectedCtr(10) // 0.0207 (2.07%)
 * getExpectedCtr(25) // ~0.006 (exponential decay)
 */
export function getExpectedCtr(position: number): number {
  if (position <= 0) {
    return 0;
  }

  const roundedPosition = Math.round(position);

  // Use lookup table for positions 1-20
  if (roundedPosition <= 20) {
    return POSITION_CTR_BENCHMARKS[roundedPosition] ?? 0.01;
  }

  // Exponential decay for positions 21+
  // Formula: CTR_pos20 * 0.85^(position - 20)
  // Minimum of 0.1% to prevent unrealistic values
  const pos20Ctr = POSITION_CTR_BENCHMARKS[20];
  const decayFactor = 0.85;
  const extrapolatedCtr = pos20Ctr * Math.pow(decayFactor, position - 20);

  return Math.max(0.001, extrapolatedCtr);
}

/**
 * Compare actual CTR to the benchmark for a position.
 *
 * Performance thresholds:
 * - "above": Actual CTR > benchmark + 10%
 * - "below": Actual CTR < benchmark - 10%
 * - "at": Within +/- 10% of benchmark
 *
 * @param actualCtr - Observed CTR as decimal
 * @param position - Search position (1-based)
 * @returns Comparison result with performance assessment
 *
 * @example
 * compareToBenchmark(0.35, 1)
 * // { expectedCtr: 0.2851, actualCtr: 0.35, performance: 'above', percentDifference: 22.7 }
 */
export function compareToBenchmark(
  actualCtr: number,
  position: number
): CtrBenchmarkResult {
  const expectedCtr = getExpectedCtr(position);
  const absoluteDifference = actualCtr - expectedCtr;
  const percentDifference = expectedCtr > 0
    ? (absoluteDifference / expectedCtr) * 100
    : 0;

  let performance: 'above' | 'at' | 'below';
  if (percentDifference > 10) {
    performance = 'above';
  } else if (percentDifference < -10) {
    performance = 'below';
  } else {
    performance = 'at';
  }

  return {
    expectedCtr,
    actualCtr,
    performance,
    percentDifference,
    absoluteDifference,
  };
}

/**
 * Calculate potential impact of improving to a target position.
 *
 * @param currentImpressions - Current impression count
 * @param currentClicks - Current click count
 * @param currentPosition - Current average position
 * @param targetPosition - Target position to achieve (default: 3)
 * @returns Impact estimate with potential clicks and gains
 *
 * @example
 * calculateImpact(10000, 100, 15, 3)
 * // { potentialClicks: 1101, currentClicks: 100, clickGain: 1001, ... }
 */
export function calculateImpact(
  currentImpressions: number,
  currentClicks: number,
  currentPosition: number,
  targetPosition: number = 3
): CtrImpactEstimate {
  const targetCtr = getExpectedCtr(targetPosition);
  const potentialClicks = Math.round(currentImpressions * targetCtr);
  const clickGain = Math.max(0, potentialClicks - currentClicks);

  return {
    potentialClicks,
    currentClicks,
    clickGain,
    targetPosition,
    targetCtr,
  };
}

/**
 * Generate a CTR curve array for charting.
 *
 * @param maxPosition - Maximum position to include (default: 20)
 * @returns Array of position/CTR pairs
 *
 * @example
 * generateCtrCurve(10)
 * // [{ position: 1, ctr: 0.2851 }, { position: 2, ctr: 0.1574 }, ...]
 */
export function generateCtrCurve(maxPosition: number = 20): CtrCurvePoint[] {
  return Array.from({ length: maxPosition }, (_, i) => ({
    position: i + 1,
    ctr: getExpectedCtr(i + 1),
  }));
}

/**
 * Get all industry benchmark data as a readonly object.
 *
 * @returns Copy of position CTR benchmarks
 */
export function getIndustryBenchmarks(): Readonly<Record<number, number>> {
  return POSITION_CTR_BENCHMARKS;
}

/**
 * Calculate severity based on CTR performance vs benchmark.
 *
 * @param actualCtr - Observed CTR
 * @param position - Search position
 * @returns Severity level for reporting
 */
export function calculateCtrSeverity(
  actualCtr: number,
  position: number
): 'critical' | 'high' | 'medium' | 'low' {
  const result = compareToBenchmark(actualCtr, position);

  if (result.percentDifference < -50) {
    return 'critical';
  } else if (result.percentDifference < -25) {
    return 'high';
  } else if (result.percentDifference < -10) {
    return 'medium';
  }
  return 'low';
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Compare multiple pages to CTR benchmarks.
 *
 * @param pages - Array of pages with position and CTR data
 * @returns Array of pages with benchmark comparisons
 */
export function compareBatch<T extends { position: number; ctr: number }>(
  pages: T[]
): Array<T & { benchmark: CtrBenchmarkResult }> {
  return pages.map(page => ({
    ...page,
    benchmark: compareToBenchmark(page.ctr, page.position),
  }));
}

/**
 * Identify CTR optimization opportunities from a set of pages.
 *
 * @param pages - Pages with position and CTR data
 * @returns Pages performing below benchmark, sorted by opportunity size
 */
export function identifyOpportunities<T extends { position: number; ctr: number; impressions: number }>(
  pages: T[]
): Array<T & { benchmark: CtrBenchmarkResult; potentialClickGain: number }> {
  const withBenchmarks = pages.map(page => {
    const benchmark = compareToBenchmark(page.ctr, page.position);
    const potentialClickGain = benchmark.performance === 'below'
      ? Math.round(page.impressions * benchmark.absoluteDifference * -1)
      : 0;

    return {
      ...page,
      benchmark,
      potentialClickGain,
    };
  });

  // Filter to below-benchmark and sort by opportunity size
  return withBenchmarks
    .filter(p => p.benchmark.performance === 'below')
    .sort((a, b) => b.potentialClickGain - a.potentialClickGain);
}
