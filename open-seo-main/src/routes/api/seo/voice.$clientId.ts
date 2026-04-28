/**
 * Voice Profile API Routes
 * Phase 37-02: Voice API Layer
 *
 * GET /api/seo/voice/:clientId - Get voice profile for client
 * PUT /api/seo/voice/:clientId - Update voice profile
 * POST /api/seo/voice/:clientId - Create/update voice profile (upsert)
 */
import { createFileRoute } from "@tanstack/react-router";
import { voiceProfileService } from "@/server/features/voice";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "api/seo/voice" });

// Primary tone enum values (must match schema)
const PRIMARY_TONES = [
  "professional", "casual", "friendly", "authoritative", "playful",
  "inspirational", "empathetic", "urgent", "conversational", "academic", "innovative"
] as const;

// Validation schema for voice profile updates
const updateSchema = z.object({
  mode: z.enum(["preservation", "application", "best_practices"]).optional(),
  voiceStatus: z.enum(["draft", "active", "archived"]).optional(),
  voiceName: z.string().optional(),
  primaryTone: z.enum(PRIMARY_TONES).optional(),
  secondaryTones: z.array(z.string()).optional(),
  formalityLevel: z.number().min(1).max(10).optional(),
  personalityTraits: z.array(z.string()).optional(),
  archetype: z.string().optional(),
  emotionalRange: z.string().optional(),
  requiredPhrases: z.array(z.string()).optional(),
  forbiddenPhrases: z.array(z.string()).optional(),
  signaturePhrases: z.array(z.string()).optional(),
  jargonLevel: z.string().optional(),
  industryTerms: z.array(z.string()).optional(),
  acronymPolicy: z.string().optional(),
  contractionUsage: z.string().optional(),
  sentenceLengthTarget: z.string().optional(),
  paragraphLengthTarget: z.string().optional(),
  listPreference: z.string().optional(),
  headingStyle: z.string().optional(),
  ctaTemplate: z.string().optional(),
  keywordDensityTolerance: z.number().min(1).max(5).optional(),
  keywordPlacementRules: z.array(z.string()).optional(),
  seoVsVoicePriority: z.number().min(1).max(10).optional(),
  protectedSections: z.array(z.string()).optional(),
  voiceBlendEnabled: z.boolean().optional(),
  voiceBlendWeight: z.number().min(0).max(1).optional(),
  voiceTemplateId: z.string().nullable().optional(),
  customInstructions: z.string().optional(),
});

export const Route = createFileRoute("/api/seo/voice/$clientId")({
  server: {
    handlers: {
      // GET /api/seo/voice/:clientId - Get voice profile
      GET: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          const authContext = await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          // SECURITY: Validate user has access to this client (CRITICAL-AUTH-001 fix)
          await requireClientAccess(authContext.userId, clientId);

          const profile = await voiceProfileService.getByClientId(clientId);

          log.info("Voice profile retrieved", { clientId, found: !!profile });

          return Response.json({ success: true, data: profile });
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
            "GET voice profile error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      // PUT /api/seo/voice/:clientId - Update voice profile (upsert)
      PUT: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          const authContext = await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          // SECURITY: Validate user has access to this client (CRITICAL-AUTH-001 fix)
          await requireClientAccess(authContext.userId, clientId);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = updateSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          const profile = await voiceProfileService.upsert(clientId, parsed.data);

          log.info("Voice profile updated", { clientId, profileId: profile.id });

          return Response.json({ success: true, data: profile });
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
            "PUT voice profile error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      // POST /api/seo/voice/:clientId - Create/update voice profile (alias for PUT)
      POST: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          const authContext = await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          // SECURITY: Validate user has access to this client (CRITICAL-AUTH-001 fix)
          await requireClientAccess(authContext.userId, clientId);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = updateSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          const profile = await voiceProfileService.upsert(clientId, parsed.data);

          log.info("Voice profile created/updated", { clientId, profileId: profile.id });

          return Response.json({ success: true, data: profile });
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
            "POST voice profile error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
