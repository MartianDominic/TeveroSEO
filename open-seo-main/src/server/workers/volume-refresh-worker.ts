/**
 * Volume Refresh Worker
 * Phase 93: Keyword Coverage Intelligence
 *
 * BullMQ worker for volume refresh jobs.
 * Uses sandboxed processor pattern like audit-worker.ts.
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection, WORKER_CONCURRENCY_LIMITS } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  VOLUME_REFRESH_QUEUE_NAME,
  type VolumeRefreshJobData,
  type VolumeRefreshResult,
} from "@/server/queues/volumeRefreshQueue";

const workerLog = createLogger({ module: "volume-refresh-worker" });

const LOCK_DURATION_MS = 300_000;  // 5 minutes (longer than audit due to batching)
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;

// Sandboxed processor path
const PROCESSOR_PATH = fileURLToPath(
  new URL("./volume-refresh-processor.js", import.meta.url)
);

let worker: Worker<VolumeRefreshJobData, VolumeRefreshResult | VolumeRefreshResult[]> | null = null;

export function startVolumeRefreshWorker(): Worker<VolumeRefreshJobData> {
  if (worker) return worker;

  worker = new Worker<VolumeRefreshJobData, VolumeRefreshResult | VolumeRefreshResult[]>(
    VOLUME_REFRESH_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:volume-refresh"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1,  // Sequential to respect DataForSEO rate limit
      limiter: {
        max: 5,
        duration: 60000,  // 5 requests per minute
      },
    }
  );

  worker.on("ready", () => {
    workerLog.info("Worker ready", { queue: VOLUME_REFRESH_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLog.error("Worker error", err instanceof Error ? err : new Error(String(err)));
  });

  worker.on("failed", async (job: Job<VolumeRefreshJobData> | undefined, err: Error) => {
    if (!job) {
      workerLog.error("Job failed with no job context", err);
      return;
    }
    workerLog.error("Job failed", err, {
      jobId: job.id,
      prospectId: job.data.prospectId,
      attempt: job.attemptsMade,
    });
  });

  worker.on("completed", (job) => {
    workerLog.info("Job completed", {
      jobId: job.id,
      prospectId: job.data.prospectId,
    });
  });

  return worker;
}

export async function stopVolumeRefreshWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    workerLog.error("Graceful shutdown timeout exceeded", undefined);
    await current.close(true);
  }
}
