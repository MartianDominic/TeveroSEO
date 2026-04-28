/**
 * Schema for rank drop events.
 *
 * Records ranking drops that exceed the configured threshold.
 * Phase 18's alert system consumes these events.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { savedKeywords } from "./app.schema";

/**
 * Rank drop events for alerting.
 * Created when a keyword's position drops by more than the threshold.
 */
export const rankDropEvents = pgTable(
  "rank_drop_events",
  {
    id: text("id").primaryKey(), // UUID v7
    keywordId: text("keyword_id")
      .notNull()
      .references(() => savedKeywords.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    clientId: text("client_id"), // Nullable for backwards compatibility
    keyword: text("keyword").notNull(), // Denormalized for easy display
    previousPosition: integer("previous_position").notNull(),
    currentPosition: integer("current_position").notNull(),
    dropAmount: integer("drop_amount").notNull(), // Positive number (e.g., 10 means dropped 10 positions)
    threshold: integer("threshold").notNull(), // The threshold that triggered this event
    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }), // When alert system processed
    processedBy: text("processed_by"), // "alert_worker" or "manual"
  },
  (table) => [
    // For efficient queue scanning of unprocessed events
    index("ix_rank_drop_events_client_processed").on(table.clientId, table.processedAt),
    // For querying by keyword
    index("ix_rank_drop_events_keyword").on(table.keywordId),
    // For chronological listing
    index("ix_rank_drop_events_detected").on(table.detectedAt),
  ],
);

export type RankDropEventSelect = typeof rankDropEvents.$inferSelect;
export type RankDropEventInsert = typeof rankDropEvents.$inferInsert;
