/**
 * Workspace Payment Settings Repository
 * Phase 54-01: Multi-Provider Payments
 *
 * Data access layer for workspace payment settings.
 * Handles encrypted credential storage/retrieval.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  workspacePaymentSettings,
  type WorkspacePaymentSettingsSelect,
  type WorkspacePaymentSettingsInsert,
  type PaymentProvider as PaymentProviderType,
} from "@/db/workspace-payment-settings-schema";
import {
  encryptCredentialSafe,
  decryptCredentialSafe,
} from "@/server/lib/encryption";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "WorkspacePaymentSettingsRepository" });

/**
 * Settings with decrypted credentials.
 * Used internally for provider initialization.
 */
export interface DecryptedPaymentSettings {
  id: string;
  workspaceId: string;
  defaultProvider: PaymentProviderType;
  stripeEnabled: boolean;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  stripePublishableKey: string | null;
  revolutEnabled: boolean;
  revolutApiKey: string | null;
  revolutWebhookSecret: string | null;
  revolutMerchantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating/updating payment settings.
 * Credentials will be encrypted before storage.
 */
export interface UpsertPaymentSettingsInput {
  workspaceId: string;
  defaultProvider?: PaymentProviderType;
  stripeEnabled?: boolean;
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
  stripePublishableKey?: string | null;
  revolutEnabled?: boolean;
  revolutApiKey?: string | null;
  revolutWebhookSecret?: string | null;
  revolutMerchantId?: string | null;
}

/**
 * Decrypt sensitive fields from a database row.
 */
function decryptSettings(
  row: WorkspacePaymentSettingsSelect
): DecryptedPaymentSettings {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    defaultProvider: row.defaultProvider as PaymentProviderType,
    stripeEnabled: row.stripeEnabled,
    stripeSecretKey: decryptCredentialSafe(row.stripeSecretKey),
    stripeWebhookSecret: decryptCredentialSafe(row.stripeWebhookSecret),
    stripePublishableKey: row.stripePublishableKey, // Not encrypted
    revolutEnabled: row.revolutEnabled,
    revolutApiKey: decryptCredentialSafe(row.revolutApiKey),
    revolutWebhookSecret: decryptCredentialSafe(row.revolutWebhookSecret),
    revolutMerchantId: row.revolutMerchantId, // Not encrypted
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get payment settings by workspace ID.
 *
 * @param workspaceId - The workspace to get settings for
 * @returns Decrypted settings or null if not found
 */
export async function getByWorkspaceId(
  workspaceId: string
): Promise<DecryptedPaymentSettings | null> {
  const rows = await db
    .select()
    .from(workspacePaymentSettings)
    .where(eq(workspacePaymentSettings.workspaceId, workspaceId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return decryptSettings(rows[0]);
}

/**
 * Create or update payment settings for a workspace.
 * Credentials are encrypted before storage.
 *
 * @param input - Settings to create/update
 * @returns The created/updated settings (decrypted)
 */
export async function upsert(
  input: UpsertPaymentSettingsInput
): Promise<DecryptedPaymentSettings> {
  const existing = await getByWorkspaceId(input.workspaceId);

  const now = new Date();
  const id = existing?.id ?? crypto.randomUUID();

  const values: WorkspacePaymentSettingsInsert = {
    id,
    workspaceId: input.workspaceId,
    defaultProvider:
      input.defaultProvider ?? existing?.defaultProvider ?? "stripe",
    stripeEnabled: input.stripeEnabled ?? existing?.stripeEnabled ?? false,
    stripeSecretKey:
      input.stripeSecretKey !== undefined
        ? encryptCredentialSafe(input.stripeSecretKey)
        : existing
          ? encryptCredentialSafe(existing.stripeSecretKey)
          : null,
    stripeWebhookSecret:
      input.stripeWebhookSecret !== undefined
        ? encryptCredentialSafe(input.stripeWebhookSecret)
        : existing
          ? encryptCredentialSafe(existing.stripeWebhookSecret)
          : null,
    stripePublishableKey:
      input.stripePublishableKey !== undefined
        ? input.stripePublishableKey
        : existing?.stripePublishableKey ?? null,
    revolutEnabled: input.revolutEnabled ?? existing?.revolutEnabled ?? false,
    revolutApiKey:
      input.revolutApiKey !== undefined
        ? encryptCredentialSafe(input.revolutApiKey)
        : existing
          ? encryptCredentialSafe(existing.revolutApiKey)
          : null,
    revolutWebhookSecret:
      input.revolutWebhookSecret !== undefined
        ? encryptCredentialSafe(input.revolutWebhookSecret)
        : existing
          ? encryptCredentialSafe(existing.revolutWebhookSecret)
          : null,
    revolutMerchantId:
      input.revolutMerchantId !== undefined
        ? input.revolutMerchantId
        : existing?.revolutMerchantId ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(workspacePaymentSettings)
      .set(values)
      .where(eq(workspacePaymentSettings.id, id));
    log.info("Updated workspace payment settings", {
      workspaceId: input.workspaceId,
    });
  } else {
    await db.insert(workspacePaymentSettings).values(values);
    log.info("Created workspace payment settings", {
      workspaceId: input.workspaceId,
    });
  }

  // Return the updated settings
  const result = await getByWorkspaceId(input.workspaceId);
  if (!result) {
    throw new Error("Failed to retrieve settings after upsert");
  }

  return result;
}

/**
 * Delete payment settings for a workspace.
 *
 * @param workspaceId - The workspace to delete settings for
 * @returns true if deleted, false if not found
 */
export async function deleteByWorkspaceId(workspaceId: string): Promise<boolean> {
  const result = await db
    .delete(workspacePaymentSettings)
    .where(eq(workspacePaymentSettings.workspaceId, workspaceId));

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    log.info("Deleted workspace payment settings", { workspaceId });
  }

  return deleted;
}

/**
 * Check if a provider is enabled for a workspace.
 *
 * @param workspaceId - The workspace to check
 * @param provider - The provider to check
 * @returns true if the provider is enabled
 */
export async function isProviderEnabled(
  workspaceId: string,
  provider: PaymentProviderType
): Promise<boolean> {
  const settings = await getByWorkspaceId(workspaceId);
  if (!settings) {
    return false;
  }

  if (provider === "stripe") {
    return settings.stripeEnabled && !!settings.stripeSecretKey;
  }

  if (provider === "revolut") {
    return settings.revolutEnabled && !!settings.revolutApiKey;
  }

  return false;
}

export const WorkspacePaymentSettingsRepository = {
  getByWorkspaceId,
  upsert,
  deleteByWorkspaceId,
  isProviderEnabled,
};
