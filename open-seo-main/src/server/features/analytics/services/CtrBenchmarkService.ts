/**
 * CtrBenchmarkService
 * Phase 96-05: Position-based CTR benchmarks
 *
 * Provides industry-standard CTR benchmarks by search position
 * and compares actual performance against benchmarks.
 *
 * NOTE: Uses shared CtrBenchmarkCalculator for consistent benchmarks.
 */
import { createLogger } from '@/server/lib/logger';
import {
  getExpectedCtr,
  compareToBenchmark as sharedCompareToBenchmark,
  generateCtrCurve as sharedGenerateCtrCurve,
  getIndustryBenchmarks,
} from '../utils/ctr-benchmark-calculator';

const logger = createLogger({ module: 'ctr-benchmark-service' });

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
   * Uses shared calculator for consistent benchmarks.
   */
  getPositionCtrBenchmark(position: number): number {
    return getExpectedCtr(position);
  }

  /**
   * Compare actual CTR against the benchmark for a position.
   * Returns comparison data including status (above/at/below).
   */
  compareActualToBenchmark(position: number, actualCtr: number): CtrComparison {
    const result = sharedCompareToBenchmark(actualCtr, position);

    return {
      position,
      benchmarkCtr: result.expectedCtr,
      actualCtr: result.actualCtr,
      delta: result.absoluteDifference,
      deltaPercent: result.percentDifference,
      status: result.performance,
    };
  }

  /**
   * Generate a CTR curve array for charting.
   * Returns position/CTR pairs for positions 1 to maxPosition.
   */
  generateCtrCurve(maxPosition: number = 20): CtrCurvePoint[] {
    return sharedGenerateCtrCurve(maxPosition);
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

    logger.debug('Analyzed CTR opportunities', {
      totalPages: pages.length,
      belowBenchmark: belowBenchmark.length,
      atOrAbove: atOrAboveBenchmark.length,
    });

    return {
      belowBenchmark,
      atOrAboveBenchmark,
    };
  }

  /**
   * Get all industry benchmark data as a lookup object.
   */
  getIndustryBenchmarks(): Record<number, number> {
    return { ...getIndustryBenchmarks() };
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
