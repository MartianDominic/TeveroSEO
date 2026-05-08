/**
 * Workspace Portal Settings Schema
 * Phase 96: CPR-005, CPR-007
 *
 * Stores agency-level portal configuration including:
 * - Configurable session timeout (1-72 hours)
 * - Agency timezone for date display
 * - Portal branding settings
 *
 * Addresses:
 * - CPR-005: Portal session timeout hardcoded to 24h
 * - CPR-007: Portal doesn't respect agency timezone
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";

/**
 * Supported session timeout options in hours.
 * Range: 1-72 hours as per spec.
 */
export const SESSION_TIMEOUT_OPTIONS = [1, 2, 4, 8, 12, 24, 48, 72] as const;
export type SessionTimeoutHours = (typeof SESSION_TIMEOUT_OPTIONS)[number];

/**
 * Common IANA timezone identifiers for UI display.
 * Full list supported via text field, this is for dropdown suggestions.
 */
export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Vilnius",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

/**
 * Workspace portal settings table.
 *
 * One row per workspace (agency). Controls portal behavior for all
 * clients under this agency.
 *
 * Design decisions:
 * - Session timeout validated 1-72 hours (CHECK constraint)
 * - Timezone stored as IANA identifier for date-fns-tz compatibility
 * - Default timeout: 24 hours (current behavior)
 * - Default timezone: UTC (safe default)
 */
export const workspacePortalSettings = pgTable(
  "workspace_portal_settings",
  {
    // Primary key - one row per workspace
    id: text("id").primaryKey(),

    // Workspace/tenant scoping
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),

    // CPR-005: Configurable session timeout (hours)
    // Valid range: 1-72 hours
    sessionTimeoutHours: integer("session_timeout_hours").notNull().default(24),

    // CPR-007: Agency timezone for date display
    // IANA timezone identifier (e.g., "America/New_York", "Europe/London")
    timezone: text("timezone").notNull().default("UTC"),

    // Portal branding (optional future extension)
    portalTitle: text("portal_title"), // Custom title shown in portal header
    supportEmail: text("support_email"), // Contact email shown in portal

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Index for workspace lookups
    index("ix_workspace_portal_settings_workspace").on(table.workspaceId),

    // CPR-005: Validate session timeout is within 1-72 hours
    check(
      "chk_session_timeout_valid",
      sql`session_timeout_hours >= 1 AND session_timeout_hours <= 72`
    ),
  ]
);

/**
 * Relations for type-safe queries with Drizzle
 */
export const workspacePortalSettingsRelations = relations(
  workspacePortalSettings,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [workspacePortalSettings.workspaceId],
      references: [organization.id],
    }),
  })
);

// Type exports for type-safe operations
export type WorkspacePortalSettingsSelect =
  typeof workspacePortalSettings.$inferSelect;
export type WorkspacePortalSettingsInsert =
  typeof workspacePortalSettings.$inferInsert;

/**
 * Default portal settings for new workspaces.
 */
export const DEFAULT_PORTAL_SETTINGS = {
  sessionTimeoutHours: 24,
  timezone: "UTC",
} as const;
