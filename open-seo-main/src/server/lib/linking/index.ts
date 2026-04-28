/**
 * Internal linking analysis module.
 * Phases 35-01 through 35-03
 *
 * Provides link extraction, graph building, orphan detection,
 * opportunity detection, and link suggestion generation.
 */

// Types - Phase 35-01
export type {
  DetailedLink,
  UrlToPageMap,
  ExtractLinksOptions,
  ExtractLinksResult,
} from "./types";

// Types - Phase 35-03
export type {
  PageCandidate,
  SourcePageData,
  ScoredCandidate,
  RankLinkTargetsParams,
  AnchorSelection,
  SelectAnchorParams,
  AnchorDistribution,
  LinkSuggestion,
} from "./types";

// Link extraction
export {
  extractDetailedLinks,
  classifyLinkPosition,
  getParagraphIndex,
  extractContext,
} from "./link-extractor";

// Graph building
export type {
  PageData,
  BuildLinkGraphParams,
  BuildLinkGraphResult,
  ComputePageMetricsParams,
  DetectOrphanPagesParams,
} from "./graph-builder";

export {
  buildLinkGraph,
  createLinkGraphEntry,
  aggregateInboundMetrics,
  aggregateOutboundMetrics,
  computePageLinkMetrics,
  detectOrphanPages,
} from "./graph-builder";

// Click depth computation
export type {
  LinkEdge,
  ComputeClickDepthsParams,
  ClickDepthResult,
} from "./click-depth";

export { computeClickDepths } from "./click-depth";

// Opportunity detection
export type {
  PageMetrics,
  OrphanPage,
  DetectOpportunitiesParams,
  DetectOpportunitiesResult,
} from "./opportunity-detector";

export {
  detectOpportunities,
  detectDepthReductionOpportunities,
  detectOrphanRescueOpportunities,
  detectLinkVelocityOpportunities,
  detectAnchorDiversityOpportunities,
  MAX_OPPORTUNITIES_PER_AUDIT,
} from "./opportunity-detector";

// Target selection - Phase 35-03
export {
  rankLinkTargets,
  computeLinkDeficitScore,
  computeExactMatchScore,
  computeOrphanScore,
  computeDepthScore,
  computeRelevanceScore,
  extractKeywordsFromContent,
  computeKeywordOverlap,
} from "./target-selector";

// Anchor selection - Phase 35-03
export {
  selectAnchorText,
  findExistingTextMatch,
  determineAnchorType,
  generateBrandedAnchor,
  generateMiscAnchor,
  normalizeText,
} from "./anchor-selector";
