/**
 * Research Session Schema
 *
 * Tracks keyword research sessions for coverage analysis.
 * Supports deduplication tracking and cost attribution.
 */

import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { prospects } from "./prospect-schema";

// Research modes
export const RESEARCH_MODES = [
  "EXPAND", // New seed keywords
  "DEEP_DIVE", // From cluster exploration
  "COMPETITOR", // Gap analysis
  "REFRESH_VOLUMES", // Background volume update
] as const;
export type ResearchMode = (typeof RESEARCH_MODES)[number];

// Session metadata by mode
export interface SessionMetadata {
  cluster_id?: string;
  competitor_domain?: string;
  parent_session_id?: string;
  user_intent?: string;
}

/**
 * Research Sessions table - tracks when/what was researched
 * for coverage dashboard and deduplication.
 */
export const researchSessions = pgTable(
  "research_sessions",
  {
    id: text("id").primaryKey(), // nanoid
    prospectId: text("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),

    // Research parameters
    mode: text("mode").notNull(), // ResearchMode
    seedKeywords: jsonb("seed_keywords").$type<string[]>().notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),

    // Results
    newKeywordsCount: integer("new_keywords_count").notNull(),
    duplicateCount: integer("duplicate_count").notNull(),
    totalCostUsd: real("total_cost_usd").notNull(),

    // Audit trail
    triggeredBy: text("triggered_by").notNull(), // user_id or "system"
    metadata: jsonb("metadata").$type<SessionMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_research_sessions_prospect").on(table.prospectId),
    index("ix_research_sessions_created").on(table.createdAt),
    index("ix_research_sessions_mode").on(table.mode),
  ]
);

export type ResearchSessionSelect = typeof researchSessions.$inferSelect;
export type ResearchSessionInsert = typeof researchSessions.$inferInsert;
