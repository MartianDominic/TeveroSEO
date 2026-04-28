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
          const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
          const dateTo = url.searchParams.get("dateTo") ?? undefined;
          const limit = url.searchParams.get("limit");
          const offset = url.searchParams.get("offset");

          let changes = await getChangesByClient(clientIdParam, {
            status,
            category,
            limit: limit ? parseInt(limit, 10) : 100,
            offset: offset ? parseInt(offset, 10) : 0,
          });

          // Apply additional filters that repository doesn't support
          if (resourceType) {
            changes = changes.filter((c) => c.resourceType === resourceType);
          }
          if (triggeredBy) {
            changes = changes.filter((c) => c.triggeredBy === triggeredBy);
          }
          if (dateFrom) {
            const fromDate = new Date(dateFrom);
            changes = changes.filter((c) => c.createdAt >= fromDate);
          }
          if (dateTo) {
            const toDate = new Date(dateTo);
            changes = changes.filter((c) => c.createdAt <= toDate);
          }

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
