/**
 * Single Change API Route
 * Phase 33: Auto-Fix System Gap Closure
 *
 * GET /api/changes/:changeId - Get single change by ID
 *
 * Security: Requires authentication and validates client ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getChangeById } from "@/server/features/changes/repositories/ChangeRepository";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/changes/$changeId" });

export const Route = createFileRoute("/api/changes/$changeId")({
  server: {
    handlers: {
      // GET /api/changes/:changeId
      GET: async ({ request, params }: { request: Request; params: { changeId: string } }) => {
        const { changeId } = params;

        if (!changeId) {
          return Response.json(
            { success: false, error: "changeId is required" },
            { status: 400 }
          );
        }

        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          // 2. Fetch the change first
          const change = await getChangeById(changeId);

          if (!change) {
            return Response.json(
              { success: false, error: "Change not found" },
              { status: 404 }
            );
          }

          // 3. Validate client ownership - user must have access to the change's client
          // Note: clientId can be null if the client was deleted (soft delete preserves change records)
          if (change.clientId) {
            const headers = new Headers(request.headers);
            headers.set("x-client-id", change.clientId);
            await resolveClientId(headers, request.url);
          }

          return Response.json({ success: true, data: change });
        } catch (error) {
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
            "Failed to get change",
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
