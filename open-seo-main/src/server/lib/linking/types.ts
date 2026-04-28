/**
 * Types for internal link analysis.
 * Phase 35-01: Link Graph Schema + Extraction
 */

import type { LinkPosition, LinkType } from "@/db/link-schema";

/**
 * Detailed link extracted from HTML.
 * Used by graph-builder to populate link_graph table.
 */
export interface DetailedLink {
  /** Normalized absolute URL of target page */
  targetUrl: string;
  /** Page ID from audit_pages if resolved */
  targetPageId: string | null;
  /** Visible anchor text (trimmed) */
  anchorText: string;
  /** Surrounding text context (~50 chars) */
  context: string;
  /** Position in page structure */
  position: LinkPosition;
  /** Paragraph index if in body (1-indexed), null otherwise */
  paragraphIndex: number | null;
  /** Whether link is dofollow (no rel="nofollow") */
  isDoFollow: boolean;
  /** Link type classification */
  linkType: LinkType;
  /** Whether link has title attribute */
  hasTitle: boolean;
  /** Whether link has rel="noopener" */
  hasNoOpener: boolean;
}

/**
 * URL to page ID mapping for resolving target page IDs.
 */
export type UrlToPageMap = Map<string, string>;

/**
 * Options for link extraction.
 */
export interface ExtractLinksOptions {
  /** HTML content to parse */
  html: string;
  /** Source page URL (for resolving relative URLs) */
  pageUrl: string;
  /** Site origin (for filtering internal links) */
  siteOrigin: string;
  /** URL to page ID mapping */
  urlToPageMap?: UrlToPageMap;
}

/**
 * Result of link extraction.
 */
export interface ExtractLinksResult {
  /** All internal links found */
  links: DetailedLink[];
  /** Count of external links skipped */
  externalLinksSkipped: number;
  /** Count of invalid links skipped (javascript:, mailto:, etc.) */
  invalidLinksSkipped: number;
}

// ============================================================
// Phase 35-03: Target Selection + Anchor Selection Types
// ============================================================

import type { AnchorType, SuggestionStatus } from "@/db/link-schema";

/**
 * Page candidate for link target ranking.
 */
export interface PageCandidate {
  pageId: string;
  pageUrl: string;
  pageTitle: string | null;
  targetKeyword: string | null;
  /** Current inbound link count */
  inboundCount: number;
  /** Ideal inbound link count (based on site average) */
  idealInboundCount: number;
  /** Click depth from homepage */
  clickDepth: number | null;
  /** Whether this page is an orphan (0 inbound links) */
  isOrphan: boolean;
  /** Keywords extracted from page content */
  contentKeywords: string[];
}

/**
 * Source page data for anchor selection.
 */
export interface SourcePageData {
  pageId: string;
  pageUrl: string;
  /** Plain text content of the page body */
  bodyText: string;
  /** Brand name for branded anchor detection */
  brandName?: string;
}

/**
 * Scored link target candidate.
 */
export interface ScoredCandidate {
  pageId: string;
  pageUrl: string;
  pageTitle: string | null;
  targetKeyword: string | null;
  /** Total score (0-100) */
  score: number;
  /** Link deficit score (25% weight) */
  linkDeficitScore: number;
  /** Exact-match need score (20% weight) */
  exactMatchScore: number;
  /** Orphan bonus score (30% weight) */
  orphanScore: number;
  /** Depth reduction score (15% weight) */
  depthScore: number;
  /** Relevance score based on keyword overlap (20% weight) */
  relevanceScore: number;
  /** Human-readable reasons for the suggestion */
  reasons: string[];
}

/**
 * Parameters for ranking link targets.
 */
export interface RankLinkTargetsParams {
  /** Source page from which to link */
  sourcePage: SourcePageData;
  /** Candidate pages to rank */
  candidates: PageCandidate[];
  /** Maximum number of results to return */
  maxResults?: number;
  /** Site average inbound links per page */
  siteAverageInbound?: number;
  /** Maximum click depth threshold */
  maxClickDepth?: number;
}

/**
 * Result of anchor text selection.
 */
export interface AnchorSelection {
  /** Selected anchor text */
  anchorText: string;
  /** Anchor type: exact, branded, or misc */
  anchorType: AnchorType;
  /** Confidence score (0.0-1.0) */
  confidence: number;
  /** If wrapping existing text, this is the text to wrap */
  existingTextMatch: string | null;
  /** If inserting, where to insert (paragraph context) */
  insertionContext: string | null;
}

/**
 * Parameters for selecting anchor text.
 */
export interface SelectAnchorParams {
  /** Source page content */
  sourcePage: SourcePageData;
  /** Target page for the link */
  targetKeyword: string | null;
  targetTitle: string | null;
  /** Distribution tracking for anchor type balance */
  anchorDistribution: AnchorDistribution;
}

/**
 * Tracks current anchor type distribution for a target page.
 * Goal: ~50% exact, ~25% branded, ~25% misc
 */
export interface AnchorDistribution {
  exact: number;
  branded: number;
  misc: number;
}

/**
 * Link suggestion ready for database insertion.
 */
export interface LinkSuggestion {
  sourceUrl: string;
  sourcePageId: string | null;
  targetUrl: string;
  targetPageId: string | null;
  anchorText: string;
  anchorType: AnchorType;
  anchorConfidence: number;
  score: number;
  linkDeficitScore: number;
  exactMatchScore: number;
  orphanScore: number;
  depthScore: number;
  relevanceScore: number;
  reasons: string[];
  existingTextMatch: string | null;
  insertionContext: string | null;
  status: SuggestionStatus;
}
