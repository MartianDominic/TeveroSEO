/**
 * Platform Connection Sync API Routes
 * Phase 61-06: Platform Integration Excellence
 *
 * POST /api/platform-connections/:id/sync - Trigger manual sync
 *
 * Platform-specific sync logic would be added here as services are implemented.
 * Currently records sync timestamp.
 */
import { createFileRoute } from "@tanstack/react-router";
import { platformConnectionService } from "@/server/features/platform-oauth/PlatformConnectionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/platform-connections/$id.sync" });

export const Route = createFileRoute("/api/platform-connections/$id/sync")({
  server: {
    handlers: {
      // POST /api/platform-connections/:id/sync
      POST: async ({
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

          // Check connection status
          if (connection.status !== "active") {
            return Response.json(
              { error: "Connection is not active" },
              { status: 400 }
            );
          }

          // Get tokens to verify they're available
          const tokens = await platformConnectionService.getOAuthTokens(
            params.id
          );
          if (!tokens && !connection.credentialType?.includes("app_password")) {
            return Response.json(
              { error: "No tokens available" },
              { status: 400 }
            );
          }

          // Platform-specific sync would happen here:
          // - GoogleSearchConsoleService.getSearchQueries()
          // - GoogleAnalyticsService.getTrafficData()
          // - ShopifyService.getProducts()
          // - WordPressService.getPosts()
          // etc.

          // For now, just record the sync as successful
          await platformConnectionService.recordSync(params.id, "success");

          const syncedAt = new Date().toISOString();

          log.info("Platform connection synced", {
            connectionId: params.id,
            workspaceId: connection.workspaceId,
            platform: connection.platform,
            syncedAt,
          });

          return Response.json({
            success: true,
            syncedAt,
          });
        } catch (error) {
          log.error(
            "Failed to sync platform connection",
            error instanceof Error ? error : new Error(String(error))
          );

          // Record failed sync
          try {
            await platformConnectionService.recordSync(
              params.id,
              "failed",
              error instanceof Error ? error.message : "Sync failed"
            );
          } catch {
            // Ignore recordSync failures
          }

          return Response.json({ error: "Failed to sync" }, { status: 500 });
        }
      },
    },
  },
});
