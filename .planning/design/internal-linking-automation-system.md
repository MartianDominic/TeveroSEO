# Internal Linking Automation System

**Design Date:** 2026-04-22  
**Status:** Design Complete  
**Scope:** End-to-end internal linking optimization for autonomous SEO platform

---

## Executive Summary

Internal linking is one of the highest-ROI SEO activities. The Zyppy 23M Links Study found that pages with 40-44 internal links receive 4x more traffic, and pages with at least one exact-match anchor receive 5x more traffic. This system automates the discovery, analysis, and optimization of internal link structures at scale.

**Core Metrics (from V1-SEO-IMPLEMENTATION-SPEC.md):**
- Peak traffic zone: 40-44 internal links pointing to a URL
- 1+ exact-match anchor: 5x more traffic
- 3-10 contextual in-content links per article
- All pages within 3 clicks from homepage
- Anchor text distribution: 50% exact match, 25% URL/branded, 25% misc

---

## 1. System Architecture Overview

```
+-------------------------------------------------------------------------------+
|                      INTERNAL LINKING AUTOMATION ENGINE                        |
+-------------------------------------------------------------------------------+
|                                                                               |
|  PHASE 1             PHASE 2              PHASE 3             PHASE 4        |
|  ---------           ---------            ---------           ---------       |
|  Graph Build         Opportunity          Suggestion          Execution       |
|                      Detection            Generation                          |
|                                                                               |
|  +----------+       +----------+        +----------+        +----------+     |
|  |  Crawl   |------>| Analyze  |------->| Generate |------->| Auto-Fix |     |
|  |  Links   |       | Gaps     |        | Targets  |        | or Flag  |     |
|  +----------+       +----------+        +----------+        +----------+     |
|       |                  |                   |                   |            |
|       v                  v                   v                   v            |
|  +----------+       +----------+        +----------+        +----------+     |
|  |  Build   |       | Score    |        | Rank     |        | Apply    |     |
|  |  Graph   |       | Urgency  |        | Options  |        | Changes  |     |
|  +----------+       +----------+        +----------+        +----------+     |
|                                                                               |
+-------------------------------------------------------------------------------+
         |                    |                   |                   |
         v                    v                   v                   v
+---------------+    +---------------+    +---------------+    +---------------+
|  link_graph   |    |  link_opps    |    |  link_suggest |    |  site_changes |
|  (PostgreSQL) |    |  (PostgreSQL) |    |  (PostgreSQL) |    |  (PostgreSQL) |
+---------------+    +---------------+    +---------------+    +---------------+
```

---

## 2. Data Model

### 2.1 Link Graph Tables

```typescript
// link-graph-schema.ts
import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Core link graph: every internal link in the site.
 * One row per link occurrence (source -> target).
 */
export const linkGraph = pgTable("link_graph", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  auditId: text("audit_id").notNull(),  // FK to audits - which crawl discovered this
  
  // Link endpoints
  sourceUrl: text("source_url").notNull(),      // Page containing the link
  sourcePageId: text("source_page_id"),         // FK to audit_pages (nullable if not crawled)
  targetUrl: text("target_url").notNull(),      // Where the link points
  targetPageId: text("target_page_id"),         // FK to audit_pages (nullable if external/not crawled)
  
  // Link context
  anchorText: text("anchor_text"),              // The clickable text
  anchorTextLower: text("anchor_text_lower"),   // Lowercase for matching
  anchorContext: text("anchor_context"),        // Surrounding ~50 chars for context
  
  // Link position
  position: text("position").notNull(),         // 'body' | 'sidebar' | 'footer' | 'nav' | 'header'
  paragraphIndex: integer("paragraph_index"),   // Which paragraph (0-indexed, null if not body)
  isFirstParagraph: boolean("is_first_paragraph").default(false),
  isSecondParagraph: boolean("is_second_paragraph").default(false),
  
  // Link attributes
  isDoFollow: boolean("is_dofollow").default(true),
  hasNoOpener: boolean("has_noopener").default(false),
  hasTitle: text("has_title"),                  // title attribute value
  linkText: text("link_text"),                  // Full innerHTML if different from anchor
  
  // Classification
  linkType: text("link_type").notNull(),        // 'contextual' | 'nav' | 'footer' | 'sidebar' | 'image'
  isExactMatch: boolean("is_exact_match").default(false),  // Anchor matches target's primary keyword
  isBranded: boolean("is_branded").default(false),         // Contains brand name
  isUrl: boolean("is_url").default(false),                 // Anchor is the URL itself
  
  // Timestamps
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  
}, (table) => [
  index("ix_link_graph_client_audit").on(table.clientId, table.auditId),
  index("ix_link_graph_source").on(table.sourceUrl),
  index("ix_link_graph_target").on(table.targetUrl),
  index("ix_link_graph_target_pageid").on(table.targetPageId),
  uniqueIndex("ix_link_graph_unique_link").on(
    table.auditId, 
    table.sourceUrl, 
    table.targetUrl, 
    table.anchorText,
    table.paragraphIndex
  ),
]);

/**
 * Aggregated link metrics per page.
 * Computed from linkGraph after each crawl.
 */
export const pageLinks = pgTable("page_links", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  auditId: text("audit_id").notNull(),
  pageId: text("page_id").notNull(),       // FK to audit_pages
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
  inboundDoFollow: integer("inbound_dofollow").notNull().default(0),
  
  // Outbound metrics
  outboundTotal: integer("outbound_total").notNull().default(0),
  outboundBody: integer("outbound_body").notNull().default(0),
  outboundInternal: integer("outbound_internal").notNull().default(0),
  outboundExternal: integer("outbound_external").notNull().default(0),
  
  // Anchor text analysis
  uniqueAnchors: integer("unique_anchors").notNull().default(0),
  anchorDistribution: jsonb("anchor_distribution").$type<{
    exactMatch: number;
    branded: number;
    url: number;
    misc: number;
  }>(),
  topAnchors: jsonb("top_anchors").$type<Array<{
    text: string;
    count: number;
    isExactMatch: boolean;
  }>>(),
  
  // Click depth
  clickDepthFromHome: integer("click_depth_from_home"),
  
  // Scores
  linkScore: real("link_score"),                  // 0-100 overall link health
  opportunityScore: real("opportunity_score"),    // Higher = needs more links
  
  // Timestamps
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  
}, (table) => [
  index("ix_page_links_client_audit").on(table.clientId, table.auditId),
  index("ix_page_links_page").on(table.pageUrl),
  index("ix_page_links_opportunity").on(table.opportunityScore),
  index("ix_page_links_click_depth").on(table.clickDepthFromHome),
]);

/**
 * Detected orphan pages (zero inbound internal links).
 */
export const orphanPages = pgTable("orphan_pages", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  auditId: text("audit_id").notNull(),
  pageId: text("page_id").notNull(),
  pageUrl: text("page_url").notNull(),
  pageTitle: text("page_title"),
  
  // How we know about this page
  discoverySource: text("discovery_source").notNull(), // 'sitemap' | 'gsc' | 'manual'
  
  // Page importance
  searchVolume: integer("search_volume"),       // If targeting a keyword
  monthlyTraffic: integer("monthly_traffic"),   // From GSC
  targetKeyword: text("target_keyword"),
  
  // Status
  status: text("status").notNull().default("detected"), // 'detected' | 'fixed' | 'ignored'
  fixedAt: timestamp("fixed_at", { withTimezone: true }),
  fixedByChangeId: text("fixed_by_change_id"),
  
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  
}, (table) => [
  index("ix_orphan_pages_client_audit").on(table.clientId, table.auditId),
  index("ix_orphan_pages_status").on(table.status),
]);
```

### 2.2 Link Opportunities & Suggestions

```typescript
// link-opportunities-schema.ts

/**
 * Detected opportunities to add internal links.
 * One row per opportunity (a page that could link to another page).
 */
export const linkOpportunities = pgTable("link_opportunities", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  auditId: text("audit_id").notNull(),
  
  // The opportunity
  sourcePageId: text("source_page_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  targetPageId: text("target_page_id").notNull(),
  targetUrl: text("target_url").notNull(),
  
  // Why this is an opportunity
  opportunityType: text("opportunity_type").notNull(), 
  // Types: 
  //   'orphan_rescue' - target has zero inbound links
  //   'depth_reduction' - reduces click depth
  //   'topical_cluster' - same topic, should be linked
  //   'keyword_match' - source mentions target's keyword
  //   'anchor_diversity' - target needs different anchor text
  //   'link_velocity' - target below optimal link count
  //   'first_paragraph' - high-priority page needs early link
  
  // Scoring
  relevanceScore: real("relevance_score").notNull(),   // 0-1 how relevant is source to target
  urgencyScore: real("urgency_score").notNull(),       // 0-1 how urgent (orphan > low links > etc)
  impactScore: real("impact_score").notNull(),         // 0-1 estimated traffic impact
  combinedScore: real("combined_score").notNull(),     // Weighted combination for prioritization
  
  // Detection details
  detectionMethod: text("detection_method").notNull(), // 'keyword_scan' | 'topic_model' | 'link_count' | 'depth_analysis'
  matchedKeywords: jsonb("matched_keywords").$type<string[]>(),
  matchedTopics: jsonb("matched_topics").$type<string[]>(),
  
  // Suggested placement
  suggestedParagraph: integer("suggested_paragraph"),  // Which paragraph to insert
  suggestedSentence: text("suggested_sentence"),       // The sentence to modify
  suggestedAnchor: text("suggested_anchor"),           // Recommended anchor text
  
  // Status
  status: text("status").notNull().default("detected"),
  // Statuses: 'detected' | 'approved' | 'rejected' | 'applied' | 'auto_applied'
  
  // If applied
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  appliedChangeId: text("applied_change_id"),
  
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  
}, (table) => [
  index("ix_link_opps_client_audit").on(table.clientId, table.auditId),
  index("ix_link_opps_source").on(table.sourceUrl),
  index("ix_link_opps_target").on(table.targetUrl),
  index("ix_link_opps_combined_score").on(table.combinedScore),
  index("ix_link_opps_status").on(table.status),
  index("ix_link_opps_type").on(table.opportunityType),
]);

/**
 * Specific link suggestions with insertion instructions.
 * Generated from opportunities when user/system wants to act.
 */
export const linkSuggestions = pgTable("link_suggestions", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  opportunityId: text("opportunity_id").notNull(), // FK to link_opportunities
  
  // Source page
  sourcePageId: text("source_page_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  
  // Target page
  targetPageId: text("target_page_id").notNull(),
  targetUrl: text("target_url").notNull(),
  targetKeyword: text("target_keyword"),
  
  // Insertion details
  anchorText: text("anchor_text").notNull(),
  anchorType: text("anchor_type").notNull(), // 'exact_match' | 'partial_match' | 'branded' | 'url' | 'misc'
  
  // Where to insert
  insertionMethod: text("insertion_method").notNull(), 
  // Methods:
  //   'replace_text' - Replace existing text with linked text
  //   'append_sentence' - Add a sentence with the link
  //   'wrap_existing' - Wrap existing keyword mention with link
  
  // For 'replace_text' and 'wrap_existing'
  originalText: text("original_text"),         // The text to find
  replacementText: text("replacement_text"),   // The text + link HTML
  
  // For 'append_sentence'
  appendAfterParagraph: integer("append_after_paragraph"),
  newSentence: text("new_sentence"),
  
  // Context
  paragraphIndex: integer("paragraph_index"),
  surroundingContext: text("surrounding_context"), // ~100 chars around insertion point
  
  // Confidence
  confidence: real("confidence").notNull(),    // 0-1 how confident in this suggestion
  isAutoApplicable: boolean("is_auto_applicable").default(false),
  
  // Status
  status: text("status").notNull().default("pending"),
  // Statuses: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed'
  
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  appliedChangeId: text("applied_change_id"),
  failureReason: text("failure_reason"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  
}, (table) => [
  index("ix_link_suggestions_client").on(table.clientId),
  index("ix_link_suggestions_opportunity").on(table.opportunityId),
  index("ix_link_suggestions_status").on(table.status),
  index("ix_link_suggestions_confidence").on(table.confidence),
]);
```

### 2.3 Cannibalization Detection

```typescript
// link-cannibalization-schema.ts

/**
 * Pages competing for the same keyword.
 * Used to prevent linking competing pages together in confusing ways.
 */
export const keywordCannibalization = pgTable("keyword_cannibalization", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  
  // The contested keyword
  keyword: text("keyword").notNull(),
  keywordLower: text("keyword_lower").notNull(),
  searchVolume: integer("search_volume"),
  
  // Competing pages (jsonb array for flexibility)
  competingPages: jsonb("competing_pages").$type<Array<{
    pageId: string;
    url: string;
    title: string;
    gscPosition: number | null;
    gscClicks: number | null;
    inboundLinks: number;
    hasExactMatchAnchor: boolean;
  }>>(),
  
  // Analysis
  severity: text("severity").notNull(), // 'critical' | 'high' | 'medium' | 'low'
  recommendedPrimary: text("recommended_primary"), // URL of the page that should be primary
  reasoning: text("reasoning"),
  
  // Status
  status: text("status").notNull().default("detected"),
  // Statuses: 'detected' | 'resolved' | 'ignored' | 'monitoring'
  
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  
}, (table) => [
  index("ix_cannibalization_client").on(table.clientId),
  index("ix_cannibalization_keyword").on(table.keywordLower),
  index("ix_cannibalization_severity").on(table.severity),
]);
```

---

## 3. Core Algorithms

### 3.1 Link Graph Building (No AI)

```typescript
/**
 * Build link graph from crawl data.
 * Run after each site audit completes.
 */
interface LinkGraphBuilder {
  auditId: string;
  clientId: string;
}

async function buildLinkGraph(params: LinkGraphBuilder): Promise<void> {
  const { auditId, clientId } = params;
  
  // 1. Get all crawled pages from audit
  const pages = await db.select()
    .from(auditPages)
    .where(eq(auditPages.auditId, auditId));
  
  // 2. Build URL -> pageId lookup
  const urlToPage = new Map(pages.map(p => [p.url, p]));
  
  // 3. Process each page's HTML to extract detailed link data
  for (const page of pages) {
    const html = await fetchCachedHtml(page.url, auditId);
    if (!html) continue;
    
    const links = extractDetailedLinks(html, page.url, urlToPage);
    
    // Insert links into link_graph
    for (const link of links) {
      await db.insert(linkGraph).values({
        id: crypto.randomUUID(),
        clientId,
        auditId,
        sourceUrl: page.url,
        sourcePageId: page.id,
        targetUrl: link.targetUrl,
        targetPageId: link.targetPageId,
        anchorText: link.anchorText,
        anchorTextLower: link.anchorText?.toLowerCase(),
        anchorContext: link.context,
        position: link.position,
        paragraphIndex: link.paragraphIndex,
        isFirstParagraph: link.paragraphIndex === 0,
        isSecondParagraph: link.paragraphIndex === 1,
        isDoFollow: link.isDoFollow,
        linkType: link.linkType,
        // Classification computed later
      }).onConflictDoNothing();
    }
  }
  
  // 4. Compute page-level aggregates
  await computePageLinkMetrics(auditId, clientId);
  
  // 5. Detect orphan pages
  await detectOrphanPages(auditId, clientId);
  
  // 6. Compute click depth
  await computeClickDepth(auditId, clientId);
}

/**
 * Extract detailed link information from HTML.
 */
function extractDetailedLinks(
  html: string, 
  pageUrl: string,
  urlToPage: Map<string, AuditPage>
): DetailedLink[] {
  const $ = cheerio.load(html);
  const links: DetailedLink[] = [];
  const pageOrigin = new URL(pageUrl).origin;
  
  // Process all anchor tags
  $('a[href]').each((_, el) => {
    const $link = $(el);
    const href = $link.attr('href');
    if (!href) return;
    
    // Skip non-HTTP links
    if (/^(javascript:|mailto:|tel:|#)/.test(href)) return;
    
    // Resolve relative URLs
    const targetUrl = normalizeUrl(href, pageUrl);
    if (!targetUrl) return;
    
    // Skip external links for internal link graph
    if (!isSameOrigin(targetUrl, pageUrl)) return;
    
    // Determine position
    const position = classifyLinkPosition($link, $);
    
    // Get paragraph index if in body
    const paragraphIndex = position === 'body' 
      ? getParagraphIndex($link, $)
      : null;
    
    // Extract anchor text
    const anchorText = $link.text().trim();
    
    // Extract surrounding context
    const context = extractContext($link, $);
    
    // Check rel attribute
    const rel = $link.attr('rel') || '';
    const isDoFollow = !rel.includes('nofollow');
    
    // Determine link type
    const linkType = determineLinkType($link, $, position);
    
    // Lookup target page
    const targetPage = urlToPage.get(targetUrl);
    
    links.push({
      targetUrl,
      targetPageId: targetPage?.id || null,
      anchorText,
      context,
      position,
      paragraphIndex,
      isDoFollow,
      linkType,
    });
  });
  
  return links;
}

/**
 * Classify where in the page a link appears.
 */
function classifyLinkPosition($link: cheerio.Cheerio, $: cheerio.CheerioAPI): string {
  // Check parent elements
  const parents = $link.parents().toArray().map(el => {
    const tagName = el.tagName?.toLowerCase();
    const className = $(el).attr('class')?.toLowerCase() || '';
    const id = $(el).attr('id')?.toLowerCase() || '';
    return { tagName, className, id };
  });
  
  // Navigation patterns
  const navPatterns = ['nav', 'navigation', 'menu', 'header-nav', 'main-nav'];
  if (parents.some(p => 
    p.tagName === 'nav' || 
    navPatterns.some(pattern => p.className.includes(pattern) || p.id.includes(pattern))
  )) {
    return 'nav';
  }
  
  // Header patterns
  if (parents.some(p => 
    p.tagName === 'header' || 
    p.className.includes('header') || 
    p.id.includes('header')
  )) {
    return 'header';
  }
  
  // Footer patterns
  if (parents.some(p => 
    p.tagName === 'footer' || 
    p.className.includes('footer') || 
    p.id.includes('footer')
  )) {
    return 'footer';
  }
  
  // Sidebar patterns
  const sidebarPatterns = ['sidebar', 'aside', 'widget', 'related'];
  if (parents.some(p => 
    p.tagName === 'aside' ||
    sidebarPatterns.some(pattern => p.className.includes(pattern) || p.id.includes(pattern))
  )) {
    return 'sidebar';
  }
  
  // Main content / body
  const mainPatterns = ['main', 'content', 'article', 'post', 'entry'];
  if (parents.some(p =>
    p.tagName === 'main' ||
    p.tagName === 'article' ||
    mainPatterns.some(pattern => p.className.includes(pattern) || p.id.includes(pattern))
  )) {
    return 'body';
  }
  
  // Default to body if unclear
  return 'body';
}

/**
 * Get the paragraph index within the main content.
 */
function getParagraphIndex($link: cheerio.Cheerio, $: cheerio.CheerioAPI): number | null {
  // Find the containing paragraph
  const $paragraph = $link.closest('p');
  if (!$paragraph.length) return null;
  
  // Find all paragraphs in main content
  const $main = $('main, article, .content, .post-content, .entry-content').first();
  if (!$main.length) return null;
  
  const $paragraphs = $main.find('p');
  let index = 0;
  let found = false;
  
  $paragraphs.each((i, p) => {
    if ($(p).is($paragraph)) {
      index = i;
      found = true;
      return false; // Break
    }
  });
  
  return found ? index : null;
}
```

### 3.2 Click Depth Analysis (BFS - No AI)

```typescript
/**
 * Compute click depth from homepage using BFS.
 * Ensures all pages are within 3 clicks.
 */
async function computeClickDepth(auditId: string, clientId: string): Promise<void> {
  // Get all links for this audit
  const links = await db.select()
    .from(linkGraph)
    .where(eq(linkGraph.auditId, auditId));
  
  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();
  for (const link of links) {
    if (!adjacency.has(link.sourceUrl)) {
      adjacency.set(link.sourceUrl, new Set());
    }
    adjacency.get(link.sourceUrl)!.add(link.targetUrl);
  }
  
  // Get homepage URL (assume "/" or domain root)
  const pages = await db.select()
    .from(auditPages)
    .where(eq(auditPages.auditId, auditId));
  
  const homeUrl = pages.find(p => {
    const path = new URL(p.url).pathname;
    return path === '/' || path === '';
  })?.url;
  
  if (!homeUrl) {
    console.warn('No homepage found for click depth analysis');
    return;
  }
  
  // BFS from homepage
  const depths = new Map<string, number>();
  const queue: [string, number][] = [[homeUrl, 0]];
  depths.set(homeUrl, 0);
  
  while (queue.length > 0) {
    const [url, depth] = queue.shift()!;
    const neighbors = adjacency.get(url) || new Set();
    
    for (const neighbor of neighbors) {
      if (!depths.has(neighbor)) {
        depths.set(neighbor, depth + 1);
        queue.push([neighbor, depth + 1]);
      }
    }
  }
  
  // Update page_links table with click depths
  for (const [url, depth] of depths) {
    await db.update(pageLinks)
      .set({ clickDepthFromHome: depth })
      .where(and(
        eq(pageLinks.auditId, auditId),
        eq(pageLinks.pageUrl, url)
      ));
  }
  
  // Flag pages with depth > 3 as opportunities
  const deepPages = Array.from(depths.entries())
    .filter(([_, depth]) => depth > 3)
    .map(([url]) => url);
  
  for (const url of deepPages) {
    // Create depth reduction opportunities
    await createDepthReductionOpportunity(auditId, clientId, url, depths.get(url)!);
  }
}

/**
 * Create opportunities to reduce click depth.
 */
async function createDepthReductionOpportunity(
  auditId: string,
  clientId: string,
  targetUrl: string,
  currentDepth: number
): Promise<void> {
  // Find pages that could link to this page to reduce depth
  // Ideal: pages at depth 1 or 2 that are topically related
  
  const candidateSources = await db.select()
    .from(pageLinks)
    .where(and(
      eq(pageLinks.auditId, auditId),
      lte(pageLinks.clickDepthFromHome, 2),
      // Exclude pages that already link to target
      notExists(
        db.select()
          .from(linkGraph)
          .where(and(
            eq(linkGraph.auditId, auditId),
            eq(linkGraph.sourceUrl, pageLinks.pageUrl),
            eq(linkGraph.targetUrl, targetUrl)
          ))
      )
    ))
    .limit(10);
  
  for (const source of candidateSources) {
    // Score relevance using keyword overlap (no AI)
    const relevance = await computeTopicalRelevance(source.pageUrl, targetUrl, auditId);
    
    if (relevance > 0.3) {
      await db.insert(linkOpportunities).values({
        id: crypto.randomUUID(),
        clientId,
        auditId,
        sourcePageId: source.pageId,
        sourceUrl: source.pageUrl,
        targetPageId: await getPageId(targetUrl, auditId),
        targetUrl,
        opportunityType: 'depth_reduction',
        relevanceScore: relevance,
        urgencyScore: Math.min(1, (currentDepth - 3) / 3), // Higher urgency for deeper pages
        impactScore: 0.5, // Medium impact
        combinedScore: relevance * 0.4 + 0.3 * Math.min(1, (currentDepth - 3) / 3) + 0.3 * 0.5,
        detectionMethod: 'depth_analysis',
      });
    }
  }
}
```

### 3.3 Opportunity Detection (Token-Efficient)

```typescript
/**
 * Main opportunity detection engine.
 * Runs after link graph is built.
 * Designed for minimal token usage - most detection is rule-based.
 */
async function detectLinkOpportunities(auditId: string, clientId: string): Promise<void> {
  // 1. Orphan rescue opportunities (No AI)
  await detectOrphanRescueOpportunities(auditId, clientId);
  
  // 2. Low link count opportunities (No AI)
  await detectLinkVelocityOpportunities(auditId, clientId);
  
  // 3. Missing exact-match anchor opportunities (No AI)
  await detectAnchorDiversityOpportunities(auditId, clientId);
  
  // 4. Keyword mention opportunities (No AI - text matching)
  await detectKeywordMentionOpportunities(auditId, clientId);
  
  // 5. First paragraph opportunities (No AI)
  await detectFirstParagraphOpportunities(auditId, clientId);
  
  // 6. Topical cluster opportunities (Minimal AI - optional)
  // Only if client has topical clusters defined
  await detectTopicalClusterOpportunities(auditId, clientId);
}

/**
 * Find pages that mention a target page's keyword but don't link to it.
 * Pure text matching - no AI.
 */
async function detectKeywordMentionOpportunities(
  auditId: string,
  clientId: string
): Promise<void> {
  // Get all pages with their target keywords
  const pagesWithKeywords = await db.select({
    pageId: auditPages.id,
    pageUrl: auditPages.url,
    title: auditPages.title,
    keyword: savedKeywords.keyword,
  })
  .from(auditPages)
  .innerJoin(savedKeywords, /* join on project/domain */)
  .where(eq(auditPages.auditId, auditId));
  
  // Build keyword -> target page mapping
  const keywordTargets = new Map<string, {pageId: string, url: string}[]>();
  for (const page of pagesWithKeywords) {
    if (!page.keyword) continue;
    const lower = page.keyword.toLowerCase();
    if (!keywordTargets.has(lower)) {
      keywordTargets.set(lower, []);
    }
    keywordTargets.get(lower)!.push({ pageId: page.pageId, url: page.pageUrl });
  }
  
  // For each page, check if its content mentions keywords of other pages
  const allPages = await db.select()
    .from(auditPages)
    .where(eq(auditPages.auditId, auditId));
  
  for (const sourcePage of allPages) {
    // Get page content (cached from crawl)
    const content = await getPageTextContent(sourcePage.url, auditId);
    if (!content) continue;
    
    const contentLower = content.toLowerCase();
    
    // Check each keyword
    for (const [keyword, targets] of keywordTargets) {
      // Skip if this page is the target for this keyword
      if (targets.some(t => t.url === sourcePage.url)) continue;
      
      // Check if keyword appears in content
      if (!contentLower.includes(keyword)) continue;
      
      // Check if already linked
      const existingLink = await db.select()
        .from(linkGraph)
        .where(and(
          eq(linkGraph.auditId, auditId),
          eq(linkGraph.sourceUrl, sourcePage.url),
          inArray(linkGraph.targetUrl, targets.map(t => t.url))
        ))
        .limit(1);
      
      if (existingLink.length > 0) continue;
      
      // Found opportunity! Keyword mentioned but not linked
      for (const target of targets) {
        await db.insert(linkOpportunities).values({
          id: crypto.randomUUID(),
          clientId,
          auditId,
          sourcePageId: sourcePage.id,
          sourceUrl: sourcePage.url,
          targetPageId: target.pageId,
          targetUrl: target.url,
          opportunityType: 'keyword_match',
          relevanceScore: 0.9, // High - exact keyword match
          urgencyScore: 0.6,
          impactScore: 0.7,
          combinedScore: 0.75,
          detectionMethod: 'keyword_scan',
          matchedKeywords: [keyword],
        });
      }
    }
  }
}

/**
 * Find pages below optimal link count (40-44).
 */
async function detectLinkVelocityOpportunities(
  auditId: string,
  clientId: string
): Promise<void> {
  // Get pages with low inbound link counts
  const lowLinkPages = await db.select()
    .from(pageLinks)
    .where(and(
      eq(pageLinks.auditId, auditId),
      lt(pageLinks.inboundTotal, 40) // Below optimal zone
    ))
    .orderBy(pageLinks.inboundTotal);
  
  for (const targetPage of lowLinkPages) {
    // Calculate how urgent based on how far below optimal
    const linksNeeded = 40 - targetPage.inboundTotal;
    const urgency = Math.min(1, linksNeeded / 40);
    
    // Find candidate source pages
    const candidates = await findRelevantSourcePages(
      auditId,
      targetPage.pageUrl,
      targetPage.pageId,
      10 // Max candidates
    );
    
    for (const source of candidates) {
      await db.insert(linkOpportunities).values({
        id: crypto.randomUUID(),
        clientId,
        auditId,
        sourcePageId: source.pageId,
        sourceUrl: source.pageUrl,
        targetPageId: targetPage.pageId,
        targetUrl: targetPage.pageUrl,
        opportunityType: 'link_velocity',
        relevanceScore: source.relevance,
        urgencyScore: urgency,
        impactScore: 0.6,
        combinedScore: source.relevance * 0.4 + urgency * 0.3 + 0.6 * 0.3,
        detectionMethod: 'link_count',
      });
    }
  }
}
```

### 3.4 Target Selection Algorithm (No AI)

```typescript
/**
 * Given a source page, rank potential link targets.
 * Used when the system needs to choose where to link.
 */
interface TargetCandidate {
  pageUrl: string;
  pageId: string;
  title: string;
  keyword: string | null;
  inboundLinks: number;
  score: number;
  reasons: string[];
}

async function rankLinkTargets(
  sourceUrl: string,
  clientId: string,
  auditId: string,
  limit: number = 10
): Promise<TargetCandidate[]> {
  // Get all potential targets (excluding self)
  const allPages = await db.select()
    .from(pageLinks)
    .leftJoin(auditPages, eq(auditPages.id, pageLinks.pageId))
    .where(and(
      eq(pageLinks.auditId, auditId),
      ne(pageLinks.pageUrl, sourceUrl)
    ));
  
  // Get source page content for relevance scoring
  const sourceContent = await getPageTextContent(sourceUrl, auditId);
  const sourceKeywords = extractKeywordsFromContent(sourceContent);
  
  // Get existing links from source
  const existingLinks = await db.select()
    .from(linkGraph)
    .where(and(
      eq(linkGraph.auditId, auditId),
      eq(linkGraph.sourceUrl, sourceUrl)
    ));
  
  const alreadyLinked = new Set(existingLinks.map(l => l.targetUrl));
  
  // Score each candidate
  const candidates: TargetCandidate[] = [];
  
  for (const { page_links: pl, audit_pages: ap } of allPages) {
    // Skip if already linked
    if (alreadyLinked.has(pl.pageUrl)) continue;
    
    const reasons: string[] = [];
    let score = 0;
    
    // Factor 1: Needs links (inverse of current count)
    const linkDeficit = Math.max(0, 40 - pl.inboundTotal);
    const linkNeedScore = linkDeficit / 40;
    score += linkNeedScore * 0.25;
    if (linkDeficit > 30) reasons.push(`Needs ${linkDeficit} more links`);
    
    // Factor 2: Has no exact-match anchor
    if (pl.inboundExactMatch === 0) {
      score += 0.2;
      reasons.push('Missing exact-match anchor');
    }
    
    // Factor 3: Is orphan page
    if (pl.inboundTotal === 0) {
      score += 0.3;
      reasons.push('Orphan page');
    }
    
    // Factor 4: High click depth
    if (pl.clickDepthFromHome && pl.clickDepthFromHome > 3) {
      score += 0.15;
      reasons.push(`Click depth: ${pl.clickDepthFromHome}`);
    }
    
    // Factor 5: Topical relevance (keyword overlap)
    const targetKeywords = extractKeywordsFromContent(ap?.title || '');
    const overlap = computeKeywordOverlap(sourceKeywords, targetKeywords);
    score += overlap * 0.2;
    if (overlap > 0.3) reasons.push('Topically related');
    
    // Factor 6: Has traffic (valuable page)
    // Would need GSC data integration
    
    candidates.push({
      pageUrl: pl.pageUrl,
      pageId: pl.pageId,
      title: ap?.title || '',
      keyword: null, // TODO: Get from saved_keywords
      inboundLinks: pl.inboundTotal,
      score,
      reasons,
    });
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  return candidates.slice(0, limit);
}

/**
 * Extract keywords from text content (no AI).
 * Uses TF-IDF-like approach with stopword removal.
 */
function extractKeywordsFromContent(content: string): Set<string> {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
    'now', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'any', 'some', 'no', 'more', 'most', 'other', 'such',
  ]);
  
  // Tokenize and filter
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
  
  // Get bigrams for multi-word keywords
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopwords.has(words[i]) && !stopwords.has(words[i + 1])) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  // Count frequency
  const freq = new Map<string, number>();
  for (const word of [...words, ...bigrams]) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  
  // Return top keywords by frequency
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word);
  
  return new Set(sorted);
}

/**
 * Compute keyword overlap between two keyword sets.
 */
function computeKeywordOverlap(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  
  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }
  
  // Jaccard similarity
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}
```

### 3.5 Anchor Text Selection (Rule-Based + Minimal AI)

```typescript
/**
 * Select appropriate anchor text for a link.
 * Follows the 50% exact / 25% branded / 25% misc distribution.
 */
interface AnchorTextOptions {
  targetUrl: string;
  targetPageId: string;
  targetKeyword: string | null;
  targetTitle: string;
  brandName: string;
  currentAnchorDistribution: {
    exactMatch: number;
    branded: number;
    url: number;
    misc: number;
  };
  sourceContent: string;
}

interface AnchorTextResult {
  text: string;
  type: 'exact_match' | 'partial_match' | 'branded' | 'url' | 'misc';
  confidence: number;
  sourceText: string | null; // Existing text in content that could be wrapped
}

function selectAnchorText(options: AnchorTextOptions): AnchorTextResult {
  const {
    targetKeyword,
    targetTitle,
    brandName,
    currentAnchorDistribution,
    sourceContent,
  } = options;
  
  // Calculate ideal anchor type based on current distribution
  const total = Object.values(currentAnchorDistribution).reduce((a, b) => a + b, 0);
  
  const currentExactRatio = total > 0 ? currentAnchorDistribution.exactMatch / total : 0;
  const currentBrandedRatio = total > 0 ? currentAnchorDistribution.branded / total : 0;
  
  // Target ratios from spec
  const targetExactRatio = 0.5;
  const targetBrandedRatio = 0.25;
  
  // Determine what type we need more of
  let preferredType: 'exact_match' | 'branded' | 'misc';
  if (currentExactRatio < targetExactRatio && targetKeyword) {
    preferredType = 'exact_match';
  } else if (currentBrandedRatio < targetBrandedRatio) {
    preferredType = 'branded';
  } else {
    preferredType = 'misc';
  }
  
  // Check if the preferred anchor text exists in source content
  const contentLower = sourceContent.toLowerCase();
  
  if (preferredType === 'exact_match' && targetKeyword) {
    const keywordLower = targetKeyword.toLowerCase();
    if (contentLower.includes(keywordLower)) {
      // Find the exact case-preserved version in content
      const index = contentLower.indexOf(keywordLower);
      const exactText = sourceContent.substring(index, index + targetKeyword.length);
      
      return {
        text: exactText,
        type: 'exact_match',
        confidence: 0.95,
        sourceText: exactText,
      };
    }
  }
  
  if (preferredType === 'branded' && brandName) {
    const brandLower = brandName.toLowerCase();
    if (contentLower.includes(brandLower)) {
      const index = contentLower.indexOf(brandLower);
      const exactText = sourceContent.substring(index, index + brandName.length);
      
      return {
        text: exactText,
        type: 'branded',
        confidence: 0.9,
        sourceText: exactText,
      };
    }
  }
  
  // Fallback: Use title or generate misc anchor
  // Check if title phrase exists in content
  const titleWords = targetTitle.split(' ').slice(0, 5).join(' ');
  if (contentLower.includes(titleWords.toLowerCase())) {
    const index = contentLower.indexOf(titleWords.toLowerCase());
    const exactText = sourceContent.substring(index, index + titleWords.length);
    
    return {
      text: exactText,
      type: 'partial_match',
      confidence: 0.8,
      sourceText: exactText,
    };
  }
  
  // No natural anchor found - will need to append a sentence
  return {
    text: targetKeyword || titleWords,
    type: targetKeyword ? 'exact_match' : 'misc',
    confidence: 0.6,
    sourceText: null, // Will need to insert new text
  };
}
```

### 3.6 Cannibalization Detection (No AI)

```typescript
/**
 * Detect keyword cannibalization - multiple pages competing for same keyword.
 */
async function detectKeywordCannibalization(clientId: string): Promise<void> {
  // Get all keyword -> page mappings from GSC
  const keywordPages = await db.select({
    keyword: gscKeywords.keyword,
    pageUrl: gscKeywords.url,
    position: gscKeywords.avgPosition,
    clicks: gscKeywords.clicks,
    impressions: gscKeywords.impressions,
  })
  .from(gscKeywords)
  .where(eq(gscKeywords.clientId, clientId));
  
  // Group by keyword
  const keywordGroups = new Map<string, typeof keywordPages>();
  for (const row of keywordPages) {
    const key = row.keyword.toLowerCase();
    if (!keywordGroups.has(key)) {
      keywordGroups.set(key, []);
    }
    keywordGroups.get(key)!.push(row);
  }
  
  // Check for cannibalization (same keyword, multiple pages)
  for (const [keyword, pages] of keywordGroups) {
    if (pages.length < 2) continue;
    
    // Multiple pages ranking for same keyword = potential cannibalization
    const competingPages = pages
      .filter(p => p.position <= 100) // Only count if actually ranking
      .sort((a, b) => a.position - b.position);
    
    if (competingPages.length < 2) continue;
    
    // Determine severity
    let severity: 'critical' | 'high' | 'medium' | 'low';
    const positionDiff = competingPages[1].position - competingPages[0].position;
    
    if (positionDiff < 5) {
      // Very close positions - severe cannibalization
      severity = 'critical';
    } else if (positionDiff < 10) {
      severity = 'high';
    } else if (positionDiff < 20) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
    
    // Recommend primary page (highest clicks, best position)
    const recommended = competingPages.sort((a, b) => {
      // Prioritize clicks, then position
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      return a.position - b.position;
    })[0];
    
    // Get link counts for competing pages
    const pageLinksData = await db.select()
      .from(pageLinks)
      .where(and(
        eq(pageLinks.clientId, clientId),
        inArray(pageLinks.pageUrl, competingPages.map(p => p.pageUrl))
      ));
    
    const linkLookup = new Map(pageLinksData.map(p => [p.pageUrl, p]));
    
    await db.insert(keywordCannibalization).values({
      id: crypto.randomUUID(),
      clientId,
      keyword,
      keywordLower: keyword.toLowerCase(),
      searchVolume: null, // Would need keyword metrics
      competingPages: competingPages.map(p => ({
        pageId: '', // TODO: lookup
        url: p.pageUrl,
        title: '', // TODO: lookup
        gscPosition: p.position,
        gscClicks: p.clicks,
        inboundLinks: linkLookup.get(p.pageUrl)?.inboundTotal || 0,
        hasExactMatchAnchor: (linkLookup.get(p.pageUrl)?.inboundExactMatch || 0) > 0,
      })),
      severity,
      recommendedPrimary: recommended.pageUrl,
      reasoning: `${competingPages.length} pages competing. Position gap: ${positionDiff}. ${recommended.pageUrl} has most clicks.`,
    });
  }
}
```

---

## 4. Auto-Fix vs Flagged Rules

### 4.1 Auto-Fix Criteria (Safe to Auto-Insert)

Links can be auto-inserted when ALL of the following are true:

```typescript
interface AutoFixCriteria {
  // Confidence threshold
  suggestionConfidence: number;  // Must be >= 0.85
  
  // Link doesn't disrupt reading flow
  insertionMethod: 'wrap_existing';  // Only wrap existing text
  
  // Anchor text is clearly appropriate
  anchorType: 'exact_match' | 'branded';
  anchorExistsInContent: true;  // Must already be in text
  
  // Target page is appropriate
  targetIsIndexable: true;
  targetNotInCannibalization: true;
  targetClickDepth: number;  // Must be <= 3 after linking
  
  // Source page context
  sourceParagraph: number;  // <= 10 (not too far down)
  sourceAlreadyHasLink: false;  // This exact anchor isn't already a link
  sourceLinksInParagraph: number;  // < 3 (don't over-link)
  
  // Workspace settings
  autoFixEnabled: true;
  autoFixScope: 'all' | 'orphan_rescue' | 'exact_match_only';
}

function isAutoFixSafe(suggestion: LinkSuggestion, settings: WorkspaceSettings): boolean {
  // Must have wrap_existing method (safest)
  if (suggestion.insertionMethod !== 'wrap_existing') return false;
  
  // Must have high confidence
  if (suggestion.confidence < 0.85) return false;
  
  // Anchor must already exist in content
  if (!suggestion.originalText) return false;
  
  // Target page must be indexable
  if (!suggestion.targetIsIndexable) return false;
  
  // Must not create cannibalization issues
  if (suggestion.targetInCannibalizationSet) return false;
  
  // Don't exceed 10 links per article
  if (suggestion.sourceCurrentLinkCount >= 10) return false;
  
  // Don't have more than 2 links per paragraph
  if (suggestion.paragraphLinkCount >= 2) return false;
  
  // Check workspace settings
  if (!settings.autoInternalLinking) return false;
  
  if (settings.autoInternalLinkingScope === 'orphan_rescue') {
    return suggestion.opportunityType === 'orphan_rescue';
  }
  
  if (settings.autoInternalLinkingScope === 'exact_match_only') {
    return suggestion.anchorType === 'exact_match';
  }
  
  return true;
}
```

### 4.2 Auto-Fix Rules Summary

| Condition | Auto-Fix? | Reason |
|-----------|-----------|--------|
| Wrap existing exact-match keyword | Yes | Minimal content change, high value |
| Wrap existing branded term | Yes | Safe, clear intent |
| Insert new sentence with link | No | Changes content significantly |
| Replace text with different anchor | No | May alter meaning |
| Link in first paragraph | Yes (with approval) | High-value placement |
| Third+ link in same paragraph | No | Over-linking risk |
| Target has cannibalization issue | No | May worsen SEO |
| Source already has 10+ links | No | Article may be over-linked |
| Confidence < 85% | No | Need human review |

### 4.3 Flagged for Review

```typescript
interface FlaggedLinkOpportunity {
  opportunityId: string;
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchor: string;
  
  // Why flagged
  flagReasons: FlagReason[];
  
  // Preview
  beforeHtml: string;
  afterHtml: string;
  
  // Metadata
  opportunityType: string;
  combinedScore: number;
  estimatedImpact: string;
}

type FlagReason = 
  | 'low_confidence'
  | 'content_insertion_required'
  | 'cannibalization_risk'
  | 'high_link_density'
  | 'first_paragraph_placement'
  | 'anchor_text_uncertain'
  | 'cross_category_link'
  | 'user_setting_requires_approval';
```

---

## 5. Integration Points

### 5.1 With Existing Audit System

```
Site Audit Pipeline
        |
        v
+-------------------+
| Crawl Phase       |  <-- Already extracts internalLinks[]
+-------------------+
        |
        v
+-------------------+
| Link Graph Build  |  <-- NEW: Build detailed link graph
+-------------------+
        |
        v
+-------------------+
| Opportunity       |  <-- NEW: Detect link opportunities
| Detection         |
+-------------------+
        |
        v
+-------------------+
| Findings + Opps   |  <-- Link opportunities appear as audit findings
+-------------------+
        |
        v
+-------------------+
| Auto-Edit System  |  <-- Uses existing site_changes infrastructure
+-------------------+
```

### 5.2 With Auto-Edit System

Link suggestions generate `site_changes` records:

```typescript
async function applyLinkSuggestion(
  suggestion: LinkSuggestion,
  connection: SiteConnection
): Promise<ChangeResult> {
  // 1. Get current page content
  const currentContent = await connection.getPageContent(suggestion.sourcePageId);
  
  // 2. Apply the link
  let newContent: string;
  
  if (suggestion.insertionMethod === 'wrap_existing') {
    // Find and replace text with linked version
    newContent = currentContent.replace(
      suggestion.originalText!,
      `<a href="${suggestion.targetUrl}">${suggestion.originalText}</a>`
    );
  } else if (suggestion.insertionMethod === 'append_sentence') {
    // Insert new sentence after specified paragraph
    newContent = insertAfterParagraph(
      currentContent,
      suggestion.appendAfterParagraph!,
      suggestion.newSentence!
    );
  }
  
  // 3. Create change record
  const change = await db.insert(siteChanges).values({
    id: crypto.randomUUID(),
    clientId: suggestion.clientId,
    connectionId: connection.id,
    changeType: 'internal_link',
    category: 'links',
    resourceType: 'post',
    resourceId: suggestion.sourcePageId,
    resourceUrl: suggestion.sourceUrl,
    field: 'content',
    beforeValue: currentContent,
    afterValue: newContent,
    triggeredBy: suggestion.isAutoApplicable ? 'audit' : 'manual',
    auditId: suggestion.auditId,
    status: 'pending',
  }).returning();
  
  // 4. Apply via platform adapter
  const result = await connection.updatePageContent(
    suggestion.sourcePageId,
    newContent
  );
  
  // 5. Update suggestion status
  await db.update(linkSuggestions)
    .set({
      status: result.success ? 'applied' : 'failed',
      appliedAt: result.success ? new Date() : null,
      appliedChangeId: change[0].id,
      failureReason: result.error,
    })
    .where(eq(linkSuggestions.id, suggestion.id));
  
  return result;
}
```

### 5.3 With Content Generation Pipeline

When generating new content, the system should:

1. Check existing pages for link opportunities
2. Include internal links in generated content brief
3. Enforce minimum 3 links per article
4. Ensure at least one exact-match anchor

```typescript
interface ContentBrief {
  // ... existing fields ...
  
  // Internal linking requirements
  internalLinking: {
    minimumLinks: 3;
    maximumLinks: 10;
    requiredTargets: Array<{
      url: string;
      keyword: string;
      anchorType: 'exact_match' | 'any';
      mustBeInFirstParagraph: boolean;
    }>;
    suggestedTargets: Array<{
      url: string;
      keyword: string;
      relevance: number;
    }>;
    avoidLinkingTo: string[];  // Cannibalized pages
  };
}
```

---

## 6. Link Velocity Control

### 6.1 Rate Limiting

To avoid looking spammy, limit link additions:

```typescript
interface LinkVelocitySettings {
  // Per-page limits
  maxNewLinksPerPage: 3;          // Per edit session
  maxTotalLinksPerPage: 10;       // Ever
  maxLinksPerParagraph: 2;
  
  // Per-site limits
  maxNewLinksPerDay: 50;          // Across all pages
  maxNewLinksPerWeek: 200;
  
  // Timing
  minDaysBetweenPageEdits: 7;     // Don't edit same page too often
  
  // Distribution
  spreadLinksAcrossPages: true;   // Don't concentrate on few pages
  maxPagesEditedPerDay: 20;
}

async function checkLinkVelocity(
  clientId: string,
  sourceUrl: string
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getLinkVelocitySettings(clientId);
  
  // Check page-specific limits
  const pageLinksToday = await db.select({ count: count() })
    .from(siteChanges)
    .where(and(
      eq(siteChanges.clientId, clientId),
      eq(siteChanges.resourceUrl, sourceUrl),
      eq(siteChanges.changeType, 'internal_link'),
      gte(siteChanges.createdAt, startOfDay(new Date()))
    ));
  
  if (pageLinksToday[0].count >= settings.maxNewLinksPerPage) {
    return {
      allowed: false,
      reason: `Page has reached daily limit of ${settings.maxNewLinksPerPage} new links`,
    };
  }
  
  // Check site-wide limits
  const siteLinksToday = await db.select({ count: count() })
    .from(siteChanges)
    .where(and(
      eq(siteChanges.clientId, clientId),
      eq(siteChanges.changeType, 'internal_link'),
      gte(siteChanges.createdAt, startOfDay(new Date()))
    ));
  
  if (siteLinksToday[0].count >= settings.maxNewLinksPerDay) {
    return {
      allowed: false,
      reason: `Site has reached daily limit of ${settings.maxNewLinksPerDay} new links`,
    };
  }
  
  return { allowed: true };
}
```

### 6.2 Prioritization Queue

When many opportunities exist, prioritize:

```typescript
function prioritizeLinkOpportunities(
  opportunities: LinkOpportunity[]
): LinkOpportunity[] {
  return opportunities.sort((a, b) => {
    // 1. Orphan rescue is highest priority
    if (a.opportunityType === 'orphan_rescue' && b.opportunityType !== 'orphan_rescue') {
      return -1;
    }
    if (b.opportunityType === 'orphan_rescue' && a.opportunityType !== 'orphan_rescue') {
      return 1;
    }
    
    // 2. Exact-match anchor opportunities
    if (a.opportunityType === 'anchor_diversity' && b.opportunityType !== 'anchor_diversity') {
      return -1;
    }
    
    // 3. High-traffic pages
    // (would need traffic data)
    
    // 4. Combined score
    return b.combinedScore - a.combinedScore;
  });
}
```

---

## 7. Token Efficiency Analysis

### 7.1 Operations That Require No AI

| Operation | Method | Token Cost |
|-----------|--------|------------|
| Link graph building | HTML parsing | 0 |
| Click depth analysis | BFS algorithm | 0 |
| Orphan page detection | SQL query | 0 |
| Keyword mention scan | Text search | 0 |
| Anchor text selection | Rule-based | 0 |
| Cannibalization detection | GSC data analysis | 0 |
| Link velocity tracking | SQL queries | 0 |
| Auto-fix eligibility | Rule evaluation | 0 |

### 7.2 Operations That May Use AI (Optional)

| Operation | When AI Helps | Fallback |
|-----------|---------------|----------|
| Topical relevance | When keywords unavailable | Keyword overlap |
| Anchor text for new content | Generating natural sentences | Template sentences |
| Content quality check | Verifying link context | Skip check |
| Suggestion summarization | Dashboard explanations | Templated text |

### 7.3 Estimated Costs

For a 500-page site with 2,000 internal links:

```
Link Graph Build:     0 tokens (pure parsing)
Opportunity Detection: 0 tokens (rule-based)
Anchor Selection:      0 tokens (rule-based)
AI Enhancement:       ~2,000 tokens (optional, for complex cases)

Monthly Ongoing:
- Re-crawl (weekly):   0 tokens
- New opportunities:   0 tokens
- AI summaries:       ~500 tokens/month

Total: ~2,500 tokens/month for optional AI features
Core system: 0 tokens
```

---

## 8. UI Components

### 8.1 Link Health Dashboard

```
+-------------------------------------------------------------------------------+
|  Internal Linking Health                                       [Run Analysis]  |
+-------------------------------------------------------------------------------+
|                                                                               |
|  +--- OVERVIEW CARDS -------------------------------------------------------+ |
|  |                                                                           | |
|  |  +-------------+  +-------------+  +-------------+  +-------------+      | |
|  |  | Total Pages |  |   Orphan    |  |  Avg Links  |  | Deep Pages  |      | |
|  |  |     487     |  |    Pages    |  |  Per Page   |  |   (>3 clicks)|     | |
|  |  |             |  |     12      |  |    18.4     |  |      34      |     | |
|  |  |  [Good]     |  |  [Critical] |  |  [Warning]  |  |  [Warning]   |     | |
|  |  +-------------+  +-------------+  +-------------+  +-------------+      | |
|  |                                                                           | |
|  +-------------------------------------------------------------------------+ |
|                                                                               |
|  +--- LINK DISTRIBUTION CHART ---------------------------------------------+ |
|  |                                                                           | |
|  |  Links per page:                                                          | |
|  |                                                                           | |
|  |  0-10   [==========                              ] 89 pages               | |
|  |  11-20  [==================                      ] 156 pages              | |
|  |  21-30  [========================                ] 198 pages              | |
|  |  31-40  [===========                             ] 34 pages   <-- Target  | |
|  |  41-50  [===                                     ] 8 pages    <-- Optimal | |
|  |  50+    [=                                       ] 2 pages                | |
|  |                                                                           | |
|  +-------------------------------------------------------------------------+ |
|                                                                               |
|  +--- OPPORTUNITIES (24 detected) -------------------- [Apply All Safe] ----+ |
|  |                                                                           | |
|  |  Priority | Source Page           | Target Page         | Type    | Act  | |
|  |  ---------|----------------------|---------------------|---------|------| |
|  |  Critical | /blog/sauna-guide    | /products/barrel    | Orphan  | [+]  | |
|  |  High     | /about               | /services           | Keyword | [+]  | |
|  |  High     | /blog/installation   | /products/heaters   | Cluster | [+]  | |
|  |  Medium   | /faq                 | /blog/maintenance   | Depth   | [+]  | |
|  |  ...                                                                      | |
|  |                                                                           | |
|  +-------------------------------------------------------------------------+ |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### 8.2 Link Opportunity Detail Modal

```
+-------------------------------------------------------------------------------+
|  Link Opportunity                                                    [X Close] |
+-------------------------------------------------------------------------------+
|                                                                               |
|  Source: /blog/complete-sauna-guide                                           |
|  Target: /products/barrel-sauna (ORPHAN - 0 inbound links)                    |
|                                                                               |
|  +--- SUGGESTED LINK -------------------------------------------------------+ |
|  |                                                                           | |
|  |  Anchor Text: "barrel sauna"                                              | |
|  |  Type: Exact Match (50% target)                                           | |
|  |  Confidence: 94%                                                          | |
|  |                                                                           | |
|  |  Preview:                                                                 | |
|  |  "...When choosing a sauna for your home, a [barrel sauna] offers        | |
|  |  superior heat distribution and aesthetic appeal..."                      | |
|  |                                                                           | |
|  +-------------------------------------------------------------------------+ |
|                                                                               |
|  +--- IMPACT ANALYSIS -----------------------------------------------------+ |
|  |                                                                           | |
|  |  - Rescues orphan page (critical)                                        | |
|  |  - Adds exact-match anchor (target has 0)                                | |
|  |  - Reduces click depth from 5 to 2                                       | |
|  |  - Estimated traffic impact: +15-25%                                     | |
|  |                                                                           | |
|  +-------------------------------------------------------------------------+ |
|                                                                               |
|  [Reject]                      [Edit Anchor]              [Apply Link]        |
|                                                                               |
+-------------------------------------------------------------------------------+
```

---

## 9. Edge Cases & Failure Modes

### 9.1 Edge Cases

| Case | Handling |
|------|----------|
| Circular links (A->B->C->A) | Allow - not harmful for internal links |
| Same anchor text to multiple pages | Flag as cannibalization risk |
| Link to non-indexable page | Warn but allow (might be intentional) |
| Link to redirect | Suggest updating to final URL |
| Dynamic content (JS-rendered) | Use rendered HTML from crawler |
| Pagination pages | Exclude from link targets |
| Archive/tag pages | Lower priority as targets |
| Login-required pages | Exclude from suggestions |

### 9.2 Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Crawl incomplete | Check pages_total vs pages_crawled | Re-run crawl |
| HTML parsing error | Try/catch, log errors | Skip page, flag for manual review |
| Content changed since analysis | Hash comparison before apply | Re-analyze, regenerate suggestions |
| Link application failed | Platform API error | Queue for retry, notify user |
| Revert failed | Platform API error | Manual intervention required |

### 9.3 Safeguards

```typescript
interface LinkingSafeguards {
  // Pre-apply checks
  verifyPageStillExists: true;
  verifyAnchorStillInContent: true;
  verifyNoRecentEdits: true;
  checkForCannibalzation: true;
  
  // Post-apply verification
  verifyLinkAppeared: true;
  verifyNoOtherChanges: true;
  
  // Automatic revert triggers
  revertIf: {
    trafficDropPercent: 20;
    rankingDropPositions: 5;
    errorRate4xxPercent: 10;
  };
}
```

---

## 10. Implementation Phases

### Phase 1: Link Graph (Week 1)
- Schema creation
- Link extraction from crawl data
- Basic graph building

### Phase 2: Analysis (Week 2)
- Click depth computation
- Orphan detection
- Page-level metrics

### Phase 3: Opportunity Detection (Week 3)
- Keyword mention scanning
- Link velocity opportunities
- Anchor diversity analysis

### Phase 4: Suggestion Generation (Week 4)
- Anchor text selection
- Insertion method determination
- Confidence scoring

### Phase 5: Auto-Fix Integration (Week 5)
- Auto-fix eligibility rules
- Integration with site_changes
- Platform adapter updates

### Phase 6: UI (Week 6)
- Link health dashboard
- Opportunity list
- Apply/reject workflow

### Phase 7: Velocity & Safety (Week 7)
- Rate limiting
- Cannibalization detection
- Safeguards implementation

### Phase 8: Testing & Polish (Week 8)
- Integration testing
- Performance optimization
- Documentation

---

## 11. API Endpoints

```typescript
// Link Graph
GET    /api/links/graph/:auditId              // Get link graph for audit
GET    /api/links/page/:pageId                // Get links for specific page
GET    /api/links/orphans/:clientId           // Get orphan pages

// Opportunities
GET    /api/links/opportunities/:clientId     // List opportunities (filtered)
GET    /api/links/opportunities/:id           // Get opportunity details
POST   /api/links/opportunities/:id/approve   // Approve opportunity
POST   /api/links/opportunities/:id/reject    // Reject opportunity

// Suggestions
GET    /api/links/suggestions/:opportunityId  // Get suggestions for opportunity
POST   /api/links/suggestions/:id/apply       // Apply suggestion
POST   /api/links/suggestions/:id/preview     // Preview suggestion

// Batch Operations
POST   /api/links/batch/apply                 // Apply multiple suggestions
POST   /api/links/batch/approve               // Approve multiple opportunities

// Analysis
POST   /api/links/analyze/:clientId           // Run link analysis
GET    /api/links/cannibalization/:clientId   // Get cannibalization issues
GET    /api/links/health/:clientId            // Get overall link health metrics

// Settings
GET    /api/links/settings/:clientId          // Get link settings
PUT    /api/links/settings/:clientId          // Update link settings
```

---

## 12. Success Metrics

### KPIs to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Orphan pages | 0 | Weekly scan |
| Avg inbound links/page | 40-44 | After each audit |
| Pages with exact-match anchor | 100% | After each audit |
| Max click depth | 3 | After each audit |
| Link suggestions accepted | >80% | Ongoing |
| Auto-fix success rate | >95% | Ongoing |
| Time to resolve orphan | <7 days | Ongoing |
| Traffic increase (linked pages) | +20% | 30-day comparison |

---

*Design complete: 2026-04-22*
