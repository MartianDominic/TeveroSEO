/**
 * Public API for invoice payment.
 * Phase 54-05: Checkout Widget + E2E Testing
 * Phase 60-02: Payment Plan Selector UI + Checkout Flow
 *
 * GET /api/invoices/:id/pay
 * Returns invoice details and available payment methods for checkout.
 * Includes split payment configuration when enabled.
 * PUBLIC endpoint - no authentication required (clients access via shared link).
 *
 * POST /api/invoices/:id/pay
 * Creates a payment session with the selected provider.
 * Supports split payments when planType is provided.
 */
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { WorkspacePaymentSettingsRepository } from "@/server/features/payments/repositories/WorkspacePaymentSettingsRepository";
import { PaymentProviderFactory } from "@/server/features/payments/PaymentProviderFactory";
import { createLogger } from "@/server/lib/logger";
import { z } from "zod";
import type { PlanType } from "@/lib/format-currency";

const log = createLogger({ module: "api/invoices/pay" });

/**
 * Default available plans when workspace settings not configured.
 */
const DEFAULT_AVAILABLE_PLANS: PlanType[] = ["full", "split_2", "split_3"];

const createSessionSchema = z.object({
  provider: z.enum(["stripe", "revolut"]),
  planType: z.enum(["full", "split_2", "split_3"]).optional(),
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

          if (settings) {
            if (settings.stripeEnabled) {
              availableProviders.push("stripe");
            }
            if (settings.revolutEnabled) {
              availableProviders.push("revolut");
            }
            primaryProvider = settings.defaultProvider;
          } else {
            availableProviders.push("stripe");
          }

          // Split payment configuration
          // TODO: Once 60-01 adds splitPaymentsEnabled and availablePlans to settings,
          // read from settings. For now, enable split payments if any provider is configured.
          const splitPaymentsEnabled = availableProviders.length > 0;
          const availablePlans = DEFAULT_AVAILABLE_PLANS;
          const defaultPlan: PlanType = "full";

          // TODO: Once 60-01 creates PaymentScheduleService,
          // check if a schedule already exists for this invoice
          const existingSchedule = null;

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
                existingCheckoutUrl:
                  invoice.stripePaymentUrl || invoice.revolutCheckoutUrl,
                existingProvider: invoice.paymentProvider,
              },
              splitPayments: {
                enabled: splitPaymentsEnabled,
                availablePlans,
                defaultPlan,
                existingSchedule,
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
              { success: false, error: "Invalid provider or plan type" },
              { status: 400 }
            );
          }

          const { provider, planType } = parsed.data;

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

          // Get payment provider
          const paymentProvider = await PaymentProviderFactory.getProvider({
            workspaceId: invoice.workspaceId,
            preferredProvider: provider,
          });

          // Determine amount to charge
          // For split payments (planType !== 'full'), the schedule API should be
          // used to create the schedule first, which will create installment-specific
          // checkout sessions. This endpoint handles full payments or when no planType specified.
          let amountCents = invoice.totalCents;

          // TODO: Once 60-01 creates PaymentScheduleService, if planType is provided:
          // 1. Create schedule via PaymentScheduleService.createScheduleForInvoice
          // 2. Get first installment amount
          // 3. Use installment amount instead of full invoice amount
          if (planType && planType !== "full") {
            log.info("Split payment requested, redirecting to schedule API", {
              invoiceId: invoice.id,
              planType,
            });
            // For now, return error directing to use schedule API
            // Once 60-01 completes, this will integrate with PaymentScheduleService
            return Response.json(
              {
                success: false,
                error: "For split payments, use POST /api/invoices/:id/schedule first",
                redirectTo: `/api/invoices/${invoice.id}/schedule`,
              },
              { status: 400 }
            );
          }

          // Create payment session for full amount
          const session = await paymentProvider.createPaymentSession(invoice);

          // Update invoice with payment details
          if (provider === "revolut") {
            await InvoiceRepository.updateInvoiceStatusWithProvider(
              invoice.id,
              "sent", // Keep status as sent until payment completes
              "revolut",
              session.externalId,
              session.paymentUrl
            );
          } else {
            await InvoiceRepository.updateInvoiceStripeDetails(invoice.id, {
              stripePaymentIntentId: session.externalId,
              stripePaymentUrl: session.paymentUrl,
            });
          }

          return Response.json({
            success: true,
            data: {
              sessionId: session.externalId,
              checkoutUrl: session.paymentUrl,
              token: session.token,
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
