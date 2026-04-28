/**
 * REST API wrapper for backlinks serverFunctions.
 * Phase 10: Exposed for Next.js server actions to call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { BacklinksService } from "@/server/features/backlinks/services/BacklinksService";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { backlinksOverviewInputSchema } from "@/types/schemas/backlinks";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/backlinks" });

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

export const Route = createFileRoute("/api/seo/backlinks")({
  server: {
    handlers: {
      // POST /api/seo/backlinks - Overview, referring domains, or top pages
      POST: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const body = (await request.json()) as Record<string, unknown>;
          const action = (body.action as string) ?? "overview";

          const parsed = backlinksOverviewInputSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json({ error: parsed.error.message }, { status: 400 });
          }

          const input = {
            target: parsed.data.target,
            scope: parsed.data.scope,
          };

          if (action === "referring-domains") {
            const profile = await BacklinksService.profileReferringDomains(input, ctx);
            return Response.json(profile.rows);
          }

          if (action === "top-pages") {
            const profile = await BacklinksService.profileTopPages(input, ctx);
            return Response.json(profile.rows);
          }

          // Default: overview
          const spamOptions = {
            hideSpam: parsed.data.hideSpam,
            spamThreshold: parsed.data.spamThreshold,
          };
          const profile = await BacklinksService.profileOverview(input, ctx, spamOptions);
          return Response.json(profile.overview);
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
