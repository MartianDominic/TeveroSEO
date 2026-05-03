/**
 * Platform Connection Sync API Routes
 * Phase 61-06: Platform Integration Excellence
 *
 * POST /api/platform-connections/:id/sync - Trigger manual sync
 *
 * Platform-specific sync logic would be added here as services are implemented.
 * Currently records sync timestamp.
 *
 * CRIT-AUTH-02 FIX: Uses requireApiAuth() for secure JWT/API key validation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { platformConnectionService } from "@/server/features/platform-oauth/PlatformConnectionService";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/platform-connections/$id.sync" });

/**
 * MEDIUM-03 FIX: Validate connection ID format (UUID or CUID).
 */
const ConnectionIdSchema = z.string().min(1).max(128).regex(
  /^[a-zA-Z0-9_-]+$/,
  "Invalid connection ID format"
);

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
          // CRIT-AUTH-02 FIX: Use secure authentication instead of spoofable headers
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          // MEDIUM-03 FIX: Validate path parameter
          const idParsed = ConnectionIdSchema.safeParse(params.id);
          if (!idParsed.success) {
            return Response.json(
              { success: false, error: "Invalid connection ID format" },
              { status: 400 }
            );
          }

          const connectionId = idParsed.data;
          const connection = await platformConnectionService.getConnection(
            connectionId
          );

          if (!connection) {
            return Response.json(
              { success: false, error: "Connection not found" },
              { status: 404 }
            );
          }

          // Validate workspace ownership (always required now)
          if (connection.workspaceId !== workspaceId) {
            return Response.json(
              { success: false, error: "Connection not found" },
              { status: 404 }
            );
          }

          // Check connection status
          if (connection.status !== "active") {
            return Response.json(
              { success: false, error: "Connection is not active" },
              { status: 400 }
            );
          }

          // Get tokens to verify they're available
          const tokens = await platformConnectionService.getOAuthTokens(
            connectionId
          );
          if (!tokens && !connection.credentialType?.includes("app_password")) {
            return Response.json(
              { success: false, error: "No tokens available" },
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
          await platformConnectionService.recordSync(connectionId, "success");

          const syncedAt = new Date().toISOString();

          log.info("Platform connection synced", {
            connectionId,
            workspaceId: connection.workspaceId,
            platform: connection.platform,
            userId: auth.userId,
            syncedAt,
          });

          // MEDIUM-01 FIX: Standardized response envelope
          return Response.json({
            success: true,
            data: { syncedAt },
          });
        } catch (error) {
          // MEDIUM-04 FIX: Handle AppError for proper status codes
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

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

          return Response.json(
            { success: false, error: "Failed to sync" },
            { status: 500 }
          );
        }
      },
    },
  },
});
