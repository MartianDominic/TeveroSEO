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
 *
 * HIGH-API-02 FIX: Idempotency key validation to prevent duplicate payment sessions.
 */
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceRepository } from "@/server/features/contracts/repositories/InvoiceRepository";
import { WorkspacePaymentSettingsRepository } from "@/server/features/payments/repositories/WorkspacePaymentSettingsRepository";
import { PaymentProviderFactory } from "@/server/features/payments/PaymentProviderFactory";
import { createLogger } from "@/server/lib/logger";
import { redis } from "@/server/lib/redis";
import { z } from "zod";

const log = createLogger({ module: "api/invoices/pay" });

/**
 * HIGH-API-02 FIX: Idempotency key validation schema.
 * Prevents duplicate payment sessions from being created.
 */
const IdempotencyKeySchema = z.string()
  .min(16)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Idempotency key must be alphanumeric with underscores/hyphens");

/**
 * Check if an idempotency key has been used and store the result.
 * Returns the cached response if the key was already used.
 */
async function checkIdempotencyKey(
  key: string,
  invoiceId: string
): Promise<{ alreadyUsed: boolean; cachedResponse?: unknown }> {
  const redisKey = `idempotency:invoice-pay:${invoiceId}:${key}`;

  try {
    const existing = await redis.get(redisKey);
    if (existing) {
      return { alreadyUsed: true, cachedResponse: JSON.parse(existing) };
    }
    return { alreadyUsed: false };
  } catch (error) {
    log.warn("Failed to check idempotency key, proceeding without check", { error });
    return { alreadyUsed: false };
  }
}

/**
 * Store the idempotency key with its response.
 * TTL: 24 hours to allow for retry within reasonable window.
 */
async function storeIdempotencyResult(
  key: string,
  invoiceId: string,
  response: unknown
): Promise<void> {
  const redisKey = `idempotency:invoice-pay:${invoiceId}:${key}`;
  const TTL_SECONDS = 24 * 60 * 60; // 24 hours

  try {
    await redis.set(redisKey, JSON.stringify(response), "EX", TTL_SECONDS);
  } catch (error) {
    log.warn("Failed to store idempotency result", { error });
  }
}

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
          const allowClientChoice = false; // TODO: Add to DecryptedPaymentSettings
          let revolutMerchantId: string | undefined;

          if (settings) {
            if (settings.stripeEnabled) {
              availableProviders.push("stripe");
            }
            if (settings.revolutEnabled && settings.revolutApiKey) {
              availableProviders.push("revolut");
              revolutMerchantId = settings.revolutMerchantId ?? undefined;
            }
            primaryProvider = settings.defaultProvider;
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
                revolutMerchantId,
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
          // HIGH-API-02 FIX: Check for idempotency key to prevent duplicate payment sessions
          const idempotencyKeyHeader = request.headers.get("Idempotency-Key") ?? request.headers.get("X-Idempotency-Key");
          let idempotencyKey: string | null = null;

          if (idempotencyKeyHeader) {
            const keyValidation = IdempotencyKeySchema.safeParse(idempotencyKeyHeader);
            if (!keyValidation.success) {
              return Response.json(
                { success: false, error: "Invalid Idempotency-Key format. Must be 16-128 alphanumeric characters." },
                { status: 400 }
              );
            }
            idempotencyKey = keyValidation.data;

            // Check if this idempotency key was already used for this invoice
            const idempotencyCheck = await checkIdempotencyKey(idempotencyKey, params.id);
            if (idempotencyCheck.alreadyUsed && idempotencyCheck.cachedResponse) {
              log.info("Returning cached response for idempotency key", {
                invoiceId: params.id,
                idempotencyKey,
              });
              return Response.json(idempotencyCheck.cachedResponse);
            }
          }

          const body = await request.json();
          const parsed = createSessionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: "Invalid provider", code: "VALIDATION_ERROR" },
              { status: 422 }
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

          const paymentProvider = await PaymentProviderFactory.getProvider({
            workspaceId: invoice.workspaceId,
            preferredProvider: provider,
          });

          // Create payment session using the provider's interface
          const session = await paymentProvider.createPaymentSession(invoice);

          if (provider === "revolut") {
            await InvoiceRepository.updateInvoiceStatusWithProvider(
              invoice.id,
              invoice.status as "draft" | "sent" | "paid" | "overdue" | "cancelled" | "refunded",
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

          const responseData = {
            success: true,
            data: {
              sessionId: session.externalId,
              checkoutUrl: session.paymentUrl,
              token: session.token,
              merchantId: provider === "revolut" ? settings.revolutMerchantId : undefined,
            },
          };

          // HIGH-API-02 FIX: Store the idempotency result for future duplicate requests
          if (idempotencyKey) {
            await storeIdempotencyResult(idempotencyKey, params.id, responseData);
          }

          return Response.json(responseData);
        } catch (error) {
          log.error("Failed to create payment session", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to create payment session", code: "INTERNAL_ERROR" },
            { status: 500 }
          );
        }
      },
    },
  },
});
