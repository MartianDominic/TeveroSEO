/**
 * Document section tracking schema for enhanced analytics.
 * Phase 101: Direct Proposal & Manual Deal Pipeline (D-04)
 *
 * Provides section-level analytics for proposals and documents:
 * - Time spent per section (not just "viewed")
 * - Scroll depth tracking
 * - Entered/exited timestamps for engagement analysis
 *
 * This extends the existing proposalViews with granular section data.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { proposals, proposalViews } from "./proposal-schema";

// ============================================================================
// Document Section Views Table
// ============================================================================

/**
 * Document section views - tracks section-level engagement.
 *
 * Each record represents one section view within a proposal view session.
 * Links to both the proposal and the parent view record.
 */
export const documentSectionViews = pgTable(
  "document_section_views",
  {
    id: text("id").primaryKey(),

    // Parent references
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    viewId: text("view_id")
      .notNull()
      .references(() => proposalViews.id, { onDelete: "cascade" }),

    // Section identification
    sectionId: text("section_id").notNull(), // e.g., "pricing", "deliverables", "timeline"
    sectionName: text("section_name").notNull(), // Human-readable name

    // Engagement metrics
    timeSpentMs: integer("time_spent_ms").notNull(), // Milliseconds spent in section
    scrollDepth: integer("scroll_depth"), // 0-100, percentage of section scrolled

    // Session timestamps
    enteredAt: timestamp("entered_at", { withTimezone: true, mode: "date" }).notNull(),
    exitedAt: timestamp("exited_at", { withTimezone: true, mode: "date" }), // nullable if session ended abruptly
  },
  (table) => [
    index("ix_section_views_proposal").on(table.proposalId),
    index("ix_section_views_view").on(table.viewId),
    index("ix_section_views_section").on(table.sectionId),
  ]
);

// ============================================================================
// Relations
// ============================================================================

export const documentSectionViewsRelations = relations(
  documentSectionViews,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [documentSectionViews.proposalId],
      references: [proposals.id],
    }),
    view: one(proposalViews, {
      fields: [documentSectionViews.viewId],
      references: [proposalViews.id],
    }),
  })
);

// ============================================================================
// Type Exports
// ============================================================================

export type DocumentSectionViewSelect = typeof documentSectionViews.$inferSelect;
export type DocumentSectionViewInsert = typeof documentSectionViews.$inferInsert;
