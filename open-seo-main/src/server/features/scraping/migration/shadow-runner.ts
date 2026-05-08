/**
 * Shadow Mode Runner
 * Phase 95-05: Migration & Monitoring
 *
 * Runs both legacy and new implementations in parallel,
 * compares results, and logs differences for analysis.
 * Always returns the legacy result in shadow mode.
 *
 * MIG-3: Now persists comparison logs to database for long-term analysis.
 */

import { db } from "@/db";
import {
  shadowComparisonLogs,
  type ShadowAnalysis,
} from "@/db/scraping-shadow-schema";
import { and, eq, gte, lt, desc } from "drizzle-orm";
import { scrapingService } from "../ScrapingService";
import { migrationLogger } from "../logging";

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
 * Stores in memory buffer for quick access and persists to database
 * for long-term analysis (MIG-3).
 */
export async function logShadowComparison(
  log: ShadowComparisonLog
): Promise<void> {
  // Add to in-memory buffer for quick access
  shadowComparisonBuffer.push(log);

  // Trim buffer if too large
  if (shadowComparisonBuffer.length > MAX_BUFFER_SIZE) {
    shadowComparisonBuffer.splice(0, shadowComparisonBuffer.length - MAX_BUFFER_SIZE);
  }

  // Log warning for mismatches
  if (!log.match) {
    migrationLogger.warn({
      feature: log.feature,
      differences: log.differences.slice(0, 5),
      legacyTimeMs: log.legacyTimeMs,
      newTimeMs: log.newTimeMs,
    }, 'Shadow mismatch');

    // Track in ScrapingService
    scrapingService.recordShadowMismatch();
  }

  // Persist to database (fire-and-forget for performance)
  db.insert(shadowComparisonLogs).values({
    feature: log.feature,
    url: log.url,
    legacyStatus: log.legacySuccess ? "success" : "failure",
    newStatus: log.newSuccess ? "success" : "failure",
    matches: log.match,
    legacyDurationMs: log.legacyTimeMs,
    newDurationMs: log.newTimeMs,
    legacyCost: log.legacyCost,
    newCost: log.newCost,
    differences: log.differences,
    sampleDiff: log.sampleDiff,
  }).catch(err => {
    migrationLogger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to persist shadow log');
  });
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

// =============================================================================
// Database Query Functions (MIG-3)
// =============================================================================

/**
 * Get shadow analysis from the database for a specific feature.
 * Queries persisted logs for long-term mismatch analysis.
 *
 * @param feature Feature name to analyze
 * @param options Query options
 * @returns Shadow analysis with logs and statistics
 */
export async function getShadowAnalysis(
  feature: string,
  options: { days?: number; onlyMismatches?: boolean; limit?: number } = {}
): Promise<ShadowAnalysis> {
  const { days = 7, onlyMismatches = false, limit = 1000 } = options;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const whereConditions = [
    eq(shadowComparisonLogs.feature, feature),
    gte(shadowComparisonLogs.createdAt, since),
  ];

  if (onlyMismatches) {
    whereConditions.push(eq(shadowComparisonLogs.matches, false));
  }

  const logs = await db.select()
    .from(shadowComparisonLogs)
    .where(and(...whereConditions))
    .orderBy(desc(shadowComparisonLogs.createdAt))
    .limit(limit);

  const total = logs.length;
  const matches = logs.filter(l => l.matches).length;
  const mismatches = total - matches;

  // Calculate average durations
  const validLegacyDurations = logs.filter(l => l.legacyDurationMs != null);
  const validNewDurations = logs.filter(l => l.newDurationMs != null);

  const avgLegacyDurationMs = validLegacyDurations.length > 0
    ? validLegacyDurations.reduce((sum, l) => sum + (l.legacyDurationMs ?? 0), 0) / validLegacyDurations.length
    : 0;

  const avgNewDurationMs = validNewDurations.length > 0
    ? validNewDurations.reduce((sum, l) => sum + (l.newDurationMs ?? 0), 0) / validNewDurations.length
    : 0;

  return {
    total,
    matches,
    mismatches,
    matchRate: total > 0 ? matches / total : 0,
    avgLegacyDurationMs,
    avgNewDurationMs,
    avgSpeedup: avgNewDurationMs > 0 ? avgLegacyDurationMs / avgNewDurationMs : 0,
    logs,
  };
}

/**
 * Get all features that have shadow logs.
 * Useful for discovering what features are being tested.
 */
export async function getShadowFeatures(): Promise<string[]> {
  const result = await db.selectDistinct({ feature: shadowComparisonLogs.feature })
    .from(shadowComparisonLogs)
    .orderBy(shadowComparisonLogs.feature);

  return result.map(r => r.feature);
}

/**
 * Cleanup old shadow logs based on retention policy.
 * Default retention is 30 days.
 *
 * @param retentionDays Number of days to retain logs (default: 30)
 * @returns Number of deleted rows
 */
export async function cleanupOldShadowLogs(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await db.delete(shadowComparisonLogs)
    .where(lt(shadowComparisonLogs.createdAt, cutoff));

  const deletedCount = result.rowCount ?? 0;

  if (deletedCount > 0) {
    migrationLogger.info({ deletedCount, retentionDays, cutoffDate: cutoff.toISOString() }, 'Cleaned up old shadow logs');
  }

  return deletedCount;
}
