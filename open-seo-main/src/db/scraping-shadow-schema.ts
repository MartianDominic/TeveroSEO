/**
 * Shadow Comparison Logs Schema
 * Phase 95-05: Migration & Monitoring
 *
 * Stores shadow mode comparison results for analysis:
 * - Feature being tested
 * - Legacy vs new implementation status
 * - Match/mismatch results
 * - Performance timing data
 * - Detailed differences for debugging
 *
 * Replaces the in-memory buffer (MIG-3) with persistent storage.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  real,
  index,
} from "drizzle-orm/pg-core";

// =============================================================================
// Schema Definition
// =============================================================================

/**
 * Shadow comparison logs table.
 *
 * Stores results from shadow mode testing where both legacy
 * and new implementations run in parallel for comparison.
 */
export const shadowComparisonLogs = pgTable(
  "scraping_shadow_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Feature classification
    feature: text("feature").notNull(),
    url: text("url"),

    // Status from each implementation
    legacyStatus: text("legacy_status").notNull(),
    newStatus: text("new_status").notNull(),

    // Comparison result
    matches: boolean("matches").notNull(),
    matchScore: real("match_score"),

    // Performance timing
    legacyDurationMs: real("legacy_duration_ms"),
    newDurationMs: real("new_duration_ms"),

    // Cost tracking (optional)
    legacyCost: real("legacy_cost"),
    newCost: real("new_cost"),

    // Detailed differences (for debugging mismatches)
    differences: jsonb("differences").$type<string[]>(),

    // Sample diff (first difference for quick viewing)
    sampleDiff: text("sample_diff"),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Query patterns:
    // 1. Analysis by feature over time
    index("ix_shadow_logs_feature_created").on(
      table.feature,
      table.createdAt
    ),

    // 2. Find mismatches for investigation
    index("ix_shadow_logs_matches_created").on(
      table.matches,
      table.createdAt
    ),

    // 3. Cleanup old logs (retention policy)
    index("ix_shadow_logs_created_at").on(table.createdAt),

    // 4. Feature + match status for targeted analysis
    index("ix_shadow_logs_feature_matches").on(
      table.feature,
      table.matches
    ),
  ]
);

// =============================================================================
// Types
// =============================================================================

export type ShadowComparisonLogSelect = typeof shadowComparisonLogs.$inferSelect;
export type ShadowComparisonLogInsert = typeof shadowComparisonLogs.$inferInsert;

/**
 * Shadow analysis result returned by getShadowAnalysis().
 */
export interface ShadowAnalysis {
  /** Total number of comparisons in the period */
  total: number;
  /** Number of matching results */
  matches: number;
  /** Number of mismatching results */
  mismatches: number;
  /** Match rate (0-1) */
  matchRate: number;
  /** Average legacy implementation duration */
  avgLegacyDurationMs: number;
  /** Average new implementation duration */
  avgNewDurationMs: number;
  /** Speedup factor (legacy/new) */
  avgSpeedup: number;
  /** The log entries */
  logs: ShadowComparisonLogSelect[];
}
