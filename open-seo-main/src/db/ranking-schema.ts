/**
 * Drizzle ORM schema for keyword rank tracking history.
 *
 * Daily position snapshots for saved keywords.
 * One row per keyword per day, storing position and SERP features.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { savedKeywords } from "./app.schema";

/**
 * Daily rank position snapshots for saved keywords.
 * One row per keyword per day, storing position and SERP features.
 */
export const keywordRankings = pgTable(
  "keyword_rankings",
  {
    id: text("id").primaryKey(), // UUID v7 for time-sortable IDs
    keywordId: text("keyword_id")
      .notNull()
      .references(() => savedKeywords.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // 1-100, or 0 if not ranking
    previousPosition: integer("previous_position"), // For calculating change
    url: text("url"), // The URL that ranks for this keyword
    date: timestamp("date", { withTimezone: true, mode: "date" }).notNull(),
    serpFeatures: jsonb("serp_features").$type<string[]>(), // ["featured_snippet", "local_pack", etc.]
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Prevent duplicate entries for same keyword on same day
    uniqueIndex("uq_rankings_keyword_date").on(table.keywordId, table.date),
    // Index for querying by date range
    index("ix_rankings_date").on(table.date),
    // Index for querying by keyword
    index("ix_rankings_keyword_id").on(table.keywordId),
  ],
);

// Type exports for use in queries
export type KeywordRankingSelect = typeof keywordRankings.$inferSelect;
export type KeywordRankingInsert = typeof keywordRankings.$inferInsert;
