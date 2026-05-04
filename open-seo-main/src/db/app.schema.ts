import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { desc, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { clients } from "./client-schema";

// ============================================================================
// ENUMS - Database-level type safety for status fields
// ============================================================================

/**
 * Audit status enum for type-safe status tracking.
 * Matches the PostgreSQL enum created in migration 0032.
 */
export const auditStatusEnum = pgEnum("audit_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type AuditStatus = (typeof auditStatusEnum.enumValues)[number];

// This stores users for Cloudflare Access and local_noauth mode
// since they don't map to the main user schema
export const delegatedUsers = pgTable("delegated_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// Projects for keyword research
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    // Soft delete columns (migration 0038)
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    // H-ONBOARD-01: Idempotency key to prevent duplicate project creation on retry
    // Format: seo-project:{client_id}:{normalized_domain}:{5min_window}
    // Migration: 0073_projects_idempotency.sql
    idempotencyKey: text("idempotency_key"),
  },
  (table) => [
    // Unique constraint to prevent duplicate project names per organization
    // Used by getOrCreateDefaultProject() atomic upsert
    uniqueIndex("uq_projects_org_name").on(table.organizationId, table.name),
    // Index for efficient soft delete filtering
    index("projects_is_deleted_idx").on(table.isDeleted),
    // H-ONBOARD-01: Index for idempotency key lookups
    index("idx_projects_idempotency_key").on(table.idempotencyKey),
  ],
);

// User-saved keywords within a project. This is the canonical saved list.
export const savedKeywords = pgTable(
  "saved_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    locationCode: integer("location_code").notNull().default(2840),
    languageCode: text("language_code").notNull().default("en"),
    trackingEnabled: boolean("tracking_enabled").default(true),
    dropAlertThreshold: integer("drop_alert_threshold").default(5), // Alert if rank drops by this many positions
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_keywords_unique_project_keyword_location_language").on(
      table.projectId,
      table.keyword,
      table.locationCode,
      table.languageCode,
    ),
    index("saved_keywords_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// Latest cached metrics for a keyword within a project.
// This is joined onto savedKeywords when rendering the saved keyword list.
export const keywordMetrics = pgTable(
  "keyword_metrics",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull().default("en"),
    searchVolume: integer("search_volume"),
    cpc: real("cpc"),
    competition: real("competition"),
    keywordDifficulty: integer("keyword_difficulty"),
    intent: text("intent"),
    monthlySearches: jsonb("monthly_searches"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("keyword_metrics_unique_project_keyword_location_language").on(
      table.projectId,
      table.keyword,
      table.locationCode,
      table.languageCode,
    ),
    index("keyword_metrics_lookup_idx").on(
      table.projectId,
      table.keyword,
      table.locationCode,
      table.languageCode,
      table.fetchedAt,
    ),
  ],
);

// ============================================================================
// Site Audit tables
// ============================================================================

// One row per audit run
export const audits = pgTable(
  "audits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // User ID from Clerk authentication system.
    // No FK constraint as Clerk users are external to PostgreSQL.
    // Validated during request via requireAuth middleware.
    // Format: Clerk user_* ID string.
    startedByUserId: text("started_by_user_id").notNull(),
    startUrl: text("start_url").notNull(),
    // Status uses inline enum for now; migration 0032 creates proper PostgreSQL enum
    // Future: switch to auditStatusEnum("status") after migration runs
    status: text("status", {
      enum: ["pending", "running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("running"),
    workflowInstanceId: text("workflow_instance_id"),
    // UUID reference to clients.id for client-scoped audits.
    // Nullable for legacy audits created before Phase 6 client scoping.
    // NULL means "unscoped" not "all clients" - queries must handle explicitly.
    // AUTH-04: Validated via resolveClientId() in API routes.
    // FK-01: SET NULL on delete preserves audit history when client is removed.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    // JSON config: { maxPages, lighthouseStrategy }
    // Schema: { maxPages?: number, lighthouseStrategy?: "mobile"|"desktop"|"both" }
    config: jsonb("config").notNull().default({}),
    // Progress & summary
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    pagesTotal: integer("pages_total").notNull().default(0),
    lighthouseTotal: integer("lighthouse_total").notNull().default(0),
    lighthouseCompleted: integer("lighthouse_completed").notNull().default(0),
    lighthouseFailed: integer("lighthouse_failed").notNull().default(0),
    currentPhase: text("current_phase").default("discovery"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    // Audit trail column (HIGH-DB-009)
    updatedBy: text("updated_by"),
    // Soft delete / archive columns (migration 0038)
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    // Optimistic locking version (H-CONC-02: Race condition fix for concurrent phase updates)
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("audits_project_id_idx").on(table.projectId),
    index("audits_started_by_user_id_idx").on(table.startedByUserId),
    index("audits_client_id_started_at_idx").on(
      table.clientId,
      desc(table.startedAt),
    ),
    // Index for efficient soft delete filtering
    index("audits_is_archived_idx").on(table.isArchived),
    // Check constraints added via migration 0032
  ],
);

// One row per crawled page
export const auditPages = pgTable(
  "audit_pages",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    statusCode: integer("status_code"),
    redirectUrl: text("redirect_url"),
    // Metadata
    title: text("title"),
    metaDescription: text("meta_description"),
    canonicalUrl: text("canonical_url"),
    robotsMeta: text("robots_meta"),
    // Open Graph
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImage: text("og_image"),
    // Headings
    h1Count: integer("h1_count").notNull().default(0),
    h2Count: integer("h2_count").notNull().default(0),
    h3Count: integer("h3_count").notNull().default(0),
    h4Count: integer("h4_count").notNull().default(0),
    h5Count: integer("h5_count").notNull().default(0),
    h6Count: integer("h6_count").notNull().default(0),
    headingOrderJson: jsonb("heading_order_json"),
    // Content
    wordCount: integer("word_count").notNull().default(0),
    // Images
    imagesTotal: integer("images_total").notNull().default(0),
    imagesMissingAlt: integer("images_missing_alt").notNull().default(0),
    imagesJson: jsonb("images_json"),
    // Links
    internalLinkCount: integer("internal_link_count").notNull().default(0),
    externalLinkCount: integer("external_link_count").notNull().default(0),
    // Structured data
    hasStructuredData: boolean("has_structured_data").notNull().default(false),
    // Hreflang
    hreflangTagsJson: jsonb("hreflang_tags_json"),
    // Indexability
    isIndexable: boolean("is_indexable").notNull().default(true),
    // Performance
    responseTimeMs: integer("response_time_ms"),
  },
  (table) => [index("audit_pages_audit_id_idx").on(table.auditId)],
);

// One row per Lighthouse test (mobile + desktop per page).
// Check constraints (0-100 for scores) added via migration 0032.
export const auditLighthouseResults = pgTable(
  "audit_lighthouse_results",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
    strategy: text("strategy", { enum: ["mobile", "desktop"] }).notNull(),
    // Score fields: constrained to 0-100 via chk_*_score_range in migration 0032
    performanceScore: integer("performance_score"),
    accessibilityScore: integer("accessibility_score"),
    bestPracticesScore: integer("best_practices_score"),
    seoScore: integer("seo_score"),
    // Core Web Vitals metrics
    lcpMs: real("lcp_ms"),
    cls: real("cls"),
    inpMs: real("inp_ms"),
    ttfbMs: real("ttfb_ms"),
    errorMessage: text("error_message"),
    r2Key: text("r2_key"),
    payloadSizeBytes: integer("payload_size_bytes"),
  },
  (table) => [
    index("audit_lighthouse_results_audit_id_idx").on(table.auditId),
    // HIGH-35: Index on pageId for FK lookups and page-based queries
    // Fixes schema/migration drift - this index was documented but not created
    index("idx_audit_lighthouse_results_page_id").on(table.pageId),
  ],
);
