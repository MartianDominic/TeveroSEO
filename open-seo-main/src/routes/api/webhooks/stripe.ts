/**
 * Stripe webhook handler.
 * Phase 48: Contract & Payment
 * Phase 60: Installment payment support
 *
 * CRITICAL: Must use raw body for signature verification.
 * Per D-07: Handle invoice.payment_succeeded to update contract status.
 * Per P60-C03: Handle checkout.session.completed for installment payments.
 */
import { createFileRoute } from "@tanstack/react-router";
import { StripeService } from "@/server/features/invoices/services/StripeService";
import { InvoiceService } from "@/server/features/invoices/services/InvoiceService";
import { PaymentScheduleService } from "@/server/features/payments/services/PaymentScheduleService";
import { processWebhookIdempotently } from "@/server/lib/webhook-utils";
import { createLogger } from "@/server/lib/logger";
import type Stripe from "stripe";

const log = createLogger({ module: "stripe-webhook" });

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const signature = request.headers.get("stripe-signature");

        if (!signature) {
          log.warn("Missing stripe-signature header");
          return new Response("Missing signature", { status: 400 });
        }

        try {
          // Get raw body for signature verification
          // CRITICAL: Do not parse as JSON before verification
          const rawBody = Buffer.from(await request.arrayBuffer());

          // Verify signature
          const event = StripeService.verifyWebhook(rawBody, signature);

          log.info("Stripe webhook received", { type: event.type, id: event.id });

          // Process idempotently
          await processWebhookIdempotently(
            event.id,
            event.type,
            "stripe",
            async () => {
              switch (event.type) {
                case "checkout.session.completed": {
                  // P60-C03: Handle installment payments via checkout sessions
                  const session = event.data.object as Stripe.Checkout.Session;
                  const { installmentId, invoiceId } = session.metadata || {};

                  if (installmentId) {
                    // Handle installment payment
                    const paymentIntentId = typeof session.payment_intent === "string"
                      ? session.payment_intent
                      : (session.payment_intent as Stripe.PaymentIntent)?.id || "";

                    try {
                      await PaymentScheduleService.recordPayment(
                        installmentId,
                        "stripe",
                        paymentIntentId
                      );
                      log.info("Installment payment recorded", {
                        installmentId,
                        invoiceId,
                        paymentIntentId,
                      });
                    } catch (error) {
                      // Log but don't fail - may be duplicate webhook
                      log.warn("Failed to record installment payment", {
                        installmentId,
                        error: error instanceof Error ? error.message : String(error),
                      });
                    }
                  } else if (invoiceId) {
                    // Handle full invoice payment via checkout
                    const paymentIntentId = typeof session.payment_intent === "string"
                      ? session.payment_intent
                      : (session.payment_intent as Stripe.PaymentIntent)?.id || "";

                    await InvoiceService.handlePaymentSuccess(
                      invoiceId,
                      paymentIntentId
                    );
                    log.info("Invoice payment via checkout recorded", {
                      invoiceId,
                      paymentIntentId,
                    });
                  }
                  break;
                }

                case "invoice.payment_succeeded": {
                  const invoice = event.data.object as any;
                  const paymentIntentId = typeof invoice.payment_intent === "string"
                    ? invoice.payment_intent
                    : invoice.payment_intent?.id || "";
                  await InvoiceService.handlePaymentSuccess(
                    invoice.id,
                    paymentIntentId
                  );
                  break;
                }

                case "invoice.payment_failed": {
                  const invoice = event.data.object as Stripe.Invoice;
                  log.warn("Payment failed", {
                    stripeInvoiceId: invoice.id,
                    customerId: invoice.customer,
                  });
                  // Could update invoice status to "overdue" or send notification
                  break;
                }

                case "invoice.finalized": {
                  log.info("Invoice finalized", {
                    stripeInvoiceId: (event.data.object as Stripe.Invoice).id,
                  });
                  break;
                }

                default:
                  log.debug("Unhandled event type", { type: event.type });
              }
            }
          );

          // Return 200 immediately to acknowledge receipt
          return new Response("OK", { status: 200 });
        } catch (error) {
          log.error("Stripe webhook error", error instanceof Error ? error : new Error(String(error)));

          // Return 400 for signature errors (Stripe will not retry)
          // Return 500 for processing errors (Stripe will retry)
          const status = String(error).includes("signature") ? 400 : 500;
          return new Response("Error", { status });
        }
      },
    },
  },
});
