/**
 * Single Connection API Routes
 * Phase 31-04: API Endpoints
 *
 * GET, DELETE operations for a specific connection.
 *
 * GET /api/connections/:id - Get connection by ID
 * DELETE /api/connections/:id - Delete connection
 *
 * SECURITY CRITICAL: Contains encrypted CMS credentials.
 * Requires authentication and validates client ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { connectionService } from "@/server/features/connections/services/ConnectionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/connections/:id" });

export const Route = createFileRoute("/api/connections/$id")({
  server: {
    handlers: {
      // GET /api/connections/:id
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          // 2. Fetch connection first to get clientId
          const connection = await connectionService.getConnection(params.id);

          if (!connection) {
            return Response.json(
              { error: "Connection not found" },
              { status: 404 }
            );
          }

          // 3. Validate client ownership
          const headers = new Headers(request.headers);
          headers.set("x-client-id", connection.clientId);
          await resolveClientId(headers, request.url);

          return Response.json(connection);
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "Failed to get connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/connections/:id
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          // 2. Check if connection exists first
          const connection = await connectionService.getConnection(params.id);

          if (!connection) {
            return Response.json(
              { error: "Connection not found" },
              { status: 404 }
            );
          }

          // 3. Validate client ownership before deletion
          const headers = new Headers(request.headers);
          headers.set("x-client-id", connection.clientId);
          await resolveClientId(headers, request.url);

          await connectionService.deleteConnection(params.id);

          log.info("Connection deleted", {
            connectionId: params.id,
            clientId: connection.clientId,
          });

          return new Response(null, { status: 204 });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "Failed to delete connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
