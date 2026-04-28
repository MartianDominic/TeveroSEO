/**
 * Schema for cross-client pattern detection.
 * Phase 25: Team & Intelligence
 */
import {
  pgTable,
  text,
  integer,
  numeric,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Detected cross-client patterns.
 * Stores traffic drops, ranking shifts, industry trends, and SERP changes
 * that affect multiple clients simultaneously.
 */
export const detectedPatterns = pgTable(
  "detected_patterns",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),

    // Pattern classification
    patternType: text("pattern_type").notNull(), // 'traffic_drop', 'ranking_shift', 'industry_trend', 'serp_change'
    title: text("title").notNull(),
    description: text("description"),

    // Affected clients
    affectedClientIds: jsonb("affected_client_ids").$type<string[]>(),
    affectedCount: integer("affected_count").default(0),

    // Pattern details
    magnitude: numeric("magnitude"), // Avg change %
    direction: text("direction"), // 'up', 'down', 'volatile'
    confidence: numeric("confidence"), // 0-100 confidence score

    // Time range
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),

    // Status
    status: text("status").default("active"), // 'active', 'resolved', 'dismissed'
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),

    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_detected_patterns_workspace").on(table.workspaceId),
    index("idx_detected_patterns_type").on(table.patternType),
    index("idx_detected_patterns_status").on(table.status),
  ]
);

export type DetectedPatternSelect = typeof detectedPatterns.$inferSelect;
export type DetectedPatternInsert = typeof detectedPatterns.$inferInsert;
