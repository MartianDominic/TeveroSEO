/**
 * Proposal Backfill Pool Schema
 * Phase 86-09: Backfill Pool + Learning
 *
 * Stores 200 backup keywords per proposal for editing operations.
 * When clusters are removed, keywords from this pool replace them.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { proposals } from '../proposal-schema';

export const proposalBackfill = pgTable(
  'proposal_backfill',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),

    keyword: text('keyword').notNull(),
    volume: integer('volume').notNull(),
    difficulty: integer('difficulty').notNull(),
    funnelStage: text('funnel_stage').notNull(),

    clusterId: uuid('cluster_id').notNull(),
    clusterLabel: text('cluster_label').notNull(),

    embedding: jsonb('embedding').notNull(),

    relevanceScore: real('relevance_score').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('proposal_backfill_proposal_id_idx').on(table.proposalId),
    index('proposal_backfill_relevance_idx').on(table.proposalId, table.relevanceScore),
  ]
);

export type ProposalBackfillRow = typeof proposalBackfill.$inferSelect;
export type NewProposalBackfillRow = typeof proposalBackfill.$inferInsert;
