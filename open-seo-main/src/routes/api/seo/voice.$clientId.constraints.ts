/**
 * Voice Constraints API Route
 * Phase 37-05: Voice Constraints API for AI-Writer Integration
 *
 * POST /api/seo/voice/:clientId/constraints - Build voice constraints for AI prompt injection
 *
 * HIGH-V-01 FIX: This endpoint makes TypeScript VoiceConstraintBuilder the single source of truth.
 * AI-Writer calls this endpoint instead of duplicating constraint-building logic in Python.
 */
import { createFileRoute } from "@tanstack/react-router";
import { voiceProfileService } from "@/server/features/voice";
import { buildVoiceConstraints } from "@/server/features/voice/services/VoiceConstraintBuilder";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "api/seo/voice/constraints" });

// Validation schema for constraint building request
const constraintRequestSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  templateBlend: z.number().min(0).max(1).optional(),
  templateId: z.string().optional(),
  targetUrl: z.string().url().optional(),
});

export const Route = createFileRoute("/api/seo/voice/$clientId/constraints")({
  server: {
    handlers: {
      // POST /api/seo/voice/:clientId/constraints - Build voice constraints
      POST: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          const authContext = await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          // SECURITY: Validate user has access to this client
          await requireClientAccess(authContext.userId, clientId);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = constraintRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          const { profileId, templateBlend, templateId, targetUrl } = parsed.data;

          // Fetch the profile
          const profile = await voiceProfileService.getById(profileId);

          if (!profile) {
            return Response.json({ error: "Voice profile not found" }, { status: 404 });
          }

          // Verify the profile belongs to this client
          if (profile.clientId !== clientId) {
            return Response.json({ error: "Profile does not belong to this client" }, { status: 403 });
          }

          // Build constraints using the authoritative TypeScript implementation
          const constraints = buildVoiceConstraints({
            profile,
            templateBlend,
            templateId,
            targetUrl,
          });

          log.info("Voice constraints built", {
            clientId,
            profileId,
            mode: profile.mode,
            constraintsLength: constraints.length,
          });

          return Response.json({
            success: true,
            constraints,
            mode: profile.mode,
          });
        } catch (error) {
          if (error instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
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
            "POST voice constraints error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
