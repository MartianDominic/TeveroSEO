/**
 * Sync Health API Route
 * Phase 96-01 Task 5: GSC sync health monitoring endpoint
 * Phase 96-Queue: Enhanced with DLQ stats and flow status
 *
 * Returns queue stats, last sync info, recent errors, DLQ status, and average durations.
 */

import { createFileRoute } from "@tanstack/react-router";
import { gscSyncQueue } from "@/server/features/analytics/jobs/gsc-sync.job";
import { getAnalyticsHealthStats } from "@/server/features/analytics/jobs/analytics-orchestrator";
import { countDeadLetterJobs, getDeadLetterStats } from "@/server/lib/dead-letter-queue";

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/analytics/sync-health")({
  loader: async () => {
    // Get comprehensive health stats from orchestrator
    const [analyticsStats, dlqStats, gscDlqCount, annotationsDlqCount] = await Promise.all([
      getAnalyticsHealthStats(),
      getDeadLetterStats(),
      countDeadLetterJobs({ queue: "gsc-sync", unreplayedOnly: true }),
      countDeadLetterJobs({ queue: "annotations-import", unreplayedOnly: true }),
    ]);

    // Get last completed job
    const completedJobs = await gscSyncQueue.getCompleted(0, 1);
    const lastSync = completedJobs.length > 0 && completedJobs[0].finishedOn
      ? {
          completedAt: completedJobs[0].finishedOn,
          sitesProcessed: completedJobs[0].returnvalue?.sitesProcessed ?? 0,
          rowsInserted: completedJobs[0].returnvalue?.totalRowsInserted ?? 0,
        }
      : null;

    // Get recent failures
    const failedJobs = await gscSyncQueue.getFailed(0, 5);
    const recentErrors = failedJobs.map((job) => ({
      failedAt: job.finishedOn ?? null,
      error: job.failedReason ?? "Unknown error",
      jobId: job.id,
    }));

    // Get next scheduled run
    const nextScheduled = await getNextScheduledRun();

    // Determine overall status
    const { gscSync, annotationsImport } = analyticsStats;
    const hasQueueFailures = gscSync.failed > 0 || annotationsImport.failed > 0;
    const hasDlqItems = gscDlqCount > 0 || annotationsDlqCount > 0;
    const isActive = gscSync.active > 0 || annotationsImport.active > 0;

    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (hasDlqItems) {
      status = "critical"; // Jobs have permanently failed
    } else if (hasQueueFailures && !isActive) {
      status = "degraded"; // Recent failures but nothing running
    }

    return {
      status,
      queue: {
        gscSync: {
          waiting: gscSync.waiting,
          active: gscSync.active,
          completed: gscSync.completed,
          failed: gscSync.failed,
          delayed: gscSync.delayed,
        },
        annotationsImport: {
          waiting: annotationsImport.waiting,
          active: annotationsImport.active,
          completed: annotationsImport.completed,
          failed: annotationsImport.failed,
          delayed: annotationsImport.delayed,
        },
      },
      deadLetterQueue: {
        gscSync: gscDlqCount,
        annotationsImport: annotationsDlqCount,
        total: dlqStats.total,
        unreplayed: dlqStats.unreplayed,
        last24h: dlqStats.last24h,
      },
      lastFlowStatus: analyticsStats.lastFlowStatus,
      averageJobDuration: {
        gscSyncMs: analyticsStats.averageJobDuration.gscSyncMs,
        gscSyncFormatted: formatDuration(analyticsStats.averageJobDuration.gscSyncMs),
        annotationsMs: analyticsStats.averageJobDuration.annotationsMs,
        annotationsFormatted: formatDuration(analyticsStats.averageJobDuration.annotationsMs),
      },
      lastSync,
      recentErrors,
      nextScheduled,
    };
  },
});

/**
 * Get next scheduled run time from repeatable jobs.
 */
async function getNextScheduledRun(): Promise<number | null> {
  try {
    const repeatableJobs = await gscSyncQueue.getRepeatableJobs();
    const fullSync = repeatableJobs.find((j) => j.key?.includes("gsc-full-sync-daily"));
    return fullSync?.next ?? null;
  } catch {
    return null;
  }
}

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
