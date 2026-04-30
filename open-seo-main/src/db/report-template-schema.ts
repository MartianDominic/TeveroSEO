/**
 * Drizzle ORM schema for report templates.
 * Phase 53: Templates store reusable report configurations with section selections.
 *
 * Templates are workspace-scoped (via organization reference).
 * Each template stores section configuration as JSONB for flexibility.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { organization } from "./user-schema";

/**
 * Report section type (matches @tevero/types ReportSectionType).
 */
export type ReportSectionType =
  | "header"
  | "summary_stats"
  | "gsc_chart"
  | "ga4_chart"
  | "queries_table"
  | "footer";

/**
 * Report section stored in template.
 */
export interface ReportSection {
  type: ReportSectionType;
  order: number;
  config?: Record<string, unknown>;
}

/**
 * Report templates table.
 * Stores saved report configurations per workspace.
 *
 * Security:
 * - T-53-11: Workspace ownership verified on all template operations
 * - T-53-12: Zod schema validates section types against enum
 * - T-53-13: Max 10 sections per template, max 100 character name
 */
export const reportTemplates = pgTable(
  "report_templates",
  {
    id: text("id").primaryKey(), // ulid or uuid string
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // JSONB array of ReportSection objects
    sections: jsonb("sections").$type<ReportSection[]>().notNull(),
    locale: text("locale").notNull().default("en"),
    // Is this the default template for the workspace?
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_report_templates_workspace_id").on(table.workspaceId),
  ],
);

// Type exports for use in queries
export type ReportTemplateSelect = typeof reportTemplates.$inferSelect;
export type ReportTemplateInsert = typeof reportTemplates.$inferInsert;
