/**
 * Public API for invoice payment.
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * GET /api/invoices/:id/pay
 * Returns invoice details and available payment methods for checkout.
 * PUBLIC endpoint - no authentication required (clients access via shared link).
 *
 * POST /api/invoices/:id/pay
 * Creates a payment session with the selected provider.
 */
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { WorkspacePaymentSettingsRepository } from "@/server/features/payments/repositories/WorkspacePaymentSettingsRepository";
import { PaymentProviderFactory } from "@/server/features/payments/PaymentProviderFactory";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "api/invoices/pay" });

const createSessionSchema = z.object({
  provider: z.enum(["stripe", "revolut"]),
});

export const Route = createFileRoute("/api/invoices/$id/pay")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        try {
          const invoice = await InvoiceRepository.getInvoiceById(params.id);

          if (!invoice) {
            return Response.json(
              { success: false, error: "Invoice not found" },
              { status: 404 }
            );
          }

          if (invoice.status !== "sent") {
            return Response.json(
              { success: false, error: "Invoice is not available for payment" },
              { status: 400 }
            );
          }

          const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
            invoice.workspaceId
          );

          const availableProviders: string[] = [];
          let primaryProvider = "stripe";
          let allowClientChoice = false;
          let revolutPublicKey: string | undefined;

          if (settings) {
            if (settings.stripeEnabled) {
              availableProviders.push("stripe");
            }
            if (settings.revolutEnabled && settings.revolutPublicKey) {
              availableProviders.push("revolut");
              revolutPublicKey = settings.revolutPublicKey;
            }
            primaryProvider = settings.primaryProvider;
            allowClientChoice = settings.allowClientChoice;
          } else {
            availableProviders.push("stripe");
          }

          return Response.json({
            success: true,
            data: {
              invoice: {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                totalCents: invoice.totalCents,
                currency: invoice.currency || "EUR",
                dueAt: invoice.dueAt,
                lineItems: invoice.lineItems,
              },
              payment: {
                availableProviders,
                primaryProvider,
                allowClientChoice,
                revolutPublicKey,
                existingCheckoutUrl:
                  invoice.stripePaymentUrl || invoice.revolutCheckoutUrl,
                existingProvider: invoice.paymentProvider,
              },
            },
          });
        } catch (error) {
          log.error("Failed to fetch invoice payment details", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to load invoice" },
            { status: 500 }
          );
        }
      },

      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const body = await request.json();
          const parsed = createSessionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: "Invalid provider" },
              { status: 400 }
            );
          }

          const { provider } = parsed.data;

          const invoice = await InvoiceRepository.getInvoiceById(params.id);

          if (!invoice) {
            return Response.json(
              { success: false, error: "Invoice not found" },
              { status: 404 }
            );
          }

          if (invoice.status !== "sent") {
            return Response.json(
              { success: false, error: "Invoice is not available for payment" },
              { status: 400 }
            );
          }

          const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
            invoice.workspaceId
          );

          if (!settings) {
            return Response.json(
              { success: false, error: "Payment not configured" },
              { status: 400 }
            );
          }

          if (provider === "stripe" && !settings.stripeEnabled) {
            return Response.json(
              { success: false, error: "Stripe not available" },
              { status: 400 }
            );
          }

          if (provider === "revolut" && !settings.revolutEnabled) {
            return Response.json(
              { success: false, error: "Revolut not available" },
              { status: 400 }
            );
          }

          const paymentProvider = await PaymentProviderFactory.getProvider(
            invoice.workspaceId,
            provider
          );

          const protocol = request.headers.get("x-forwarded-proto") || "https";
          const host = request.headers.get("host") || "localhost:3000";
          const baseUrl = `${protocol}://${host}`;

          const session = await paymentProvider.createSession({
            invoiceId: invoice.id,
            amountCents: invoice.totalCents,
            currency: invoice.currency || "EUR",
            description: `Invoice ${invoice.invoiceNumber}`,
            customerEmail: undefined,
            metadata: {
              workspaceId: invoice.workspaceId,
              invoiceNumber: invoice.invoiceNumber,
            },
            successUrl: `${baseUrl}/invoices/${invoice.id}/success`,
            cancelUrl: `${baseUrl}/invoices/${invoice.id}/pay`,
          });

          if (provider === "revolut") {
            await InvoiceRepository.updateInvoice(invoice.id, {
              paymentProvider: "revolut",
              revolutOrderId: session.id,
              revolutCheckoutUrl: session.checkoutUrl,
            });
          } else {
            await InvoiceRepository.updateInvoice(invoice.id, {
              paymentProvider: "stripe",
              stripePaymentIntentId: session.id,
              stripePaymentUrl: session.checkoutUrl,
            });
          }

          return Response.json({
            success: true,
            data: {
              sessionId: session.id,
              checkoutUrl: session.checkoutUrl,
              token: session.token,
              publicKey: provider === "revolut" ? settings.revolutPublicKey : undefined,
            },
          });
        } catch (error) {
          log.error("Failed to create payment session", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to create payment session" },
            { status: 500 }
          );
        }
      },
    },
  },
});
