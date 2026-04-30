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
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    // Soft delete support - prevents catastrophic cascade deletes
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_clients_workspace").on(table.workspaceId),
    index("ix_clients_status").on(table.status),
    uniqueIndex("ix_clients_workspace_domain").on(table.workspaceId, table.domain),
    index("ix_clients_converted_prospect").on(table.convertedFromProspectId),
    // Partial index for active (non-deleted) clients - speeds up common queries
    index("ix_clients_active").on(table.workspaceId, table.isDeleted),
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
