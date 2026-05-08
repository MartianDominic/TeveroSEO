/**
 * Schema for clients (converted prospects).
 * Phase 30-07: Auto-Onboarding
 *
 * Clients are prospects that have been converted after payment.
 * Stores contact info, GSC credentials, and onboarding status.
 */
import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
  boolean,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { prospects } from "./prospect-schema";
import { projects } from "./app.schema";
import { softDeleteColumns } from "./soft-delete-columns";

// Client status enum values
export const CLIENT_STATUS = [
  "onboarding",
  "active",
  "paused",
  "churned",
] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];

// Baseline metrics JSONB type
export interface BaselineMetrics {
  traffic: number;
  keywords: number;
  domainRank: number;
}

/**
 * Clients table - converted prospects who have paid.
 * One client per converted prospect (unique constraint).
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Company info
    name: text("name").notNull(),
    domain: text("domain").notNull(),

    // Contact info
    contactEmail: text("contact_email"),
    contactName: text("contact_name"),
    industry: text("industry"),

    // Status
    status: text("status").notNull().default("onboarding"),

    // Conversion tracking
    convertedFromProspectId: text("converted_from_prospect_id")
      .references(() => prospects.id, { onDelete: "set null" }),

    // GSC OAuth credentials
    gscRefreshToken: text("gsc_refresh_token"),
    gscSiteUrl: text("gsc_site_url"),
    gscConnectedAt: timestamp("gsc_connected_at", { withTimezone: true, mode: "date" }),

    // Onboarding tracking
    kickoffScheduledAt: timestamp("kickoff_scheduled_at", { withTimezone: true, mode: "date" }),
    kickoffCompletedAt: timestamp("kickoff_completed_at", { withTimezone: true, mode: "date" }),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: "date" }),

    // Baseline metrics from analysis
    baselineMetrics: jsonb("baseline_metrics").$type<BaselineMetrics>(),

    // Target keywords imported from analysis
    targetKeywords: jsonb("target_keywords").$type<string[]>(),

    // Language preferences (Phase 55-04) - null = inherit from workspace
    preferredLanguage: text("preferred_language"),
    country: text("country"), // ISO 3166-1 alpha-2

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // MED-18: Added $onUpdate for automatic timestamp updates via Drizzle ORM
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // Soft delete support - prevents catastrophic cascade deletes
    // Legacy columns (deprecated - use softDeletedAt instead)
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    // New standardized soft delete column (DBS-005/006/007)
    ...softDeleteColumns,
  },
  (table) => [
    index("ix_clients_workspace").on(table.workspaceId),
    index("ix_clients_status").on(table.status),
    uniqueIndex("ix_clients_workspace_domain").on(table.workspaceId, table.domain),
    index("ix_clients_converted_prospect").on(table.convertedFromProspectId),
    // Partial index for active (non-deleted) clients - speeds up common queries
    index("ix_clients_active").on(table.workspaceId, table.isDeleted),
    // New soft delete index
    index("ix_clients_soft_deleted").on(table.softDeletedAt),
    // H-01: Client status must be valid enum value
    check("chk_client_status_valid", sql`status IN ('onboarding', 'active', 'paused', 'churned')`),
  ],
);

// Relations
export const clientsRelations = relations(clients, ({ one, many }) => ({
  workspace: one(organization, {
    fields: [clients.workspaceId],
    references: [organization.id],
  }),
  convertedFromProspect: one(prospects, {
    fields: [clients.convertedFromProspectId],
    references: [prospects.id],
  }),
  projects: many(projects),
}));

// Inferred types for database operations
export type ClientSelect = typeof clients.$inferSelect;
export type ClientInsert = typeof clients.$inferInsert;

/**
 * Client Sync Log - FIX-08: M-SYNC-01
 *
 * Tracks cross-service sync operations for idempotency.
 * Prevents duplicate syncs when retrying failed operations.
 */
export const clientSyncLog = pgTable(
  "client_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Idempotency key from the sync request
    idempotencyKey: text("idempotency_key").notNull().unique(),

    // Client that was synced
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Workspace context
    workspaceId: text("workspace_id").notNull(),

    // When the sync was completed
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    // Sync source (for debugging)
    source: text("source").default("ai-writer"),

    // TTL for cleanup - sync records older than 7 days can be deleted
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`NOW() + INTERVAL '7 days'`),
  },
  (table) => [
    index("ix_client_sync_log_client").on(table.clientId),
    index("ix_client_sync_log_expires").on(table.expiresAt),
  ]
);

export type ClientSyncLogSelect = typeof clientSyncLog.$inferSelect;
export type ClientSyncLogInsert = typeof clientSyncLog.$inferInsert;
