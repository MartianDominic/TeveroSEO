/**
 * Shadow Mode Runner
 * Phase 95-05: Migration & Monitoring
 *
 * Runs both legacy and new implementations in parallel,
 * compares results, and logs differences for analysis.
 * Always returns the legacy result in shadow mode.
 */

import { scrapingService } from "../ScrapingService";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a shadow comparison.
 */
export interface ShadowComparison {
  match: boolean;
  differences: string[];
  legacyTimeMs: number;
  newTimeMs: number;
  legacyCost: number;
  newCost: number;
}

/**
 * Full shadow result including both implementations' outputs.
 */
export interface ShadowResult<T> {
  legacyResult: T;
  newResult: T | null;
  comparison: ShadowComparison;
  newError?: Error;
}

/**
 * Shadow comparison log entry.
 */
export interface ShadowComparisonLog {
  feature: string;
  timestamp: Date;
  legacyTimeMs: number;
  newTimeMs: number;
  match: boolean;
  differences: string[];
  legacySuccess: boolean;
  newSuccess: boolean;
  legacyCost?: number;
  newCost?: number;
  url?: string;
  sampleDiff?: string;
}

/**
 * Comparison function type.
 */
export type CompareFunction<T> = (
  legacy: T,
  newResult: T
) => { match: boolean; differences: string[] };

// =============================================================================
// Shadow Comparison Logging
// =============================================================================

/** In-memory log buffer for shadow comparisons */
const shadowComparisonBuffer: ShadowComparisonLog[] = [];
const MAX_BUFFER_SIZE = 1000;

/**
 * Log a shadow comparison result.
 * Stores in memory buffer and optionally writes to persistent storage.
 */
export async function logShadowComparison(
  log: ShadowComparisonLog
): Promise<void> {
  // Add to in-memory buffer
  shadowComparisonBuffer.push(log);

  // Trim buffer if too large
  if (shadowComparisonBuffer.length > MAX_BUFFER_SIZE) {
    shadowComparisonBuffer.splice(0, shadowComparisonBuffer.length - MAX_BUFFER_SIZE);
  }

  // Log warning for mismatches
  if (!log.match) {
    console.warn(`[Shadow] Mismatch in ${log.feature}:`, {
      differences: log.differences.slice(0, 5),
      legacyTimeMs: log.legacyTimeMs,
      newTimeMs: log.newTimeMs,
    });

    // Track in ScrapingService
    scrapingService.recordShadowMismatch();
  }

  // TODO: Persist to database for long-term analysis
  // await db.insert(shadowComparisonLogs).values(log);
}

/**
 * Get recent shadow comparison logs.
 */
export function getShadowComparisonLogs(
  limit = 100,
  filterMismatches = false
): ShadowComparisonLog[] {
  let logs = [...shadowComparisonBuffer];

  if (filterMismatches) {
    logs = logs.filter((l) => !l.match);
  }

  return logs.slice(-limit);
}

/**
 * Get shadow comparison statistics.
 */
export function getShadowStats(): {
  totalComparisons: number;
  matches: number;
  mismatches: number;
  matchRate: number;
  avgLegacyTimeMs: number;
  avgNewTimeMs: number;
  avgSpeedup: number;
} {
  const logs = shadowComparisonBuffer;
  const total = logs.length;

  if (total === 0) {
    return {
      totalComparisons: 0,
      matches: 0,
      mismatches: 0,
      matchRate: 1,
      avgLegacyTimeMs: 0,
      avgNewTimeMs: 0,
      avgSpeedup: 0,
    };
  }

  const matches = logs.filter((l) => l.match).length;
  const avgLegacyTime = logs.reduce((sum, l) => sum + l.legacyTimeMs, 0) / total;
  const avgNewTime = logs.reduce((sum, l) => sum + l.newTimeMs, 0) / total;

  return {
    totalComparisons: total,
    matches,
    mismatches: total - matches,
    matchRate: matches / total,
    avgLegacyTimeMs: avgLegacyTime,
    avgNewTimeMs: avgNewTime,
    avgSpeedup: avgNewTime > 0 ? avgLegacyTime / avgNewTime : 0,
  };
}

/**
 * Clear shadow comparison buffer.
 */
export function clearShadowLogs(): void {
  shadowComparisonBuffer.length = 0;
}

// =============================================================================
// Shadow Runner
// =============================================================================

/**
 * Safely execute a function and return result or error.
 */
async function safeExecute<T>(
  fn: () => Promise<T>
): Promise<[T | null, Error | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Run both legacy and new implementations in shadow mode.
 *
 * @param featureName Name of the feature (for logging)
 * @param legacyFn Function that runs the legacy implementation
 * @param newFn Function that runs the new implementation
 * @param compareFn Function that compares the two results
 * @returns Always returns the legacy result (shadow mode)
 *
 * @example
 * ```typescript
 * const result = await runShadow(
 *   'prospectAnalysis',
 *   () => scrapeWithLegacy(url),
 *   () => scrapeWithUnified(url),
 *   compareProspectScrape
 * );
 * ```
 */
export async function runShadow<T>(
  featureName: string,
  legacyFn: () => Promise<T>,
  newFn: () => Promise<T>,
  compareFn: CompareFunction<T>,
  options: {
    url?: string;
    timeout?: number;
    logOnMatch?: boolean;
  } = {}
): Promise<T> {
  const { url, logOnMatch = false } = options;

  // Run both implementations in parallel
  const legacyStart = Date.now();
  const [legacyResult, legacyError] = await safeExecute(legacyFn);
  const legacyTimeMs = Date.now() - legacyStart;

  const newStart = Date.now();
  const [newResult, newError] = await safeExecute(newFn);
  const newTimeMs = Date.now() - newStart;

  // Log comparison if both succeeded
  if (legacyResult !== null && newResult !== null) {
    const comparison = compareFn(legacyResult, newResult);

    // Only log if mismatch or logOnMatch is true
    if (!comparison.match || logOnMatch) {
      await logShadowComparison({
        feature: featureName,
        timestamp: new Date(),
        legacyTimeMs,
        newTimeMs,
        match: comparison.match,
        differences: comparison.differences,
        legacySuccess: true,
        newSuccess: true,
        url,
        sampleDiff: comparison.differences[0],
      });
    }
  } else {
    // Log if one or both failed
    await logShadowComparison({
      feature: featureName,
      timestamp: new Date(),
      legacyTimeMs,
      newTimeMs,
      match: false,
      differences: [
        legacyError ? `Legacy failed: ${legacyError.message}` : "",
        newError ? `New failed: ${newError.message}` : "",
      ].filter(Boolean),
      legacySuccess: !legacyError,
      newSuccess: !newError,
      url,
    });
  }

  // Always return legacy result in shadow mode
  if (legacyError) {
    throw legacyError;
  }

  return legacyResult!;
}

/**
 * Run shadow comparison without blocking on the new implementation.
 * Useful when you want non-blocking shadow testing.
 */
export async function runShadowAsync<T>(
  featureName: string,
  legacyFn: () => Promise<T>,
  newFn: () => Promise<T>,
  compareFn: CompareFunction<T>,
  options: { url?: string } = {}
): Promise<T> {
  // Run legacy synchronously
  const legacyStart = Date.now();
  const legacyResult = await legacyFn();
  const legacyTimeMs = Date.now() - legacyStart;

  // Run new implementation in background (fire-and-forget)
  const newStart = Date.now();
  newFn()
    .then((newResult) => {
      const newTimeMs = Date.now() - newStart;
      const comparison = compareFn(legacyResult, newResult);

      if (!comparison.match) {
        logShadowComparison({
          feature: featureName,
          timestamp: new Date(),
          legacyTimeMs,
          newTimeMs,
          match: comparison.match,
          differences: comparison.differences,
          legacySuccess: true,
          newSuccess: true,
          url: options.url,
        });
      }
    })
    .catch((error) => {
      logShadowComparison({
        feature: featureName,
        timestamp: new Date(),
        legacyTimeMs,
        newTimeMs: Date.now() - newStart,
        match: false,
        differences: [`New failed: ${error instanceof Error ? error.message : String(error)}`],
        legacySuccess: true,
        newSuccess: false,
        url: options.url,
      });
    });

  return legacyResult;
}
