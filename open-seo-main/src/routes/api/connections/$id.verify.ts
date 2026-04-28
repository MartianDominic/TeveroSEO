/**
 * Connection Verification API Route
 * Phase 31-04: API Endpoints
 *
 * Tests connection credentials and updates status.
 *
 * POST /api/connections/:id/verify - Verify connection credentials
 */
import { createFileRoute } from "@tanstack/react-router";
import { connectionService } from "@/server/features/connections/services/ConnectionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/connections/:id/verify" });

export const Route = createFileRoute("/api/connections/$id/verify")({
  server: {
    handlers: {
      // POST /api/connections/:id/verify
      POST: async ({
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // Check if connection exists first
          const connection = await connectionService.getConnection(params.id);

          if (!connection) {
            return Response.json(
              { error: "Connection not found" },
              { status: 404 }
            );
          }

          const result = await connectionService.verifyConnection(params.id);

          log.info("Connection verification attempted", {
            connectionId: params.id,
            clientId: connection.clientId,
            success: result.success,
          });

          return Response.json(result);
        } catch (error) {
          log.error(
            "Failed to verify connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
