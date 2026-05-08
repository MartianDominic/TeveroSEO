/**
 * Cache Warming Service
 * CACHE-02 FIX: Pre-populate analytics cache after GSC sync completion
 *
 * Triggered by 'analytics:sync-completed' event to ensure first users
 * accessing the dashboard get warm cache hits instead of cold queries.
 *
 * Strategy:
 * - Non-blocking (does not delay sync completion notification)
 * - Uses Promise.allSettled (partial failure doesn't affect other queries)
 * - Logs warming duration for performance monitoring
 *
 * Warms the following cache entries:
 * - Dashboard overview metrics (most common query)
 * - Trend data for last 30 days
 * - Top striking distance keywords
 * - Active cannibalization issues
 *
 * @see CACHING-STRATEGY.md for TTL rationale and design decisions
 */

import { createLogger } from '@/server/lib/logger';
import { db } from '@/db';
import { siteConnections } from '@/db/connection-schema';
import { eq } from 'drizzle-orm';

const log = createLogger({ module: 'cache-warming' });

/**
 * Result of a cache warming operation.
 */
export interface CacheWarmingResult {
  /** Whether warming completed successfully */
  success: boolean;
  /** Number of queries that succeeded */
  warmedCount: number;
  /** Number of queries that failed */
  failedCount: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Individual task results */
  tasks: Array<{
    name: string;
    status: 'fulfilled' | 'rejected';
    durationMs?: number;
    error?: string;
  }>;
}

/**
 * Warm analytics cache for a specific site after GSC sync completion.
 *
 * This function pre-populates common dashboard queries so the first user
 * to load the dashboard gets fast cache hits instead of slow database queries.
 *
 * @param workspaceId - Workspace UUID (typically clientId for this codebase)
 * @param siteId - Site UUID
 * @returns Result with success/failure counts and timing
 */
export async function warmAnalyticsCache(
  workspaceId: string,
  siteId: string
): Promise<CacheWarmingResult> {
  const startTime = Date.now();
  log.info('Starting cache warming', { workspaceId, siteId });

  // Define warming tasks with names for logging
  const warmingTasks: Array<{ name: string; fn: () => Promise<unknown> }> = [
    {
      name: 'trends',
      fn: async () => {
        const { getTrendDetectionService } = await import(
          '@/server/features/analytics/services/TrendDetectionService'
        );
        return getTrendDetectionService().analyzePageTrends(siteId, {}, workspaceId);
      },
    },
    {
      name: 'striking-distance',
      fn: async () => {
        const { getStrikingDistanceService } = await import(
          '@/server/features/analytics/services/StrikingDistanceService'
        );
        return getStrikingDistanceService().getStrikingDistancePages(
          siteId,
          { limit: 20 },
          workspaceId
        );
      },
    },
    {
      name: 'cannibalization',
      fn: async () => {
        const { getCannibalizationService } = await import(
          '@/server/features/analytics/services/CannibalizationService'
        );
        return getCannibalizationService().detect(siteId, {
          limit: 50,
          persist: false,
        });
      },
    },
    {
      name: 'dashboard',
      fn: async () => {
        const { getMasterDashboardService } = await import(
          '@/server/features/analytics/services/MasterDashboardService'
        );
        const { subDays, format } = await import('date-fns');
        const endDate = format(subDays(new Date(), 3), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 33), 'yyyy-MM-dd');

        return getMasterDashboardService().getAggregatedMetrics(workspaceId, {
          dateRange: { startDate, endDate },
          comparison: 'WoW', // Week-over-week comparison for dashboard overview
        });
      },
    },
  ];

  // Execute all tasks in parallel with individual timing
  const taskStartTimes = new Map<string, number>();
  const wrappedTasks = warmingTasks.map(({ name, fn }) => {
    taskStartTimes.set(name, Date.now());
    return fn()
      .then((result) => ({ name, result, durationMs: Date.now() - taskStartTimes.get(name)! }))
      .catch((error) => {
        throw { name, error, durationMs: Date.now() - taskStartTimes.get(name)! };
      });
  });

  const results = await Promise.allSettled(wrappedTasks);

  // Process results
  const tasks: CacheWarmingResult['tasks'] = [];
  let warmedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      warmedCount++;
      tasks.push({
        name: result.value.name,
        status: 'fulfilled',
        durationMs: result.value.durationMs,
      });
    } else {
      failedCount++;
      const reason = result.reason as { name: string; error: unknown; durationMs: number };
      tasks.push({
        name: reason.name,
        status: 'rejected',
        durationMs: reason.durationMs,
        error: reason.error instanceof Error ? reason.error.message : String(reason.error),
      });
    }
  }

  const durationMs = Date.now() - startTime;

  // Log results
  if (failedCount > 0) {
    log.warn('Cache warming completed with failures', {
      workspaceId,
      siteId,
      warmedCount,
      failedCount,
      durationMs,
      failures: tasks.filter((t) => t.status === 'rejected').map((t) => t.name),
    });
  } else {
    log.info('Cache warming completed successfully', {
      workspaceId,
      siteId,
      warmedCount,
      durationMs,
    });
  }

  return {
    success: failedCount === 0,
    warmedCount,
    failedCount,
    durationMs,
    tasks,
  };
}

/**
 * Warm analytics cache for a site, looking up the workspace ID automatically.
 *
 * This is a convenience function for callers that only have the siteId.
 * It queries the database to find the associated clientId (workspaceId).
 *
 * @param siteId - Site UUID
 * @returns Result with success/failure counts and timing
 */
export async function warmAnalyticsCacheForSite(siteId: string): Promise<CacheWarmingResult> {
  try {
    // Look up the clientId (workspaceId) for this site
    const siteConnection = await db
      .select({ clientId: siteConnections.clientId })
      .from(siteConnections)
      .where(eq(siteConnections.id, siteId))
      .limit(1);

    if (siteConnection.length === 0 || !siteConnection[0].clientId) {
      log.warn('Cannot warm cache: site not found or no clientId', { siteId });
      return {
        success: false,
        warmedCount: 0,
        failedCount: 0,
        durationMs: 0,
        tasks: [],
      };
    }

    return warmAnalyticsCache(siteConnection[0].clientId, siteId);
  } catch (error) {
    log.error('Failed to warm cache for site', error instanceof Error ? error : undefined, {
      siteId,
    });
    return {
      success: false,
      warmedCount: 0,
      failedCount: 1,
      durationMs: 0,
      tasks: [
        {
          name: 'lookup',
          status: 'rejected',
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}
