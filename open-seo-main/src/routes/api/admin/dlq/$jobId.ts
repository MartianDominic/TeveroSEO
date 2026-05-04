/**
 * Admin API endpoints for individual DLQ job management.
 *
 * Provides endpoints to replay or remove a specific DLQ job.
 *
 * SECURITY: Protected by X-Internal-Api-Key header + rate limiting.
 * These endpoints are NOT exposed to public - internal network only.
 * Phase 72-03: Added 10 req/min rate limit per user.
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { createLogger } from "@/server/lib/logger";
import {
  adminRateLimiter,
  rateLimitExceededResponse,
} from "@/server/middleware";
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
 * API response envelope following project conventions.
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Timing-safe comparison of two strings.
 * Returns false if lengths differ (before comparison) to avoid timing leaks.
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Verify internal API key header for service-to-service auth.
 * SECURITY: Uses timing-safe comparison to prevent timing attacks.
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
  return secureCompare(apiKey, INTERNAL_API_KEY);
}

/**
 * Check if a job is a DLQ job by its name prefix.
 */
function isDLQJob(jobName: string): boolean {
  return jobName.startsWith("dlq:");
}

/**
 * Extract clientId from DLQ job data.
 */
function extractClientId(data: AnalyticsSyncJobData | SyncAllClientsJobData): string | undefined {
  return "clientId" in data ? data.clientId : undefined;
}

export const Route = createFileRoute("/api/admin/dlq/$jobId")({
  server: {
    handlers: {
      /**
       * POST /api/admin/dlq/:jobId/replay - Replay a single DLQ job.
       *
       * Creates a new job with the original data and removes the DLQ job.
       * Note: TanStack Start routes the POST to this handler, and we check
       * for /replay suffix in the URL to differentiate from other POST actions.
       * Rate limited: 10 req/min per user (72-03).
       */
      POST: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
        if (!verifyInternalApiKey(request)) {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies ApiResponse<never>,
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        // Rate limit by user ID or IP (72-03)
        const userId = request.headers.get("X-User-Id") ?? request.headers.get("X-Forwarded-For")?.split(",")[0] ?? "anonymous";
        const rateLimitResult = await adminRateLimiter(userId);
        if (!rateLimitResult.allowed) {
          return rateLimitExceededResponse(rateLimitResult);
        }

        const { jobId } = params;

        try {
          const job = await analyticsQueue.getJob(jobId);

          if (!job) {
            return Response.json(
              { success: false, error: "Job not found" } satisfies ApiResponse<never>,
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          if (!isDLQJob(job.name)) {
            return Response.json(
              { success: false, error: "Job is not a DLQ job" } satisfies ApiResponse<never>,
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const dlqData = job.data as AnalyticsDLQJobData;

          // Create new job with original data
          const newJob = await analyticsQueue.add(dlqData.originalJobName, dlqData.data, {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          });

          // Remove from DLQ
          await job.remove();

          dlqLogger.info("Replayed single DLQ job", {
            action: "replay-single",
            jobId,
            newJobId: newJob.id,
            originalJobName: dlqData.originalJobName,
            clientId: extractClientId(dlqData.data),
          });

          return Response.json(
            {
              success: true,
              data: {
                replayed: true,
                originalJobId: dlqData.originalJobId,
                newJobId: newJob.id,
              },
            } satisfies ApiResponse<{ replayed: boolean; originalJobId: string | undefined; newJobId: string | undefined }>,
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          dlqLogger.error("Failed to replay DLQ job", err as Error, { jobId });
          return Response.json(
            { success: false, error: "Failed to replay DLQ job" } satisfies ApiResponse<never>,
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      /**
       * DELETE /api/admin/dlq/:jobId - Remove a job from DLQ without replaying.
       *
       * Permanently removes the job from the DLQ.
       * Use when a job should not be retried (e.g., invalid data, obsolete).
       * Rate limited: 10 req/min per user (72-03).
       */
      DELETE: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
        if (!verifyInternalApiKey(request)) {
          return Response.json(
            { success: false, error: "Unauthorized" } satisfies ApiResponse<never>,
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        // Rate limit by user ID or IP (72-03)
        const userId = request.headers.get("X-User-Id") ?? request.headers.get("X-Forwarded-For")?.split(",")[0] ?? "anonymous";
        const rateLimitResult = await adminRateLimiter(userId);
        if (!rateLimitResult.allowed) {
          return rateLimitExceededResponse(rateLimitResult);
        }

        const { jobId } = params;

        try {
          const job = await analyticsQueue.getJob(jobId);

          if (!job) {
            return Response.json(
              { success: false, error: "Job not found" } satisfies ApiResponse<never>,
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          if (!isDLQJob(job.name)) {
            return Response.json(
              { success: false, error: "Job is not a DLQ job" } satisfies ApiResponse<never>,
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const dlqData = job.data as AnalyticsDLQJobData;

          await job.remove();

          dlqLogger.info("Removed single DLQ job", {
            action: "remove-single",
            jobId,
            originalJobName: dlqData.originalJobName,
            clientId: extractClientId(dlqData.data),
          });

          return Response.json(
            {
              success: true,
              data: {
                removed: true,
                jobId,
              },
            } satisfies ApiResponse<{ removed: boolean; jobId: string }>,
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          dlqLogger.error("Failed to remove DLQ job", err as Error, { jobId });
          return Response.json(
            { success: false, error: "Failed to remove DLQ job" } satisfies ApiResponse<never>,
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
