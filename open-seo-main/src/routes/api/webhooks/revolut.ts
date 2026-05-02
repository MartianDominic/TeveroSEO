/**
 * Revolut webhook handler.
 * Phase 54-03: Webhook Handlers + InvoiceService Updates
 *
 * CRITICAL: Must use raw body for signature verification.
 * Handles ORDER_COMPLETED, ORDER_CANCELLED, ORDER_PAYMENT_DECLINED events.
 */
import { createFileRoute } from "@tanstack/react-router";
import { RevolutProvider } from "@/server/features/payments/providers/RevolutProvider";
import { InvoiceService } from "@/server/features/invoices/services/InvoiceService";
import { processWebhookIdempotently } from "@/server/lib/webhook-utils";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "revolut-webhook" });

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/webhooks/revolut")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Get raw body for signature verification
          // CRITICAL: Do not parse as JSON before verification
          const rawBody = Buffer.from(await request.arrayBuffer());

          // Get webhook secret from env (workspace-specific webhooks use per-workspace secrets)
          const webhookSecret = process.env.REVOLUT_WEBHOOK_SECRET;
          if (!webhookSecret) {
            log.error("REVOLUT_WEBHOOK_SECRET not configured");
            return new Response(null, { status: 500 });
          }

          // Create provider instance for verification
          const provider = new RevolutProvider({
            revolutApiKey: process.env.REVOLUT_SECRET_KEY ?? "",
            revolutWebhookSecret: webhookSecret,
          });

          // Verify signature and parse event
          const event = provider.verifyWebhook(rawBody, request.headers);

          log.info("Revolut webhook received", {
            type: event.type,
            orderId: event.orderId,
          });

          // Process idempotently using order_id + event type as unique key
          const eventId = `${event.orderId}:${event.type}`;

          await processWebhookIdempotently(
            eventId,
            event.type,
            "revolut",
            async () => {
              switch (event.type) {
                case "ORDER_COMPLETED": {
                  // Payment successful - mark invoice as paid
                  const data = event.data as {
                    order_id: string;
                    payments?: Array<{ id: string }>;
                  };
                  const paymentId = data.payments?.[0]?.id ?? "";

                  await InvoiceService.handlePaymentSuccess(
                    event.orderId,
                    paymentId,
                    "revolut"
                  );
                  log.info("Revolut payment completed", {
                    orderId: event.orderId,
                    paymentId,
                  });
                  break;
                }

                case "ORDER_CANCELLED": {
                  // Payment cancelled - log activity only
                  log.info("Revolut order cancelled", {
                    orderId: event.orderId,
                  });
                  // Activity logging handled by InvoiceService if needed
                  break;
                }

                case "ORDER_PAYMENT_DECLINED": {
                  // Payment declined - log activity
                  log.warn("Revolut payment declined", {
                    orderId: event.orderId,
                  });
                  // Could notify client or update invoice status
                  break;
                }

                default:
                  // Unknown event - log and acknowledge
                  log.debug("Unhandled Revolut event type", {
                    type: event.type,
                    orderId: event.orderId,
                  });
              }
            }
          );

          // Return 204 No Content on success (no body to leak info)
          return new Response(null, { status: 204 });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error("Revolut webhook error", new Error(errorMessage));

          // Return 403 for signature errors (Revolut will not retry)
          // Return 500 for processing errors (Revolut will retry)
          const isSignatureError =
            errorMessage.includes("signature") ||
            errorMessage.includes("Signature") ||
            errorMessage.includes("timestamp");

          return new Response(null, { status: isSignatureError ? 403 : 500 });
        }
      },
    },
  },
});
