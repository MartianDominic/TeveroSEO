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
import { organization } from "./user-schema";
import { softDeleteColumns } from "./soft-delete-columns";

/**
 * Detected cross-client patterns.
 * Stores traffic drops, ranking shifts, industry trends, and SERP changes
 * that affect multiple clients simultaneously.
 */
export const detectedPatterns = pgTable(
  "detected_patterns",
  {
    id: text("id").primaryKey(),
    // SCHEMA-FK: Added FK constraint to organization
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

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

    // SCHEMA-SOFTDELETE: Standard soft delete column
    ...softDeleteColumns,
  },
  (table) => [
    index("idx_detected_patterns_workspace").on(table.workspaceId),
    index("idx_detected_patterns_type").on(table.patternType),
    index("idx_detected_patterns_status").on(table.status),
    index("idx_detected_patterns_soft_deleted").on(table.softDeletedAt),
  ]
);

export type DetectedPatternSelect = typeof detectedPatterns.$inferSelect;
export type DetectedPatternInsert = typeof detectedPatterns.$inferInsert;
