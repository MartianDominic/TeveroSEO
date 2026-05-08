/**
 * Cannibalization Detection Worker
 * Phase 96 Analytics: BullMQ worker for keyword cannibalization detection
 *
 * QUEUE-02 FIX: lockDuration set to 900000ms (15 minutes) for complex detection
 *
 * Worker configuration:
 * - lockDuration: 900000 (15 min) - allows analysis of large keyword sets
 * - Concurrency: 2 (parallel workspace analysis)
 * - Graceful shutdown with 30s timeout
 *
 * Detection modes:
 * - stored: Fast queries using pre-aggregated TimescaleDB data
 * - live: Real-time GSC API detection with persistence
 * - auto: Chooses based on data availability
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection, WORKER_CONCURRENCY_LIMITS } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
// QUEUE-03 FIX: Use DB-based DLQ instead of Redis streams
import { moveToDeadLetter } from "@/server/lib/dead-letter-queue";

const log = createLogger({ module: "cannibalization-worker" });

// QUEUE-02: Extended lockDuration for complex cannibalization detection
const LOCK_DURATION_MS = 900_000; // 15 minutes
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Job data for cannibalization detection jobs.
 */
export interface CannibalizationJobData {
  workspaceId: string;
  siteId: string;
  mode: "stored" | "live" | "auto";
  minImpressions?: number;
  persist?: boolean;
}

/**
 * Job result returned after detection completes.
 */
export interface CannibalizationJobResult {
  issuesDetected: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalMonthlyImpact: number;
  durationMs: number;
}

let worker: Worker<CannibalizationJobData, CannibalizationJobResult> | null = null;

/**
 * Start the cannibalization detection worker.
 */
export function startCannibalizationWorker(): Worker<CannibalizationJobData, CannibalizationJobResult> {
  if (worker) return worker;

  worker = new Worker<CannibalizationJobData, CannibalizationJobResult>(
    "cannibalization",
    async (job: Job<CannibalizationJobData, CannibalizationJobResult>) => {
      const startTime = Date.now();
      const { workspaceId, siteId, mode, minImpressions, persist } = job.data;

      log.info("Starting cannibalization detection", { jobId: job.id, workspaceId, siteId, mode });

      try {
        // Lazy import to avoid circular dependencies
        const { getCannibalizationService } = await import(
          "@/server/features/analytics/services/CannibalizationService"
        );

        const service = getCannibalizationService();

        // Run detection
        const result = await service.detect(siteId, {
          mode,
          minImpressions: minImpressions ?? 100,
          persist: persist ?? true,
        });

        await job.updateProgress(100);

        const durationMs = Date.now() - startTime;
        log.info("Cannibalization detection complete", {
          jobId: job.id,
          issues: result.issues.length,
          summary: result.summary.bySeverity,
          durationMs,
        });

        return {
          issuesDetected: result.issues.length,
          criticalCount: result.summary.bySeverity.critical,
          highCount: result.summary.bySeverity.high,
          mediumCount: result.summary.bySeverity.medium,
          lowCount: result.summary.bySeverity.low,
          totalMonthlyImpact: result.summary.totalMonthlyImpact,
          durationMs,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error("Cannibalization detection failed", error instanceof Error ? error : new Error(errorMsg), {
          jobId: job.id,
          workspaceId,
          siteId,
        });
        throw error;
      }
    },
    {
      connection: getSharedBullMQConnection("worker:cannibalization"),
      lockDuration: LOCK_DURATION_MS, // QUEUE-02 fix
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: WORKER_CONCURRENCY_LIMITS.analytics ?? 2,
    }
  );

  worker.on("ready", () => {
    log.info("Cannibalization detection worker ready");
  });

  worker.on("error", (err) => {
    log.error("Cannibalization detection worker error", err);
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      // QUEUE-03 FIX: Use DB-based DLQ instead of Redis streams
      try {
        await moveToDeadLetter({
          jobId: job.id ?? `unknown-${Date.now()}`,
          queue: "cannibalization",
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
        log.warn("Cannibalization job moved to DB-based DLQ", { jobId: job.id });
      } catch (dlqErr) {
        log.error("Failed to move cannibalization job to DLQ", dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)));
      }
    }
  });

  worker.on("completed", (job, result) => {
    log.info("Cannibalization job completed", {
      jobId: job.id,
      issues: result.issuesDetected,
      critical: result.criticalCount,
      high: result.highCount,
      impact: result.totalMonthlyImpact,
      durationMs: result.durationMs,
    });
  });

  worker.on("stalled", (jobId) => {
    log.warn("Cannibalization job stalled", { jobId });
  });

  return worker;
}

/**
 * Stop the cannibalization detection worker gracefully.
 */
export async function stopCannibalizationWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);

  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    log.error("Cannibalization worker graceful shutdown timeout, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }

  log.info("Cannibalization detection worker stopped");
}
