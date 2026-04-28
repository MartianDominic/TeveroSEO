/**
 * Client drop events API route.
 * Phase 17: List rank drop events for a client.
 *
 * GET /api/clients/:clientId/drop-events - List unprocessed drop events
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { getUnprocessedDropEvents, getRecentDropEvents } from "@/services/rank-events";

const log = createLogger({ module: "api/clients/:clientId/drop-events" });

export const Route = createFileRoute("/api/clients/$clientId/drop-events")({
  server: {
    handlers: {
      // GET /api/clients/:clientId/drop-events - List drop events
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { clientId } = params;
          const url = new URL(request.url);
          const unprocessedOnly = url.searchParams.get("unprocessed") === "true";

          const events = unprocessedOnly
            ? await getUnprocessedDropEvents(clientId)
            : await getRecentDropEvents(clientId);

          return Response.json(
            events.map((e) => ({
              id: e.id,
              keywordId: e.keywordId,
              keyword: e.keyword,
              projectId: e.projectId,
              previousPosition: e.previousPosition,
              currentPosition: e.currentPosition,
              dropAmount: e.dropAmount,
              threshold: e.threshold,
              detectedAt: e.detectedAt.toISOString(),
              processedAt: e.processedAt?.toISOString() ?? null,
              processedBy: e.processedBy,
            })),
          );
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "List drop events failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
