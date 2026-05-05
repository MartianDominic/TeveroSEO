/**
 * Portal Schema - Client Portal Foundation
 * Phase 87-01: Agency Business
 *
 * Defines portal tokens and users for client portal access.
 * Supports three auth levels: token_only, email_verify, full_login.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { clients } from "./client-schema";

// Auth level enum values
export const AUTH_LEVELS = ["token_only", "email_verify", "full_login"] as const;
export type AuthLevel = (typeof AUTH_LEVELS)[number];

/**
 * Portal Tokens - shareable links for client portal access.
 *
 * Token format: nanoid 12 chars (URL-safe)
 * Default expiry: 30 days
 */
export const portalTokens = pgTable(
  "portal_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 32 }).notNull().unique(),

    // Security
    authLevel: text("auth_level").notNull().default("token_only"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),

    // Usage tracking
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: "date" }),
    accessCount: integer("access_count").default(0),

    // Status
    isRevoked: boolean("is_revoked").default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_portal_tokens_client").on(table.clientId),
    index("ix_portal_tokens_expires").on(table.expiresAt),
    uniqueIndex("ix_portal_tokens_token").on(table.token),
    // Auth level must be valid enum value
    check(
      "chk_portal_token_auth_level",
      sql`auth_level IN ('token_only', 'email_verify', 'full_login')`
    ),
  ]
);

// Relations
export const portalTokensRelations = relations(portalTokens, ({ one }) => ({
  client: one(clients, {
    fields: [portalTokens.clientId],
    references: [clients.id],
  }),
}));

/**
 * Portal Users - client contacts who access the portal.
 *
 * Used for email verification and full login auth levels.
 */
export const portalUsers = pgTable(
  "portal_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),

    // Auth
    clerkUserId: varchar("clerk_user_id", { length: 255 }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),

    // Access tracking
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }),
    loginCount: integer("login_count").default(0),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_portal_users_client").on(table.clientId),
    index("ix_portal_users_email").on(table.email),
    uniqueIndex("ix_portal_users_client_email").on(table.clientId, table.email),
  ]
);

// Relations
export const portalUsersRelations = relations(portalUsers, ({ one }) => ({
  client: one(clients, {
    fields: [portalUsers.clientId],
    references: [clients.id],
  }),
}));

// Inferred types for database operations
export type PortalTokenSelect = typeof portalTokens.$inferSelect;
export type PortalTokenInsert = typeof portalTokens.$inferInsert;
export type PortalUserSelect = typeof portalUsers.$inferSelect;
export type PortalUserInsert = typeof portalUsers.$inferInsert;

// =============================================================================
// Phase 90-01: Trust Foundation - Extended Portal Schema
// =============================================================================

// Activity categories enum
export const ACTIVITY_CATEGORIES = [
  "content",
  "technical",
  "links",
  "tracking",
  "analytics",
  "communication",
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

// Notification types enum
export const NOTIFICATION_TYPES = ["win", "alert", "update", "digest"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Notification channels enum
export const NOTIFICATION_CHANNELS = [
  "in_app",
  "email",
  "slack",
  "push",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// Notification status enum
export const NOTIFICATION_STATUS = ["pending", "sent", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[number];

/**
 * Activity artifact type - links to work deliverables
 */
export interface ActivityArtifact {
  label: string;
  url: string;
}

/**
 * Portal Activities - Work we've done for the client.
 * Displayed in the activity feed on the portal dashboard.
 *
 * Phase 90-01: Trust Foundation
 */
export const portalActivities = pgTable(
  "portal_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractId: text("contract_id"),

    // Activity metadata
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // Links to deliverables (reports, pages, etc.)
    artifacts: jsonb("artifacts").$type<ActivityArtifact[]>().default([]),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("ix_portal_activities_client").on(table.clientId),
    index("ix_portal_activities_created").on(table.createdAt),
    index("ix_portal_activities_category").on(table.category),
    // Category must be valid enum value
    check(
      "chk_portal_activity_category",
      sql`category IN ('content', 'technical', 'links', 'tracking', 'analytics', 'communication')`
    ),
  ]
);

// Relations
export const portalActivitiesRelations = relations(
  portalActivities,
  ({ one }) => ({
    client: one(clients, {
      fields: [portalActivities.clientId],
      references: [clients.id],
    }),
  })
);

// Type exports
export type PortalActivitySelect = typeof portalActivities.$inferSelect;
export type PortalActivityInsert = typeof portalActivities.$inferInsert;

/**
 * Notification payload type - varies by notification type
 */
export interface NotificationPayload {
  // Win notification
  keyword?: string;
  position?: number;
  previousPosition?: number;
  monthlyVolume?: number;

  // Alert notification
  dropAmount?: number;

  // Digest notification
  summary?: {
    clicks: number;
    impressions: number;
    top10Count: number;
    winsCount: number;
  };

  // Common fields
  portalUrl?: string;
  [key: string]: unknown;
}

/**
 * Portal Notifications - Queued notifications for clients.
 * Processed by BullMQ worker for delivery via various channels.
 *
 * Phase 90-01: Trust Foundation
 */
export const portalNotifications = pgTable(
  "portal_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Notification metadata
    type: text("type").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),

    // Notification content
    payload: jsonb("payload").$type<NotificationPayload>().notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    failureReason: text("failure_reason"),
  },
  (table) => [
    index("ix_portal_notifications_client").on(table.clientId),
    index("ix_portal_notifications_status").on(table.status),
    index("ix_portal_notifications_type").on(table.type),
    index("ix_portal_notifications_created").on(table.createdAt),
    // Type must be valid enum value
    check(
      "chk_portal_notification_type",
      sql`type IN ('win', 'alert', 'update', 'digest')`
    ),
    // Channel must be valid enum value
    check(
      "chk_portal_notification_channel",
      sql`channel IN ('in_app', 'email', 'slack', 'push')`
    ),
    // Status must be valid enum value
    check(
      "chk_portal_notification_status",
      sql`status IN ('pending', 'sent', 'failed')`
    ),
  ]
);

// Relations
export const portalNotificationsRelations = relations(
  portalNotifications,
  ({ one }) => ({
    client: one(clients, {
      fields: [portalNotifications.clientId],
      references: [clients.id],
    }),
  })
);

// Type exports
export type PortalNotificationSelect = typeof portalNotifications.$inferSelect;
export type PortalNotificationInsert = typeof portalNotifications.$inferInsert;

/**
 * Notification settings JSONB type - additional per-channel settings
 */
export interface NotificationSettingsJson {
  slackWebhookUrl?: string;
  slackChannel?: string;
  pushEndpoint?: string;
  [key: string]: unknown;
}

/**
 * Portal Notification Settings - Per-client notification preferences.
 * Controls which notifications are sent via which channels.
 *
 * Phase 90-01: Trust Foundation
 */
export const portalNotificationSettings = pgTable("portal_notification_settings", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),

  // Win notifications (keyword hits top 10)
  winEmail: boolean("win_email").default(true),
  winSlack: boolean("win_slack").default(true),
  winPush: boolean("win_push").default(true),

  // Alert notifications (significant drops)
  alertEmail: boolean("alert_email").default(true),
  alertSlack: boolean("alert_slack").default(true),
  alertPush: boolean("alert_push").default(true),

  // Update notifications (work completed)
  updatePush: boolean("update_push").default(true),

  // Digest notifications (weekly summary)
  weeklyDigest: boolean("weekly_digest").default(true),
  digestDay: integer("digest_day").default(1), // 1 = Monday, 7 = Sunday

  // Additional channel settings
  settings: jsonb("settings").$type<NotificationSettingsJson>().default({}),

  // Timestamps
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Relations
export const portalNotificationSettingsRelations = relations(
  portalNotificationSettings,
  ({ one }) => ({
    client: one(clients, {
      fields: [portalNotificationSettings.clientId],
      references: [clients.id],
    }),
  })
);

// Type exports
export type PortalNotificationSettingsSelect =
  typeof portalNotificationSettings.$inferSelect;
export type PortalNotificationSettingsInsert =
  typeof portalNotificationSettings.$inferInsert;
