/**
 * Dedicated BullMQ worker entry — used by the `open-seo-worker` service in
 * docker-compose.vps.yml. Does NOT start the HTTP server. Runs only the
 * sandboxed audit worker + graceful shutdown.
 */
import { validateEnv, REQUIRED_ENV_CORE } from "@/server/lib/runtime-env";
import { startAuditWorker, stopAuditWorker } from "@/server/workers/audit-worker";
import { startReportWorker, stopReportWorker } from "@/server/workers/report-worker";
import { startScheduleWorker, stopScheduleWorker } from "@/server/workers/schedule-worker";
import { startRankingWorker, stopRankingWorker } from "@/server/workers/ranking-worker";
import { startAlertWorker, stopAlertWorker } from "@/server/workers/alert-worker";
import { startDashboardMetricsWorker, stopDashboardMetricsWorker } from "@/server/workers/dashboard-metrics-worker";
import { startProspectAnalysisWorker, stopProspectAnalysisWorker } from "@/server/workers/prospect-analysis-worker";
import { startVoiceAnalysisWorker, stopVoiceAnalysisWorker } from "@/server/workers/voice-analysis-worker";
import { startAnalyticsWorker, stopAnalyticsWorker } from "@/server/workers/analytics-worker";
import { startWebhookWorker, stopWebhookWorker } from "@/server/workers/webhook-worker";
import { startPortfolioAggregatesWorker, stopPortfolioAggregatesWorker } from "@/server/workers/portfolio-aggregates-worker";
import { startGoalWorker, stopGoalWorker } from "@/server/workers/goal-processor";
import { startAutoRevertWorker, stopAutoRevertWorker } from "@/server/workers/auto-revert-worker";
import { startPhaseWorker, stopPhaseWorker } from "@/server/workers/phase-worker";
import { startPlanWorker, stopPlanWorker } from "@/server/workers/plan-worker";
import { startOnboardingWorker, stopOnboardingWorker } from "@/server/workers/onboarding-worker";
import { startMaintenanceWorker, stopMaintenanceWorker } from "@/server/workers/maintenance-worker";
import { startDLQWorker, stopDLQWorker } from "@/server/workers/dlq-worker";
import { startFailedAuditsWorker, stopFailedAuditsWorker } from "@/server/workers/failed-audits-worker";
// Phase 96 Analytics Workers (QUEUE-01 fix: register all P96 workers)
import { startGscSyncWorker, stopGscSyncWorker } from "@/server/features/analytics/jobs/gsc-sync.worker";
import { startGa4SyncWorker, stopGa4SyncWorker } from "@/server/workers/ga4-sync-worker";
import { startTrendCalculationWorker, stopTrendCalculationWorker } from "@/server/workers/trend-calculation-worker";
import { startCannibalizationWorker, stopCannibalizationWorker } from "@/server/workers/cannibalization-worker";
import { startAlertDispatchWorker, stopAlertDispatchWorker } from "@/server/workers/alert-dispatch-worker";
import { closeRedis } from "@/server/lib/redis";
import { closeWebhookQueue } from "@/server/queues/webhookQueue";
import { closeOnboardingQueue } from "@/server/queues/onboardingQueue";
import { closePipelineFlowProducer } from "@/server/queues/pipelineQueue";
// SCR-01: Legacy Redis DLQ cleanup - still needed to process/migrate any remaining legacy jobs
// Once Redis DLQ is fully drained, this import and related shutdown calls can be removed
import { closeDLQQueue, stopDLQCleanupScheduler } from "@/server/queues/dlq";
import { closeAlertQueue } from "@/server/queues/alertQueue";
import { closeDashboardMetricsQueue } from "@/server/queues/dashboardMetricsQueue";
// SCRAPE-02/SCRAPE-03 FIX: Centralized queue scheduler
import { removeLegacySchedulers, closeAllQueues as closeSchedulerQueues } from "@/server/queues/queue-scheduler";
import { pool } from "@/db";
import { createLogger } from "@/server/lib/logger";
// SVC-01 FIX: Event consumers for analytics event handling
import {
  initAnalyticsEventConsumers,
  shutdownAnalyticsEventConsumers,
} from "@/server/features/analytics/events";

const log = createLogger({ module: "worker-entry" });

validateEnv(REQUIRED_ENV_CORE);

/**
 * Worker startup configuration.
 * Each entry maps a worker name to its start function.
 */
const workers = [
  { name: "Audit", start: startAuditWorker },
  { name: "Report", start: startReportWorker },
  { name: "Schedule", start: startScheduleWorker },
  { name: "Ranking", start: startRankingWorker },
  { name: "Alert", start: startAlertWorker },
  { name: "Dashboard metrics", start: startDashboardMetricsWorker },
  { name: "Prospect analysis", start: startProspectAnalysisWorker },
  { name: "Voice analysis", start: startVoiceAnalysisWorker },
  { name: "Analytics", start: startAnalyticsWorker },
  { name: "Webhook", start: startWebhookWorker },
  { name: "Portfolio aggregates", start: startPortfolioAggregatesWorker },
  { name: "Goal", start: startGoalWorker },
  { name: "Auto-revert", start: startAutoRevertWorker },
  { name: "Phase", start: startPhaseWorker },
  { name: "Plan", start: startPlanWorker },
  { name: "Onboarding", start: startOnboardingWorker },
  { name: "Maintenance", start: startMaintenanceWorker },
  { name: "DLQ", start: startDLQWorker },
  { name: "Failed audits", start: startFailedAuditsWorker },
  // Phase 96 Analytics Workers (QUEUE-01 fix)
  // lockDuration configured in each worker file per QUEUE-02 requirements
  { name: "GSC sync", start: startGscSyncWorker },
  { name: "GA4 sync", start: startGa4SyncWorker },
  { name: "Trend calculation", start: startTrendCalculationWorker },
  { name: "Cannibalization", start: startCannibalizationWorker },
  { name: "Alert dispatch", start: startAlertDispatchWorker },
] as const;

/**
 * Start all workers with proper error handling.
 * Uses Promise.allSettled to ensure all workers attempt to start,
 * even if some fail. Logs success/failure for each worker.
 *
 * Exported for use by server.ts in development mode to enable full
 * worker functionality without running a separate worker process.
 */
export async function startAllWorkers(): Promise<void> {
  log.info("Starting all workers...", { count: workers.length });

  // SCRAPE-02 FIX: Remove legacy schedulers before starting workers
  // This ensures old schedules (2 AM analytics, 3 AM gsc, etc.) are cleaned up
  try {
    await removeLegacySchedulers();
    log.info("Legacy schedulers cleaned up");
  } catch (err) {
    log.warn("Failed to remove legacy schedulers (may not exist)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const results = await Promise.allSettled(
    workers.map(async ({ name, start }) => {
      try {
        await start();
        log.info(`${name} worker started`);
        return { name, success: true };
      } catch (err) {
        log.error(`${name} worker failed to start`, err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  log.info("Worker startup complete", { succeeded, failed, total: workers.length });

  if (failed > 0) {
    log.warn("Some workers failed to start", { failedCount: failed });
  }

  // SVC-01 FIX: Initialize event consumers after workers are ready
  // This ensures events emitted by workers (CannibalizationWorker, TrendCalculationWorker)
  // have registered handlers to process them
  try {
    initAnalyticsEventConsumers();
    log.info("Analytics event consumers initialized");
  } catch (err) {
    log.error("Failed to initialize analytics event consumers", err instanceof Error ? err : new Error(String(err)));
    // Non-fatal: continue but log the error
  }
}

// Start all workers with proper error handling
startAllWorkers().catch((err) => {
  log.error("Fatal error starting workers", err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("Shutdown signal received", { signal });

  // SVC-01 FIX: Shutdown event consumers first to stop processing new events
  try { shutdownAnalyticsEventConsumers(); } catch (err) { log.error("shutdownAnalyticsEventConsumers failed", err instanceof Error ? err : new Error(String(err))); }

  try { await stopAuditWorker(); } catch (err) { log.error("stopAuditWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopReportWorker(); } catch (err) { log.error("stopReportWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopScheduleWorker(); } catch (err) { log.error("stopScheduleWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopRankingWorker(); } catch (err) { log.error("stopRankingWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopAlertWorker(); } catch (err) { log.error("stopAlertWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopDashboardMetricsWorker(); } catch (err) { log.error("stopDashboardMetricsWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopProspectAnalysisWorker(); } catch (err) { log.error("stopProspectAnalysisWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopVoiceAnalysisWorker(); } catch (err) { log.error("stopVoiceAnalysisWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopAnalyticsWorker(); } catch (err) { log.error("stopAnalyticsWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopWebhookWorker(); } catch (err) { log.error("stopWebhookWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopPortfolioAggregatesWorker(); } catch (err) { log.error("stopPortfolioAggregatesWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopGoalWorker(); } catch (err) { log.error("stopGoalWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopAutoRevertWorker(); } catch (err) { log.error("stopAutoRevertWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopPhaseWorker(); } catch (err) { log.error("stopPhaseWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopPlanWorker(); } catch (err) { log.error("stopPlanWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopOnboardingWorker(); } catch (err) { log.error("stopOnboardingWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopMaintenanceWorker(); } catch (err) { log.error("stopMaintenanceWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopDLQWorker(); } catch (err) { log.error("stopDLQWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopFailedAuditsWorker(); } catch (err) { log.error("stopFailedAuditsWorker failed", err instanceof Error ? err : new Error(String(err))); }
  // Phase 96 Analytics Workers (QUEUE-H05 fix: graceful shutdown)
  try { await stopGscSyncWorker(); } catch (err) { log.error("stopGscSyncWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopGa4SyncWorker(); } catch (err) { log.error("stopGa4SyncWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopTrendCalculationWorker(); } catch (err) { log.error("stopTrendCalculationWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopCannibalizationWorker(); } catch (err) { log.error("stopCannibalizationWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopAlertDispatchWorker(); } catch (err) { log.error("stopAlertDispatchWorker failed", err instanceof Error ? err : new Error(String(err))); }
  // Close queues before Redis connections
  try { stopDLQCleanupScheduler(); } catch (err) { log.error("stopDLQCleanupScheduler failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closeWebhookQueue(); } catch (err) { log.error("closeWebhookQueue failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closeOnboardingQueue(); } catch (err) { log.error("closeOnboardingQueue failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closePipelineFlowProducer(); } catch (err) { log.error("closePipelineFlowProducer failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closeDLQQueue(); } catch (err) { log.error("closeDLQQueue failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closeAlertQueue(); } catch (err) { log.error("closeAlertQueue failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closeDashboardMetricsQueue(); } catch (err) { log.error("closeDashboardMetricsQueue failed", err instanceof Error ? err : new Error(String(err))); }
  // SCRAPE-02/SCRAPE-03 FIX: Close centralized scheduler queues
  try { await closeSchedulerQueues(); } catch (err) { log.error("closeSchedulerQueues failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closeRedis(); } catch (err) { log.error("closeRedis failed", err instanceof Error ? err : new Error(String(err))); }
  try { await pool.end(); } catch (err) { log.error("pool.end failed", err instanceof Error ? err : new Error(String(err))); }
  log.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT");  });

// Process error handlers - prevent ungraceful crashes
process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled Rejection", reason instanceof Error ? reason : new Error(String(reason)), {
    promise: String(promise),
  });
  // Don't exit - just log. Let the worker continue processing.
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught Exception", error);
  // Attempt graceful shutdown on uncaught exception
  void shutdown("uncaughtException").finally(() => process.exit(1));
});

// Keep process alive — workers are event-driven, not request-driven.
setInterval(() => {}, 1 << 30);
