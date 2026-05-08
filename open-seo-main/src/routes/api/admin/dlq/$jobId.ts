/**
 * Admin API endpoints for individual DLQ job management.
 *
 * Provides endpoints to replay or remove a specific DLQ job.
 *
 * SECURITY: Protected by HMAC-SHA256 authentication + rate limiting.
 * CSI-001/CSI-002 FIX: Migrated from legacy X-Internal-Api-Key to HMAC auth.
 * These endpoints are NOT exposed to public - internal network only.
 * Phase 72-03: Added 10 req/min rate limit per user.
 * Phase 95: Added Zod validation for path parameters (P1.G8).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { requireInternalAuth } from "@/server/middleware/internal-auth";
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

// --------------------------------------------------------------------------
// Zod Schemas for Input Validation (P1.G8)
// --------------------------------------------------------------------------

/**
 * Path parameter schema for job ID.
 * BullMQ job IDs are strings, typically numeric or prefixed (e.g., "dlq:123").
 * Validates format and prevents injection by limiting characters and length.
 */
const jobIdParamSchema = z.object({
  jobId: z
    .string()
    .min(1, "Job ID is required")
    .max(256, "Job ID too long")
    .regex(
      /^[a-zA-Z0-9_:\-]+$/,
      "Job ID contains invalid characters (allowed: alphanumeric, underscore, colon, hyphen)"
    ),
});

/**
 * Create a standardized validation error response.
 * Hides internal details while providing useful feedback.
 */
function validationErrorResponse(error: z.ZodError): Response {
  // Zod 4 uses .issues instead of .errors
  const sanitizedErrors = error.issues.map((e) => ({
    field: e.path.join(".") || "params",
    message: e.message,
  }));

  return Response.json(
    {
      success: false,
      error: "Validation failed",
      details: sanitizedErrors,
    },
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}

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
       * Phase 95: Added path parameter validation (P1.G8).
       * CSI-001/CSI-002: Uses HMAC authentication.
       */
      POST: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
        // CSI-001/CSI-002: Verify HMAC signature (POST with empty body for replay)
        const authError = await requireInternalAuth(request, "");
        if (authError) {
          return authError;
        }

        // Rate limit by user ID or IP (72-03)
        const userId = request.headers.get("X-User-Id") ?? request.headers.get("X-Forwarded-For")?.split(",")[0] ?? "anonymous";
        const rateLimitResult = await adminRateLimiter(userId);
        if (!rateLimitResult.allowed) {
          return rateLimitExceededResponse(rateLimitResult);
        }

        // Validate path parameters (P1.G8)
        const paramsResult = jobIdParamSchema.safeParse(params);
        if (!paramsResult.success) {
          return validationErrorResponse(paramsResult.error);
        }

        const { jobId } = paramsResult.data;

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
       * Phase 95: Added path parameter validation (P1.G8).
       * CSI-001/CSI-002: Uses HMAC authentication.
       */
      DELETE: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
        // CSI-001/CSI-002: Verify HMAC signature (DELETE with empty body)
        const authError = await requireInternalAuth(request, "");
        if (authError) {
          return authError;
        }

        // Rate limit by user ID or IP (72-03)
        const userId = request.headers.get("X-User-Id") ?? request.headers.get("X-Forwarded-For")?.split(",")[0] ?? "anonymous";
        const rateLimitResult = await adminRateLimiter(userId);
        if (!rateLimitResult.allowed) {
          return rateLimitExceededResponse(rateLimitResult);
        }

        // Validate path parameters (P1.G8)
        const paramsResult = jobIdParamSchema.safeParse(params);
        if (!paramsResult.success) {
          return validationErrorResponse(paramsResult.error);
        }

        const { jobId } = paramsResult.data;

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
