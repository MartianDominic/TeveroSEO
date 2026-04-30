/**
 * Dokobit webhook endpoint for e-signature completion.
 * Phase 48-02: Contract & Payment - Webhook handling
 *
 * POST /api/webhooks/dokobit
 * Handles Dokobit signing status callbacks (signed, rejected, expired).
 *
 * SECURITY: IP whitelist verification (Dokobit does not provide HMAC signatures).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContractService } from "@/server/features/contracts/services/ContractService";
import { verifyDokobitIp, processWebhookIdempotently } from "@/server/lib/webhook-utils";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "dokobit-webhook" });

const dokobitWebhookSchema = z.object({
  session_id: z.string(),
  status: z.enum(["signed", "rejected", "expired"]),
  signer_name: z.string().optional(),
});

export const Route = createFileRoute("/api/webhooks/dokobit")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Get client IP for verification
        const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ||
                         request.headers.get("x-real-ip");

        // Verify source IP per security pattern
        if (!verifyDokobitIp(clientIp)) {
          log.warn("Blocked webhook from unauthorized IP", { clientIp });
          return new Response("Forbidden", { status: 403 });
        }

        try {
          const body = await request.json();
          const payload = dokobitWebhookSchema.parse(body);

          // Generate event ID from session for idempotency
          const eventId = `dokobit-${payload.session_id}-${payload.status}`;

          await processWebhookIdempotently(
            eventId,
            `signing.${payload.status}`,
            "dokobit",
            async () => {
              if (payload.status === "signed") {
                await ContractService.handleSigningComplete(
                  payload.session_id,
                  payload.signer_name || "Unknown"
                );
              } else if (payload.status === "rejected" || payload.status === "expired") {
                // Mark contract as cancelled/expired
                // Implementation: find contract by session, transition to cancelled/expired
                log.info("Signing rejected/expired", { sessionId: payload.session_id });
              }
            }
          );

          return new Response("OK", { status: 200 });
        } catch (error) {
          log.error("Dokobit webhook error", error instanceof Error ? error : undefined);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
