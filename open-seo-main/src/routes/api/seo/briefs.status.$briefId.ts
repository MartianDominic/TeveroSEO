/**
 * Brief generation status endpoint.
 * Phase 36: Content Brief Generation
 */
import { createFileRoute } from "@tanstack/react-router";
import { BriefRepository } from "@/server/features/briefs/services/BriefRepository";
import { getArticleStatus } from "@/server/features/briefs/services/AIWriterClient";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/briefs/status" });
const repository = new BriefRepository();

export const Route = createFileRoute("/api/seo/briefs/status/$briefId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { briefId: string } }) => {
        try {
          await requireApiAuth(request);
          const briefId = params.briefId;

          const brief = await repository.findById(briefId);
          if (!brief) {
            return Response.json({ error: "Brief not found" }, { status: 404 });
          }

          if (!brief.articleId) {
            return Response.json({
              data: {
                briefStatus: brief.status,
                articleStatus: null,
                articleId: null,
              },
            });
          }

          try {
            const articleStatus = await getArticleStatus(brief.articleId);

            if (articleStatus === "generated" || articleStatus === "published") {
              await repository.updateStatus(briefId, "published");
            }

            return Response.json({
              data: {
                briefStatus: brief.status,
                articleStatus,
                articleId: brief.articleId,
              },
            });
          } catch {
            return Response.json({
              data: {
                briefStatus: brief.status,
                articleStatus: "unknown",
                articleId: brief.articleId,
              },
            });
          }
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
            "Status check error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
