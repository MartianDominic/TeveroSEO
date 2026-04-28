/**
 * Schema for automation execution logs.
 * Phase 30-08: Pipeline & Automation
 *
 * Persists automation execution history to prevent duplicate executions
 * after server restarts.
 */
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { proposals } from "./proposal-schema";

/**
 * Automation logs table - tracks executed automation rules.
 * Used to prevent duplicate automation executions for the same proposal/rule combination.
 */
export const automationLogs = pgTable(
  "automation_logs",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    actionType: text("action_type").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_automation_logs_proposal").on(table.proposalId),
    index("ix_automation_logs_proposal_rule").on(table.proposalId, table.ruleId),
  ]
);

// Relations
export const automationLogsRelations = relations(automationLogs, ({ one }) => ({
  proposal: one(proposals, {
    fields: [automationLogs.proposalId],
    references: [proposals.id],
  }),
}));

// Inferred types for database operations
export type AutomationLogSelect = typeof automationLogs.$inferSelect;
export type AutomationLogInsert = typeof automationLogs.$inferInsert;
