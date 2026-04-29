/**
 * Project By ID API Routes
 * Phase 40: Gap Closure - CRITICAL API endpoint fix.
 *
 * GET /api/seo/projects/:projectId - Get project by ID
 * DELETE /api/seo/projects/:projectId - Delete project
 *
 * Resolves 404 errors when frontend calls getProject() for audit,
 * keyword mapping, and domain analysis features.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProjectService } from "@/server/features/projects/services/ProjectService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "api/seo/projects/$projectId" });

// UUID validation schema
const uuidSchema = z.string().uuid("Invalid project ID format");

export const Route = createFileRoute("/api/seo/projects/$projectId")({
  server: {
    handlers: {
      // GET /api/seo/projects/:projectId - Get project by ID
      GET: async ({ request, params }: { request: Request; params: { projectId: string } }) => {
        try {
          const authContext = await requireApiAuth(request);
          const { projectId } = params;

          // Validate projectId format
          const uuidResult = uuidSchema.safeParse(projectId);
          if (!uuidResult.success) {
            return Response.json(
              { error: "Invalid project ID format" },
              { status: 400 }
            );
          }

          // Get project with organization verification
          // This ensures the project belongs to the user's organization
          const project = await ProjectService.getProjectForOrganization(
            authContext.organizationId,
            projectId
          );

          log.info("Project retrieved by ID", {
            projectId,
            organizationId: authContext.organizationId,
          });

          return Response.json(project);
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
            "GET project by ID error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      // DELETE /api/seo/projects/:projectId - Delete project
      DELETE: async ({ request, params }: { request: Request; params: { projectId: string } }) => {
        try {
          const authContext = await requireApiAuth(request);
          const { projectId } = params;

          // Validate projectId format
          const uuidResult = uuidSchema.safeParse(projectId);
          if (!uuidResult.success) {
            return Response.json(
              { error: "Invalid project ID format" },
              { status: 400 }
            );
          }

          // Delete project (includes organization verification)
          await ProjectService.deleteProject(authContext.organizationId, {
            projectId,
          });

          log.info("Project deleted", {
            projectId,
            organizationId: authContext.organizationId,
            userId: authContext.userId,
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
            "DELETE project error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
