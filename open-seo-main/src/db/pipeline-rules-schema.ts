/**
 * Schema for prospect pipeline automation rules and logs.
 * Phase 30.5: Prospect Pipeline Automation
 *
 * Stores automation rule executions to prevent duplicates.
 * Rules themselves are defined in code (DEFAULT_PROSPECT_RULES).
 */
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { prospects } from "./prospect-schema";

/**
 * Pipeline automation logs - tracks executed automation rules for prospects.
 * Similar to proposal automationLogs but for prospect pipeline.
 */
export const pipelineAutomationLogs = pgTable(
  "pipeline_automation_logs",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    fromStage: text("from_stage").notNull(),
    toStage: text("to_stage").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_pipeline_logs_prospect").on(table.prospectId),
    index("ix_pipeline_logs_prospect_rule").on(table.prospectId, table.ruleId),
  ]
);

// Relations
export const pipelineAutomationLogsRelations = relations(
  pipelineAutomationLogs,
  ({ one }) => ({
    prospect: one(prospects, {
      fields: [pipelineAutomationLogs.prospectId],
      references: [prospects.id],
    }),
  })
);

// Inferred types
export type PipelineAutomationLogSelect =
  typeof pipelineAutomationLogs.$inferSelect;
export type PipelineAutomationLogInsert =
  typeof pipelineAutomationLogs.$inferInsert;
