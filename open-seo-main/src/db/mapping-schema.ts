import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

// Action types for keyword-page mapping
export const MAPPING_ACTIONS = ["optimize", "create"] as const;
export type MappingAction = (typeof MAPPING_ACTIONS)[number];

export const keywordPageMapping = pgTable(
  "keyword_page_mapping",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    targetUrl: text("target_url"), // Null if action='create' (no existing page)
    action: text("action").notNull(), // 'optimize' or 'create'
    relevanceScore: real("relevance_score"), // 0-100, null if action='create'
    reason: text("reason"), // "Already position X" or "Best match (Y% relevant)"
    searchVolume: integer("search_volume"),
    difficulty: integer("difficulty"),
    currentPosition: integer("current_position"), // From GSC/rankings
    currentUrl: text("current_url"), // Which page currently ranks (may differ from target)
    isManualOverride: boolean("is_manual_override").default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_mapping_project_keyword").on(table.projectId, table.keyword),
    index("ix_mapping_project").on(table.projectId),
    index("ix_mapping_target_url").on(table.targetUrl),
    index("ix_mapping_action").on(table.action),
  ],
);

export type KeywordPageMappingSelect = typeof keywordPageMapping.$inferSelect;
export type KeywordPageMappingInsert = typeof keywordPageMapping.$inferInsert;
