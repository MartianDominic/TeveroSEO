/**
 * Client Preferences Schema
 * Phase 86-09: Backfill Pool + Learning
 *
 * IMPORTANT: This is a SEPARATE table from proposals.
 * Preferences persist across proposals and are learned from edit history.
 */

import {
  pgTable,
  uuid,
  jsonb,
  text,
  timestamp,
  integer,
  real,
  index,
} from 'drizzle-orm/pg-core';

export const clientPreferences = pgTable(
  'client_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    clientId: uuid('client_id').notNull().unique(),

    exclusions: jsonb('exclusions').notNull().default([]),

    funnelBias: jsonb('funnel_bias')
      .notNull()
      .default({ bofu: 1.0, mofu: 1.0, tofu: 1.0 }),

    positioning: text('positioning').notNull().default('neutral'),

    preferredTopics: text('preferred_topics').array().notNull().default([]),
    avoidedTopics: text('avoided_topics').array().notNull().default([]),

    lastLearnedAt: timestamp('last_learned_at', { withTimezone: true }).defaultNow(),
    editsSinceLastLearn: integer('edits_since_last_learn').notNull().default(0),
    confidenceScore: real('confidence_score').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('client_preferences_client_id_idx').on(table.clientId)]
);

export type ClientPreferencesRow = typeof clientPreferences.$inferSelect;
export type NewClientPreferencesRow = typeof clientPreferences.$inferInsert;
