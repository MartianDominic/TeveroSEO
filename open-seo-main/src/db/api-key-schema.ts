/**
 * API key schema for authenticating external API requests.
 * Phase 40: Auth middleware for REST API endpoints.
 *
 * API keys are scoped to organizations and optionally clients.
 * They provide machine-to-machine auth for server actions and integrations.
 */
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./user-schema";
import { clients } from "./client-schema";

// API key permission scopes
export const API_KEY_SCOPES = [
  "read:audits",
  "write:audits",
  "read:briefs",
  "write:briefs",
  "read:linking",
  "write:linking",
  "read:voice",
  "write:voice",
  "*", // Full access
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/**
 * API keys table for authenticating API requests.
 *
 * Key format: `oseo_<random_32_chars>` (prefix for easy identification)
 * Hash: SHA-256 of the full key (we never store the raw key)
 *
 * Scoping:
 * - organizationId: Required. Key only works for this org's resources.
 * - clientId: Optional. If set, key is restricted to this client only.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),

    // The key hash (SHA-256). We never store the raw key.
    keyHash: text("key_hash").notNull(),

    // Key prefix for display (first 8 chars: `oseo_xxx`)
    keyPrefix: text("key_prefix").notNull(),

    // Human-readable name for identifying the key
    name: text("name").notNull(),

    // Scoping
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Optional client restriction
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),

    // Who created this key
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Permission scopes (JSON array of ApiKeyScope values)
    // If includes "*", has full access
    scopes: text("scopes").notNull().default('["*"]'),

    // Lifecycle
    enabled: boolean("enabled").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ix_api_keys_hash").on(table.keyHash),
    index("ix_api_keys_prefix").on(table.keyPrefix),
    index("ix_api_keys_org").on(table.organizationId),
    index("ix_api_keys_client").on(table.clientId),
    index("ix_api_keys_enabled").on(table.enabled),
  ],
);

// Relations
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organization, {
    fields: [apiKeys.organizationId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [apiKeys.clientId],
    references: [clients.id],
  }),
  createdByUser: one(user, {
    fields: [apiKeys.createdBy],
    references: [user.id],
  }),
}));

// Inferred types for database operations
export type ApiKeySelect = typeof apiKeys.$inferSelect;
export type ApiKeyInsert = typeof apiKeys.$inferInsert;
