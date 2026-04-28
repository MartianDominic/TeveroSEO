/**
 * Voice Analysis Job Status API Route
 * Phase 37-06: Gap Closure - Job Status Polling
 *
 * GET /api/seo/voice/:clientId/job/:jobId - Get voice analysis job status
 */
import { createFileRoute } from "@tanstack/react-router";
import { voiceAnalysisQueue } from "@/server/queues/voiceAnalysisQueue";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/voice/job" });

export const Route = createFileRoute("/api/seo/voice/$clientId/job/$jobId")({
  server: {
    handlers: {
      // GET /api/seo/voice/:clientId/job/:jobId - Get job status
      GET: async ({ request, params }: { request: Request; params: { clientId: string; jobId: string } }) => {
        try {
          await requireApiAuth(request);
          const { clientId, jobId } = params;

          if (!clientId || !jobId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId or jobId");
          }

          const job = await voiceAnalysisQueue.getJob(jobId);

          if (!job) {
            return Response.json({ error: "Job not found" }, { status: 404 });
          }

          // Verify job belongs to this client (handle both regular and DLQ job types)
          const jobClientId = "clientId" in job.data
            ? job.data.clientId
            : job.data.data?.clientId;
          if (jobClientId !== clientId) {
            return Response.json({ error: "Job not found" }, { status: 404 });
          }

          const state = await job.getState();
          const progress = job.progress as number | { completedUrls?: number; totalUrls?: number };

          // Normalize progress
          let progressPercent = 0;
          let completedUrls = 0;
          let totalUrls = 0;

          if (typeof progress === "number") {
            progressPercent = progress;
          } else if (progress && typeof progress === "object") {
            completedUrls = progress.completedUrls ?? 0;
            totalUrls = progress.totalUrls ?? 0;
            progressPercent = totalUrls > 0 ? Math.round((completedUrls / totalUrls) * 100) : 0;
          }

          return Response.json({
            success: true,
            data: {
              jobId,
              state,
              progress: progressPercent,
              completedUrls,
              totalUrls,
              failedReason: job.failedReason ?? null,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "Job status error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
