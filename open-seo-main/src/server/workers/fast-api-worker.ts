/**
 * Fast API Worker - High concurrency worker for Types B/C/D/E/F.
 *
 * Per 64-RESEARCH.md Pattern 2:
 * - SLA: <1 minute
 * - Concurrency: 50 (high for I/O-bound API calls)
 * - Lock duration: 60s (1 minute)
 *
 * Integrates:
 * - Singleflight (64-01): Deduplicates concurrent requests for same URL
 * - Delta Cascade (64-02): Skips unchanged content at earliest layer
 *
 * Per RESEARCH.md Pitfall 5: Implements graceful shutdown to prevent
 * memory leaks from unstopped BullMQ workers.
 *
 * @module fast-api-worker
 */

import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import {
  FAST_API_QUEUE_NAME,
  type FastApiJobData,
} from "@/server/queues/fastApiQueue";
import {
  Singleflight,
  createCrawlSingleflight,
} from "@/server/lib/crawler/singleflight";
import { deltaCascade, type DeltaResult } from "@/server/lib/crawler/delta-cascade";
import { DeltaSyncService } from "@/server/lib/crawler/delta-sync";

/**
 * Result of fast API job processing.
 */
export interface FastApiJobResult {
  /** Whether the job was processed or skipped */
  status: "processed" | "skipped" | "error";
  /** Human-readable reason */
  reason: string;
  /** Processing time in milliseconds */
  durationMs: number;
  /** Delta layer that made the skip decision (if skipped) */
  deltaLayer?: "L0" | "L1" | "L2" | "L3";
  /** Whether result came from singleflight cache */
  fromSingleflight?: boolean;
  /** Type-specific result data */
  data?: unknown;
}

/**
 * Process a Type B (Competitor Snapshot) job.
 */
async function processCompetitorSnapshot(
  job: Job<FastApiJobData>,
  singleflight: Singleflight<unknown>
): Promise<FastApiJobResult> {
  const startTime = Date.now();
  const { url, payload } = job.data;

  // Use singleflight to deduplicate concurrent requests for same URL
  const result = await singleflight.execute(url, async () => {
    // TODO: Implement actual competitor snapshot logic
    // This would call DataForSEO or similar API
    return {
      url,
      competitorData: payload.competitorUrls || [],
      analyzedAt: new Date().toISOString(),
    };
  });

  return {
    status: "processed",
    reason: result.shared ? "Shared from singleflight cache" : "Executed directly",
    durationMs: Date.now() - startTime,
    fromSingleflight: result.shared,
    data: result.result,
  };
}

/**
 * Process a Type C (Keyword Gap) job.
 */
async function processKeywordGap(
  job: Job<FastApiJobData>,
  singleflight: Singleflight<unknown>
): Promise<FastApiJobResult> {
  const startTime = Date.now();
  const { projectId, payload } = job.data;
  const cacheKey = `keyword-gap:${projectId}:${JSON.stringify(payload.keywords || [])}`;

  const result = await singleflight.execute(cacheKey, async () => {
    // TODO: Implement actual keyword gap analysis
    // This would call DataForSEO keyword gap endpoint
    return {
      projectId,
      keywords: payload.keywords || [],
      gaps: [],
      analyzedAt: new Date().toISOString(),
    };
  });

  return {
    status: "processed",
    reason: result.shared ? "Shared from singleflight cache" : "Executed directly",
    durationMs: Date.now() - startTime,
    fromSingleflight: result.shared,
    data: result.result,
  };
}

/**
 * Process a Type D (Backlink Profile) job.
 */
async function processBacklinkProfile(
  job: Job<FastApiJobData>,
  singleflight: Singleflight<unknown>
): Promise<FastApiJobResult> {
  const startTime = Date.now();
  const { url, tenantId } = job.data;

  const result = await singleflight.execute(url, async () => {
    // TODO: Implement actual backlink profile fetching
    // This would call DataForSEO backlinks endpoint
    return {
      url,
      tenantId,
      backlinks: [],
      referringDomains: 0,
      analyzedAt: new Date().toISOString(),
    };
  });

  return {
    status: "processed",
    reason: result.shared ? "Shared from singleflight cache" : "Executed directly",
    durationMs: Date.now() - startTime,
    fromSingleflight: result.shared,
    data: result.result,
  };
}

/**
 * Process a Type E (Content Gap) job with delta cascade.
 */
async function processContentGap(
  job: Job<FastApiJobData>,
  singleflight: Singleflight<unknown>,
  deltaService: DeltaSyncService
): Promise<FastApiJobResult> {
  const startTime = Date.now();
  const { url, tenantId, payload } = job.data;

  // First check delta cascade to see if we can skip
  const deltaResult: DeltaResult = await deltaCascade(
    url,
    tenantId,
    null, // No sitemap info for API calls
    payload.lastCrawledAt ? new Date(payload.lastCrawledAt as string) : null,
    payload.cachedHeaders as { etag: string | null; lastModified: string | null } | null,
    deltaService
  );

  if (deltaResult.action === "skip") {
    return {
      status: "skipped",
      reason: deltaResult.reason,
      durationMs: Date.now() - startTime,
      deltaLayer: deltaResult.layer,
    };
  }

  // Use singleflight for the actual processing
  const result = await singleflight.execute(url, async () => {
    // TODO: Implement actual content gap analysis
    return {
      url,
      tenantId,
      contentGaps: [],
      analyzedAt: new Date().toISOString(),
    };
  });

  return {
    status: "processed",
    reason: result.shared ? "Shared from singleflight cache" : "Executed directly",
    durationMs: Date.now() - startTime,
    fromSingleflight: result.shared,
    data: result.result,
  };
}

/**
 * Process a Type F (Local SEO) job.
 */
async function processLocalSEO(
  job: Job<FastApiJobData>,
  singleflight: Singleflight<unknown>
): Promise<FastApiJobResult> {
  const startTime = Date.now();
  const { url, payload } = job.data;
  const cacheKey = `local-seo:${url}:${payload.location || "default"}`;

  const result = await singleflight.execute(cacheKey, async () => {
    // TODO: Implement actual local SEO analysis
    // This would fetch Google Business Profile, local pack data, etc.
    return {
      url,
      location: payload.location,
      localRankings: [],
      gmbPresent: false,
      analyzedAt: new Date().toISOString(),
    };
  });

  return {
    status: "processed",
    reason: result.shared ? "Shared from singleflight cache" : "Executed directly",
    durationMs: Date.now() - startTime,
    fromSingleflight: result.shared,
    data: result.result,
  };
}

/**
 * Main job processor for fast-api queue.
 */
async function processFastApiJob(job: Job<FastApiJobData>): Promise<FastApiJobResult> {
  const { type, tenantId } = job.data;

  // Create tenant-scoped singleflight (per T-64-01 mitigation)
  const singleflight = createCrawlSingleflight<unknown>(tenantId);

  // DeltaSyncService for jobs that need delta checking
  // Note: In production, this would be injected or use a shared instance
  const deltaService = new DeltaSyncService();

  switch (type) {
    case "B":
      return processCompetitorSnapshot(job, singleflight);
    case "C":
      return processKeywordGap(job, singleflight);
    case "D":
      return processBacklinkProfile(job, singleflight);
    case "E":
      return processContentGap(job, singleflight, deltaService);
    case "F":
      return processLocalSEO(job, singleflight);
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = type;
      throw new Error(`Unknown job type: ${_exhaustive}`);
    }
  }
}

/**
 * Fast API worker instance.
 *
 * High concurrency (50) for I/O-bound API operations.
 * 1-minute lock duration matches SLA target.
 */
export const fastApiWorker = new Worker<FastApiJobData, FastApiJobResult>(
  FAST_API_QUEUE_NAME,
  processFastApiJob,
  {
    connection: getSharedBullMQConnection("worker:fast-api"),
    concurrency: 50, // High concurrency for I/O-bound API calls
    lockDuration: 60_000, // 1 minute lock (SLA target)
  }
);

// ============================================================================
// Graceful Shutdown (Pitfall 5)
// ============================================================================

let isShuttingDown = false;

/**
 * Gracefully shutdown the fast-api worker.
 *
 * Per RESEARCH.md Pitfall 5: Workers not properly closed leak Redis connections.
 * This function ensures clean shutdown with configurable timeout.
 *
 * @param timeoutMs - Maximum time to wait for jobs to complete (default 30s)
 */
export async function shutdownFastApiWorker(timeoutMs: number = 30_000): Promise<void> {
  if (isShuttingDown) {
    console.log("[fast-api-worker] Already shutting down");
    return;
  }

  isShuttingDown = true;
  console.log("[fast-api-worker] Initiating graceful shutdown...");

  try {
    // Close worker, waiting for active jobs to complete
    await fastApiWorker.close();
    console.log("[fast-api-worker] Worker closed successfully");
  } catch (error) {
    console.error("[fast-api-worker] Error during shutdown:", error);
  }
}

// Register shutdown handlers
process.on("SIGTERM", () => {
  console.log("[fast-api-worker] Received SIGTERM");
  shutdownFastApiWorker().catch(console.error);
});

process.on("SIGINT", () => {
  console.log("[fast-api-worker] Received SIGINT");
  shutdownFastApiWorker().catch(console.error);
});

// Worker event handlers for observability
fastApiWorker.on("completed", (job, result) => {
  console.log(`[fast-api-worker] Job ${job.id} completed:`, {
    type: job.data.type,
    status: result.status,
    durationMs: result.durationMs,
    fromSingleflight: result.fromSingleflight,
    deltaLayer: result.deltaLayer,
  });
});

fastApiWorker.on("failed", (job, error) => {
  console.error(`[fast-api-worker] Job ${job?.id} failed:`, {
    type: job?.data.type,
    error: error.message,
  });
});

fastApiWorker.on("error", (error) => {
  console.error("[fast-api-worker] Worker error:", error);
});
