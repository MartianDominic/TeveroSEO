/**
 * System Secrets Schema
 *
 * Stores encrypted API keys and credentials for the platform.
 * Values are AES-256-GCM encrypted at rest.
 *
 * SECURITY:
 * - Encryption key (SECRETS_ENCRYPTION_KEY) must be stored separately from database
 * - All access is audit logged
 * - Only superadmin can read/write
 */

import { pgTable, text, timestamp, boolean, pgEnum, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Environment types
export const secretEnvironmentEnum = pgEnum("secret_environment", [
  "development",
  "production",
  "all", // Applies to both environments
]);

// Secret categories for organization
export const secretCategoryEnum = pgEnum("secret_category", [
  "ai_providers",
  "payments",
  "email",
  "seo_services",
  "authentication",
  "oauth",
  "infrastructure",
  "encryption",
  "other",
]);

/**
 * System secrets table - stores encrypted credentials
 */
export const systemSecrets = pgTable("system_secrets", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Secret identification
  key: text("key").notNull(), // e.g., "ANTHROPIC_API_KEY"
  environment: secretEnvironmentEnum("environment").notNull().default("all"),

  // Encrypted value (AES-256-GCM)
  // Format: base64(iv):base64(authTag):base64(ciphertext)
  encryptedValue: text("encrypted_value"),

  // Metadata
  category: secretCategoryEnum("category").notNull().default("other"),
  description: text("description"), // Human-readable description
  isRequired: boolean("is_required").notNull().default(false),
  isSet: boolean("is_set").notNull().default(false), // Quick check without decryption

  // Services that use this secret
  usedByServices: text("used_by_services").array(), // e.g., ["open-seo", "ai-writer", "tevero-web"]

  // Validation pattern (optional)
  validationPattern: text("validation_pattern"), // e.g., "^sk_live_" for Stripe keys

  // Rotation tracking
  lastRotated: timestamp("last_rotated", { withTimezone: true }),
  rotationReminder: timestamp("rotation_reminder", { withTimezone: true }),

  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  lastAccessedBy: text("last_accessed_by"), // User ID who last accessed
});

/**
 * Audit log for secret access
 */
export const secretAuditLog = pgTable("secret_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),

  // What was accessed
  secretId: uuid("secret_id").references(() => systemSecrets.id, { onDelete: "cascade" }),
  secretKey: text("secret_key").notNull(), // Denormalized for history after deletion

  // Who accessed
  userId: text("user_id").notNull(),
  userEmail: text("user_email"), // Denormalized for readability

  // What action
  action: text("action").notNull(), // "view", "update", "delete", "create", "test"

  // Context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // Result
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),

  // Timestamp
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const systemSecretsRelations = relations(systemSecrets, ({ many }) => ({
  auditLogs: many(secretAuditLog),
}));

export const secretAuditLogRelations = relations(secretAuditLog, ({ one }) => ({
  secret: one(systemSecrets, {
    fields: [secretAuditLog.secretId],
    references: [systemSecrets.id],
  }),
}));

// Types
export type SystemSecret = typeof systemSecrets.$inferSelect;
export type SystemSecretInsert = typeof systemSecrets.$inferInsert;
export type SecretAuditLogEntry = typeof secretAuditLog.$inferSelect;
export type SecretAuditLogInsert = typeof secretAuditLog.$inferInsert;
export type SecretEnvironment = "development" | "production" | "all";
export type SecretCategory =
  | "ai_providers"
  | "payments"
  | "email"
  | "seo_services"
  | "authentication"
  | "oauth"
  | "infrastructure"
  | "encryption"
  | "other";
