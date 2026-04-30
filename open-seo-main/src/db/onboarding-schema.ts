/**
 * Onboarding checklists schema for agency pipeline.
 * Phase 45: Data Foundation - Onboarding Checklists
 *
 * Provides per-tier checklist templates for client onboarding,
 * with progress tracking and auto-completion event support.
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";
import { clients } from "./client-schema";

/**
 * Service tier enum for onboarding checklists.
 * Each tier has different checklist item requirements.
 */
export const SERVICE_TIERS = ["starter", "growth", "enterprise"] as const;
export type ServiceTier = (typeof SERVICE_TIERS)[number];

/**
 * Checklist category enum for organizing items.
 */
export const CHECKLIST_CATEGORIES = [
  "setup",
  "credentials",
  "kickoff",
  "content",
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

/**
 * ChecklistItem interface for JSONB items array.
 * Each item tracks completion status and optional auto-complete triggers.
 */
export interface ChecklistItem {
  id: string;
  label: string;
  category: ChecklistCategory;
  autoCompleteEvent?: string; // e.g., "gsc_connected", "kickoff_completed"
  completedAt?: string; // ISO date string
  completedBy?: string; // user ID who completed
}

/**
 * onboarding_checklists table - per-client onboarding tracking.
 *
 * Stores checklist items as JSONB for flexibility while maintaining
 * progress counts for efficient querying.
 */
export const onboardingChecklists = pgTable(
  "onboarding_checklists",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    serviceTier: text("service_tier").notNull(),
    items: jsonb("items").$type<ChecklistItem[]>().notNull(),
    completedCount: integer("completed_count").notNull().default(0),
    totalCount: integer("total_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ix_checklists_workspace").on(table.workspaceId),
    index("ix_checklists_client").on(table.clientId),
    index("ix_checklists_tier").on(table.serviceTier),
  ],
);

/**
 * Relations for type-safe queries with joins.
 */
export const onboardingChecklistsRelations = relations(
  onboardingChecklists,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [onboardingChecklists.workspaceId],
      references: [organization.id],
    }),
    client: one(clients, {
      fields: [onboardingChecklists.clientId],
      references: [clients.id],
    }),
  }),
);

/**
 * Type exports for select and insert operations.
 */
export type OnboardingChecklistSelect =
  typeof onboardingChecklists.$inferSelect;
export type OnboardingChecklistInsert =
  typeof onboardingChecklists.$inferInsert;
