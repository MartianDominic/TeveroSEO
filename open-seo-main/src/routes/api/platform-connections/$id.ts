/**
 * Platform Connection Detail API Routes
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/platform-connections/:id - Get single connection
 * DELETE /api/platform-connections/:id - Remove connection
 *
 * SECURITY CRITICAL: Contains encrypted OAuth tokens.
 * CRIT-AUTH-01 FIX: Uses requireApiAuth() for secure JWT/API key validation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { platformConnectionService } from "@/server/features/platform-oauth/PlatformConnectionService";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/platform-connections/$id" });

/**
 * MEDIUM-03 FIX: Validate connection ID format (UUID or CUID).
 */
const ConnectionIdSchema = z.string().min(1).max(128).regex(
  /^[a-zA-Z0-9_-]+$/,
  "Invalid connection ID format"
);

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
          // CRIT-AUTH-01 FIX: Use secure authentication
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

          const connection = await platformConnectionService.getConnection(
            idParsed.data
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

          // MEDIUM-01 FIX: Standardized response envelope
          return Response.json({ success: true, data: { connection } });
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
            "Failed to get platform connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
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
          // CRIT-AUTH-01 FIX: Use secure authentication
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

          const connection = await platformConnectionService.getConnection(
            idParsed.data
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

          // Delete the connection
          await platformConnectionService.deleteConnection(idParsed.data);

          log.info("Platform connection deleted", {
            connectionId: idParsed.data,
            workspaceId: connection.workspaceId,
            userId: auth.userId,
          });

          // MEDIUM-01 FIX: Standardized response envelope
          return Response.json({ success: true, data: null });
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
            "Failed to delete platform connection",
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
