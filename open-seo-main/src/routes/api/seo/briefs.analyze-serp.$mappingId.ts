/**
 * SERP analysis preview endpoint for content briefs.
 * Phase 36: Content Brief Generation
 */
import { createFileRoute } from "@tanstack/react-router";
import { previewSerp } from "@/server/features/briefs/services/BriefGenerator";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/briefs/analyze-serp" });

interface AnalyzeSerpBody {
  locationCode?: number;
}

export const Route = createFileRoute("/api/seo/briefs/analyze-serp/$mappingId")({
  server: {
    handlers: {
      /**
       * POST /api/seo/briefs/analyze-serp/:mappingId
       * Returns SERP analysis without creating a brief.
       *
       * Body: { locationCode? }
       */
      POST: async ({ request, params }: { request: Request; params: { mappingId: string } }) => {
        try {
          await requireApiAuth(request);

          // Validate client ownership
          const clientId = await resolveClientId(request.headers, request.url);
          if (!clientId) {
            return Response.json(
              { error: "client_id header or query parameter is required" },
              { status: 400 },
            );
          }

          const { mappingId } = params;

          let body: AnalyzeSerpBody = {};
          try {
            body = await request.json();
          } catch {
            // Empty body is valid, use defaults
          }

          const analysis = await previewSerp(clientId, mappingId, body.locationCode ?? 2840);
          return Response.json({ data: analysis });
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
            "POST error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
