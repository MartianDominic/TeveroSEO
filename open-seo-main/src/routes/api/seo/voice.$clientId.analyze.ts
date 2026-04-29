/**
 * Voice Analysis API Route
 * Phase 37-02: Voice API Layer
 *
 * POST /api/seo/voice/:clientId/analyze - Trigger voice analysis from URLs
 */
import { createFileRoute } from "@tanstack/react-router";
import { voiceProfileService } from "@/server/features/voice";
import { queueVoiceAnalysis } from "@/server/queues/voiceAnalysisQueue";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "api/seo/voice/analyze" });

// Validation schema for voice analysis request
const analyzeSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
});

export const Route = createFileRoute("/api/seo/voice/$clientId/analyze")({
  server: {
    handlers: {
      // POST /api/seo/voice/:clientId/analyze - Trigger voice analysis
      POST: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          const authContext = await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          // SECURITY: Validate user has access to this client (CRIT-03-A fix)
          await requireClientAccess(authContext.userId, clientId);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = analyzeSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          // Ensure profile exists, create if needed
          let profile = await voiceProfileService.getByClientId(clientId);
          if (!profile) {
            profile = await voiceProfileService.upsert(clientId, {
              mode: "best_practices",
            });
            log.info("Created voice profile for analysis", {
              clientId,
              profileId: profile.id,
            });
          }

          // Queue analysis job
          const jobId = await queueVoiceAnalysis(clientId, profile.id, parsed.data.urls);

          log.info("Voice analysis queued", {
            clientId,
            profileId: profile.id,
            urlCount: parsed.data.urls.length,
            jobId,
          });

          return Response.json({
            success: true,
            data: {
              jobId,
              profileId: profile.id,
              urlCount: parsed.data.urls.length,
            },
          });
        } catch (error) {
          if (error instanceof AuthorizationError) {
            return Response.json({ error: error.message }, { status: 403 });
          }
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
            "Voice analysis trigger error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
