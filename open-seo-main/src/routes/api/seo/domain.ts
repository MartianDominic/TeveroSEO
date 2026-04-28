/**
 * REST API wrapper for domain serverFunctions.
 * Phase 10: Exposed for Next.js server actions to call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { DomainService } from "@/server/features/domain/services/DomainService";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { domainOverviewSchema } from "@/types/schemas/domain";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/domain" });

async function getProjectContext(request: Request) {
  const auth = await requireApiAuth(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  const clientId = await resolveClientId(request.headers, request.url);

  if (!projectId) {
    throw new AppError("VALIDATION_ERROR", "project_id query parameter required");
  }

  return { ...auth, projectId, clientId };
}

export const Route = createFileRoute("/api/seo/domain")({
  server: {
    handlers: {
      // POST /api/seo/domain - Get domain overview
      POST: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const body = (await request.json()) as Record<string, unknown>;

          const parsed = domainOverviewSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          const result = await DomainService.getOverview(
            { ...parsed.data, projectId: ctx.projectId },
            ctx
          );
          return Response.json(result);
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error("POST error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
