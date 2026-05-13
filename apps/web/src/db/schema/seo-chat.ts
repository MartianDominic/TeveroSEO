/**
 * SEO Chat Schema (apps/web mirror)
 *
 * This mirrors the schema from open-seo-main/src/db/schema/seo-chat.ts
 * Both apps connect to the same PostgreSQL database.
 *
 * The authoritative schema and migrations live in open-seo-main.
 * This file is for type-safety and query building in apps/web.
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
import { relations } from "drizzle-orm";

/**
 * SEO Chat Sessions
 */
export const seoChatSessions = pgTable(
  "seo_chat_sessions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    prospectDomain: text("prospect_domain"),
    prospectName: text("prospect_name"),
    prospectEmail: text("prospect_email"),
    title: text("title"),
    status: text("status").default("active").notNull(),
    metadata: jsonb("metadata")
      .$type<{
        niche?: string;
        location?: string;
        keywordsAnalyzed?: number;
        analysisHistory?: Array<{
          type: string;
          timestamp: Date;
          costMicros: number;
        }>;
        proposalId?: string | null;
        proposalStatus?: string | null;
        [key: string]: unknown;
      }>()
      .default({}),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_seo_chat_sessions_workspace").on(table.workspaceId),
    index("idx_seo_chat_sessions_domain").on(table.prospectDomain),
    index("idx_seo_chat_sessions_status").on(table.status),
  ]
);

/**
 * SEO Chat Messages
 */
export const seoChatMessages = pgTable(
  "seo_chat_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => seoChatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    intent: text("intent"),
    extractedContext: jsonb("extracted_context")
      .$type<{
        domain?: string;
        niche?: string;
        location?: string;
        keywords?: string[];
        [key: string]: unknown;
      }>()
      .default({}),
    toolCalls: jsonb("tool_calls")
      .$type<
        Array<{
          toolName: string;
          parameters: Record<string, unknown>;
          result?: unknown;
          costMicros?: number;
        }>
      >()
      .default([]),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_seo_chat_messages_session").on(table.sessionId),
    index("idx_seo_chat_messages_created").on(table.createdAt),
    index("idx_seo_chat_messages_role").on(table.role),
  ]
);

/**
 * SEO Chat Analyses
 */
export const seoChatAnalyses = pgTable(
  "seo_chat_analyses",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => seoChatSessions.id, { onDelete: "cascade" }),
    analysisType: text("analysis_type").notNull(),
    inputHash: text("input_hash").notNull(),
    result: jsonb("result").notNull(),
    costMicros: integer("cost_micros").default(0),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_seo_chat_analyses_cache").on(
      table.sessionId,
      table.analysisType,
      table.inputHash
    ),
  ]
);

/**
 * Relations
 */
export const seoChatSessionsRelations = relations(
  seoChatSessions,
  ({ many }) => ({
    messages: many(seoChatMessages),
    analyses: many(seoChatAnalyses),
  })
);

export const seoChatMessagesRelations = relations(
  seoChatMessages,
  ({ one }) => ({
    session: one(seoChatSessions, {
      fields: [seoChatMessages.sessionId],
      references: [seoChatSessions.id],
    }),
  })
);

export const seoChatAnalysesRelations = relations(
  seoChatAnalyses,
  ({ one }) => ({
    session: one(seoChatSessions, {
      fields: [seoChatAnalyses.sessionId],
      references: [seoChatSessions.id],
    }),
  })
);

/**
 * Inferred Types
 */
export type SeoChatSession = typeof seoChatSessions.$inferSelect;
export type SeoChatSessionInsert = typeof seoChatSessions.$inferInsert;
export type SeoChatMessage = typeof seoChatMessages.$inferSelect;
export type SeoChatMessageInsert = typeof seoChatMessages.$inferInsert;
export type SeoChatAnalysis = typeof seoChatAnalyses.$inferSelect;
export type SeoChatAnalysisInsert = typeof seoChatAnalyses.$inferInsert;
