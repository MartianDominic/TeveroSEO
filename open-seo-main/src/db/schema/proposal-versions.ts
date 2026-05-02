/**
 * Proposal Versions Schema - Version history for proposals
 * Phase 57-06: Auto-Save + Version History
 *
 * Stores content snapshots for version history with restore capability.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { proposals, type ProposalContent } from "../proposal-schema";

// Change types for version tracking
export const CHANGE_TYPES = [
  "content_edit",
  "section_reorder",
  "section_add",
  "section_delete",
  "ai_generated",
  "restore",
  "initial",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/**
 * Proposal versions table - stores content snapshots.
 * Each version captures the full proposal state at a point in time.
 */
export const proposalVersions = pgTable(
  "proposal_versions",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),

    // Version number auto-incremented per proposal
    versionNumber: integer("version_number").notNull(),

    // Content snapshot
    content: jsonb("content").$type<ProposalContent>().notNull(),
    sectionOrder: jsonb("section_order").$type<string[]>(),

    // Change metadata
    changeType: text("change_type").$type<ChangeType>().notNull(),
    changeDescription: text("change_description"),
    changeDescriptionEn: text("change_description_en"),
    changeDescriptionLt: text("change_description_lt"),
    changedSections: text("changed_sections").array(),

    // Authorship
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_proposal_versions_proposal").on(table.proposalId),
    index("ix_proposal_versions_proposal_version").on(
      table.proposalId,
      table.versionNumber
    ),
    index("ix_proposal_versions_created_at").on(table.createdAt),
  ]
);

// Relations
export const proposalVersionsRelations = relations(
  proposalVersions,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalVersions.proposalId],
      references: [proposals.id],
    }),
  })
);

// Inferred types
export type ProposalVersionSelect = typeof proposalVersions.$inferSelect;
export type ProposalVersionInsert = typeof proposalVersions.$inferInsert;
