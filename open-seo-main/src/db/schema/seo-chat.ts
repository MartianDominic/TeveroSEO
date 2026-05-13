/**
 * SEO Chat Schema
 * Phase 98-01: Database tables for SEO Chat sessions and messages
 *
 * Per SPEC.md Section 5.4: Three tables for chat persistence:
 * - seo_chat_sessions: Chat session metadata and status
 * - seo_chat_messages: Individual messages with role and tool results
 * - seo_chat_analyses: Analysis result cache (session-scoped)
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
import { organization } from "../user-schema";

/**
 * SEO Chat Sessions
 *
 * Tracks conversation sessions between agency and prospects.
 * Each session accumulates context across messages.
 */
export const seoChatSessions = pgTable(
  "seo_chat_sessions",
  {
    id: text("id").primaryKey(), // nanoid for URL-friendly session IDs
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Prospect identification (extracted from conversation)
    prospectDomain: text("prospect_domain"),
    prospectName: text("prospect_name"),
    prospectEmail: text("prospect_email"),

    // Session metadata
    title: text("title"), // e.g., "groziosalon.lt analysis"
    status: text("status").default("active").notNull(), // 'active' | 'archived' | 'converted'
    metadata: jsonb("metadata")
      .$type<{
        niche?: string;
        location?: string;
        totalCostMicros?: number;
        [key: string]: unknown;
      }>()
      .default({}),

    // Timestamps
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
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_seo_chat_sessions_workspace").on(table.workspaceId),
    index("idx_seo_chat_sessions_domain").on(table.prospectDomain),
    index("idx_seo_chat_sessions_status").on(table.status),
  ]
);

/**
 * SEO Chat Messages
 *
 * Individual messages within a session.
 * Stores user input, assistant responses, and tool call results.
 */
export const seoChatMessages = pgTable(
  "seo_chat_messages",
  {
    id: text("id").primaryKey(), // nanoid
    sessionId: text("session_id")
      .notNull()
      .references(() => seoChatSessions.id, { onDelete: "cascade" }),

    // Message content
    role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'tool'
    content: text("content").notNull(), // Message text or tool result JSON

    // Intent and context extraction
    intent: text("intent"), // Classified intent (domain_health, keyword_analysis, etc.)
    extractedContext: jsonb("extracted_context")
      .$type<{
        domain?: string;
        niche?: string;
        location?: string;
        keywords?: string[];
        [key: string]: unknown;
      }>()
      .default({}),

    // Tool call tracking
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

    // Token usage (for cost tracking)
    tokenCount: integer("token_count"),

    // Timestamp
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
 *
 * Analysis result cache (session-scoped).
 * Prevents re-running expensive analyses for the same input within a session.
 */
export const seoChatAnalyses = pgTable(
  "seo_chat_analyses",
  {
    id: text("id").primaryKey(), // nanoid
    sessionId: text("session_id")
      .notNull()
      .references(() => seoChatSessions.id, { onDelete: "cascade" }),

    // Analysis identification
    analysisType: text("analysis_type").notNull(), // 'domain_health' | 'keyword_analysis' | 'feasibility_check'
    inputHash: text("input_hash").notNull(), // SHA-256 hash of input parameters

    // Result
    result: jsonb("result").notNull(), // Structured analysis result (DomainHealthResult, etc.)

    // Cost and performance tracking
    costMicros: integer("cost_micros").default(0),
    durationMs: integer("duration_ms"),

    // Timestamp
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Unique cache key: (sessionId, analysisType, inputHash)
    uniqueIndex("idx_seo_chat_analyses_cache").on(
      table.sessionId,
      table.analysisType,
      table.inputHash
    ),
  ]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const seoChatSessionsRelations = relations(
  seoChatSessions,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [seoChatSessions.workspaceId],
      references: [organization.id],
    }),
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

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type SeoChatSession = typeof seoChatSessions.$inferSelect;
export type SeoChatSessionInsert = typeof seoChatSessions.$inferInsert;
export type SeoChatMessage = typeof seoChatMessages.$inferSelect;
export type SeoChatMessageInsert = typeof seoChatMessages.$inferInsert;
export type SeoChatAnalysis = typeof seoChatAnalyses.$inferSelect;
export type SeoChatAnalysisInsert = typeof seoChatAnalyses.$inferInsert;
