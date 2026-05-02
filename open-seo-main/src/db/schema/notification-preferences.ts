/**
 * Notification Preferences Schema - User notification settings
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-10: Per-user notification toggles with quiet hours.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "../user-schema";

/**
 * Notification preferences table - per-user per-workspace settings.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Channels
    emailEnabled: boolean("email_enabled").default(true).notNull(),
    inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
    slackEnabled: boolean("slack_enabled").default(false).notNull(),
    slackChannel: text("slack_channel"),

    // Event types
    notifyOverdueInvoice: boolean("notify_overdue_invoice")
      .default(true)
      .notNull(),
    notifyContractExpiring: boolean("notify_contract_expiring")
      .default(true)
      .notNull(),
    notifyProposalViewed: boolean("notify_proposal_viewed")
      .default(true)
      .notNull(),
    notifyContractSigned: boolean("notify_contract_signed")
      .default(true)
      .notNull(),
    notifyPaymentReceived: boolean("notify_payment_received")
      .default(true)
      .notNull(),
    notifySmartAlerts: boolean("notify_smart_alerts").default(true).notNull(),
    notifyFollowUpDue: boolean("notify_follow_up_due").default(true).notNull(),

    // Timing
    dailyDigestEnabled: boolean("daily_digest_enabled").default(true).notNull(),
    dailyDigestHour: integer("daily_digest_hour").default(9).notNull(),

    // Quiet hours
    quietHoursStart: integer("quiet_hours_start"),
    quietHoursEnd: integer("quiet_hours_end"),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_notification_preferences_user").on(table.userId),
    index("ix_notification_preferences_workspace").on(table.workspaceId),
    unique("uq_notification_preferences_user_workspace").on(
      table.userId,
      table.workspaceId
    ),
  ]
);

// Relations
export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationPreferences.userId],
      references: [user.id],
    }),
    workspace: one(organization, {
      fields: [notificationPreferences.workspaceId],
      references: [organization.id],
    }),
  })
);

// Inferred types
export type NotificationPreferencesSelect =
  typeof notificationPreferences.$inferSelect;
export type NotificationPreferencesInsert =
  typeof notificationPreferences.$inferInsert;
