/**
 * Internal API route for triggering analytics backfill.
 *
 * Called by AI-Writer backend after OAuth callback successfully stores
 * Google credentials. This endpoint queues a backfill job in BullMQ.
 *
 * SECURITY: Protected by HMAC-signed requests (X-Internal-Signature + X-Internal-Timestamp).
 * CSI-001/CSI-002 FIX: Legacy X-Internal-Api-Key auth has been removed.
 * This endpoint is NOT exposed to public - internal network only.
 *
 * SECURITY FIXES:
 * - CRIT-002: Uses standardized HMAC-based auth from internal-auth middleware
 * - CRIT-003: Uses timing-safe comparison to prevent timing attacks
 * - CSI-001/CSI-002: Removed legacy API key authentication
 */
import { createFileRoute } from "@tanstack/react-router";
import { queueBackfillJob } from "@/server/queues/analyticsQueue";
import { createLogger } from "@/server/lib/logger";
import { requireInternalAuth } from "@/server/middleware/internal-auth";

const log = createLogger({ module: "api/internal/analytics/backfill" });

interface BackfillRequestBody {
  clientId: string;
}

export const Route = createFileRoute("/api/internal/analytics/backfill")({
  server: {
    handlers: {
      // POST /api/internal/analytics/backfill - Queue backfill job
      POST: async ({ request }: { request: Request }) => {
        // Clone request to read body for signature verification
        const clonedRequest = request.clone();
        let bodyText = "";
        try {
          bodyText = await clonedRequest.text();
        } catch {
          // Empty body is fine
        }

        // Verify internal auth using shared middleware (CRIT-002, CRIT-003 fixes)
        const authError = await requireInternalAuth(request, bodyText);
        if (authError) {
          return authError;
        }

        try {
          const body = JSON.parse(bodyText || "{}") as BackfillRequestBody;
          const { clientId } = body;

          if (!clientId) {
            return Response.json(
              { error: "clientId required" },
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Validate UUID format (basic check)
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(clientId)) {
            return Response.json(
              { error: "Invalid clientId format" },
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Queue the backfill job
          await queueBackfillJob(clientId);

          log.info("Queued backfill", { clientId });

          return Response.json(
            { status: "queued", clientId },
            { status: 202, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          log.error("Failed to queue backfill", err instanceof Error ? err : new Error(String(err)));
          return Response.json(
            { error: "Failed to queue backfill" },
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
