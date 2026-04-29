/**
 * Brief generation status endpoint.
 * Phase 36: Content Brief Generation
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { keywordPageMapping } from "@/db/mapping-schema";
import { projects } from "@/db/app.schema";
import { BriefRepository } from "@/server/features/briefs/services/BriefRepository";
import { getArticleStatus } from "@/server/features/briefs/services/AIWriterClient";
import { requireApiAuth, type ApiAuthContext } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import type { ContentBriefSelect } from "@/db/brief-schema";

const log = createLogger({ module: "api/seo/briefs/status" });
const repository = new BriefRepository();

/**
 * Verify user has access to a brief via ownership chain:
 * brief -> mapping -> project -> organization
 * (HIGH-AUTH-02 fix)
 *
 * @param brief - The brief to check ownership for
 * @param auth - Authenticated user context
 * @throws AppError("FORBIDDEN") if user does not own the brief
 */
async function verifyBriefOwnership(
  brief: ContentBriefSelect,
  auth: ApiAuthContext
): Promise<void> {
  // Get the mapping to find the project
  const [mapping] = await db
    .select({ projectId: keywordPageMapping.projectId })
    .from(keywordPageMapping)
    .where(eq(keywordPageMapping.id, brief.mappingId))
    .limit(1);

  if (!mapping) {
    throw new AppError("NOT_FOUND", "Brief mapping not found");
  }

  // Get the project to find the organization
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, mapping.projectId))
    .limit(1);

  if (!project) {
    throw new AppError("NOT_FOUND", "Brief project not found");
  }

  // Verify the user's organization matches
  if (project.organizationId !== auth.organizationId) {
    log.warn("Unauthorized brief status access attempt", {
      briefId: brief.id,
      userOrgId: auth.organizationId,
      briefOrgId: project.organizationId,
      userId: auth.userId,
    });
    throw new AppError("FORBIDDEN", "Access denied to this brief");
  }
}

export const Route = createFileRoute("/api/seo/briefs/status/$briefId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { briefId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const briefId = params.briefId;

          const brief = await repository.findById(briefId);
          if (!brief) {
            return Response.json({ error: "Brief not found" }, { status: 404 });
          }

          // SECURITY: Verify ownership before returning status (HIGH-AUTH-02 fix)
          await verifyBriefOwnership(brief, auth);

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
