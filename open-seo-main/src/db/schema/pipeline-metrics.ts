/**
 * Pipeline Metrics Schema - Pre-computed dashboard metrics
 * Phase 62-01: Database schema for Agency Command Center
 *
 * Per DESIGN.md D-07: Materialized pipeline metrics refreshed periodically.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "../user-schema";

/**
 * Pipeline metrics table - pre-computed metrics per workspace.
 * One row per workspace, updated by metrics worker.
 */
export const pipelineMetrics = pgTable(
  "pipeline_metrics",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Prospect counts
    prospectsNew: integer("prospects_new").default(0).notNull(),
    prospectsAnalyzing: integer("prospects_analyzing").default(0).notNull(),
    prospectsScored: integer("prospects_scored").default(0).notNull(),
    prospectsQualified: integer("prospects_qualified").default(0).notNull(),
    prospectsContacted: integer("prospects_contacted").default(0).notNull(),
    prospectsNegotiating: integer("prospects_negotiating").default(0).notNull(),
    prospectsConverted30d: integer("prospects_converted_30d")
      .default(0)
      .notNull(),
    prospectsArchived30d: integer("prospects_archived_30d")
      .default(0)
      .notNull(),

    // Proposal counts
    proposalsDraft: integer("proposals_draft").default(0).notNull(),
    proposalsSent: integer("proposals_sent").default(0).notNull(),
    proposalsViewed: integer("proposals_viewed").default(0).notNull(),
    proposalsAccepted: integer("proposals_accepted").default(0).notNull(),
    proposalsDeclined30d: integer("proposals_declined_30d")
      .default(0)
      .notNull(),
    proposalsExpired30d: integer("proposals_expired_30d").default(0).notNull(),

    // Contract counts
    contractsDraft: integer("contracts_draft").default(0).notNull(),
    contractsSent: integer("contracts_sent").default(0).notNull(),
    contractsPendingSignature: integer("contracts_pending_signature")
      .default(0)
      .notNull(),
    contractsSigned: integer("contracts_signed").default(0).notNull(),
    contractsExecuted: integer("contracts_executed").default(0).notNull(),
    contractsExpiring7d: integer("contracts_expiring_7d").default(0).notNull(),

    // Invoice counts
    invoicesDraft: integer("invoices_draft").default(0).notNull(),
    invoicesSent: integer("invoices_sent").default(0).notNull(),
    invoicesPaid30d: integer("invoices_paid_30d").default(0).notNull(),
    invoicesOverdue: integer("invoices_overdue").default(0).notNull(),

    // Financial (cents)
    pipelineValueDraftCents: integer("pipeline_value_draft_cents")
      .default(0)
      .notNull(),
    pipelineValueSentCents: integer("pipeline_value_sent_cents")
      .default(0)
      .notNull(),
    pipelineValueSignedCents: integer("pipeline_value_signed_cents")
      .default(0)
      .notNull(),
    revenueThisMonthCents: integer("revenue_this_month_cents")
      .default(0)
      .notNull(),
    revenueLastMonthCents: integer("revenue_last_month_cents")
      .default(0)
      .notNull(),
    outstandingCents: integer("outstanding_cents").default(0).notNull(),
    overdueAmountCents: integer("overdue_amount_cents").default(0).notNull(),

    // Conversion rates (percentage * 100 for precision)
    winRatePct: integer("win_rate_pct").default(0).notNull(),
    prospectToQualifiedPct: integer("prospect_to_qualified_pct")
      .default(0)
      .notNull(),
    qualifiedToProposalPct: integer("qualified_to_proposal_pct")
      .default(0)
      .notNull(),
    proposalToSignedPct: integer("proposal_to_signed_pct")
      .default(0)
      .notNull(),

    // Cycle times (days)
    avgCycleDays: integer("avg_cycle_days").default(0).notNull(),
    avgCollectionDays: integer("avg_collection_days").default(0).notNull(),

    // Currency
    currency: text("currency").default("EUR").notNull(),

    // Metadata
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    computationDurationMs: integer("computation_duration_ms"),
  },
  (table) => [
    index("ix_pipeline_metrics_workspace").on(table.workspaceId),
    unique("uq_pipeline_metrics_workspace").on(table.workspaceId),
  ]
);

// Relations
export const pipelineMetricsRelations = relations(
  pipelineMetrics,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [pipelineMetrics.workspaceId],
      references: [organization.id],
    }),
  })
);

// Inferred types
export type PipelineMetricsSelect = typeof pipelineMetrics.$inferSelect;
export type PipelineMetricsInsert = typeof pipelineMetrics.$inferInsert;
