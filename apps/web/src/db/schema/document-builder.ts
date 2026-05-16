/**
 * Document Builder Schema
 * Phase 102-01: Foundation Schema and Types
 *
 * Drizzle schema for persuasion blocks, A/B testing variants,
 * and proposal structure tracking.
 */

import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { proposals } from "./seo-chat";
import type {
  PersuasionBlockType,
  TipTapContent,
  BlockStyling,
  PersuasionMeta,
  FrameworkValidation,
} from "@/lib/document-builder/types";

// =====================================
// Persuasion Blocks Table
// =====================================

/**
 * Persuasion blocks within proposals.
 * Each block has a type (pain_amplifier, credibility, etc.),
 * position, and rich content.
 */
export const persuasionBlocks = pgTable(
  "persuasion_blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),

    // Block type and position
    type: text("type").$type<PersuasionBlockType>().notNull(),
    position: integer("position").notNull().default(0),

    // Content (TipTap JSON format)
    content: jsonb("content").$type<TipTapContent>().default({ type: "doc", content: [] }),
    styling: jsonb("styling").$type<BlockStyling | null>().default(null),

    // Persuasion metadata for AI and framework compliance
    persuasionMeta: jsonb("persuasion_meta")
      .$type<PersuasionMeta>()
      .default({}),

    // Analytics counters
    viewCount: integer("view_count").notNull().default(0),
    dwellTimeMs: integer("dwell_time_ms").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_persuasion_blocks_proposal").on(table.proposalId),
    index("idx_persuasion_blocks_workspace").on(table.workspaceId),
    index("idx_persuasion_blocks_type").on(table.type),
    index("idx_persuasion_blocks_position").on(table.proposalId, table.position),
  ]
);

// =====================================
// Block Variants Table (A/B Testing - D-02)
// =====================================

/**
 * Variant status for A/B testing lifecycle.
 */
export type BlockVariantStatusDB = "active" | "paused" | "winner" | "loser";

/**
 * Block variants for A/B testing.
 * Normalized design per D-02 - separate table from parent blocks.
 */
export const blockVariants = pgTable(
  "block_variants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    parentBlockId: text("parent_block_id")
      .notNull()
      .references(() => persuasionBlocks.id, { onDelete: "cascade" }),

    // Variant identification
    variantName: text("variant_name").notNull().default("Control"),

    // Content (may differ from parent block)
    content: jsonb("content").$type<TipTapContent>().notNull(),
    styling: jsonb("styling").$type<BlockStyling | null>().default(null),

    // Traffic allocation (0-100 percentage)
    weight: integer("weight").notNull().default(50),

    // Analytics
    impressions: integer("impressions").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),

    // Variant state
    status: text("status").$type<BlockVariantStatusDB>().notNull().default("active"),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_block_variants_parent").on(table.parentBlockId),
    index("idx_block_variants_status").on(table.status),
    // CHECK constraint for weight 0-100 (T-102-01 mitigation)
    check("weight_range", sql`${table.weight} >= 0 AND ${table.weight} <= 100`),
  ]
);

// =====================================
// Proposal Structures Table
// =====================================

/**
 * Stores framework-based proposal structures.
 * Tracks block order and framework compliance validation.
 */
export const proposalStructures = pgTable(
  "proposal_structures",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),

    // Framework information
    frameworkId: text("framework_id"),
    frameworkName: text("framework_name"),

    // Block ordering (array of block IDs)
    blockOrder: jsonb("block_order").$type<string[]>().default([]),

    // Framework validation result
    validationResult: jsonb("validation_result")
      .$type<FrameworkValidation | null>()
      .default(null),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_proposal_structures_proposal").on(table.proposalId),
    index("idx_proposal_structures_workspace").on(table.workspaceId),
    index("idx_proposal_structures_framework").on(table.frameworkId),
  ]
);

// =====================================
// Relations
// =====================================

export const persuasionBlocksRelations = relations(
  persuasionBlocks,
  ({ one, many }) => ({
    proposal: one(proposals, {
      fields: [persuasionBlocks.proposalId],
      references: [proposals.id],
    }),
    variants: many(blockVariants),
  })
);

export const blockVariantsRelations = relations(blockVariants, ({ one }) => ({
  parentBlock: one(persuasionBlocks, {
    fields: [blockVariants.parentBlockId],
    references: [persuasionBlocks.id],
  }),
}));

export const proposalStructuresRelations = relations(
  proposalStructures,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalStructures.proposalId],
      references: [proposals.id],
    }),
  })
);

// =====================================
// Inferred Types
// =====================================

export type PersuasionBlock = typeof persuasionBlocks.$inferSelect;
export type PersuasionBlockInsert = typeof persuasionBlocks.$inferInsert;
export type BlockVariantDB = typeof blockVariants.$inferSelect;
export type BlockVariantInsert = typeof blockVariants.$inferInsert;
export type ProposalStructure = typeof proposalStructures.$inferSelect;
export type ProposalStructureInsert = typeof proposalStructures.$inferInsert;
