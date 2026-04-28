/**
 * Changes API Routes
 * Phase 33: Auto-Fix System Gap Closure
 *
 * GET /api/changes?clientId=X - List changes for client with filters
 *
 * Security: Requires authentication and validates client ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  getChangesByClient,
} from "@/server/features/changes/repositories/ChangeRepository";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/changes" });

export const Route = createFileRoute("/api/changes/")({
  server: {
    handlers: {
      // GET /api/changes?clientId=X
      GET: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          // 2. Validate client ownership
          const url = new URL(request.url);
          const clientIdParam = url.searchParams.get("clientId");

          if (!clientIdParam) {
            return Response.json(
              { success: false, error: "clientId query parameter required" },
              { status: 400 }
            );
          }

          // resolveClientId validates the client exists and user has access
          const clientId = await resolveClientId(request.headers, request.url);
          if (!clientId || clientId !== clientIdParam) {
            // If clientId from header/param doesn't match, use param validation
            // Set header for validation
            const headers = new Headers(request.headers);
            headers.set("x-client-id", clientIdParam);
            await resolveClientId(headers, request.url);
          }

          const status = url.searchParams.get("status") ?? undefined;
          const category = url.searchParams.get("category") ?? undefined;
          const resourceType = url.searchParams.get("resourceType") ?? undefined;
          const triggeredBy = url.searchParams.get("triggeredBy") ?? undefined;
          const dateFromStr = url.searchParams.get("dateFrom");
          const dateToStr = url.searchParams.get("dateTo");
          const limit = url.searchParams.get("limit");
          const offset = url.searchParams.get("offset");

          // FIX: All filters now pushed to database layer to avoid in-memory filtering
          // This improves performance and ensures pagination works correctly with filters
          const changes = await getChangesByClient(clientIdParam, {
            status,
            category,
            resourceType,
            triggeredBy,
            dateFrom: dateFromStr ? new Date(dateFromStr) : undefined,
            dateTo: dateToStr ? new Date(dateToStr) : undefined,
            limit: limit ? parseInt(limit, 10) : 100,
            offset: offset ? parseInt(offset, 10) : 0,
          });

          return Response.json({ success: true, data: changes });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }
          log.error(
            "Failed to get changes",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
