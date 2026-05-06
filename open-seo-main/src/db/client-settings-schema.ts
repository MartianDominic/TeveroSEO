/**
 * Client Settings Schema - Communication and Portal Preferences
 * Phase 87-01: Agency Business
 *
 * Defines client settings for communication style and portal configuration.
 * All features optional, OFF by default per CLIENT-PORTAL-SPEC.md.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { clients } from "./client-schema";

// Communication style enum values
export const COMMUNICATION_STYLES = ["high_touch", "hybrid", "self_service"] as const;
export type CommunicationStyle = (typeof COMMUNICATION_STYLES)[number];

/**
 * Client Settings - per-client configuration for portal and workflow.
 *
 * All boolean features default to false (opt-in).
 * Communication style defaults to "hybrid".
 */
export const clientSettings = pgTable(
  "client_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" })
      .unique(),

    // Communication style (high_touch, hybrid, self_service)
    communicationStyle: text("communication_style").default("hybrid"),

    // Portal settings - OFF by default
    portalEnabled: boolean("portal_enabled").default(false),
    portalAuthLevel: text("portal_auth_level").default("token_only"),

    // Notifications - OFF by default
    notificationsEnabled: boolean("notifications_enabled").default(false),

    // Content workflow
    contentApprovalRequired: boolean("content_approval_required").default(false),
    autoApproveAfterDays: integer("auto_approve_after_days").default(3),

    // Keyword tracking - ON by default (infrastructure)
    keywordLockinEnabled: boolean("keyword_lockin_enabled").default(true),
    keywordLockinStrict: boolean("keyword_lockin_strict").default(false),

    // Timestamps
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ix_client_settings_client").on(table.clientId),
    // Communication style must be valid enum value
    check(
      "chk_client_settings_comm_style",
      sql`communication_style IN ('high_touch', 'hybrid', 'self_service')`
    ),
    // Portal auth level must be valid enum value
    check(
      "chk_client_settings_portal_auth",
      sql`portal_auth_level IN ('token_only', 'email_verify', 'full_login')`
    ),
  ]
);

// Relations
export const clientSettingsRelations = relations(clientSettings, ({ one }) => ({
  client: one(clients, {
    fields: [clientSettings.clientId],
    references: [clients.id],
  }),
}));

/**
 * Notification Preferences - per-client notification settings.
 *
 * All notification types default to false (opt-in).
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" })
      .unique(),

    // Notification types - all OFF by default
    weeklyDigest: boolean("weekly_digest").default(false),
    monthlyReport: boolean("monthly_report").default(false),
    milestoneAlerts: boolean("milestone_alerts").default(false),
    contentPublished: boolean("content_published").default(false),

    // Recipients
    recipientEmails: text("recipient_emails")
      .array()
      .default(sql`'{}'::text[]`),

    // Timestamps
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("ix_notification_prefs_client").on(table.clientId)]
);

// Relations
export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    client: one(clients, {
      fields: [notificationPreferences.clientId],
      references: [clients.id],
    }),
  })
);

// Inferred types for database operations
export type ClientSettingsSelect = typeof clientSettings.$inferSelect;
export type ClientSettingsInsert = typeof clientSettings.$inferInsert;
export type NotificationPreferencesSelect = typeof notificationPreferences.$inferSelect;
export type NotificationPreferencesInsert = typeof notificationPreferences.$inferInsert;
