/**
 * CtrBenchmarkService
 * Phase 96-05: Position-based CTR benchmarks
 *
 * Provides industry-standard CTR benchmarks by search position
 * and compares actual performance against benchmarks.
 *
 * CTR benchmarks based on Advanced Web Rankings research (2024).
 */

/**
 * Industry-standard CTR benchmarks by position
 * Based on Advanced Web Rankings aggregate data
 */
const POSITION_CTR_BENCHMARKS: Record<number, number> = {
  1: 0.284,   // 28.4% CTR
  2: 0.155,   // 15.5% CTR
  3: 0.110,   // 11.0% CTR
  4: 0.082,   // 8.2% CTR
  5: 0.065,   // 6.5% CTR
  6: 0.047,   // 4.7% CTR
  7: 0.038,   // 3.8% CTR
  8: 0.032,   // 3.2% CTR
  9: 0.028,   // 2.8% CTR
  10: 0.024,  // 2.4% CTR
  // Positions 11-20 (striking distance)
  11: 0.018,  // 1.8%
  12: 0.015,
  13: 0.013,
  14: 0.011,
  15: 0.010,
  16: 0.009,
  17: 0.008,
  18: 0.007,
  19: 0.006,
  20: 0.005,  // 0.5%
};

/**
 * CTR comparison result
 */
export interface CtrComparison {
  position: number;
  benchmarkCtr: number;
  actualCtr: number;
  delta: number;        // actualCtr - benchmarkCtr
  deltaPercent: number; // (actual - benchmark) / benchmark * 100
  status: "above" | "at" | "below";
}

/**
 * CTR curve data point
 */
export interface CtrCurvePoint {
  position: number;
  ctr: number;
}

/**
 * Page with CTR data
 */
export interface PageWithCtr {
  url: string;
  position: number;
  ctr: number;
}

/**
 * Opportunity analysis result
 */
export interface PositionOpportunities {
  belowBenchmark: Array<PageWithCtr & { comparison: CtrComparison }>;
  atOrAboveBenchmark: Array<PageWithCtr & { comparison: CtrComparison }>;
}

export class CtrBenchmarkService {
  /**
   * Get the benchmark CTR for a given search position.
   * Uses industry-standard data for positions 1-20, exponential decay beyond.
   */
  getPositionCtrBenchmark(position: number): number {
    if (position < 1) {
      return 0;
    }

    if (position in POSITION_CTR_BENCHMARKS) {
      return POSITION_CTR_BENCHMARKS[position];
    }

    // Exponential decay for positions beyond 20
    // Uses decay factor that roughly matches observed behavior
    return Math.max(0.001, 0.284 * Math.pow(0.7, position - 1));
  }

  /**
   * Compare actual CTR against the benchmark for a position.
   * Returns comparison data including status (above/at/below).
   */
  compareActualToBenchmark(position: number, actualCtr: number): CtrComparison {
    const benchmark = this.getPositionCtrBenchmark(position);
    const delta = actualCtr - benchmark;
    const deltaPercent = benchmark > 0 ? ((actualCtr - benchmark) / benchmark) * 100 : 0;

    let status: "above" | "at" | "below";
    if (actualCtr > benchmark * 1.1) {
      status = "above";
    } else if (actualCtr < benchmark * 0.9) {
      status = "below";
    } else {
      status = "at";
    }

    return {
      position,
      benchmarkCtr: benchmark,
      actualCtr,
      delta,
      deltaPercent,
      status,
    };
  }

  /**
   * Generate a CTR curve array for charting.
   * Returns position/CTR pairs for positions 1 to maxPosition.
   */
  generateCtrCurve(maxPosition: number = 20): CtrCurvePoint[] {
    return Array.from({ length: maxPosition }, (_, i) => ({
      position: i + 1,
      ctr: this.getPositionCtrBenchmark(i + 1),
    }));
  }

  /**
   * Analyze pages to identify CTR optimization opportunities.
   * Returns pages sorted by opportunity size (biggest gaps first).
   */
  analyzePositionOpportunities(pages: PageWithCtr[]): PositionOpportunities {
    const belowBenchmark: Array<PageWithCtr & { comparison: CtrComparison }> = [];
    const atOrAboveBenchmark: Array<PageWithCtr & { comparison: CtrComparison }> = [];

    for (const page of pages) {
      const comparison = this.compareActualToBenchmark(page.position, page.ctr);

      if (comparison.status === "below") {
        belowBenchmark.push({ ...page, comparison });
      } else {
        atOrAboveBenchmark.push({ ...page, comparison });
      }
    }

    // Sort below-benchmark by opportunity size (biggest delta first)
    belowBenchmark.sort((a, b) => a.comparison.delta - b.comparison.delta);

    return {
      belowBenchmark,
      atOrAboveBenchmark,
    };
  }

  /**
   * Get all industry benchmark data as a lookup object.
   */
  getIndustryBenchmarks(): Record<number, number> {
    // Return copy to prevent mutation
    return { ...POSITION_CTR_BENCHMARKS };
  }
}

// Singleton instance
let instance: CtrBenchmarkService | null = null;

export function getCtrBenchmarkService(): CtrBenchmarkService {
  if (!instance) {
    instance = new CtrBenchmarkService();
  }
  return instance;
}

// Reset singleton for testing
export function resetCtrBenchmarkService(): void {
  instance = null;
}
