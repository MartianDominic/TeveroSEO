import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
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
  ],
);

export type ContentBriefSelect = typeof contentBriefs.$inferSelect;
export type ContentBriefInsert = typeof contentBriefs.$inferInsert;
