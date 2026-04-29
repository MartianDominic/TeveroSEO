/**
 * Schema for internal link graph analysis.
 * Phase 35-01: Link Graph Schema + Extraction
 *
 * Stores every internal link relationship with detailed position and anchor data,
 * aggregated page metrics, and orphan page detection.
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
import { audits, auditPages } from "./app.schema";
import { siteChanges } from "./change-schema";

// Constants
export const LINK_POSITIONS = [
  "body",
  "sidebar",
  "footer",
  "nav",
  "header",
] as const;
export type LinkPosition = (typeof LINK_POSITIONS)[number];

export const LINK_TYPES = [
  "contextual",
  "nav",
  "footer",
  "sidebar",
  "image",
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const ORPHAN_STATUS = ["detected", "fixed", "ignored"] as const;
export type OrphanStatus = (typeof ORPHAN_STATUS)[number];

export const DISCOVERY_SOURCES = ["sitemap", "gsc", "manual"] as const;
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

export const OPPORTUNITY_TYPES = [
  "depth_reduction",
  "orphan_rescue",
  "link_velocity",
  "anchor_diversity",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

/**
 * link_graph table - stores every internal link with detailed attributes.
 * Core of the internal linking analysis system.
 */
export const linkGraph = pgTable(
  "link_graph",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),

    // Source page (where the link is placed)
    sourceUrl: text("source_url").notNull(),
    sourcePageId: text("source_page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),

    // Target page (where the link points to)
    targetUrl: text("target_url").notNull(),
    targetPageId: text("target_page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),

    // Anchor text and context
    anchorText: text("anchor_text").notNull().default(""),
    anchorTextLower: text("anchor_text_lower").notNull().default(""),
    anchorContext: text("anchor_context"), // ~50 chars surrounding text

    // Position classification
    position: text("position").notNull().default("body"), // body, sidebar, footer, nav, header
    paragraphIndex: integer("paragraph_index"), // null if not in body paragraph
    isFirstParagraph: boolean("is_first_paragraph").notNull().default(false),
    isSecondParagraph: boolean("is_second_paragraph").notNull().default(false),

    // Link attributes
    isDoFollow: boolean("is_do_follow").notNull().default(true),
    hasNoOpener: boolean("has_no_opener").notNull().default(false),
    hasTitle: boolean("has_title").notNull().default(false),
    linkText: text("link_text"), // Full visible text (may differ from anchor if truncated)

    // Classification
    linkType: text("link_type").notNull().default("contextual"), // contextual, nav, footer, sidebar, image
    isExactMatch: boolean("is_exact_match").notNull().default(false), // Anchor = target keyword
    isBranded: boolean("is_branded").notNull().default(false), // Anchor contains brand name
    isUrl: boolean("is_url").notNull().default(false), // Anchor is a raw URL

    // Discovery tracking
    discoveredAt: timestamp("discovered_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    // Client+audit queries
    index("ix_link_graph_client_audit").on(table.clientId, table.auditId),
    // Source page queries
    index("ix_link_graph_source_url").on(table.sourceUrl),
    // Target page queries (for inbound link counting)
    index("ix_link_graph_target_url").on(table.targetUrl),
    index("ix_link_graph_target_page").on(table.targetPageId),
    // Unique constraint per source-target-anchor combination
    uniqueIndex("ix_link_graph_unique_link").on(
      table.auditId,
      table.sourceUrl,
      table.targetUrl,
      table.anchorTextLower
    ),
  ]
);

/**
 * page_links table - aggregated link metrics per page.
 * Pre-computed for dashboard display and opportunity scoring.
 */
export const pageLinks = pgTable(
  "page_links",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
    pageUrl: text("page_url").notNull(),

    // Inbound metrics
    inboundTotal: integer("inbound_total").notNull().default(0),
    inboundBody: integer("inbound_body").notNull().default(0),
    inboundNav: integer("inbound_nav").notNull().default(0),
    inboundFooter: integer("inbound_footer").notNull().default(0),
    inboundSidebar: integer("inbound_sidebar").notNull().default(0),
    inboundFirstParagraph: integer("inbound_first_paragraph").notNull().default(0),
    inboundExactMatch: integer("inbound_exact_match").notNull().default(0),
    inboundBranded: integer("inbound_branded").notNull().default(0),
    inboundDoFollow: integer("inbound_do_follow").notNull().default(0),

    // Outbound metrics
    outboundTotal: integer("outbound_total").notNull().default(0),
    outboundBody: integer("outbound_body").notNull().default(0),
    outboundInternal: integer("outbound_internal").notNull().default(0),
    outboundExternal: integer("outbound_external").notNull().default(0),

    // Anchor analysis
    uniqueAnchors: integer("unique_anchors").notNull().default(0),
    anchorDistribution: jsonb("anchor_distribution").$type<Record<string, number>>(), // anchor -> percentage
    topAnchors: jsonb("top_anchors").$type<Array<{ anchor: string; count: number }>>(),

    // Scoring
    clickDepthFromHome: integer("click_depth_from_home"),
    linkScore: real("link_score"), // 0-100 composite score
    opportunityScore: real("opportunity_score"), // Higher = more opportunity for improvement

    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Client+audit queries
    index("ix_page_links_client_audit").on(table.clientId, table.auditId),
    // Page URL lookup
    index("ix_page_links_page_url").on(table.pageUrl),
    // Opportunity ranking
    index("ix_page_links_opportunity").on(table.opportunityScore),
    // Click depth analysis
    index("ix_page_links_click_depth").on(table.clickDepthFromHome),
  ]
);

/**
 * orphan_pages table - pages with zero inbound internal links.
 * Critical SEO issue tracking for internal linking recommendations.
 */
export const orphanPages = pgTable(
  "orphan_pages",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .references(() => auditPages.id, { onDelete: "set null" }),
    pageUrl: text("page_url").notNull(),
    pageTitle: text("page_title"),

    // Discovery source
    discoverySource: text("discovery_source").notNull(), // sitemap, gsc, manual

    // Traffic data (from GSC or analytics)
    searchVolume: integer("search_volume"),
    monthlyTraffic: integer("monthly_traffic"),
    targetKeyword: text("target_keyword"),

    // Status tracking
    status: text("status").notNull().default("detected"), // detected, fixed, ignored
    fixedAt: timestamp("fixed_at", { withTimezone: true, mode: "date" }),
    fixedByChangeId: text("fixed_by_change_id"), // FK to site_changes when link is added

    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Client+audit queries
    index("ix_orphan_pages_client_audit").on(table.clientId, table.auditId),
    // Status filtering
    index("ix_orphan_pages_status").on(table.status),
  ]
);

/**
 * link_opportunities table - actionable internal linking opportunities.
 * Phase 35-02: Opportunity Detection
 *
 * Stores detected opportunities for improving internal link structure:
 * - depth_reduction: Pages too many clicks from homepage
 * - orphan_rescue: Pages with zero inbound links
 * - link_velocity: Pages with low inbound link count
 * - anchor_diversity: Pages lacking exact-match anchor text
 */
export const linkOpportunities = pgTable(
  "link_opportunities",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),

    // Target page
    pageId: text("page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),
    pageUrl: text("page_url").notNull(),

    // Opportunity classification
    opportunityType: text("opportunity_type").notNull(), // depth_reduction, orphan_rescue, link_velocity, anchor_diversity

    // Urgency scoring (0.0-1.0, higher = more urgent)
    urgency: real("urgency").notNull().default(0.5),

    // Current state metrics
    currentDepth: integer("current_depth"), // For depth_reduction
    targetDepth: integer("target_depth"), // Desired depth after fix
    currentInboundCount: integer("current_inbound_count"), // For link_velocity
    currentExactMatchCount: integer("current_exact_match_count"), // For anchor_diversity

    // Recommendation
    suggestedSourcePages: jsonb("suggested_source_pages").$type<
      Array<{ pageUrl: string; pageId: string | null; relevanceScore: number }>
    >(),
    suggestedAnchorText: text("suggested_anchor_text"),
    reason: text("reason").notNull(), // Human-readable explanation

    // Status tracking
    status: text("status").notNull().default("pending"), // pending, accepted, rejected, implemented
    implementedAt: timestamp("implemented_at", { withTimezone: true, mode: "date" }),
    implementedByChangeId: text("implemented_by_change_id"), // FK to site_changes

    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Client+audit queries
    index("ix_link_opportunities_client_audit").on(table.clientId, table.auditId),
    // Opportunity type filtering
    index("ix_link_opportunities_type").on(table.opportunityType),
    // Urgency ranking
    index("ix_link_opportunities_urgency").on(table.urgency),
    // Status filtering
    index("ix_link_opportunities_status").on(table.status),
    // Page lookup
    index("ix_link_opportunities_page_url").on(table.pageUrl),
  ]
);

// Relations
export const linkGraphRelations = relations(linkGraph, ({ one }) => ({
  client: one(clients, {
    fields: [linkGraph.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [linkGraph.auditId],
    references: [audits.id],
  }),
  sourcePage: one(auditPages, {
    fields: [linkGraph.sourcePageId],
    references: [auditPages.id],
  }),
  targetPage: one(auditPages, {
    fields: [linkGraph.targetPageId],
    references: [auditPages.id],
  }),
}));

export const pageLinksRelations = relations(pageLinks, ({ one }) => ({
  client: one(clients, {
    fields: [pageLinks.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [pageLinks.auditId],
    references: [audits.id],
  }),
  page: one(auditPages, {
    fields: [pageLinks.pageId],
    references: [auditPages.id],
  }),
}));

export const orphanPagesRelations = relations(orphanPages, ({ one }) => ({
  client: one(clients, {
    fields: [orphanPages.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [orphanPages.auditId],
    references: [audits.id],
  }),
  page: one(auditPages, {
    fields: [orphanPages.pageId],
    references: [auditPages.id],
  }),
}));

export const linkOpportunitiesRelations = relations(linkOpportunities, ({ one }) => ({
  client: one(clients, {
    fields: [linkOpportunities.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [linkOpportunities.auditId],
    references: [audits.id],
  }),
  page: one(auditPages, {
    fields: [linkOpportunities.pageId],
    references: [auditPages.id],
  }),
}));

// Suggestion status enum
export const SUGGESTION_STATUS = [
  "pending",
  "accepted",
  "rejected",
  "applied",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUS)[number];

// Anchor type enum
export const ANCHOR_TYPES = ["exact", "branded", "misc"] as const;
export type AnchorType = (typeof ANCHOR_TYPES)[number];

/**
 * link_suggestions table - AI-generated internal link recommendations.
 * Phase 35-03: Target Selection + Anchor Selection
 *
 * Stores suggestions for new internal links with scoring, anchor text,
 * and placement information.
 */
export const linkSuggestions = pgTable(
  "link_suggestions",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),

    // Source page (where the link should be placed)
    sourceUrl: text("source_url").notNull(),
    sourcePageId: text("source_page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),

    // Target page (where the link points to)
    targetUrl: text("target_url").notNull(),
    targetPageId: text("target_page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),

    // Anchor text recommendation
    anchorText: text("anchor_text").notNull(),
    anchorType: text("anchor_type").notNull().default("misc"), // exact, branded, misc
    anchorConfidence: real("anchor_confidence").notNull().default(0.6), // 0.0-1.0

    // Scoring (0-100 scale)
    score: real("score").notNull().default(0),
    linkDeficitScore: real("link_deficit_score").notNull().default(0), // 25% weight
    exactMatchScore: real("exact_match_score").notNull().default(0), // 20% weight
    orphanScore: real("orphan_score").notNull().default(0), // 30% weight
    depthScore: real("depth_score").notNull().default(0), // 15% weight
    relevanceScore: real("relevance_score").notNull().default(0), // 20% weight - keyword overlap

    // Reasons for suggestion (human-readable)
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),

    // Placement context
    existingTextMatch: text("existing_text_match"), // Text to wrap if found in source
    insertionContext: text("insertion_context"), // Where to insert if no match

    // Phase 35-04: Auto-insert fields
    opportunityId: text("opportunity_id").references(() => linkOpportunities.id, {
      onDelete: "set null",
    }),
    insertionMethod: text("insertion_method").notNull().default("wrap_existing"), // wrap_existing, append_sentence
    replacementText: text("replacement_text"), // HTML replacement for wrap_existing
    newSentence: text("new_sentence"), // Sentence to append for append_sentence
    isAutoApplicable: boolean("is_auto_applicable").notNull().default(false),
    failureReason: text("failure_reason"), // Reason if application failed

    // Status tracking
    status: text("status").notNull().default("pending"), // pending, accepted, rejected, applied, failed
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "date" }),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }),
    // SECURITY FIX (DB-H05): Added FK constraint to prevent orphaned references
    appliedChangeId: text("applied_change_id").references(() => siteChanges.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Client+audit queries
    index("ix_link_suggestions_client_audit").on(table.clientId, table.auditId),
    // Source page queries
    index("ix_link_suggestions_source_url").on(table.sourceUrl),
    // Target page queries
    index("ix_link_suggestions_target_url").on(table.targetUrl),
    // Status filtering
    index("ix_link_suggestions_status").on(table.status),
    // Score ranking
    index("ix_link_suggestions_score").on(table.score),
    // Unique constraint per source-target pair per audit
    uniqueIndex("ix_link_suggestions_unique_pair").on(
      table.auditId,
      table.sourceUrl,
      table.targetUrl
    ),
    // Phase 40: Composite indexes for suggestions API query optimization
    // Note: These are partial indexes defined in migration 0028
    // ix_link_suggestions_query_filter: (client_id, anchor_confidence DESC)
    //   WHERE status = 'pending' AND is_auto_applicable = true
    // ix_link_suggestions_query_sort: (client_id, score DESC)
    //   WHERE status = 'pending' AND is_auto_applicable = true
    // Drizzle does not support partial indexes via schema definition,
    // so these are managed via raw SQL migration only.
  ]
);

// Link suggestions relations
export const linkSuggestionsRelations = relations(linkSuggestions, ({ one }) => ({
  client: one(clients, {
    fields: [linkSuggestions.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [linkSuggestions.auditId],
    references: [audits.id],
  }),
  sourcePage: one(auditPages, {
    fields: [linkSuggestions.sourcePageId],
    references: [auditPages.id],
  }),
  targetPage: one(auditPages, {
    fields: [linkSuggestions.targetPageId],
    references: [auditPages.id],
  }),
}));

// Cannibalization severity enum
export const CANNIBALIZATION_SEVERITY = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export type CannibalizationSeverity = (typeof CANNIBALIZATION_SEVERITY)[number];

// Cannibalization status enum
export const CANNIBALIZATION_STATUS = [
  "detected",
  "resolved",
  "ignored",
  "monitoring",
] as const;
export type CannibalizationStatus = (typeof CANNIBALIZATION_STATUS)[number];

/**
 * Competing page data for cannibalization detection.
 */
export interface CompetingPage {
  pageId: string;
  url: string;
  title: string;
  gscPosition: number | null;
  gscClicks: number | null;
  inboundLinks: number;
  hasExactMatchAnchor: boolean;
}

/**
 * keyword_cannibalization table - detects pages competing for same keyword.
 * Phase 35-05: Cannibalization Detection
 *
 * When multiple pages rank for the same keyword, they compete with each other
 * and dilute ranking potential. This table tracks these conflicts.
 */
export const keywordCannibalization = pgTable(
  "keyword_cannibalization",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // The contested keyword
    keyword: text("keyword").notNull(),
    keywordLower: text("keyword_lower").notNull(),
    searchVolume: integer("search_volume"),

    // Competing pages
    competingPages: jsonb("competing_pages").$type<CompetingPage[]>(),

    // Analysis
    severity: text("severity").notNull(), // critical, high, medium, low
    recommendedPrimary: text("recommended_primary"),
    reasoning: text("reasoning"),

    // Status tracking
    status: text("status").notNull().default("detected"), // detected, resolved, ignored, monitoring

    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_cannibalization_client").on(table.clientId),
    index("ix_cannibalization_keyword").on(table.keywordLower),
    index("ix_cannibalization_severity").on(table.severity),
    index("ix_cannibalization_status").on(table.status),
    uniqueIndex("ix_cannibalization_unique").on(table.clientId, table.keywordLower),
  ]
);

// Keyword cannibalization relations
export const keywordCannibalizationRelations = relations(
  keywordCannibalization,
  ({ one }) => ({
    client: one(clients, {
      fields: [keywordCannibalization.clientId],
      references: [clients.id],
    }),
  })
);

// Inferred types
export type LinkGraphSelect = typeof linkGraph.$inferSelect;
export type LinkGraphInsert = typeof linkGraph.$inferInsert;
export type PageLinksSelect = typeof pageLinks.$inferSelect;
export type PageLinksInsert = typeof pageLinks.$inferInsert;
export type OrphanPagesSelect = typeof orphanPages.$inferSelect;
export type OrphanPagesInsert = typeof orphanPages.$inferInsert;
export type LinkOpportunitiesSelect = typeof linkOpportunities.$inferSelect;
export type LinkOpportunitiesInsert = typeof linkOpportunities.$inferInsert;
export type LinkSuggestionsSelect = typeof linkSuggestions.$inferSelect;
export type LinkSuggestionsInsert = typeof linkSuggestions.$inferInsert;
export type KeywordCannibalizationSelect = typeof keywordCannibalization.$inferSelect;
export type KeywordCannibalizationInsert = typeof keywordCannibalization.$inferInsert;
