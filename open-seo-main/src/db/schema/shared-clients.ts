/**
 * Unified shared_clients schema for database consolidation.
 * Phase 67-01: Schema Design (Database Consolidation)
 *
 * This schema merges columns from:
 *   - open-seo-main clients table (client-schema.ts)
 *   - AI-Writer clients table (models/client.py)
 *
 * Namespace: shared_*
 * ORM Owner: Drizzle
 *
 * Requirements:
 *   - CRITICAL-DB-002: Single source of truth for client data
 *   - HIGH-DB-001: workspace_id NOT NULL constraint
 *   - MED-DB-006: TIMESTAMPTZ for all timestamp columns
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
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "../user-schema";

// Client status enum values - unified from both systems
export const CLIENT_STATUS = [
  "onboarding",
  "active",
  "paused",
  "churned",
] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];

// Baseline metrics JSONB type (from open-seo-main)
export interface BaselineMetrics {
  traffic: number;
  keywords: number;
  domainRank: number;
}

// CMS type enum for content publishing (from AI-Writer)
export const CMS_TYPES = [
  "wordpress",
  "shopify",
  "wix",
  "webhook",
] as const;
export type CmsType = (typeof CMS_TYPES)[number];

/**
 * Unified shared_clients table.
 *
 * Merges:
 *   - open-seo-main: domain, contact info, status, GSC credentials, baseline metrics
 *   - AI-Writer: CMS settings, brand voice, model overrides
 *
 * workspace_id is NOT NULL (HIGH-DB-001).
 * All timestamps use TIMESTAMPTZ (MED-DB-006).
 */
export const sharedClients = pgTable(
  "shared_clients",
  {
    // Primary key - UUID for high insert volume and distribution
    id: uuid("id").primaryKey().defaultRandom(),

    // Multi-tenant isolation - NOT NULL required (HIGH-DB-001)
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // === Company Info (from both systems) ===
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    websiteUrl: text("website_url"), // AI-Writer: website_url

    // === Contact Info (from open-seo-main) ===
    contactEmail: text("contact_email"),
    contactName: text("contact_name"),
    industry: text("industry"),

    // === Status (unified) ===
    status: text("status").notNull().default("onboarding"),

    // === Conversion tracking (from open-seo-main) ===
    convertedFromProspectId: text("converted_from_prospect_id"),

    // === GSC OAuth credentials (from open-seo-main) ===
    gscRefreshToken: text("gsc_refresh_token"),
    gscSiteUrl: text("gsc_site_url"),
    gscConnectedAt: timestamp("gsc_connected_at", {
      withTimezone: true,
      mode: "date",
    }),

    // === Onboarding tracking (from open-seo-main) ===
    kickoffScheduledAt: timestamp("kickoff_scheduled_at", {
      withTimezone: true,
      mode: "date",
    }),
    kickoffCompletedAt: timestamp("kickoff_completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
      mode: "date",
    }),

    // === Baseline metrics from analysis (from open-seo-main) ===
    baselineMetrics: jsonb("baseline_metrics").$type<BaselineMetrics>(),

    // === Target keywords imported from analysis (from open-seo-main) ===
    targetKeywords: jsonb("target_keywords").$type<string[]>(),

    // === Language preferences (from open-seo-main Phase 55-04) ===
    preferredLanguage: text("preferred_language"),
    country: text("country"), // ISO 3166-1 alpha-2

    // === Content generation preferences (from AI-Writer) ===
    brandVoice: text("brand_voice"),
    imagePromptTemplate: text("image_prompt_template"),
    textModelOverride: text("text_model_override"),
    imageModelOverride: text("image_model_override"),

    // === CMS routing (from AI-Writer) ===
    cmsType: text("cms_type"), // wordpress | shopify | wix | webhook
    webhookUrl: text("webhook_url"),

    // === WordPress credentials (from AI-Writer) - encrypted ===
    wpUrl: text("wp_url"),
    wpUsername: text("wp_username"),
    wpAppPasswordEncrypted: text("wp_app_password_encrypted"), // Base64 encoded encrypted bytes

    // === Shopify credentials (from AI-Writer) - encrypted ===
    shopifyStoreUrl: text("shopify_store_url"),
    shopifyApiKeyEncrypted: text("shopify_api_key_encrypted"),

    // === Wix credentials (from AI-Writer) - encrypted ===
    wixSiteId: text("wix_site_id"),
    wixBlogId: text("wix_blog_id"),
    wixApiKeyEncrypted: text("wix_api_key_encrypted"),

    // === Standard timestamps - TIMESTAMPTZ (MED-DB-006) ===
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // === Soft delete support ===
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),

    // === Archive support (from AI-Writer is_archived) ===
    isArchived: boolean("is_archived").default(false).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    // Indexes
    index("ix_shared_clients_workspace").on(table.workspaceId),
    index("ix_shared_clients_status").on(table.status),
    index("ix_shared_clients_converted_prospect").on(
      table.convertedFromProspectId
    ),
    // Partial index for active (non-deleted, non-archived) clients
    index("ix_shared_clients_active").on(
      table.workspaceId,
      table.isDeleted,
      table.isArchived
    ),

    // Unique constraint on (workspace_id, domain) - no duplicate domains per workspace
    uniqueIndex("ix_shared_clients_workspace_domain").on(
      table.workspaceId,
      table.domain
    ),

    // Check constraints
    check(
      "chk_shared_client_status_valid",
      sql`status IN ('onboarding', 'active', 'paused', 'churned')`
    ),
    check(
      "chk_shared_client_cms_type_valid",
      sql`cms_type IS NULL OR cms_type IN ('wordpress', 'shopify', 'wix', 'webhook')`
    ),
  ]
);

// Relations
export const sharedClientsRelations = relations(sharedClients, ({ one }) => ({
  workspace: one(organization, {
    fields: [sharedClients.workspaceId],
    references: [organization.id],
  }),
}));

// Inferred types for database operations
export type SharedClientSelect = typeof sharedClients.$inferSelect;
export type SharedClientInsert = typeof sharedClients.$inferInsert;
