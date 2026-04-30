/**
 * Pipeline configuration schema for agency pipeline.
 * Phase 50: Pipeline Kanban
 *
 * Provides per-workspace configurable pipeline stages for the sales kanban.
 * Implements D-05 (full pipeline stages), D-06 (configurable stages).
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";

/**
 * PipelineStageConfig interface for JSONB stages array.
 * Each stage has id, name, order, and color.
 */
export interface PipelineStageConfig {
  id: string; // slug: "new", "qualified", "won"
  name: string; // display: "New", "Qualified", "Won"
  order: number; // 0, 1, 2, ...
  color: string; // hex: "#10b981"
}

/**
 * D-05: Default pipeline stages per CONTEXT.md
 * New -> Analyzing -> Qualified -> Proposal Sent -> Negotiating -> Won -> Onboarding -> Active Client
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: "new", name: "New", order: 0, color: "#6b7280" },
  { id: "analyzing", name: "Analyzing", order: 1, color: "#3b82f6" },
  { id: "qualified", name: "Qualified", order: 2, color: "#10b981" },
  { id: "proposal_sent", name: "Proposal Sent", order: 3, color: "#f59e0b" },
  { id: "negotiating", name: "Negotiating", order: 4, color: "#8b5cf6" },
  { id: "won", name: "Won", order: 5, color: "#22c55e" },
  { id: "onboarding", name: "Onboarding", order: 6, color: "#06b6d4" },
  { id: "active_client", name: "Active Client", order: 7, color: "#14b8a6" },
];

/**
 * pipeline_configs table - per-workspace pipeline stage configuration.
 *
 * Stores configurable stages as JSONB for flexibility while allowing
 * agencies to customize their sales funnel per D-06.
 */
export const pipelineConfigs = pgTable(
  "pipeline_configs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stages: jsonb("stages").$type<PipelineStageConfig[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ix_pipeline_configs_workspace").on(table.workspaceId),
  ],
);

/**
 * Relations for type-safe queries with joins.
 */
export const pipelineConfigsRelations = relations(pipelineConfigs, ({ one }) => ({
  workspace: one(organization, {
    fields: [pipelineConfigs.workspaceId],
    references: [organization.id],
  }),
}));

/**
 * Type exports for select and insert operations.
 */
export type PipelineConfigSelect = typeof pipelineConfigs.$inferSelect;
export type PipelineConfigInsert = typeof pipelineConfigs.$inferInsert;
