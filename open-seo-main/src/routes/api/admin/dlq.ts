/**
 * Admin API endpoints for Dead-Letter Queue management.
 *
 * Provides endpoints to list, replay, and manage DLQ jobs for manual
 * inspection and recovery of failed analytics sync jobs.
 *
 * SECURITY: Protected by HMAC-SHA256 authentication + rate limiting.
 * CSI-001/CSI-002 FIX: Migrated from legacy X-Internal-Api-Key to HMAC auth.
 * These endpoints are NOT exposed to public - internal network only.
 * Phase 72-03: Added 10 req/min rate limit per user.
 * Phase 95: Added Zod validation for all inputs (P1.G8).
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
 * Query parameters for GET /api/admin/dlq
 * Validates optional pagination and filtering parameters.
 */
const listDlqQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 100))
    .pipe(z.number().int().min(1).max(1000)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0)),
});

/**
 * Request body for POST /api/admin/dlq (bulk replay)
 * Optional parameters to control replay behavior.
 */
const replayAllDlqBodySchema = z.object({
  maxJobs: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10),
}).optional();

/**
 * Request body for DELETE /api/admin/dlq (purge all)
 * Requires explicit confirmation to prevent accidental purge.
 */
const purgeDlqBodySchema = z.object({
  confirm: z.literal(true),
}).optional();

/**
 * Parse and validate query parameters from URL.
 * Returns validation result with sanitized data or error.
 */
function parseQueryParams(request: Request) {
  const url = new URL(request.url);
  const params = {
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  };
  return listDlqQuerySchema.safeParse(params);
}

/**
 * Create a standardized validation error response.
 * Hides internal details while providing useful feedback.
 */
function validationErrorResponse(error: z.ZodError): Response {
  // Sanitize error messages to avoid leaking internal details
  // Zod 4 uses .issues instead of .errors
  const sanitizedErrors = error.issues.map((e) => ({
    field: e.path.join(".") || "body",
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
       * Rate limited: 10 req/min per user (72-03).
       * Phase 95: Added query param validation (P1.G8).
       * CSI-001/CSI-002: Uses HMAC authentication.
       *
       * Query params:
       * - limit: Max jobs to return (1-1000, default 100)
       * - offset: Skip first N jobs (default 0)
       */
      GET: async ({ request }: { request: Request }) => {
        // CSI-001/CSI-002: Verify HMAC signature (GET has empty body)
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

        // Validate query parameters (P1.G8)
        const queryResult = parseQueryParams(request);
        if (!queryResult.success) {
          return validationErrorResponse(queryResult.error);
        }
        const { limit, offset } = queryResult.data;

        try {
          // Get all jobs from waiting and delayed states (where DLQ jobs live)
          const [waitingJobs, delayedJobs] = await Promise.all([
            analyticsQueue.getJobs(["waiting"]),
            analyticsQueue.getJobs(["delayed"]),
          ]);

          const allJobs = [...waitingJobs, ...delayedJobs];

          // Filter to DLQ jobs only
          const dlqJobs = allJobs.filter((job) => isDLQJob(job.name));

          // Apply pagination
          const paginatedJobs = dlqJobs.slice(offset, offset + limit);

          const summaries: DLQJobSummary[] = paginatedJobs.map((job) => {
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

          dlqLogger.info("Listed DLQ jobs", { action: "list", count: summaries.length, total: dlqJobs.length });

          return Response.json(
            {
              success: true,
              data: summaries,
              meta: { total: dlqJobs.length, page: Math.floor(offset / limit) + 1, limit },
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
       * Rate limited: 10 req/min per user (72-03).
       * Phase 95: Added body validation (P1.G8).
       * CSI-001/CSI-002: Uses HMAC authentication.
       *
       * Request body (optional):
       * - maxJobs: Override batch size (1-100, default 10)
       */
      POST: async ({ request }: { request: Request }) => {
        // Clone request to read body for signature verification
        const clonedRequest = request.clone();
        let bodyText = "";
        try {
          bodyText = await clonedRequest.text();
        } catch {
          // Empty body is fine
        }

        // CSI-001/CSI-002: Verify HMAC signature
        const authError = await requireInternalAuth(request, bodyText);
        if (authError) {
          return authError;
        }

        // Rate limit by user ID or IP (72-03)
        const userId = request.headers.get("X-User-Id") ?? request.headers.get("X-Forwarded-For")?.split(",")[0] ?? "anonymous";
        const rateLimitResult = await adminRateLimiter(userId);
        if (!rateLimitResult.allowed) {
          return rateLimitExceededResponse(rateLimitResult);
        }

        // Validate request body (P1.G8)
        let body: unknown = undefined;
        try {
          const text = await request.text();
          if (text.trim()) {
            body = JSON.parse(text);
          }
        } catch {
          return Response.json(
            { success: false, error: "Invalid JSON body" } satisfies ApiResponse<never>,
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const bodyResult = replayAllDlqBodySchema.safeParse(body);
        if (!bodyResult.success) {
          return validationErrorResponse(bodyResult.error);
        }

        const maxBatch = bodyResult.data?.maxJobs ?? 10;

        try {
          // Get all DLQ jobs
          const [waitingJobs, delayedJobs] = await Promise.all([
            analyticsQueue.getJobs(["waiting"]),
            analyticsQueue.getJobs(["delayed"]),
          ]);

          const allJobs = [...waitingJobs, ...delayedJobs];
          const dlqJobs = allJobs.filter((job) => isDLQJob(job.name));

          // Limit to batch size
          const jobsToReplay = dlqJobs.slice(0, maxBatch);
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
       * Rate limited: 10 req/min per user (72-03).
       * Phase 95: Added confirmation requirement (P1.G8).
       * CSI-001/CSI-002: Uses HMAC authentication.
       *
       * Request body:
       * - confirm: Must be true to proceed with purge
       */
      DELETE: async ({ request }: { request: Request }) => {
        // Clone request to read body for signature verification
        const clonedRequest = request.clone();
        let bodyText = "";
        try {
          bodyText = await clonedRequest.text();
        } catch {
          // Empty body is fine
        }

        // CSI-001/CSI-002: Verify HMAC signature
        const authError = await requireInternalAuth(request, bodyText);
        if (authError) {
          return authError;
        }

        // Rate limit by user ID or IP (72-03)
        const userId = request.headers.get("X-User-Id") ?? request.headers.get("X-Forwarded-For")?.split(",")[0] ?? "anonymous";
        const rateLimitResult = await adminRateLimiter(userId);
        if (!rateLimitResult.allowed) {
          return rateLimitExceededResponse(rateLimitResult);
        }

        // Validate request body - require explicit confirmation (P1.G8)
        let body: unknown = undefined;
        try {
          const text = await request.text();
          if (text.trim()) {
            body = JSON.parse(text);
          }
        } catch {
          return Response.json(
            { success: false, error: "Invalid JSON body" } satisfies ApiResponse<never>,
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const bodyResult = purgeDlqBodySchema.safeParse(body);
        if (!bodyResult.success) {
          return validationErrorResponse(bodyResult.error);
        }

        // Require explicit confirmation for destructive operation
        if (!bodyResult.data?.confirm) {
          return Response.json(
            {
              success: false,
              error: "Confirmation required: send { confirm: true } in request body to purge all DLQ jobs",
            },
            { status: 400, headers: { "Content-Type": "application/json" } },
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
