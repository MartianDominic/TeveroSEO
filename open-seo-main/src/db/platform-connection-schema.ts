/**
 * Schema for OAuth platform connections.
 * Phase 61-01: Platform Integration Excellence
 *
 * Stores OAuth tokens (encrypted) for 15+ platforms with status tracking.
 * Used for integrating Google Search Console, Analytics, Shopify, etc.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { prospects } from "./prospect-schema";
import { organization } from "./user-schema";

// OAuth platform types - 15 platforms per DESIGN.md
export const OAUTH_PLATFORM_TYPES = [
  "google_search_console",
  "google_analytics",
  "google_business_profile",
  "wordpress_com",
  "wordpress_org",
  "shopify",
  "wix",
  "squarespace",
  "webflow",
  "hubspot",
  "bigcommerce",
  "magento",
  "drupal",
  "ghost",
  "bing_webmaster",
] as const;

export type OAuthPlatformType = (typeof OAUTH_PLATFORM_TYPES)[number];

// OAuth connection status values - more granular than site connections
export const OAUTH_CONNECTION_STATUS = [
  "pending",
  "connecting",
  "active",
  "expired",
  "revoked",
  "error",
] as const;

export type OAuthConnectionStatus = (typeof OAUTH_CONNECTION_STATUS)[number];

// Credential types for non-OAuth authentication
export const CREDENTIAL_TYPES = ["oauth", "app_password", "api_key"] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

// Sync schedule options
export const SYNC_SCHEDULES = ["hourly", "daily", "weekly", "manual"] as const;
export type SyncSchedule = (typeof SYNC_SCHEDULES)[number];

// Sync status values
export const SYNC_STATUS = ["success", "partial", "failed"] as const;
export type SyncStatus = (typeof SYNC_STATUS)[number];

/**
 * Platform connections table - stores OAuth tokens with encrypted credentials.
 * One workspace can have multiple platform connections.
 * prospectId is optional - some connections are workspace-level (e.g., Google services).
 */
export const platformConnections = pgTable(
  "platform_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    prospectId: text("prospect_id").references(() => prospects.id, {
      onDelete: "set null",
    }),

    // Platform identification
    platform: text("platform").notNull(),
    platformAccountId: text("platform_account_id"),
    platformAccountName: text("platform_account_name"),
    platformSiteUrl: text("platform_site_url"),

    // OAuth tokens (encrypted with AES-256-GCM)
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    tokenType: text("token_type").default("Bearer"),

    // For non-OAuth (WordPress Application Passwords, API keys)
    credentialType: text("credential_type"),
    credentialsEncrypted: text("credentials_encrypted"),

    // Connection status
    status: text("status").notNull().default("pending"),

    // Sync tracking
    lastSyncAt: timestamp("last_sync_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastSyncStatus: text("last_sync_status"),
    lastError: text("last_error"),
    syncSchedule: text("sync_schedule").default("daily"),

    // Scopes (stored as JSON arrays)
    scopesRequested: jsonb("scopes_requested").$type<string[]>(),
    scopesGranted: jsonb("scopes_granted").$type<string[]>(),

    // Audit trail
    connectedAt: timestamp("connected_at", {
      withTimezone: true,
      mode: "date",
    }),
    connectedBy: text("connected_by"),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "date",
    }),
    revokedBy: text("revoked_by"),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // MED-18: Added $onUpdate for automatic timestamp updates via Drizzle ORM
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_platform_connections_workspace_prospect").on(
      table.workspaceId,
      table.prospectId
    ),
    index("idx_platform_connections_status").on(table.status),
    index("idx_platform_connections_expiry").on(table.tokenExpiresAt),
    // H-03: Platform type filter for dashboard
    index("idx_platform_connections_platform").on(table.platform),
    // H-05: Validate status enum at database level
    check(
      "chk_connection_status_valid",
      sql`status IN ('pending', 'connecting', 'active', 'expired', 'revoked', 'error')`
    ),
  ]
);

// Relations
export const platformConnectionsRelations = relations(
  platformConnections,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [platformConnections.workspaceId],
      references: [organization.id],
    }),
    prospect: one(prospects, {
      fields: [platformConnections.prospectId],
      references: [prospects.id],
    }),
  })
);

// Inferred types for database operations
export type PlatformConnectionSelect = typeof platformConnections.$inferSelect;
export type PlatformConnectionInsert = typeof platformConnections.$inferInsert;
