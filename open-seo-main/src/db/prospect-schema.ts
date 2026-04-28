/**
 * Schema for prospects and prospect analyses.
 * Phase 26: Prospect Data Model
 *
 * Prospects are potential clients that have not yet converted.
 * Analyses are one-time DataForSEO runs to understand their SEO state.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";

// Status enum values
export const PROSPECT_STATUS = [
  "new",
  "analyzing",
  "analyzed",
  "converted",
  "archived",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUS)[number];

// Pipeline stages for sales funnel tracking (Phase 30.5)
export const PIPELINE_STAGES = [
  "new", // Just added, no analysis
  "analyzing", // Analysis in progress
  "scored", // Analysis complete, priority score assigned
  "qualified", // High score (>70), worth pursuing
  "contacted", // Outreach initiated
  "negotiating", // In discussion
  "converted", // Became a client
  "archived", // Not pursuing
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Analysis type enum values
export const ANALYSIS_TYPE = [
  "quick_scan",
  "deep_dive",
  "opportunity_discovery",
] as const;
export type AnalysisType = (typeof ANALYSIS_TYPE)[number];

// Analysis status enum values
export const ANALYSIS_STATUS = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUS)[number];

// Domain metrics JSONB type
export interface DomainMetrics {
  domainRank?: number;
  organicTraffic?: number;
  organicKeywords?: number;
  backlinks?: number;
  referringDomains?: number;
}

// Organic keyword item type
export interface OrganicKeywordItem {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc?: number;
  url?: string;
}

// Competitor keyword item type
export interface CompetitorKeywordItem {
  keyword: string;
  searchVolume: number;
  difficulty?: number;
  competitorDomain: string;
  competitorPosition: number;
}

// Keyword gap item type (Phase 28)
export interface KeywordGap {
  keyword: string;
  competitorDomain: string;
  competitorPosition: number;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  trafficPotential: number;
  achievability?: number; // 0-100, higher = more achievable based on DA (Phase 28-02)
}

// Scraped content type (from businessExtractor)
export interface ScrapedContent {
  pages: Array<{
    url: string;
    title: string;
    metaDescription: string;
    h1s: string[];
    wordCount: number;
  }>;
  businessLinks: {
    products: string | null;
    about: string | null;
    services: string | null;
    contact: string | null;
    categories: string[];
  } | null;
  businessInfo: {
    products: string[];
    brands: string[];
    services: string[];
    location: string | null;
    targetMarket: "residential" | "commercial" | "both" | null;
    summary: string;
    confidence: number;
  } | null;
  totalCostCents: number;
  scrapedAt: string;
}

// Opportunity keyword type (Phase 29: AI Opportunity Discovery)
export const OPPORTUNITY_KEYWORD_CATEGORIES = [
  "product",
  "brand",
  "service",
  "commercial",
  "informational",
] as const;
export type OpportunityKeywordCategory =
  (typeof OPPORTUNITY_KEYWORD_CATEGORIES)[number];

// Keyword classification type (Phase 29-04)
export const KEYWORD_CLASSES = ["quick_win", "strategic", "long_tail"] as const;
export type KeywordClass = (typeof KEYWORD_CLASSES)[number];

export interface OpportunityKeyword {
  keyword: string;
  category: OpportunityKeywordCategory;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  opportunityScore: number;
  achievability?: number; // 0-100, higher = easier to rank
  classification?: KeywordClass; // quick_win | strategic | long_tail
  source: "ai_generated";
}

/**
 * Prospects table - potential clients stored by domain.
 * One prospect per domain per workspace (unique constraint).
 */
export const prospects = pgTable(
  "prospects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    companyName: text("company_name"),
    contactEmail: text("contact_email"),
    contactName: text("contact_name"),
    industry: text("industry"),
    notes: text("notes"),
    status: text("status").notNull().default("new"),
    source: text("source"),
    assignedTo: text("assigned_to"),
    convertedClientId: text("converted_client_id"),
    priorityScore: real("priority_score"), // 0-100, auto-computed after analysis (Phase 30.5-03)
    pipelineStage: text("pipeline_stage").notNull().default("new"), // Phase 30.5-04: Sales funnel tracking
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_prospects_workspace").on(table.workspaceId),
    index("ix_prospects_status").on(table.status),
    index("ix_prospects_priority").on(table.priorityScore), // Phase 30.5-03: sorting by priority
    index("ix_prospects_pipeline_stage").on(table.pipelineStage), // Phase 30.5-04: filtering by stage
    uniqueIndex("ix_prospects_workspace_domain").on(
      table.workspaceId,
      table.domain,
    ),
  ],
);

/**
 * Prospect analyses table - stores DataForSEO analysis results.
 * Each analysis captures domain metrics, keywords, and competitor data.
 * Cost is tracked in cents for billing/budgeting.
 */
export const prospectAnalyses = pgTable(
  "prospect_analyses",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    analysisType: text("analysis_type").notNull(),
    status: text("status").notNull().default("pending"),
    targetRegion: text("target_region"),
    targetLanguage: text("target_language"),
    competitorDomains: jsonb("competitor_domains").$type<string[]>(),
    domainMetrics: jsonb("domain_metrics").$type<DomainMetrics>(),
    organicKeywords: jsonb("organic_keywords").$type<OrganicKeywordItem[]>(),
    competitorKeywords: jsonb("competitor_keywords").$type<
      CompetitorKeywordItem[]
    >(),
    keywordGaps: jsonb("keyword_gaps").$type<KeywordGap[]>(),
    opportunityKeywords: jsonb("opportunity_keywords").$type<OpportunityKeyword[]>(),
    scrapedContent: jsonb("scraped_content").$type<ScrapedContent>(),
    costCents: integer("cost_cents").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_analyses_prospect").on(table.prospectId),
    index("ix_analyses_status").on(table.status),
  ],
);

// Relations
export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  workspace: one(organization, {
    fields: [prospects.workspaceId],
    references: [organization.id],
  }),
  analyses: many(prospectAnalyses),
}));

export const prospectAnalysesRelations = relations(prospectAnalyses, ({ one }) => ({
  prospect: one(prospects, {
    fields: [prospectAnalyses.prospectId],
    references: [prospects.id],
  }),
}));

// Inferred types for database operations
export type ProspectSelect = typeof prospects.$inferSelect;
export type ProspectInsert = typeof prospects.$inferInsert;
export type ProspectAnalysisSelect = typeof prospectAnalyses.$inferSelect;
export type ProspectAnalysisInsert = typeof prospectAnalyses.$inferInsert;
