/**
 * Magic link schema for client onboarding invitations.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Provides secure, expiring tokens for white-label client credential completion.
 * Supports D-01 (dual mode) and D-02 (white-label branding) decisions.
 */
import {
  pgTable,
  text,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";
import { clients } from "./client-schema";
import { onboardingChecklists } from "./onboarding-schema";

/**
 * magic_links table - secure invitation tokens for client onboarding.
 *
 * Design decisions:
 * - 32-char nanoid token for 128 bits entropy (T-49-01 mitigation)
 * - 24-hour expiry to limit exposure window
 * - usedAt tracks single-use constraint
 * - Indexes on token (lookup) and expiresAt (cleanup)
 */
export const magicLinks = pgTable(
  "magic_links",
  {
    /** Primary key - nanoid for collision resistance */
    id: text("id").primaryKey(),

    /** Workspace that generated this link */
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    /** Client this link is for */
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    /** Associated onboarding checklist */
    checklistId: text("checklist_id")
      .notNull()
      .references(() => onboardingChecklists.id, { onDelete: "cascade" }),

    /** Specific checklist item this link completes */
    itemId: text("item_id").notNull(),

    /** Secure token - 32-char nanoid (128 bits entropy) */
    token: text("token").notNull().unique(),

    /** Expiration timestamp - 24 hours from creation */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),

    /** When token was used (null if unused) */
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),

    /** Creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Fast token lookups for validation
    uniqueIndex("ix_magic_links_token").on(table.token),
    // Cleanup queries for expired tokens
    index("ix_magic_links_expires").on(table.expiresAt),
    // Workspace-scoped queries
    index("ix_magic_links_workspace").on(table.workspaceId),
  ]
);

/**
 * Relations for type-safe queries with joins.
 */
export const magicLinksRelations = relations(magicLinks, ({ one }) => ({
  workspace: one(organization, {
    fields: [magicLinks.workspaceId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [magicLinks.clientId],
    references: [clients.id],
  }),
  checklist: one(onboardingChecklists, {
    fields: [magicLinks.checklistId],
    references: [onboardingChecklists.id],
  }),
}));

/**
 * Type exports for select and insert operations.
 */
export type MagicLinkSelect = typeof magicLinks.$inferSelect;
export type MagicLinkInsert = typeof magicLinks.$inferInsert;
