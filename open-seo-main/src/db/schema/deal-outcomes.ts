/**
 * Deal Outcomes Schema - Win/Loss tracking and analysis
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-06: Track deal outcomes with detailed loss reasons.
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
import { organization, user } from "../user-schema";

// Loss reason taxonomy (17 values)
export const LOSS_REASONS = [
  // Pricing
  "too_expensive",
  "budget_cut",
  "competitor_cheaper",
  // Timing
  "bad_timing",
  "project_delayed",
  "internal_changes",
  // Fit
  "wrong_fit",
  "scope_mismatch",
  "different_direction",
  // Competition
  "chose_competitor",
  "went_internal",
  "found_alternative",
  // Process
  "unresponsive",
  "ghosted",
  "decision_maker_left",
  // Other
  "unknown",
  "other",
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

// Deal outcome values
export const DEAL_OUTCOMES = ["won", "lost"] as const;
export type DealOutcome = (typeof DEAL_OUTCOMES)[number];

// Entity types for deal outcomes (subset of full entity types)
export const DEAL_ENTITY_TYPES = ["prospect", "proposal"] as const;
export type DealEntityType = (typeof DEAL_ENTITY_TYPES)[number];

/**
 * Deal outcomes table - tracks win/loss for analytics.
 */
export const dealOutcomes = pgTable(
  "deal_outcomes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Source entity
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),

    // Outcome
    outcome: text("outcome").notNull(),
    lossReason: text("loss_reason"),
    lossReasonDetail: text("loss_reason_detail"),
    competitorName: text("competitor_name"),

    // Value tracking
    dealValueCents: integer("deal_value_cents"),
    currency: text("currency").default("EUR").notNull(),

    // Timeline
    firstContactAt: timestamp("first_contact_at", {
      withTimezone: true,
      mode: "date",
    }),
    proposalSentAt: timestamp("proposal_sent_at", {
      withTimezone: true,
      mode: "date",
    }),
    outcomeAt: timestamp("outcome_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    cycleDays: integer("cycle_days"),

    // Attributed to
    ownerId: text("owner_id").references(() => user.id),

    // Metadata
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_deal_outcomes_workspace_outcome").on(
      table.workspaceId,
      table.outcome
    ),
    index("ix_deal_outcomes_workspace_date").on(
      table.workspaceId,
      table.outcomeAt
    ),
    index("ix_deal_outcomes_workspace_reason").on(
      table.workspaceId,
      table.lossReason
    ),
    check(
      "chk_deal_outcomes_entity_type",
      sql`entity_type IN ('prospect', 'proposal')`
    ),
    check("chk_deal_outcomes_outcome", sql`outcome IN ('won', 'lost')`),
    check(
      "chk_deal_outcomes_loss_reason",
      sql`loss_reason IS NULL OR loss_reason IN (
        'too_expensive', 'budget_cut', 'competitor_cheaper',
        'bad_timing', 'project_delayed', 'internal_changes',
        'wrong_fit', 'scope_mismatch', 'different_direction',
        'chose_competitor', 'went_internal', 'found_alternative',
        'unresponsive', 'ghosted', 'decision_maker_left',
        'unknown', 'other'
      )`
    ),
  ]
);

// Relations
export const dealOutcomesRelations = relations(dealOutcomes, ({ one }) => ({
  workspace: one(organization, {
    fields: [dealOutcomes.workspaceId],
    references: [organization.id],
  }),
  owner: one(user, {
    fields: [dealOutcomes.ownerId],
    references: [user.id],
  }),
}));

// Inferred types
export type DealOutcomeSelect = typeof dealOutcomes.$inferSelect;
export type DealOutcomeInsert = typeof dealOutcomes.$inferInsert;
