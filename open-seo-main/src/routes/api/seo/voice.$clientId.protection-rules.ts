/**
 * Protection Rules API Route
 * Phase 37-02: Voice API Layer
 *
 * GET /api/seo/voice/:clientId/protection-rules - List protection rules
 * POST /api/seo/voice/:clientId/protection-rules - Create protection rule
 * DELETE /api/seo/voice/:clientId/protection-rules?ruleId=... - Delete protection rule
 */
import { createFileRoute } from "@tanstack/react-router";
import { voiceProfileService, protectionRulesService } from "@/server/features/voice";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "api/seo/voice/protection-rules" });

// Validation schema for creating protection rules
const createRuleSchema = z.object({
  ruleType: z.enum(["page", "section", "pattern"]),
  target: z.string().min(1),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/seo/voice/$clientId/protection-rules")({
  server: {
    handlers: {
      // GET /api/seo/voice/:clientId/protection-rules - List protection rules
      GET: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          const profile = await voiceProfileService.getByClientId(clientId);
          if (!profile) {
            throw new AppError("NOT_FOUND", "Voice profile not found");
          }

          const rules = await protectionRulesService.getByProfileId(profile.id);

          log.info("Protection rules retrieved", {
            clientId,
            profileId: profile.id,
            count: rules.length,
          });

          return Response.json({ success: true, data: rules });
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
            "GET protection rules error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      // POST /api/seo/voice/:clientId/protection-rules - Create protection rule
      POST: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          const profile = await voiceProfileService.getByClientId(clientId);
          if (!profile) {
            throw new AppError("NOT_FOUND", "Voice profile not found");
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = createRuleSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          const rule = await protectionRulesService.create(profile.id, {
            ruleType: parsed.data.ruleType,
            target: parsed.data.target,
            reason: parsed.data.reason ?? "",
            createdBy: "user", // TODO: get from auth context
            expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
          });

          log.info("Protection rule created", {
            clientId,
            profileId: profile.id,
            ruleId: rule.id,
            ruleType: rule.ruleType,
          });

          return Response.json({ success: true, data: rule });
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
            "POST protection rule error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      // DELETE /api/seo/voice/:clientId/protection-rules - Delete protection rule
      DELETE: async ({ request, params }: { request: Request; params: { clientId: string } }) => {
        try {
          await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          const url = new URL(request.url);
          const ruleId = url.searchParams.get("ruleId");

          if (!ruleId) {
            throw new AppError("VALIDATION_ERROR", "Missing ruleId query parameter");
          }

          await protectionRulesService.delete(ruleId);

          log.info("Protection rule deleted", {
            clientId,
            ruleId,
          });

          return Response.json({ success: true });
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
            "DELETE protection rule error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
