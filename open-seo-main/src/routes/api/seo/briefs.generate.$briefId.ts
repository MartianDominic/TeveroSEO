/**
 * Brief content generation endpoint.
 * Phase 36: Content Brief Generation
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BriefRepository } from "@/server/features/briefs/services/BriefRepository";
import {
  createArticleFromBrief,
  triggerArticleGeneration,
} from "@/server/features/briefs/services/AIWriterClient";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/briefs/generate" });
const repository = new BriefRepository();

/**
 * Zod schema for brief generation request validation.
 * HIGH-INPUT-03: Replace .catch(() => ({})) with proper validation.
 */
const generateBodySchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
});

export const Route = createFileRoute("/api/seo/briefs/generate/$briefId")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { briefId: string } }) => {
        try {
          await requireApiAuth(request);
          const briefId = params.briefId;

          // HIGH-INPUT-03: Proper JSON parsing with validation
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const validation = generateBodySchema.safeParse(rawBody);
          if (!validation.success) {
            return Response.json(
              {
                error: "Invalid request body",
                details: validation.error.issues.map((i) => ({
                  field: i.path.join("."),
                  message: i.message,
                })),
              },
              { status: 400 }
            );
          }

          const body = validation.data;

          const brief = await repository.findById(briefId);
          if (!brief) {
            return Response.json({ error: "Brief not found" }, { status: 404 });
          }

          if (brief.status !== "ready" && brief.status !== "draft") {
            return Response.json(
              { error: `Cannot generate from brief with status: ${brief.status}` },
              { status: 400 }
            );
          }

          log.info("Starting content generation", { briefId, clientId: body.clientId });

          const article = await createArticleFromBrief(brief, body.clientId);
          await repository.updateArticleId(briefId, article.id);
          await repository.updateStatus(briefId, "generating");
          await triggerArticleGeneration(article.id);

          log.info("Content generation triggered", { briefId, articleId: article.id });

          return Response.json({
            data: {
              briefId: brief.id,
              articleId: article.id,
              status: "generating",
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
            "Generate error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
