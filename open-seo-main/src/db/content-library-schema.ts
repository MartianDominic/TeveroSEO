/**
 * Content Library schema for reusable proposal/document blocks.
 * Phase 101: Direct Proposal & Manual Deal Pipeline (D-04)
 *
 * Provides:
 * - contentBlocks: Reusable content snippets with localization
 * - blockUsage: Tracks where blocks are used for analytics
 *
 * Categories per D-04:
 * - case_study: Client success stories
 * - testimonial: Client quotes/reviews
 * - pricing_table: Service pricing structures
 * - legal_clause: Contract terms, disclaimers
 * - team_bio: Team member introductions
 * - methodology: Process explanations
 * - faq: Frequently asked questions
 * - custom: User-defined blocks
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { softDeleteColumns } from "./soft-delete-columns";

// ============================================================================
// Type/Enum Exports
// ============================================================================

/**
 * Content block categories.
 * 8 types as specified in D-04.
 */
export const CONTENT_BLOCK_CATEGORIES = [
  "case_study",
  "testimonial",
  "pricing_table",
  "legal_clause",
  "team_bio",
  "methodology",
  "faq",
  "custom",
] as const;
export type ContentBlockCategory = (typeof CONTENT_BLOCK_CATEGORIES)[number];

// ============================================================================
// Content Blocks Table
// ============================================================================

/**
 * Content blocks - reusable content for proposals and documents.
 *
 * Supports localization with separate fields for each language.
 * Tracks usage count for analytics on most-used blocks.
 */
export const contentBlocks = pgTable(
  "content_blocks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Block metadata
    name: text("name").notNull(),
    category: text("category").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Localized content
    content: text("content").notNull(), // Default language content
    contentEn: text("content_en"), // English variant
    contentLt: text("content_lt"), // Lithuanian variant

    // Usage tracking
    usageCount: integer("usage_count").default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"), // User ID who created the block

    // Soft delete support
    ...softDeleteColumns,
  },
  (table) => [
    index("ix_content_blocks_workspace").on(table.workspaceId),
    index("ix_content_blocks_category").on(table.category),
    check(
      "chk_content_block_category",
      sql`category IN ('case_study', 'testimonial', 'pricing_table', 'legal_clause', 'team_bio', 'methodology', 'faq', 'custom')`
    ),
  ]
);

// ============================================================================
// Block Usage Table
// ============================================================================

/**
 * Block usage - tracks where content blocks are used.
 *
 * Polymorphic reference to entity (proposal, contract, document).
 * Enables analytics on which blocks are most popular.
 */
export const blockUsage = pgTable(
  "block_usage",
  {
    id: text("id").primaryKey(),
    blockId: text("block_id")
      .notNull()
      .references(() => contentBlocks.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // 'proposal', 'contract', 'document'
    entityId: text("entity_id").notNull(),
    insertedAt: timestamp("inserted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    insertedBy: text("inserted_by"), // User ID who inserted the block
  },
  (table) => [
    index("ix_block_usage_block").on(table.blockId),
    index("ix_block_usage_entity").on(table.entityType, table.entityId),
  ]
);

// ============================================================================
// Relations
// ============================================================================

export const contentBlocksRelations = relations(
  contentBlocks,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [contentBlocks.workspaceId],
      references: [organization.id],
    }),
    usages: many(blockUsage),
  })
);

export const blockUsageRelations = relations(blockUsage, ({ one }) => ({
  block: one(contentBlocks, {
    fields: [blockUsage.blockId],
    references: [contentBlocks.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type ContentBlockSelect = typeof contentBlocks.$inferSelect;
export type ContentBlockInsert = typeof contentBlocks.$inferInsert;
export type BlockUsageSelect = typeof blockUsage.$inferSelect;
export type BlockUsageInsert = typeof blockUsage.$inferInsert;
