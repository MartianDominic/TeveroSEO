/**
 * Voice Templates API Route
 * Phase 37-02: Voice API Layer
 *
 * GET /api/seo/voice-templates - List all templates (optionally filtered by industry)
 */
import { createFileRoute } from "@tanstack/react-router";
import { voiceTemplateService } from "@/server/features/voice";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/voice-templates" });

export const Route = createFileRoute("/api/seo/voice-templates")({
  server: {
    handlers: {
      // GET /api/seo/voice-templates - List templates
      GET: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          const url = new URL(request.url);
          const industry = url.searchParams.get("industry");

          let templates;
          if (industry) {
            templates = await voiceTemplateService.listByIndustry(industry);
            log.info("Voice templates retrieved (filtered)", {
              industry,
              count: templates.length,
            });
          } else {
            templates = await voiceTemplateService.listAll();
            log.info("Voice templates retrieved (all)", {
              count: templates.length,
            });
          }

          return Response.json({ success: true, data: templates });
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
            "GET voice templates error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
