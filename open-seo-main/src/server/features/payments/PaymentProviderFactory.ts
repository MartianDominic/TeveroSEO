/**
 * Payment Provider Factory
 * Phase 54-01: Multi-Provider Payments
 *
 * Factory pattern for creating payment provider instances.
 * Handles credential decryption and provider selection.
 */
import type {
  PaymentProvider,
  PaymentProviderType,
  GetProviderOptions,
  ProviderCredentials,
} from "./types";
import { PaymentProviderNotConfiguredError } from "./types";
import { WorkspacePaymentSettingsRepository } from "./repositories/WorkspacePaymentSettingsRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "PaymentProviderFactory" });

/**
 * Cache for provider instances.
 * Key format: `${workspaceId}:${providerType}`
 *
 * Note: Providers are cached per workspace because each workspace
 * may have different credentials configured.
 */
const providerCache = new Map<string, PaymentProvider>();

/**
 * Clear the provider cache for a workspace.
 * Call this when workspace credentials are updated.
 *
 * @param workspaceId - The workspace to clear cache for
 */
export function clearProviderCache(workspaceId: string): void {
  for (const key of providerCache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) {
      providerCache.delete(key);
    }
  }
  log.debug("Cleared provider cache for workspace", { workspaceId });
}

/**
 * Clear the entire provider cache.
 * Useful for testing or when global config changes.
 */
export function clearAllProviderCache(): void {
  providerCache.clear();
  log.debug("Cleared all provider cache");
}

/**
 * Get a payment provider for a workspace.
 *
 * Provider selection logic:
 * 1. If preferredProvider specified, use it if enabled
 * 2. Otherwise, use workspace's defaultProvider
 * 3. If neither configured, fall back to Stripe with env vars
 *
 * @param options - Provider options (workspaceId, preferredProvider)
 * @returns PaymentProvider instance
 * @throws PaymentProviderNotConfiguredError if provider not enabled
 */
export async function getProvider(
  options: GetProviderOptions
): Promise<PaymentProvider> {
  const { workspaceId, preferredProvider } = options;

  // Get workspace settings
  const settings =
    await WorkspacePaymentSettingsRepository.getByWorkspaceId(workspaceId);

  // Determine which provider to use
  let providerType: PaymentProviderType;

  if (preferredProvider) {
    // Check if preferred provider is enabled
    const isEnabled = settings
      ? preferredProvider === "stripe"
        ? settings.stripeEnabled && !!settings.stripeSecretKey
        : settings.revolutEnabled && !!settings.revolutApiKey
      : false;

    if (!isEnabled) {
      // Fall back to default if preferred not available
      log.warn("Preferred provider not enabled, falling back", {
        workspaceId,
        preferred: preferredProvider,
        fallback: settings?.defaultProvider ?? "stripe",
      });
      providerType = settings?.defaultProvider ?? "stripe";
    } else {
      providerType = preferredProvider;
    }
  } else {
    providerType = settings?.defaultProvider ?? "stripe";
  }

  // Check cache
  const cacheKey = `${workspaceId}:${providerType}`;
  const cached = providerCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Build credentials
  const credentials: ProviderCredentials = {};

  if (providerType === "stripe") {
    if (settings?.stripeEnabled && settings.stripeSecretKey) {
      credentials.stripeSecretKey = settings.stripeSecretKey;
      credentials.stripeWebhookSecret = settings.stripeWebhookSecret ?? undefined;
    } else {
      // Fall back to environment variables for backwards compatibility
      const envSecretKey = process.env.STRIPE_SECRET_KEY;
      const envWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!envSecretKey) {
        throw new PaymentProviderNotConfiguredError("stripe", workspaceId);
      }

      credentials.stripeSecretKey = envSecretKey;
      credentials.stripeWebhookSecret = envWebhookSecret;
      log.debug("Using Stripe credentials from environment", { workspaceId });
    }
  } else if (providerType === "revolut") {
    if (!settings?.revolutEnabled || !settings.revolutApiKey) {
      throw new PaymentProviderNotConfiguredError("revolut", workspaceId);
    }

    credentials.revolutApiKey = settings.revolutApiKey;
    credentials.revolutWebhookSecret = settings.revolutWebhookSecret ?? undefined;
    credentials.revolutMerchantId = settings.revolutMerchantId ?? undefined;
  }

  // Create provider instance
  const provider = await createProvider(providerType, credentials);

  // Cache the provider
  providerCache.set(cacheKey, provider);

  log.info("Created payment provider", { workspaceId, providerType });

  return provider;
}

/**
 * Create a provider instance.
 * Dynamically imports the provider module to avoid loading unused providers.
 */
async function createProvider(
  providerType: PaymentProviderType,
  credentials: ProviderCredentials
): Promise<PaymentProvider> {
  if (providerType === "stripe") {
    const { StripeProvider } = await import("./providers/StripeProvider");
    return new StripeProvider(credentials);
  }

  if (providerType === "revolut") {
    const { RevolutProvider } = await import("./providers/RevolutProvider");
    return new RevolutProvider(credentials);
  }

  throw new Error(`Unknown provider type: ${providerType}`);
}

/**
 * Get available providers for a workspace.
 * Returns list of enabled providers.
 *
 * @param workspaceId - The workspace to check
 * @returns Array of enabled provider types
 */
export async function getAvailableProviders(
  workspaceId: string
): Promise<PaymentProviderType[]> {
  const settings =
    await WorkspacePaymentSettingsRepository.getByWorkspaceId(workspaceId);

  const available: PaymentProviderType[] = [];

  // Check Stripe
  if (settings?.stripeEnabled && settings.stripeSecretKey) {
    available.push("stripe");
  } else if (process.env.STRIPE_SECRET_KEY) {
    // Fallback to env vars
    available.push("stripe");
  }

  // Check Revolut
  if (settings?.revolutEnabled && settings.revolutApiKey) {
    available.push("revolut");
  }

  return available;
}

export const PaymentProviderFactory = {
  getProvider,
  getAvailableProviders,
  clearProviderCache,
  clearAllProviderCache,
};
