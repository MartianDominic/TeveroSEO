/**
 * Workspace Payment Settings Schema
 * Phase 54-01: Multi-Provider Payments
 *
 * Stores encrypted payment provider credentials per workspace.
 * Agencies configure their preferred payment providers here.
 *
 * Security:
 * - All credentials encrypted with AES-256-GCM via PAYMENT_ENCRYPTION_KEY
 * - Credentials never logged or exposed in API responses
 * - Access scoped to workspace owner/admin only
 */
import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";

/**
 * Supported payment providers.
 * Stripe: Default, widely supported
 * Revolut: EU-focused, lower fees for EUR transactions
 */
export const PAYMENT_PROVIDERS = ["stripe", "revolut"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * Workspace payment settings table.
 *
 * Design decisions:
 * - Encrypted credentials stored as base64 ciphertext
 * - Each provider can be enabled/disabled independently
 * - default_provider determines fallback when invoice doesn't specify
 *
 * Threat mitigations:
 * - T-54-01: Credentials encrypted at rest (AES-256-GCM)
 * - T-54-02: Workspace isolation via foreign key constraint
 * - T-54-03: CHECK constraint validates provider values
 */
export const workspacePaymentSettings = pgTable(
  "workspace_payment_settings",
  {
    // Primary key - one row per workspace
    id: text("id").primaryKey(),

    // Workspace/tenant scoping
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Default provider when invoice doesn't specify
    defaultProvider: text("default_provider").notNull().default("stripe"),

    // Stripe credentials (encrypted)
    stripeEnabled: boolean("stripe_enabled").notNull().default(false),
    stripeSecretKey: text("stripe_secret_key"), // Encrypted
    stripeWebhookSecret: text("stripe_webhook_secret"), // Encrypted
    stripePublishableKey: text("stripe_publishable_key"), // Not secret, but kept here for convenience

    // Revolut credentials (encrypted)
    revolutEnabled: boolean("revolut_enabled").notNull().default(false),
    revolutApiKey: text("revolut_api_key"), // Encrypted
    revolutWebhookSecret: text("revolut_webhook_secret"), // Encrypted
    revolutMerchantId: text("revolut_merchant_id"), // Not secret, but kept here

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Index for workspace lookups
    index("ix_workspace_payment_settings_workspace").on(table.workspaceId),

    // T-54-03: Validate default_provider is a known provider
    check(
      "chk_default_provider_valid",
      sql`default_provider IN ('stripe', 'revolut')`
    ),
  ]
);

/**
 * Relations for type-safe queries with Drizzle
 */
export const workspacePaymentSettingsRelations = relations(
  workspacePaymentSettings,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [workspacePaymentSettings.workspaceId],
      references: [organization.id],
    }),
  })
);

// Type exports for type-safe operations
export type WorkspacePaymentSettingsSelect =
  typeof workspacePaymentSettings.$inferSelect;
export type WorkspacePaymentSettingsInsert =
  typeof workspacePaymentSettings.$inferInsert;
