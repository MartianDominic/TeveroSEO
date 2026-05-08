/**
 * GA4 Sync Worker
 * Phase 96 Analytics: BullMQ worker for Google Analytics 4 data synchronization
 *
 * QUEUE-02 FIX: lockDuration set to 600000ms (10 minutes) for long-running GA4 API calls
 *
 * Worker configuration:
 * - lockDuration: 600000 (10 min) - prevents job stalling during API pagination
 * - Concurrency: 2 (parallel GA4 property syncs)
 * - Rate limiter: 100 req/min (GA4 API limit)
 * - Graceful shutdown with 30s timeout
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection, WORKER_CONCURRENCY_LIMITS } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
// QUEUE-03 FIX: Use DB-based DLQ instead of Redis streams
import { moveToDeadLetter } from "@/server/lib/dead-letter-queue";

const log = createLogger({ module: "ga4-sync-worker" });

// QUEUE-02: Extended lockDuration for long-running GA4 API calls
const LOCK_DURATION_MS = 600_000; // 10 minutes
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Job data for GA4 sync jobs.
 */
export interface Ga4SyncJobData {
  workspaceId: string;
  propertyId: string;
  dateRange?: { start: string; end: string };
  mode: "incremental" | "backfill";
}

/**
 * Job result returned after sync completes.
 */
export interface Ga4SyncJobResult {
  rowsInserted: number;
  durationMs: number;
  errors: string[];
}

let worker: Worker<Ga4SyncJobData, Ga4SyncJobResult> | null = null;

/**
 * Start the GA4 sync worker with proper lockDuration for long-running jobs.
 */
export function startGa4SyncWorker(): Worker<Ga4SyncJobData, Ga4SyncJobResult> {
  if (worker) return worker;

  worker = new Worker<Ga4SyncJobData, Ga4SyncJobResult>(
    "ga4-sync",
    async (job: Job<Ga4SyncJobData, Ga4SyncJobResult>) => {
      const startTime = Date.now();
      const { workspaceId, propertyId, mode } = job.data;

      log.info("Starting GA4 sync job", { jobId: job.id, workspaceId, propertyId, mode });

      try {
        // Lazy import to avoid circular dependencies
        const { fetchGA4Metrics, getGA4DateRange } = await import(
          "@/server/services/analytics/ga4-client"
        );
        const { getValidCredentials } = await import(
          "@/server/services/analytics/google-auth"
        );
        const { db } = await import("@/db");
        const { ga4Snapshots } = await import("@/db/schema");
        const { sql } = await import("drizzle-orm");

        // Get credentials
        const creds = await getValidCredentials(workspaceId);
        if (!creds.ga4PropertyId) {
          throw new Error("No GA4 property configured for this workspace");
        }

        // Determine date range
        const { startDate, endDate } = job.data.dateRange
          ? { startDate: job.data.dateRange.start, endDate: job.data.dateRange.end }
          : getGA4DateRange(mode);

        // Fetch GA4 metrics
        const metrics = await fetchGA4Metrics(
          creds.accessToken,
          creds.ga4PropertyId,
          startDate,
          endDate
        );

        // Update progress
        await job.updateProgress(50);

        // Insert into database
        const ga4Rows = metrics.map((row) => ({
          clientId: workspaceId,
          date: row.date,
          propertyId: creds.ga4PropertyId!, // Assert non-null (validated above)
          sessions: row.sessions,
          users: row.users,
          newUsers: row.newUsers,
          bounceRate: row.bounceRate,
          avgSessionDuration: row.avgSessionDuration,
          conversions: row.conversions,
          revenue: row.revenue,
        }));

        // Batch upsert
        for (let i = 0; i < ga4Rows.length; i += 100) {
          const chunk = ga4Rows.slice(i, i + 100);
          await db
            .insert(ga4Snapshots)
            .values(chunk)
            .onConflictDoUpdate({
              target: [ga4Snapshots.clientId, ga4Snapshots.date],
              set: {
                sessions: sql`excluded.sessions`,
                users: sql`excluded.users`,
                newUsers: sql`excluded.new_users`,
                bounceRate: sql`excluded.bounce_rate`,
                avgSessionDuration: sql`excluded.avg_session_duration`,
                conversions: sql`excluded.conversions`,
                revenue: sql`excluded.revenue`,
                syncedAt: sql`NOW()`,
              },
            });
        }

        await job.updateProgress(100);

        const durationMs = Date.now() - startTime;
        log.info("GA4 sync complete", { jobId: job.id, rows: ga4Rows.length, durationMs });

        return {
          rowsInserted: ga4Rows.length,
          durationMs,
          errors: [],
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error("GA4 sync failed", error instanceof Error ? error : new Error(errorMsg), {
          jobId: job.id,
          workspaceId,
        });
        throw error;
      }
    },
    {
      connection: getSharedBullMQConnection("worker:ga4-sync"),
      lockDuration: LOCK_DURATION_MS, // QUEUE-02 fix
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: WORKER_CONCURRENCY_LIMITS.analytics ?? 2,
      limiter: {
        max: 100,
        duration: 60000, // 100 req/min
      },
    }
  );

  worker.on("ready", () => {
    log.info("GA4 sync worker ready");
  });

  worker.on("error", (err) => {
    log.error("GA4 sync worker error", err);
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      // QUEUE-03 FIX: Use DB-based DLQ instead of Redis streams
      try {
        await moveToDeadLetter({
          jobId: job.id ?? `unknown-${Date.now()}`,
          queue: "ga4-sync",
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
        log.warn("GA4 sync job moved to DB-based DLQ", { jobId: job.id });
      } catch (dlqErr) {
        log.error("Failed to move GA4 sync job to DLQ", dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)));
      }
    }
  });

  worker.on("completed", (job, result) => {
    log.info("GA4 sync job completed", {
      jobId: job.id,
      rows: result.rowsInserted,
      durationMs: result.durationMs,
    });
  });

  worker.on("stalled", (jobId) => {
    log.warn("GA4 sync job stalled", { jobId });
  });

  return worker;
}

/**
 * Stop the GA4 sync worker gracefully.
 */
export async function stopGa4SyncWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);

  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    log.error("GA4 sync worker graceful shutdown timeout, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }

  log.info("GA4 sync worker stopped");
}
