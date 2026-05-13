/**
 * SEO Chat Schema (apps/web mirror)
 *
 * This mirrors the schema from open-seo-main/src/db/schema/seo-chat.ts
 * Both apps connect to the same PostgreSQL database.
 *
 * The authoritative schema and migrations live in open-seo-main.
 * This file is for type-safety and query building in apps/web.
 */

import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

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
 * SEO Chat Proposals
 */
export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => seoChatSessions.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),
    domain: text("domain").notNull(),
    package: text("package").notNull(), // pamatas, augimas, autoritetas
    keywords: jsonb("keywords")
      .$type<
        Array<{
          keyword: string;
          volume: number;
          difficulty: number;
          feasibility: string;
        }>
      >()
      .notNull()
      .default([]),
    analysisResults: jsonb("analysis_results")
      .$type<{
        domainHealth?: {
          da: number;
          dr: number;
          traffic: number;
          summary: string;
        } | null;
      }>()
      .default({}),
    narrative: text("narrative"), // AI-generated proposal text
    magicLinkToken: text("magic_link_token").notNull().unique(),
    status: text("status").default("generated").notNull(), // generated, sent, viewed, converted
    viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
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
    index("idx_proposals_workspace").on(table.workspaceId),
    index("idx_proposals_session").on(table.sessionId),
    uniqueIndex("idx_proposals_magic_token").on(table.magicLinkToken),
  ]
);

/**
 * Proposal Views (analytics tracking)
 */
export const proposalViews = pgTable(
  "proposal_views",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    referrer: text("referrer"),
  },
  (table) => [index("idx_proposal_views_proposal").on(table.proposalId)]
);

/**
 * Proposal Relations
 */
export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  session: one(seoChatSessions, {
    fields: [proposals.sessionId],
    references: [seoChatSessions.id],
  }),
  views: many(proposalViews),
}));

export const proposalViewsRelations = relations(
  proposalViews,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalViews.proposalId],
      references: [proposals.id],
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
export type Proposal = typeof proposals.$inferSelect;
export type ProposalInsert = typeof proposals.$inferInsert;
export type ProposalView = typeof proposalViews.$inferSelect;
export type ProposalViewInsert = typeof proposalViews.$inferInsert;
