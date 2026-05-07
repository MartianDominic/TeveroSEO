/**
 * Sync Health API Route
 * Phase 96-01 Task 5: GSC sync health monitoring endpoint
 *
 * Returns queue stats, last sync info, and recent errors.
 */

import { createFileRoute } from "@tanstack/react-router";
import { gscSyncQueue } from "@/server/features/analytics/jobs/gsc-sync.job";

export const Route = createFileRoute("/api/analytics/sync-health")({
  loader: async () => {
    // Get queue stats in parallel
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      gscSyncQueue.getWaitingCount(),
      gscSyncQueue.getActiveCount(),
      gscSyncQueue.getCompletedCount(),
      gscSyncQueue.getFailedCount(),
      gscSyncQueue.getDelayedCount(),
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
    const status = failed > 0 && active === 0 ? "degraded" : "healthy";

    return {
      status,
      queue: {
        waiting,
        active,
        completed,
        failed,
        delayed,
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
  } catch (error) {
    return null;
  }
}
