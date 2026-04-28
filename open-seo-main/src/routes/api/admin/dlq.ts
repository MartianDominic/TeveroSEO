/**
 * Admin API endpoints for Dead-Letter Queue management.
 *
 * Provides endpoints to list, replay, and manage DLQ jobs for manual
 * inspection and recovery of failed analytics sync jobs.
 *
 * SECURITY: Protected by X-Internal-Api-Key header.
 * These endpoints are NOT exposed to public - internal network only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { createLogger } from "@/server/lib/logger";
import {
  analyticsQueue,
  type AnalyticsDLQJobData,
  type AnalyticsSyncJobData,
  type SyncAllClientsJobData,
} from "@/server/queues/analyticsQueue";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Module-level logger for admin DLQ operations
const dlqLogger = createLogger({ module: "admin-dlq" });

/**
 * DLQ job summary for API responses.
 */
interface DLQJobSummary {
  id: string;
  originalJobId: string;
  originalJobName: string;
  clientId: string | undefined;
  error: string;
  failedAt: string;
  attemptsMade: number;
}

/**
 * API response envelope following project conventions.
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page?: number;
    limit?: number;
  };
}

/**
 * Verify internal API key header for service-to-service auth.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyInternalApiKey(request: Request): boolean {
  const apiKey = request.headers.get("X-Internal-Api-Key");
  if (!INTERNAL_API_KEY) {
    dlqLogger.error("INTERNAL_API_KEY not configured");
    return false;
  }
  if (!apiKey) {
    return false;
  }

  // SECURITY: Use timing-safe comparison to prevent timing attacks
  try {
    const apiKeyBuffer = Buffer.from(apiKey);
    const expectedBuffer = Buffer.from(INTERNAL_API_KEY);

    // timingSafeEqual requires same length buffers
    if (apiKeyBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(apiKeyBuffer, expectedBuffer);
  } catch {
    // Any error in comparison should fail closed
    return false;
  }
}

/**
 * Check if a job is a DLQ job by its name prefix.
 */
function isDLQJob(jobName: string): boolean {
  return jobName.startsWith("dlq:");
}

/**
 * Extract clientId from DLQ job data.
 * Handles both AnalyticsSyncJobData and SyncAllClientsJobData.
 */
function extractClientId(data: AnalyticsSyncJobData | SyncAllClientsJobData): string | undefined {
  return "clientId" in data ? data.clientId : undefined;
}

export const Route = createFileRoute("/api/admin/dlq")({
  server: {
    handlers: {
      /**
       * GET /api/admin/dlq - List all DLQ jobs with metadata.
       *
       * Returns a list of all dead-letter queue jobs for inspection.
       * Jobs are identified by the "dlq:" prefix in their name.
       */
      GET: async ({ request }: { request: Request }) => {
        if (!verifyInternalApiKey(request)) {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies ApiResponse<never>,
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          // Get all jobs from waiting and delayed states (where DLQ jobs live)
          const [waitingJobs, delayedJobs] = await Promise.all([
            analyticsQueue.getJobs(["waiting"]),
            analyticsQueue.getJobs(["delayed"]),
          ]);

          const allJobs = [...waitingJobs, ...delayedJobs];

          // Filter to DLQ jobs only
          const dlqJobs = allJobs.filter((job) => isDLQJob(job.name));

          const summaries: DLQJobSummary[] = dlqJobs.map((job) => {
            const dlqData = job.data as AnalyticsDLQJobData;
            return {
              id: job.id ?? "unknown",
              originalJobId: dlqData.originalJobId ?? "unknown",
              originalJobName: dlqData.originalJobName,
              clientId: extractClientId(dlqData.data),
              error: dlqData.error,
              failedAt: dlqData.failedAt,
              attemptsMade: dlqData.attemptsMade,
            };
          });

          dlqLogger.info("Listed DLQ jobs", { action: "list", count: summaries.length });

          return Response.json(
            {
              success: true,
              data: summaries,
              meta: { total: summaries.length },
            } satisfies ApiResponse<DLQJobSummary[]>,
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          dlqLogger.error("Failed to list DLQ jobs", err as Error);
          return Response.json(
            { success: false, error: "Failed to list DLQ jobs" } satisfies ApiResponse<never>,
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      /**
       * POST /api/admin/dlq - Replay all DLQ jobs (with rate limiting).
       *
       * Replays up to 10 DLQ jobs at a time to prevent overwhelming the system.
       * Each replayed job is removed from the DLQ after being re-queued.
       */
      POST: async ({ request }: { request: Request }) => {
        if (!verifyInternalApiKey(request)) {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies ApiResponse<never>,
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const MAX_REPLAY_BATCH = 10;

          // Get all DLQ jobs
          const [waitingJobs, delayedJobs] = await Promise.all([
            analyticsQueue.getJobs(["waiting"]),
            analyticsQueue.getJobs(["delayed"]),
          ]);

          const allJobs = [...waitingJobs, ...delayedJobs];
          const dlqJobs = allJobs.filter((job) => isDLQJob(job.name));

          // Limit to batch size
          const jobsToReplay = dlqJobs.slice(0, MAX_REPLAY_BATCH);
          const replayedJobIds: string[] = [];
          const failedJobIds: string[] = [];

          for (const job of jobsToReplay) {
            try {
              const dlqData = job.data as AnalyticsDLQJobData;

              // Create new job with original data
              await analyticsQueue.add(dlqData.originalJobName, dlqData.data, {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
              });

              // Remove from DLQ
              await job.remove();
              replayedJobIds.push(job.id ?? "unknown");

              dlqLogger.info("Replayed DLQ job", {
                action: "replay",
                jobId: job.id,
                originalJobName: dlqData.originalJobName,
                clientId: extractClientId(dlqData.data),
              });
            } catch (replayErr) {
              failedJobIds.push(job.id ?? "unknown");
              dlqLogger.error("Failed to replay DLQ job", replayErr as Error, {
                jobId: job.id,
              });
            }
          }

          return Response.json(
            {
              success: true,
              data: {
                replayed: replayedJobIds,
                failed: failedJobIds,
                remaining: dlqJobs.length - jobsToReplay.length,
              },
              meta: { total: replayedJobIds.length },
            } satisfies ApiResponse<{ replayed: string[]; failed: string[]; remaining: number }>,
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          dlqLogger.error("Failed to replay DLQ jobs", err as Error);
          return Response.json(
            { success: false, error: "Failed to replay DLQ jobs" } satisfies ApiResponse<never>,
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      /**
       * DELETE /api/admin/dlq - Purge all DLQ jobs.
       *
       * Removes all jobs from the DLQ without replaying them.
       * Use with caution - this action cannot be undone.
       */
      DELETE: async ({ request }: { request: Request }) => {
        if (!verifyInternalApiKey(request)) {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies ApiResponse<never>,
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          // Get all DLQ jobs
          const [waitingJobs, delayedJobs] = await Promise.all([
            analyticsQueue.getJobs(["waiting"]),
            analyticsQueue.getJobs(["delayed"]),
          ]);

          const allJobs = [...waitingJobs, ...delayedJobs];
          const dlqJobs = allJobs.filter((job) => isDLQJob(job.name));

          const removedJobIds: string[] = [];
          const failedJobIds: string[] = [];

          for (const job of dlqJobs) {
            try {
              await job.remove();
              removedJobIds.push(job.id ?? "unknown");
              dlqLogger.info("Purged DLQ job", {
                action: "purge",
                jobId: job.id,
              });
            } catch (removeErr) {
              failedJobIds.push(job.id ?? "unknown");
              dlqLogger.error("Failed to purge DLQ job", removeErr as Error, {
                jobId: job.id,
              });
            }
          }

          dlqLogger.warn("Purged all DLQ jobs", {
            action: "purge-all",
            count: removedJobIds.length,
          });

          return Response.json(
            {
              success: true,
              data: {
                removed: removedJobIds,
                failed: failedJobIds,
              },
              meta: { total: removedJobIds.length },
            } satisfies ApiResponse<{ removed: string[]; failed: string[] }>,
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          dlqLogger.error("Failed to purge DLQ jobs", err as Error);
          return Response.json(
            { success: false, error: "Failed to purge DLQ jobs" } satisfies ApiResponse<never>,
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
