/**
 * Stripe webhook handler API route.
 * Phase 30-06: Payment (Stripe)
 *
 * Handles Stripe webhook events for payment completion.
 * Verifies webhook signature before processing.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import {
  verifyWebhookSignature,
  handleStripeWebhook,
} from "@/server/features/proposals/payment";

const log = createLogger({ module: "api/stripe/webhook" });

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      // POST /api/stripe/webhook - Handle Stripe webhook events
      POST: async ({ request }: { request: Request }) => {
        try {
          // Get raw body for signature verification
          const body = await request.text();
          const signature = request.headers.get("stripe-signature");

          if (!signature) {
            log.warn("Missing stripe-signature header");
            return new Response("Missing signature", { status: 400 });
          }

          // Verify webhook signature
          let event;
          try {
            event = verifyWebhookSignature(body, signature);
          } catch (err) {
            log.error(
              "Webhook signature verification failed",
              err instanceof Error ? err : new Error(String(err))
            );
            return new Response("Invalid signature", { status: 400 });
          }

          // Process the event
          await handleStripeWebhook(event);

          return new Response("OK", { status: 200 });
        } catch (err) {
          log.error(
            "Stripe webhook handler failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return new Response("Webhook handler failed", { status: 500 });
        }
      },
    },
  },
});
