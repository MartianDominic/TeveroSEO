/**
 * Schema for OAuth state management (CSRF protection).
 * Phase 61-01: Platform Integration Excellence
 *
 * Stores temporary OAuth state parameters for CSRF protection.
 * Each state has a 10-minute expiry and is invalidated after use.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./user-schema";
import { prospects } from "./prospect-schema";

/**
 * OAuth states table - stores temporary CSRF tokens for OAuth flows.
 * Each state parameter is unique and expires after 10 minutes.
 * The state is marked as used (usedAt) after successful token exchange.
 */
export const oauthStates = pgTable(
  "oauth_states",
  {
    id: text("id").primaryKey(),

    // Random CSRF token - must be unique
    state: text("state").notNull().unique(),

    // OAuth flow context
    platform: text("platform").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    prospectId: text("prospect_id").references(() => prospects.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").notNull(),

    // OAuth configuration
    redirectUri: text("redirect_uri").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),

    // Expiry and usage tracking
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    usedAt: timestamp("used_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Standard timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow(),
  },
  (table) => [
    // Unique index on state for fast lookup
    uniqueIndex("idx_oauth_states_state").on(table.state),
  ]
);

// Inferred types for database operations
export type OAuthStateSelect = typeof oauthStates.$inferSelect;
export type OAuthStateInsert = typeof oauthStates.$inferInsert;
