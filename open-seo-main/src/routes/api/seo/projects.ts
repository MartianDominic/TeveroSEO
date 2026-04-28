/**
 * REST API wrapper for project serverFunctions.
 * Phase 10: Exposed for Next.js server actions to call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProjectService } from "@/server/features/projects/services/ProjectService";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/projects" });

export const Route = createFileRoute("/api/seo/projects")({
  server: {
    handlers: {
      // GET /api/seo/projects - Get or create default project
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          // Note: resolveClientId validation happens in requireApiAuth
          // Get or create default project for this organization
          const project = await ProjectService.getOrCreateDefaultProject(auth.organizationId);
          return Response.json(project);
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error("GET error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
