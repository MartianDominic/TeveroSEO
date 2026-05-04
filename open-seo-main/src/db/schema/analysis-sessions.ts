/**
 * Analysis Sessions Schema
 * Phase 82: Chat Integration
 *
 * Stores keyword analysis sessions for conversation memory.
 * Each session is scoped to a client for retrieval in future chats.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Analysis sessions table.
 *
 * Stores completed keyword analyses per client for retrieval.
 * Uses uuid for high-volume ID generation.
 */
export const analysisSessions = pgTable(
  'analysis_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').notNull(),
    workspaceId: text('workspace_id').notNull(),

    // Session metadata
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Input data
    conversation: text('conversation').notNull(),
    constraintsHash: text('constraints_hash').notNull(),
    keywordCount: integer('keyword_count').notNull(),

    // Results summary
    selectedCount: integer('selected_count').notNull(),
    excludedCount: integer('excluded_count').notNull(),

    // Full breakdown for retrieval (SelectionBreakdown type)
    breakdown: jsonb('breakdown').notNull().$type<{
      total: number;
      byStage: { bofu: number; mofu: number; tofu: number };
      averageScore: number;
    }>(),

    // Full result for retrieval (compressed JSON)
    // Nullable to allow for large result cleanup
    result: jsonb('result').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('analysis_sessions_client_id_idx').on(table.clientId),
    index('analysis_sessions_workspace_id_idx').on(table.workspaceId),
    index('analysis_sessions_created_at_idx').on(table.createdAt),
    index('analysis_sessions_constraints_hash_idx').on(table.constraintsHash),
  ]
);

// Inferred types (following existing codebase pattern)
export type AnalysisSession = typeof analysisSessions.$inferSelect;
export type NewAnalysisSession = typeof analysisSessions.$inferInsert;
