/**
 * Payment Settings API Routes
 * Phase 54-04: Payment Settings UI + Client Choice
 *
 * GET /api/settings/payments - Get workspace payment settings
 * PUT /api/settings/payments - Update settings
 * POST /api/settings/payments/connect/stripe - Initiate Stripe Connect
 * POST /api/settings/payments/connect/revolut - Store Revolut credentials
 * DELETE /api/settings/payments/disconnect/:provider - Remove credentials
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { WorkspacePaymentSettingsRepository } from "@/server/features/payments/repositories/WorkspacePaymentSettingsRepository";
import { PaymentProviderFactory } from "@/server/features/payments/PaymentProviderFactory";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import type { PaymentProvider as PaymentProviderType } from "@/db/workspace-payment-settings-schema";

const log = createLogger({ module: "PaymentSettingsAPI" });

// Validation schemas
const updateSettingsSchema = z.object({
  defaultProvider: z.enum(["stripe", "revolut"]).optional(),
  allowClientChoice: z.boolean().optional(),
  paymentTermsDays: z.number().int().min(0).max(90).optional(),
  stripeEnabled: z.boolean().optional(),
  revolutEnabled: z.boolean().optional(),
});

const revolutConnectSchema = z.object({
  secretKey: z.string().min(1, "Secret key is required"),
  publicKey: z.string().min(1, "Public key is required"),
  merchantId: z.string().min(1, "Merchant ID is required"),
  webhookSecret: z.string().min(1, "Webhook secret is required"),
});

const stripeConnectSchema = z.object({
  secretKey: z.string().min(1, "Secret key is required"),
  publishableKey: z.string().min(1, "Publishable key is required"),
  webhookSecret: z.string().min(1, "Webhook secret is required"),
});

/**
 * Public response format - excludes sensitive credentials
 */
interface PaymentSettingsResponse {
  defaultProvider: PaymentProviderType;
  allowClientChoice: boolean;
  paymentTermsDays: number;
  stripe: {
    enabled: boolean;
    connected: boolean;
    publishableKey: string | null;
  };
  revolut: {
    enabled: boolean;
    connected: boolean;
    merchantId: string | null;
  };
}

/**
 * Format settings for API response (exclude secrets)
 */
function formatSettingsResponse(
  settings: Awaited<ReturnType<typeof WorkspacePaymentSettingsRepository.getByWorkspaceId>>
): PaymentSettingsResponse {
  if (!settings) {
    return {
      defaultProvider: "stripe",
      allowClientChoice: false,
      paymentTermsDays: 14,
      stripe: { enabled: false, connected: false, publishableKey: null },
      revolut: { enabled: false, connected: false, merchantId: null },
    };
  }

  return {
    defaultProvider: settings.defaultProvider,
    allowClientChoice: false, // TODO: Add to schema
    paymentTermsDays: 14, // TODO: Add to schema
    stripe: {
      enabled: settings.stripeEnabled,
      connected: !!settings.stripeSecretKey,
      publishableKey: settings.stripePublishableKey,
    },
    revolut: {
      enabled: settings.revolutEnabled,
      connected: !!settings.revolutApiKey,
      merchantId: settings.revolutMerchantId,
    },
  };
}

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/settings/payments")({
  server: {
    handlers: {
      /**
       * GET /api/settings/payments
       * Get workspace payment settings
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
            auth.organizationId
          );

          return Response.json({
            success: true,
            data: formatSettingsResponse(settings),
          });
        } catch (error) {
          log.error("Failed to get payment settings", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to get payment settings" },
            { status: 500 }
          );
        }
      },

      /**
       * PUT /api/settings/payments
       * Update workspace payment settings
       */
      PUT: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          const body = await request.json();
          const parsed = updateSettingsSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: "Validation error", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const { defaultProvider, stripeEnabled, revolutEnabled } = parsed.data;

          // Validate default provider is enabled
          if (defaultProvider) {
            const current = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
              auth.organizationId
            );

            if (defaultProvider === "stripe" && !current?.stripeSecretKey && !stripeEnabled) {
              return Response.json(
                { success: false, error: "Cannot set Stripe as default - not connected" },
                { status: 400 }
              );
            }
            if (defaultProvider === "revolut" && !current?.revolutApiKey && !revolutEnabled) {
              return Response.json(
                { success: false, error: "Cannot set Revolut as default - not connected" },
                { status: 400 }
              );
            }
          }

          const updated = await WorkspacePaymentSettingsRepository.upsert({
            workspaceId: auth.organizationId,
            defaultProvider,
            stripeEnabled,
            revolutEnabled,
          });

          // Clear provider cache on settings change
          PaymentProviderFactory.clearProviderCache(auth.organizationId);

          log.info("Updated payment settings", { workspaceId: auth.organizationId });

          return Response.json({
            success: true,
            data: formatSettingsResponse(updated),
          });
        } catch (error) {
          log.error("Failed to update payment settings", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to update payment settings" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/settings/payments
       * Connect Stripe (via POST with action=connect-stripe)
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          const body = await request.json();
          const action = (body as Record<string, unknown>).action;

          if (action === "connect-stripe") {
            const parsed = stripeConnectSchema.safeParse(body);

            if (!parsed.success) {
              return Response.json(
                { success: false, error: "Validation error", details: parsed.error.issues },
                { status: 400 }
              );
            }

            const { secretKey, publishableKey, webhookSecret } = parsed.data;

            // Verify credentials by attempting a simple API call
            const Stripe = (await import("stripe")).default;
            // @ts-expect-error - Stripe API version
            const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

            try {
              await stripe.balance.retrieve();
            } catch {
              return Response.json(
                { success: false, error: "Invalid Stripe credentials" },
                { status: 400 }
              );
            }

            const updated = await WorkspacePaymentSettingsRepository.upsert({
              workspaceId: auth.organizationId,
              stripeEnabled: true,
              stripeSecretKey: secretKey,
              stripePublishableKey: publishableKey,
              stripeWebhookSecret: webhookSecret,
            });

            PaymentProviderFactory.clearProviderCache(auth.organizationId);

            log.info("Connected Stripe", { workspaceId: auth.organizationId });

            return Response.json({
              success: true,
              data: formatSettingsResponse(updated),
            });
          }

          if (action === "connect-revolut") {
            const parsed = revolutConnectSchema.safeParse(body);

            if (!parsed.success) {
              return Response.json(
                { success: false, error: "Validation error", details: parsed.error.issues },
                { status: 400 }
              );
            }

            const { secretKey, merchantId, webhookSecret } = parsed.data;

            // Test Revolut credentials by calling the API
            const testUrl = secretKey.startsWith("sk_sandbox")
              ? "https://sandbox-merchant.revolut.com/api/1.0/orders"
              : "https://merchant.revolut.com/api/1.0/orders";

            const testResponse = await fetch(`${testUrl}?limit=1`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
                "Revolut-Api-Version": "2024-09-01",
              },
            });

            if (!testResponse.ok && testResponse.status !== 404) {
              return Response.json(
                { success: false, error: "Invalid Revolut credentials" },
                { status: 400 }
              );
            }

            const updated = await WorkspacePaymentSettingsRepository.upsert({
              workspaceId: auth.organizationId,
              revolutEnabled: true,
              revolutApiKey: secretKey,
              revolutMerchantId: merchantId,
              revolutWebhookSecret: webhookSecret,
            });

            PaymentProviderFactory.clearProviderCache(auth.organizationId);

            log.info("Connected Revolut", { workspaceId: auth.organizationId });

            return Response.json({
              success: true,
              data: formatSettingsResponse(updated),
            });
          }

          return Response.json(
            { success: false, error: "Invalid action" },
            { status: 400 }
          );
        } catch (error) {
          log.error("Failed to connect payment provider", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to connect payment provider" },
            { status: 500 }
          );
        }
      },

      /**
       * DELETE /api/settings/payments
       * Disconnect a payment provider (via DELETE with provider query param)
       */
      DELETE: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          const url = new URL(request.url);
          const provider = url.searchParams.get("provider");

          if (provider !== "stripe" && provider !== "revolut") {
            return Response.json(
              { success: false, error: "Invalid provider" },
              { status: 400 }
            );
          }

          const current = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
            auth.organizationId
          );

          if (!current) {
            return Response.json(
              { success: false, error: "No payment settings found" },
              { status: 404 }
            );
          }

          // Prevent disconnecting the default provider if it's the only one
          if (current.defaultProvider === provider) {
            const otherProvider = provider === "stripe" ? "revolut" : "stripe";
            const otherEnabled =
              otherProvider === "stripe" ? current.stripeEnabled : current.revolutEnabled;

            if (!otherEnabled) {
              return Response.json(
                { success: false, error: "Cannot disconnect the only connected provider" },
                { status: 400 }
              );
            }
          }

          const updateData =
            provider === "stripe"
              ? {
                  workspaceId: auth.organizationId,
                  stripeEnabled: false,
                  stripeSecretKey: null,
                  stripeWebhookSecret: null,
                  stripePublishableKey: null,
                  defaultProvider:
                    current.defaultProvider === "stripe" ? ("revolut" as const) : current.defaultProvider,
                }
              : {
                  workspaceId: auth.organizationId,
                  revolutEnabled: false,
                  revolutApiKey: null,
                  revolutWebhookSecret: null,
                  revolutMerchantId: null,
                  defaultProvider:
                    current.defaultProvider === "revolut" ? ("stripe" as const) : current.defaultProvider,
                };

          const updated = await WorkspacePaymentSettingsRepository.upsert(updateData);

          PaymentProviderFactory.clearProviderCache(auth.organizationId);

          log.info("Disconnected provider", { workspaceId: auth.organizationId, provider });

          return Response.json({
            success: true,
            data: formatSettingsResponse(updated),
          });
        } catch (error) {
          log.error("Failed to disconnect provider", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to disconnect provider" },
            { status: 500 }
          );
        }
      },
    },
  },
});
