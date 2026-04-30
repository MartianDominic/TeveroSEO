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
import { createAPIFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { z } from "zod";
import { WorkspacePaymentSettingsRepository } from "@/server/features/payments/repositories/WorkspacePaymentSettingsRepository";
import { PaymentProviderFactory } from "@/server/features/payments/PaymentProviderFactory";
import { getAuthUser } from "@/server/lib/auth";
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

export const Route = createAPIFileRoute("/api/settings/payments")({
  /**
   * GET /api/settings/payments
   * Get workspace payment settings
   */
  GET: async ({ request }) => {
    const user = await getAuthUser(request);
    if (!user?.organizationId) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      const settings = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
        user.organizationId
      );

      return json({
        success: true,
        data: formatSettingsResponse(settings),
      });
    } catch (error) {
      log.error("Failed to get payment settings", { error, workspaceId: user.organizationId });
      return json({ success: false, error: "Failed to get payment settings" }, { status: 500 });
    }
  },

  /**
   * PUT /api/settings/payments
   * Update workspace payment settings
   */
  PUT: async ({ request }) => {
    const user = await getAuthUser(request);
    if (!user?.organizationId) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json();
      const parsed = updateSettingsSchema.safeParse(body);

      if (!parsed.success) {
        return json(
          { success: false, error: "Validation error", details: parsed.error.issues },
          { status: 400 }
        );
      }

      const { defaultProvider, stripeEnabled, revolutEnabled } = parsed.data;

      // Validate default provider is enabled
      if (defaultProvider) {
        const current = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
          user.organizationId
        );

        if (defaultProvider === "stripe" && !current?.stripeSecretKey && !stripeEnabled) {
          return json(
            { success: false, error: "Cannot set Stripe as default - not connected" },
            { status: 400 }
          );
        }
        if (defaultProvider === "revolut" && !current?.revolutApiKey && !revolutEnabled) {
          return json(
            { success: false, error: "Cannot set Revolut as default - not connected" },
            { status: 400 }
          );
        }
      }

      const updated = await WorkspacePaymentSettingsRepository.upsert({
        workspaceId: user.organizationId,
        defaultProvider,
        stripeEnabled,
        revolutEnabled,
      });

      // Clear provider cache on settings change
      PaymentProviderFactory.clearProviderCache(user.organizationId);

      log.info("Updated payment settings", { workspaceId: user.organizationId });

      return json({
        success: true,
        data: formatSettingsResponse(updated),
      });
    } catch (error) {
      log.error("Failed to update payment settings", { error, workspaceId: user.organizationId });
      return json({ success: false, error: "Failed to update payment settings" }, { status: 500 });
    }
  },
});

/**
 * POST /api/settings/payments/connect/stripe
 * Store Stripe credentials
 */
export const stripeConnectRoute = createAPIFileRoute("/api/settings/payments/connect/stripe")({
  POST: async ({ request }) => {
    const user = await getAuthUser(request);
    if (!user?.organizationId) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json();
      const parsed = stripeConnectSchema.safeParse(body);

      if (!parsed.success) {
        return json(
          { success: false, error: "Validation error", details: parsed.error.issues },
          { status: 400 }
        );
      }

      const { secretKey, publishableKey, webhookSecret } = parsed.data;

      // Verify credentials by attempting a simple API call
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

      try {
        await stripe.balance.retrieve();
      } catch {
        return json(
          { success: false, error: "Invalid Stripe credentials" },
          { status: 400 }
        );
      }

      const updated = await WorkspacePaymentSettingsRepository.upsert({
        workspaceId: user.organizationId,
        stripeEnabled: true,
        stripeSecretKey: secretKey,
        stripePublishableKey: publishableKey,
        stripeWebhookSecret: webhookSecret,
      });

      PaymentProviderFactory.clearProviderCache(user.organizationId);

      log.info("Connected Stripe", { workspaceId: user.organizationId });

      return json({
        success: true,
        data: formatSettingsResponse(updated),
      });
    } catch (error) {
      log.error("Failed to connect Stripe", { error, workspaceId: user.organizationId });
      return json({ success: false, error: "Failed to connect Stripe" }, { status: 500 });
    }
  },
});

/**
 * POST /api/settings/payments/connect/revolut
 * Store Revolut credentials
 */
export const revolutConnectRoute = createAPIFileRoute("/api/settings/payments/connect/revolut")({
  POST: async ({ request }) => {
    const user = await getAuthUser(request);
    if (!user?.organizationId) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json();
      const parsed = revolutConnectSchema.safeParse(body);

      if (!parsed.success) {
        return json(
          { success: false, error: "Validation error", details: parsed.error.issues },
          { status: 400 }
        );
      }

      const { secretKey, publicKey, merchantId, webhookSecret } = parsed.data;

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
        return json(
          { success: false, error: "Invalid Revolut credentials" },
          { status: 400 }
        );
      }

      const updated = await WorkspacePaymentSettingsRepository.upsert({
        workspaceId: user.organizationId,
        revolutEnabled: true,
        revolutApiKey: secretKey,
        revolutMerchantId: merchantId,
        revolutWebhookSecret: webhookSecret,
      });

      PaymentProviderFactory.clearProviderCache(user.organizationId);

      log.info("Connected Revolut", { workspaceId: user.organizationId });

      return json({
        success: true,
        data: formatSettingsResponse(updated),
      });
    } catch (error) {
      log.error("Failed to connect Revolut", { error, workspaceId: user.organizationId });
      return json({ success: false, error: "Failed to connect Revolut" }, { status: 500 });
    }
  },
});

/**
 * DELETE /api/settings/payments/disconnect/:provider
 * Disconnect a payment provider
 */
export const disconnectRoute = createAPIFileRoute("/api/settings/payments/disconnect/$provider")({
  DELETE: async ({ request, params }) => {
    const user = await getAuthUser(request);
    if (!user?.organizationId) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = params;

    if (provider !== "stripe" && provider !== "revolut") {
      return json({ success: false, error: "Invalid provider" }, { status: 400 });
    }

    try {
      const current = await WorkspacePaymentSettingsRepository.getByWorkspaceId(
        user.organizationId
      );

      if (!current) {
        return json({ success: false, error: "No payment settings found" }, { status: 404 });
      }

      // Prevent disconnecting the default provider if it's the only one
      if (current.defaultProvider === provider) {
        const otherProvider = provider === "stripe" ? "revolut" : "stripe";
        const otherEnabled =
          otherProvider === "stripe" ? current.stripeEnabled : current.revolutEnabled;

        if (!otherEnabled) {
          return json(
            { success: false, error: "Cannot disconnect the only connected provider" },
            { status: 400 }
          );
        }
      }

      const updateData =
        provider === "stripe"
          ? {
              workspaceId: user.organizationId,
              stripeEnabled: false,
              stripeSecretKey: null,
              stripeWebhookSecret: null,
              stripePublishableKey: null,
              defaultProvider:
                current.defaultProvider === "stripe" ? ("revolut" as const) : current.defaultProvider,
            }
          : {
              workspaceId: user.organizationId,
              revolutEnabled: false,
              revolutApiKey: null,
              revolutWebhookSecret: null,
              revolutMerchantId: null,
              defaultProvider:
                current.defaultProvider === "revolut" ? ("stripe" as const) : current.defaultProvider,
            };

      const updated = await WorkspacePaymentSettingsRepository.upsert(updateData);

      PaymentProviderFactory.clearProviderCache(user.organizationId);

      log.info("Disconnected provider", { workspaceId: user.organizationId, provider });

      return json({
        success: true,
        data: formatSettingsResponse(updated),
      });
    } catch (error) {
      log.error("Failed to disconnect provider", {
        error,
        workspaceId: user.organizationId,
        provider,
      });
      return json({ success: false, error: "Failed to disconnect provider" }, { status: 500 });
    }
  },
});
