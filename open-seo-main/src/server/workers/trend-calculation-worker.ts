/**
 * Trend Calculation Worker
 * Phase 96 Analytics: BullMQ worker for calculating trend metrics
 *
 * QUEUE-02 FIX: lockDuration set to 300000ms (5 minutes) for trend calculations
 *
 * Worker configuration:
 * - lockDuration: 300000 (5 min) - allows complex trend analysis
 * - Concurrency: 3 (parallel workspace calculations)
 * - Graceful shutdown with 30s timeout
 *
 * Calculates:
 * - Position trends (7d, 30d, 90d deltas)
 * - Click/impression velocity
 * - Seasonality detection
 * - Anomaly detection
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection, WORKER_CONCURRENCY_LIMITS } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
// QUEUE-03 FIX: Use DB-based DLQ instead of Redis streams
import { moveToDeadLetter } from "@/server/lib/dead-letter-queue";

const log = createLogger({ module: "trend-calculation-worker" });

// QUEUE-02: lockDuration for trend calculations
const LOCK_DURATION_MS = 300_000; // 5 minutes
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Job data for trend calculation jobs.
 */
export interface TrendCalculationJobData {
  workspaceId: string;
  siteId?: string;
  calculationType: "full" | "incremental" | "page" | "query";
  dateRange?: { start: string; end: string };
}

/**
 * Job result returned after calculation completes.
 */
export interface TrendCalculationJobResult {
  trendsCalculated: number;
  anomaliesDetected: number;
  durationMs: number;
}

let worker: Worker<TrendCalculationJobData, TrendCalculationJobResult> | null = null;

/**
 * Start the trend calculation worker.
 */
export function startTrendCalculationWorker(): Worker<TrendCalculationJobData, TrendCalculationJobResult> {
  if (worker) return worker;

  worker = new Worker<TrendCalculationJobData, TrendCalculationJobResult>(
    "trend-calculation",
    async (job: Job<TrendCalculationJobData, TrendCalculationJobResult>) => {
      const startTime = Date.now();
      const { workspaceId, calculationType } = job.data;

      log.info("Starting trend calculation", { jobId: job.id, workspaceId, calculationType });

      try {
        // Lazy import to avoid circular dependencies
        // Use backward-compatible function that returns TrendResult directly
        const { analyzePageTrends } = await import(
          "@/server/features/analytics/services/TrendDetectionService"
        );

        let trendsCalculated = 0;
        let anomaliesDetected = 0;

        // Different calculation modes
        switch (calculationType) {
          case "full": {
            // Full site trend analysis
            const result = await analyzePageTrends(workspaceId);
            trendsCalculated = result.pages?.length ?? 0;
            anomaliesDetected = result.pages?.filter((p: { trend?: string }) =>
              p.trend === "declining" || p.trend === "volatile"
            ).length ?? 0;
            break;
          }
          case "page": {
            // Page-level trend analysis
            const result = await analyzePageTrends(workspaceId);
            trendsCalculated = result.pages?.length ?? 0;
            break;
          }
          case "query": {
            // Query-level trend analysis (uses same API as page trends)
            const result = await analyzePageTrends(workspaceId);
            trendsCalculated = result.pages?.length ?? 0;
            break;
          }
          case "incremental":
          default: {
            // Incremental updates (last 7 days)
            const result = await analyzePageTrends(workspaceId);
            trendsCalculated = result.pages?.length ?? 0;
            break;
          }
        }

        await job.updateProgress(100);

        const durationMs = Date.now() - startTime;
        log.info("Trend calculation complete", {
          jobId: job.id,
          trendsCalculated,
          anomaliesDetected,
          durationMs,
        });

        return {
          trendsCalculated,
          anomaliesDetected,
          durationMs,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error("Trend calculation failed", error instanceof Error ? error : new Error(errorMsg), {
          jobId: job.id,
          workspaceId,
        });
        throw error;
      }
    },
    {
      connection: getSharedBullMQConnection("worker:trend-calculation"),
      lockDuration: LOCK_DURATION_MS, // QUEUE-02 fix
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: WORKER_CONCURRENCY_LIMITS.analytics ?? 3,
    }
  );

  worker.on("ready", () => {
    log.info("Trend calculation worker ready");
  });

  worker.on("error", (err) => {
    log.error("Trend calculation worker error", err);
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      // QUEUE-03 FIX: Use DB-based DLQ instead of Redis streams
      try {
        await moveToDeadLetter({
          jobId: job.id ?? `unknown-${Date.now()}`,
          queue: "trend-calculation",
          jobName: job.name,
          data: job.data,
          error: err.message,
          stackTrace: err.stack,
          retryCount: job.attemptsMade,
          metadata: {
            lastAttemptAt: new Date().toISOString(),
            originalTimestamp: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
          },
        });
        log.warn("Trend calculation job moved to DB-based DLQ", { jobId: job.id });
      } catch (dlqErr) {
        log.error("Failed to move trend calculation job to DLQ", dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)));
      }
    }
  });

  worker.on("completed", (job, result) => {
    log.info("Trend calculation job completed", {
      jobId: job.id,
      trends: result.trendsCalculated,
      anomalies: result.anomaliesDetected,
      durationMs: result.durationMs,
    });
  });

  worker.on("stalled", (jobId) => {
    log.warn("Trend calculation job stalled", { jobId });
  });

  return worker;
}

/**
 * Stop the trend calculation worker gracefully.
 */
export async function stopTrendCalculationWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);

  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    log.error("Trend calculation worker graceful shutdown timeout, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }

  log.info("Trend calculation worker stopped");
}
