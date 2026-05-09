/**
 * Schema for On-Page SEO Mastery system.
 * Phase 92-01: Database Schema + VerticalClassifier
 *
 * Stores vertical classifications, quality scores, semantic chunks,
 * and client SEO settings for Tier 5 Content Quality Intelligence.
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clients } from "./client-schema";
import { audits } from "./app.schema";
import type { ScrapeTier } from "./domain-scrape-learning-schema";

// 12 primary verticals from CONTEXT.md
export const VERTICALS = [
  "healthcare",
  "legal",
  "financial",
  "ecommerce",
  "saas",
  "real_estate",
  "home_services",
  "hospitality",
  "education",
  "professional",
  "manufacturing",
  "nonprofit",
  "general",
] as const;
export type Vertical = (typeof VERTICALS)[number];

// YMYL verticals requiring stricter quality gates
export const YMYL_VERTICALS: Vertical[] = ["healthcare", "legal", "financial"];

// Classification methods
export const CLASSIFICATION_METHODS = [
  "schema",
  "url-pattern",
  "keyword",
  "client-setting",
  "llm",
] as const;
export type ClassificationMethod = (typeof CLASSIFICATION_METHODS)[number];

// Quality gate tiers
export const QUALITY_GATE_TIERS = ["basic", "standard", "full"] as const;
export type QualityGateTier = (typeof QUALITY_GATE_TIERS)[number];

// Chunk recommendation types
export const RECOMMENDATION_TYPES = ["split", "merge", "expand"] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

// Recommendation status
export const RECOMMENDATION_STATUS = ["pending", "applied", "dismissed"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUS)[number];

/**
 * client_seo_settings table - Per-client Tier 5 configuration.
 * Controls which features are enabled and quality gate thresholds.
 */
export const clientSeoSettings = pgTable(
  "client_seo_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Feature toggles
    tier5Enabled: boolean("tier5_enabled").notNull().default(false),

    // Manual vertical classification override
    verticalOverride: text("vertical_override"),

    // Quality gate tier: basic (3 gates), standard (7 gates), full (13 gates)
    qualityGateTier: text("quality_gate_tier").notNull().default("basic"),

    // Excluded check IDs (e.g., ["T5-01", "T5-08"])
    excludedChecks: jsonb("excluded_checks").$type<string[]>().default([]),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ix_client_seo_settings_client").on(table.clientId),
  ]
);

/**
 * vertical_classifications table - Cached vertical classifications.
 * 90-day cache by domain + path pattern for cost optimization.
 * 90%+ of pages classified via heuristics without LLM call.
 */
export const verticalClassifications = pgTable(
  "vertical_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Classification key
    domain: text("domain").notNull(),
    pathPattern: text("path_pattern").notNull(), // e.g., "/product/*", "/blog/*"

    // Classification result
    vertical: text("vertical").notNull(), // One of 12 verticals
    confidence: real("confidence").notNull(), // 0-1
    isYmyl: boolean("is_ymyl").notNull().default(false),

    // Classification method for cost tracking
    method: text("method").notNull(), // schema | url-pattern | keyword | client-setting | llm

    // Cache management
    cachedAt: timestamp("cached_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    // Composite index for cache lookups
    index("ix_vertical_class_lookup").on(
      table.clientId,
      table.domain,
      table.pathPattern
    ),
    // Index for cache expiration cleanup
    index("ix_vertical_class_expires").on(table.expiresAt),
  ]
);

/**
 * page_quality_scores table - Tier 5 quality metrics per page.
 * Stores individual gate scores and overall quality score.
 */
export const pageQualityScores = pgTable(
  "page_quality_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Page identification
    pageId: text("page_id").notNull(),
    pageUrl: text("page_url").notNull(),
    auditId: text("audit_id").references(() => audits.id, { onDelete: "set null" }),

    // Classification context
    vertical: text("vertical").notNull(),
    isYmyl: boolean("is_ymyl").notNull().default(false),

    // Individual quality gate scores (0-100, nullable if not run)
    redditTestScore: real("reddit_test_score"),
    infoGainScore: real("info_gain_score"),
    proveItScore: real("prove_it_score"),
    aiSlopScore: real("ai_slop_score"),
    voiceConsistencyScore: real("voice_consistency_score"),
    toneScore: real("tone_score"),

    // Aggregate score
    overallScore: real("overall_score").notNull(), // 0-100

    // Check results
    blockingFailures: jsonb("blocking_failures").$type<string[]>().default([]),
    passedChecks: jsonb("passed_checks").$type<string[]>().default([]),
    failedChecks: jsonb("failed_checks").$type<string[]>().default([]),

    // Scraping metadata for traceability
    scrapeTier: text("scrape_tier").$type<ScrapeTier>(),
    scrapeFromCache: boolean("scrape_from_cache"),
    scrapeCostUsd: real("scrape_cost_usd"),
    scrapeResponseTimeMs: integer("scrape_response_time_ms"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Client + audit queries
    index("ix_page_quality_client_audit").on(table.clientId, table.auditId),
    // Page URL lookup
    index("ix_page_quality_page_url").on(table.pageUrl),
    // Score filtering
    index("ix_page_quality_score").on(table.overallScore),
    // Unique page per audit
    uniqueIndex("ix_page_quality_unique").on(table.pageId, table.auditId),
  ]
);

/**
 * semantic_chunks table - 500-token chunks with embeddings.
 * Optimized for LLM retrieval with self-containment scoring.
 */
export const semanticChunks = pgTable(
  "semantic_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Content identification
    contentId: text("content_id").notNull(), // Page ID or content hash

    // Chunk position and content
    position: integer("position").notNull(),
    text: text("text").notNull(),
    tokenCount: integer("token_count").notNull(),
    parentHeading: text("parent_heading"),

    // 768-dim jina-v5 embedding stored as JSONB
    embedding: jsonb("embedding").$type<number[]>().notNull(),

    // Chunk quality metrics
    tokenScore: real("token_score").notNull(), // 1.0 in range, decay outside
    selfContainmentScore: real("self_containment_score").notNull(),
    headingAlignmentScore: real("heading_alignment_score").notNull(),
    factDensity: real("fact_density").notNull(), // Entities per 100 tokens

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Content ID lookup for all chunks of a page
    index("ix_semantic_chunks_content").on(table.contentId),
    // Position ordering
    index("ix_semantic_chunks_position").on(table.contentId, table.position),
  ]
);

/**
 * seo_rule_weights table - Custom rule weights per client.
 * Allows clients to adjust importance of specific rules.
 */
export const seoRuleWeights = pgTable(
  "seo_rule_weights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Rule identification
    ruleId: text("rule_id").notNull(), // e.g., "T5-01", "T1-70"

    // Weight configuration
    weight: real("weight").notNull().default(1.0), // Multiplier (0-2.0)
    enabled: boolean("enabled").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Unique rule per client
    uniqueIndex("ix_seo_rule_weights_unique").on(table.clientId, table.ruleId),
    // Client lookup
    index("ix_seo_rule_weights_client").on(table.clientId),
  ]
);

/**
 * chunk_recommendations table - Split/merge/expand suggestions.
 * AI-generated recommendations for chunk optimization.
 */
export const chunkRecommendations = pgTable(
  "chunk_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Reference to chunk
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => semanticChunks.id, { onDelete: "cascade" }),

    // Recommendation details
    recommendationType: text("recommendation_type").notNull(), // split | merge | expand
    reason: text("reason").notNull(),

    // Status tracking
    status: text("status").notNull().default("pending"), // pending | applied | dismissed

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Chunk lookup
    index("ix_chunk_recommendations_chunk").on(table.chunkId),
    // Status filtering
    index("ix_chunk_recommendations_status").on(table.status),
  ]
);

/**
 * topic_clusters table - Topical authority clusters.
 * Groups related content for authority measurement.
 */
export const topicClusters = pgTable(
  "topic_clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Cluster identification
    name: text("name").notNull(),

    // Pillar page (optional - some clusters don't have one yet)
    pillarPageId: text("pillar_page_id"),

    // Keywords in this cluster
    keywords: jsonb("keywords").$type<string[]>().default([]),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Client lookup
    index("ix_topic_clusters_client").on(table.clientId),
    // Unique name per client
    uniqueIndex("ix_topic_clusters_unique_name").on(table.clientId, table.name),
  ]
);

/**
 * topic_authority_scores table - Per-cluster authority metrics.
 * Tracks coverage, depth, and linking metrics.
 */
export const topicAuthorityScores = pgTable(
  "topic_authority_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Reference to cluster
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => topicClusters.id, { onDelete: "cascade" }),

    // Individual scores (0-100)
    coverageScore: real("coverage_score").notNull(), // Pages covering topic / total possible
    depthScore: real("depth_score").notNull(), // Avg words, unique angles
    linkDensityScore: real("link_density_score").notNull(), // Internal links within cluster
    backlinkScore: real("backlink_score").notNull(), // External authority signals

    // Aggregate score
    overallScore: real("overall_score").notNull(), // Weighted combination

    // Calculation timestamp
    calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Cluster lookup
    index("ix_topic_authority_cluster").on(table.clusterId),
    // Score ranking
    index("ix_topic_authority_score").on(table.overallScore),
  ]
);

// Relations
export const clientSeoSettingsRelations = relations(clientSeoSettings, ({ one }) => ({
  client: one(clients, {
    fields: [clientSeoSettings.clientId],
    references: [clients.id],
  }),
}));

export const verticalClassificationsRelations = relations(
  verticalClassifications,
  ({ one }) => ({
    client: one(clients, {
      fields: [verticalClassifications.clientId],
      references: [clients.id],
    }),
  })
);

export const pageQualityScoresRelations = relations(pageQualityScores, ({ one }) => ({
  client: one(clients, {
    fields: [pageQualityScores.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [pageQualityScores.auditId],
    references: [audits.id],
  }),
}));

export const seoRuleWeightsRelations = relations(seoRuleWeights, ({ one }) => ({
  client: one(clients, {
    fields: [seoRuleWeights.clientId],
    references: [clients.id],
  }),
}));

export const chunkRecommendationsRelations = relations(
  chunkRecommendations,
  ({ one }) => ({
    chunk: one(semanticChunks, {
      fields: [chunkRecommendations.chunkId],
      references: [semanticChunks.id],
    }),
  })
);

export const topicClustersRelations = relations(topicClusters, ({ one, many }) => ({
  client: one(clients, {
    fields: [topicClusters.clientId],
    references: [clients.id],
  }),
  authorityScores: many(topicAuthorityScores),
}));

export const topicAuthorityScoresRelations = relations(
  topicAuthorityScores,
  ({ one }) => ({
    cluster: one(topicClusters, {
      fields: [topicAuthorityScores.clusterId],
      references: [topicClusters.id],
    }),
  })
);

// Inferred types for database operations
export type ClientSeoSettingsSelect = typeof clientSeoSettings.$inferSelect;
export type ClientSeoSettingsInsert = typeof clientSeoSettings.$inferInsert;
export type VerticalClassificationSelect = typeof verticalClassifications.$inferSelect;
export type VerticalClassificationInsert = typeof verticalClassifications.$inferInsert;
export type PageQualityScoreSelect = typeof pageQualityScores.$inferSelect;
export type PageQualityScoreInsert = typeof pageQualityScores.$inferInsert;
export type SemanticChunkSelect = typeof semanticChunks.$inferSelect;
export type SemanticChunkInsert = typeof semanticChunks.$inferInsert;
export type SeoRuleWeightSelect = typeof seoRuleWeights.$inferSelect;
export type SeoRuleWeightInsert = typeof seoRuleWeights.$inferInsert;
export type ChunkRecommendationSelect = typeof chunkRecommendations.$inferSelect;
export type ChunkRecommendationInsert = typeof chunkRecommendations.$inferInsert;
export type TopicClusterSelect = typeof topicClusters.$inferSelect;
export type TopicClusterInsert = typeof topicClusters.$inferInsert;
export type TopicAuthorityScoreSelect = typeof topicAuthorityScores.$inferSelect;
export type TopicAuthorityScoreInsert = typeof topicAuthorityScores.$inferInsert;
