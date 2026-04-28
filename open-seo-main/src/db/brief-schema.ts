import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { keywordPageMapping } from "./mapping-schema";

// Brief status workflow: draft → ready → generating → published
export const BRIEF_STATUSES = [
  "draft",
  "ready",
  "generating",
  "published",
] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

// Voice mode selection: preservation (match existing), application (brand guidelines), best_practices (SEO optimized)
export const VOICE_MODES = [
  "preservation",
  "application",
  "best_practices",
] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

// SERP analysis data structure stored as JSONB
export interface SerpAnalysisData {
  commonH2s: { heading: string; frequency: number }[];
  paaQuestions: string[];
  competitorWordCounts: number[];
  metaLengths: { title: number; description: number };
  analyzedAt: string; // ISO timestamp
  location: string;
}

export const contentBriefs = pgTable(
  "content_briefs",
  {
    id: text("id").primaryKey(),
    mappingId: text("mapping_id")
      .notNull()
      .references(() => keywordPageMapping.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(), // Denormalized for quick access
    targetWordCount: integer("target_word_count").notNull(),
    voiceMode: text("voice_mode").notNull(), // One of VOICE_MODES
    status: text("status").notNull().default("draft"), // One of BRIEF_STATUSES
    serpAnalysis: jsonb("serp_analysis").$type<SerpAnalysisData>(),
    articleId: text("article_id"), // Nullable FK to AI-Writer articles
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_briefs_mapping").on(table.mappingId),
    index("ix_briefs_status").on(table.status),
    // M-18: Target word count must be reasonable (100-50000)
    check("chk_target_word_count_range", sql`target_word_count >= 100 AND target_word_count <= 50000`),
    // M-19: Voice mode must be valid enum value
    check("chk_voice_mode_valid", sql`voice_mode IN ('preservation', 'application', 'best_practices')`),
    // Brief status must be valid enum value
    check("chk_brief_status_valid", sql`status IN ('draft', 'ready', 'generating', 'published')`),
  ],
);

export type ContentBriefSelect = typeof contentBriefs.$inferSelect;
export type ContentBriefInsert = typeof contentBriefs.$inferInsert;
