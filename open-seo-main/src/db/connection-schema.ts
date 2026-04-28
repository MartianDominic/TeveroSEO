/**
 * Schema for site connections.
 * Phase 31-01: Site Connection Schema
 *
 * Stores platform connection credentials (encrypted) and status.
 * Used for multi-platform content management from the agency dashboard.
 */
import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clients } from "./client-schema";

// Platform types - must match types.ts
export const PLATFORM_TYPES = [
  "wordpress",
  "shopify",
  "wix",
  "squarespace",
  "webflow",
  "custom",
  "pixel",
] as const;

export type PlatformType = (typeof PLATFORM_TYPES)[number];

// Connection status enum values
export const CONNECTION_STATUS = [
  "pending",
  "active",
  "error",
  "disconnected",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUS)[number];

/**
 * Site connections table - stores platform connections with encrypted credentials.
 * One client can have multiple connections (e.g., WordPress + Shopify).
 */
export const siteConnections = pgTable(
  "site_connections",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Platform info
    platform: text("platform").notNull(),
    siteUrl: text("site_url").notNull(),
    displayName: text("display_name"),

    // Encrypted credentials (AES-256-GCM packed: IV || TAG || CIPHERTEXT) stored as base64
    encryptedCredentials: text("encrypted_credentials"),

    // Detected capabilities array (e.g., ["posts", "pages", "media"])
    capabilities: text("capabilities").array(),

    // Status tracking
    status: text("status").notNull().default("pending"),
    lastVerifiedAt: timestamp("last_verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastErrorMessage: text("last_error_message"),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_site_connections_client").on(table.clientId),
    index("ix_site_connections_platform").on(table.platform),
    index("ix_site_connections_status").on(table.status),
  ]
);

// Relations
export const siteConnectionsRelations = relations(siteConnections, ({ one }) => ({
  client: one(clients, {
    fields: [siteConnections.clientId],
    references: [clients.id],
  }),
}));

// Inferred types for database operations
export type SiteConnectionSelect = typeof siteConnections.$inferSelect;
export type SiteConnectionInsert = typeof siteConnections.$inferInsert;
