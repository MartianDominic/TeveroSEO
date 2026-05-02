/**
 * Platform Connection Detail API Routes
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/platform-connections/:id - Get single connection
 * DELETE /api/platform-connections/:id - Remove connection
 *
 * SECURITY CRITICAL: Contains encrypted OAuth tokens.
 * Validates workspace ownership via x-workspace-id header.
 */
import { createFileRoute } from "@tanstack/react-router";
import { platformConnectionService } from "@/server/features/platform-oauth/PlatformConnectionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/platform-connections/$id" });

export const Route = createFileRoute("/api/platform-connections/$id")({
  server: {
    handlers: {
      // GET /api/platform-connections/:id
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const userId = request.headers.get("x-user-id");
          const workspaceId = request.headers.get("x-workspace-id");

          if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const connection = await platformConnectionService.getConnection(
            params.id
          );

          if (!connection) {
            return Response.json({ error: "Not found" }, { status: 404 });
          }

          // Validate workspace ownership
          if (workspaceId && connection.workspaceId !== workspaceId) {
            return Response.json({ error: "Not found" }, { status: 404 });
          }

          return Response.json({ connection });
        } catch (error) {
          log.error(
            "Failed to get platform connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/platform-connections/:id
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const userId = request.headers.get("x-user-id");
          const workspaceId = request.headers.get("x-workspace-id");

          if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const connection = await platformConnectionService.getConnection(
            params.id
          );

          if (!connection) {
            return Response.json({ error: "Not found" }, { status: 404 });
          }

          // Validate workspace ownership
          if (workspaceId && connection.workspaceId !== workspaceId) {
            return Response.json({ error: "Not found" }, { status: 404 });
          }

          // Delete the connection
          await platformConnectionService.deleteConnection(params.id);

          log.info("Platform connection deleted", {
            connectionId: params.id,
            workspaceId: connection.workspaceId,
          });

          return Response.json({ success: true });
        } catch (error) {
          log.error(
            "Failed to delete platform connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
