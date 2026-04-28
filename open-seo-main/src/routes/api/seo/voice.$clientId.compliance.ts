/**
 * Voice Compliance API Route
 * Phase 37-06: Gap Closure - Mode Enforcement
 *
 * POST /api/seo/voice/:clientId/compliance - Score content against voice profile
 */
import { createFileRoute } from "@tanstack/react-router";
import { voiceProfileService } from "@/server/features/voice";
import { voiceComplianceService } from "@/server/features/voice/services/VoiceComplianceService";
import { protectionEnforcementService } from "@/server/features/voice/services/ProtectionEnforcementService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "api/seo/voice/compliance" });

const complianceSchema = z.object({
  content: z.string().min(1).max(100_000),
  targetUrl: z.string().url().optional(),
});

export const Route = createFileRoute("/api/seo/voice/$clientId/compliance")({
  server: {
    handlers: {
      // POST /api/seo/voice/:clientId/compliance - Score content compliance
      POST: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = complianceSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          const { content, targetUrl } = parsed.data;

          // Fetch voice profile
          const profile = await voiceProfileService.getByClientId(clientId);
          if (!profile) {
            return Response.json({ error: "Voice profile not found" }, { status: 404 });
          }

          // For preservation mode, check if content is protected
          if (profile.mode === "preservation" && targetUrl) {
            const preservationResult = await protectionEnforcementService.shouldPreserveContent(
              profile.id,
              targetUrl,
              content
            );

            if (preservationResult.preserveEntirePage) {
              return Response.json({
                success: true,
                data: {
                  tone_match: 0,
                  vocabulary_match: 0,
                  structure_match: 0,
                  personality_match: 0,
                  rule_compliance: 0,
                  overall: 0,
                  violations: [{
                    dimension: "rules" as const,
                    severity: "high" as const,
                    text: "Entire page is protected",
                    suggestion: preservationResult.reason || "This page is marked for full preservation",
                  }],
                  passed: false,
                  protectionMode: true,
                },
              });
            }
          }

          // Score content compliance
          const complianceScore = await voiceComplianceService.scoreContent(content, profile);

          log.info("Voice compliance scored", {
            clientId,
            profileId: profile.id,
            overall: complianceScore.overall,
            passed: complianceScore.passed,
          });

          return Response.json({
            success: true,
            data: complianceScore,
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
            "Voice compliance error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
