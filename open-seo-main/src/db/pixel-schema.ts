/**
 * Schema for TeveroPixel analytics and DOM injection system.
 * Phase 66-01: Platform Unification Excellence
 *
 * Enables any website to connect via a simple script tag.
 * Tracks pageviews, Core Web Vitals, and approved DOM changes.
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  numeric,
  date,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { user } from "./user-schema";

// Installation status values
export const PIXEL_INSTALLATION_STATUS = [
  "pending",
  "detected",
  "verified",
  "error",
] as const;
export type PixelInstallationStatus = (typeof PIXEL_INSTALLATION_STATUS)[number];

// DOM change types
export const PIXEL_CHANGE_TYPES = [
  "meta_title",
  "meta_description",
  "canonical",
  "schema",
  "internal_link",
  "content",
] as const;
export type PixelChangeType = (typeof PIXEL_CHANGE_TYPES)[number];

// DOM change status values
export const PIXEL_CHANGE_STATUS = [
  "pending",
  "approved",
  "rejected",
  "live",
  "rolled_back",
] as const;
export type PixelChangeStatus = (typeof PIXEL_CHANGE_STATUS)[number];

// Developer handoff status values
export const HANDOFF_STATUS = [
  "sent",
  "opened",
  "completed",
  "expired",
] as const;
export type HandoffStatus = (typeof HANDOFF_STATUS)[number];

// Pixel features configuration type
export interface PixelFeatures {
  analytics: boolean;
  cwv: boolean;
  metaInjection: boolean;
  schemaInjection: boolean;
  linkInjection: boolean;
  abTesting: boolean;
}

// Default features (analytics and CWV always on)
export const DEFAULT_PIXEL_FEATURES: PixelFeatures = {
  analytics: true,
  cwv: true,
  metaInjection: false,
  schemaInjection: false,
  linkInjection: false,
  abTesting: false,
};

// Top pages aggregation type
export interface TopPageEntry {
  url: string;
  pageviews: number;
  uniqueVisitors: number;
}

/**
 * Pixel installations table - tracks pixel script installations per site.
 * Each installation has a unique siteId used in the data-site attribute.
 */
export const pixelInstallations = pgTable(
  "pixel_installations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Unique identifier for the pixel (used in data-site attribute)
    siteId: text("site_id").notNull().unique(),
    // Domain this pixel is installed on
    domain: text("domain").notNull(),

    // Installation status
    status: text("status").notNull().default("pending"),

    // Detection tracking
    firstPingAt: timestamp("first_ping_at", { withTimezone: true, mode: "date" }),
    lastPingAt: timestamp("last_ping_at", { withTimezone: true, mode: "date" }),
    pingCount: integer("ping_count").notNull().default(0),

    // Feature configuration
    features: jsonb("features").$type<PixelFeatures>().notNull().default(DEFAULT_PIXEL_FEATURES),

    // Domain whitelist for CORS
    allowedOrigins: text("allowed_origins").array(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pixel_installations_workspace").on(table.workspaceId),
    index("idx_pixel_installations_status").on(table.status),
    index("idx_pixel_installations_domain").on(table.domain),
    // Status must be valid enum value
    check(
      "chk_pixel_status_valid",
      sql`status IN ('pending', 'detected', 'verified', 'error')`
    ),
  ]
);

/**
 * Pixel DOM changes table - tracks approved SEO modifications.
 * Changes are only applied via the pixel if approved by a user.
 */
export const pixelDomChanges = pgTable(
  "pixel_dom_changes",
  {
    id: text("id").primaryKey(),
    installationId: text("installation_id")
      .notNull()
      .references(() => pixelInstallations.id, { onDelete: "cascade" }),

    // Change details
    changeType: text("change_type").notNull(),
    targetSelector: text("target_selector"),
    targetUrl: text("target_url"),
    oldValue: text("old_value"),
    newValue: text("new_value").notNull(),

    // Approval status
    status: text("status").notNull().default("pending"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),

    // Deployment tracking
    deployedAt: timestamp("deployed_at", { withTimezone: true, mode: "date" }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pixel_dom_changes_installation").on(table.installationId),
    index("idx_pixel_dom_changes_status").on(table.status),
    index("idx_pixel_dom_changes_target_url").on(table.targetUrl),
    // Status must be valid enum value
    check(
      "chk_pixel_change_status_valid",
      sql`status IN ('pending', 'approved', 'rejected', 'live', 'rolled_back')`
    ),
    // Change type must be valid enum value
    check(
      "chk_pixel_change_type_valid",
      sql`change_type IN ('meta_title', 'meta_description', 'canonical', 'schema', 'internal_link', 'content')`
    ),
  ]
);

/**
 * Pixel analytics daily table - aggregated daily metrics.
 * Populated by the collector service, one row per installation per day.
 */
export const pixelAnalyticsDaily = pgTable(
  "pixel_analytics_daily",
  {
    id: text("id").primaryKey(),
    installationId: text("installation_id")
      .notNull()
      .references(() => pixelInstallations.id, { onDelete: "cascade" }),
    date: date("date", { mode: "date" }).notNull(),

    // Traffic metrics
    pageviews: integer("pageviews").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    uniqueVisitors: integer("unique_visitors").notNull().default(0),
    avgTimeOnPage: numeric("avg_time_on_page", { precision: 10, scale: 2 }),
    bounceRate: numeric("bounce_rate", { precision: 5, scale: 2 }),

    // Core Web Vitals (p75 aggregates)
    lcpP75: numeric("lcp_p75", { precision: 10, scale: 2 }),
    clsP75: numeric("cls_p75", { precision: 10, scale: 4 }),
    inpP75: numeric("inp_p75", { precision: 10, scale: 2 }),

    // Top pages for the day (JSONB for flexibility)
    topPages: jsonb("top_pages").$type<TopPageEntry[]>(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pixel_analytics_installation").on(table.installationId),
    index("idx_pixel_analytics_date").on(table.date),
    // Unique constraint on (installationId, date)
    uniqueIndex("idx_pixel_analytics_installation_date").on(
      table.installationId,
      table.date
    ),
  ]
);

/**
 * Developer handoffs table - tracks email invitations for technical setup.
 * Used when non-technical users send installation instructions to developers.
 */
export const developerHandoffs = pgTable(
  "developer_handoffs",
  {
    id: text("id").primaryKey(),
    // References the pixel installation
    installationId: text("installation_id")
      .notNull()
      .references(() => pixelInstallations.id, { onDelete: "cascade" }),

    // Recipient details
    developerEmail: text("developer_email").notNull(),
    developerName: text("developer_name"),

    // Status tracking
    status: text("status").notNull().default("sent"),

    // Magic link for one-click verification
    magicLinkToken: text("magic_link_token").unique(),
    magicLinkExpiresAt: timestamp("magic_link_expires_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Tracking timestamps
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),

    // Reminder tracking
    reminderCount: integer("reminder_count").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("idx_developer_handoffs_installation").on(table.installationId),
    index("idx_developer_handoffs_status").on(table.status),
    index("idx_developer_handoffs_email").on(table.developerEmail),
    // Status must be valid enum value
    check(
      "chk_handoff_status_valid",
      sql`status IN ('sent', 'opened', 'completed', 'expired')`
    ),
  ]
);

// Relations
export const pixelInstallationsRelations = relations(
  pixelInstallations,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [pixelInstallations.workspaceId],
      references: [organization.id],
    }),
    domChanges: many(pixelDomChanges),
    dailyAnalytics: many(pixelAnalyticsDaily),
    handoffs: many(developerHandoffs),
  })
);

export const pixelDomChangesRelations = relations(pixelDomChanges, ({ one }) => ({
  installation: one(pixelInstallations, {
    fields: [pixelDomChanges.installationId],
    references: [pixelInstallations.id],
  }),
  approver: one(user, {
    fields: [pixelDomChanges.approvedBy],
    references: [user.id],
  }),
}));

export const pixelAnalyticsDailyRelations = relations(
  pixelAnalyticsDaily,
  ({ one }) => ({
    installation: one(pixelInstallations, {
      fields: [pixelAnalyticsDaily.installationId],
      references: [pixelInstallations.id],
    }),
  })
);

export const developerHandoffsRelations = relations(developerHandoffs, ({ one }) => ({
  installation: one(pixelInstallations, {
    fields: [developerHandoffs.installationId],
    references: [pixelInstallations.id],
  }),
}));

// Inferred types for database operations
export type PixelInstallationSelect = typeof pixelInstallations.$inferSelect;
export type PixelInstallationInsert = typeof pixelInstallations.$inferInsert;
export type PixelDomChangeSelect = typeof pixelDomChanges.$inferSelect;
export type PixelDomChangeInsert = typeof pixelDomChanges.$inferInsert;
export type PixelAnalyticsDailySelect = typeof pixelAnalyticsDaily.$inferSelect;
export type PixelAnalyticsDailyInsert = typeof pixelAnalyticsDaily.$inferInsert;
export type DeveloperHandoffSelect = typeof developerHandoffs.$inferSelect;
export type DeveloperHandoffInsert = typeof developerHandoffs.$inferInsert;
