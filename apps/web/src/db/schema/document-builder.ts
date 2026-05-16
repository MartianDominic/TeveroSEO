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
import { seoChatProposals } from "./seo-chat";
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
      .references(() => seoChatProposals.id, { onDelete: "cascade" }),
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
      .references(() => seoChatProposals.id, { onDelete: "cascade" }),
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
    proposal: one(seoChatProposals, {
      fields: [persuasionBlocks.proposalId],
      references: [seoChatProposals.id],
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
    proposal: one(seoChatProposals, {
      fields: [proposalStructures.proposalId],
      references: [seoChatProposals.id],
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

// =====================================
// Uploaded Documents Table (102-07)
// =====================================

/**
 * Uploaded documents for processing.
 * Tracks files uploaded to R2 and their processing status.
 */
export const uploadedDocuments = pgTable(
  "uploaded_documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workspaceId: text("workspace_id").notNull(),

    // File metadata
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(), // 'pdf' | 'docx' | 'image'
    fileSize: integer("file_size").notNull(), // bytes
    mimeType: text("mime_type").notNull(),

    // Storage
    r2Key: text("r2_key").notNull(),
    r2Bucket: text("r2_bucket").notNull().default("documents"),

    // Processing state
    status: text("status").notNull().default("pending"), // pending | processing | completed | failed
    processingProgress: integer("processing_progress").notNull().default(0), // 0-100
    processingError: text("processing_error"),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true, mode: "date" }),
    processingCompletedAt: timestamp("processing_completed_at", { withTimezone: true, mode: "date" }),

    // Extracted data (populated after processing)
    extractedText: jsonb("extracted_text"),
    extractedMetadata: jsonb("extracted_metadata"), // fonts, colors, structure hints
    ocrTier: text("ocr_tier"), // 'native' | 'tesseract' | 'deepseek' | 'gemini'
    ocrConfidence: integer("ocr_confidence"), // 0-100

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_uploaded_documents_workspace").on(table.workspaceId),
    index("idx_uploaded_documents_status").on(table.status),
  ]
);

export type UploadedDocument = typeof uploadedDocuments.$inferSelect;
export type NewUploadedDocument = typeof uploadedDocuments.$inferInsert;

// =====================================
// Detected Structures Table (102-10)
// =====================================

/**
 * Detected variable in content.
 */
export interface DetectedVariable {
  id: string;
  originalText: string;
  suggestedVariable: string;
  variableType: "company_name" | "contact_name" | "price" | "date" | "domain" | "percentage" | "custom";
  confidence: number;
  occurrences: number;
  positions: Array<{ start: number; end: number }>;
}

/**
 * AI-detected structures from uploaded documents.
 * Stores blocks detected during processing with confidence scores.
 * User can verify, adjust, or reject detections before creating proposals.
 */
export const detectedStructures = pgTable(
  "detected_structures",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    documentId: text("document_id")
      .notNull()
      .references(() => uploadedDocuments.id, { onDelete: "cascade" }),

    // Block classification
    blockType: text("block_type").$type<PersuasionBlockType | "heading" | "paragraph" | "table" | "list" | "image" | "unknown">().notNull(),
    position: integer("position").notNull().default(0),

    // AI confidence (0-100)
    confidence: integer("confidence").notNull().default(0),

    // Original extracted text
    originalText: text("original_text").notNull(),

    // AI-suggested improved content (optional)
    suggestedContent: text("suggested_content"),

    // Variables detected in this block
    detectedVariables: jsonb("detected_variables").$type<DetectedVariable[]>().default([]),

    // User verification status
    verified: text("verified").$type<"pending" | "accepted" | "rejected" | "modified">().notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    verifiedBy: text("verified_by"),

    // AI reasoning for classification (for debugging/improvement)
    reasoning: text("reasoning"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_detected_structures_document").on(table.documentId),
    index("idx_detected_structures_type").on(table.blockType),
    index("idx_detected_structures_verified").on(table.verified),
    check("confidence_range", sql`${table.confidence} >= 0 AND ${table.confidence} <= 100`),
  ]
);

// Relations for detectedStructures
export const detectedStructuresRelations = relations(
  detectedStructures,
  ({ one }) => ({
    document: one(uploadedDocuments, {
      fields: [detectedStructures.documentId],
      references: [uploadedDocuments.id],
    }),
  })
);

export type DetectedStructure = typeof detectedStructures.$inferSelect;
export type NewDetectedStructure = typeof detectedStructures.$inferInsert;
