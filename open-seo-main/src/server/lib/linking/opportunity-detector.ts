/**
 * Opportunity detection for internal linking improvements.
 * Phase 35-02: Opportunity Detection
 *
 * Detects actionable opportunities to improve internal link structure:
 * - depth_reduction: Pages too many clicks from homepage
 * - orphan_rescue: Pages with zero inbound links
 * - link_velocity: Pages with low inbound link count
 * - anchor_diversity: Pages lacking exact-match anchor text
 */
import { nanoid } from "nanoid";
import type { LinkOpportunitiesInsert, OpportunityType } from "@/db/link-schema";

/**
 * Maximum opportunities per audit (DoS protection T-35-08).
 */
export const MAX_OPPORTUNITIES_PER_AUDIT = 1000;

/**
 * Threshold for click depth - pages deeper than this are candidates.
 */
const DEPTH_THRESHOLD = 3;

/**
 * Target click depth for recommendations.
 */
const TARGET_DEPTH = 3;

/**
 * Threshold for inbound links - pages with fewer are candidates.
 */
const INBOUND_LINKS_THRESHOLD = 40;

/**
 * Page metrics required for opportunity detection.
 */
export interface PageMetrics {
  pageId: string | null;
  pageUrl: string;
  clickDepthFromHome: number | null;
  inboundTotal: number;
  inboundExactMatch: number;
}

/**
 * Orphan page data.
 */
export interface OrphanPage {
  pageId: string | null;
  pageUrl: string;
  pageTitle: string | null;
}

/**
 * Parameters for detecting opportunities.
 */
export interface DetectOpportunitiesParams {
  clientId: string;
  auditId: string;
  pageMetrics: PageMetrics[];
  orphanPages: OrphanPage[];
}

/**
 * Parameters for individual detection functions.
 */
interface DetectParams {
  clientId: string;
  auditId: string;
}

/**
 * Result of opportunity detection.
 */
export interface DetectOpportunitiesResult {
  opportunities: LinkOpportunitiesInsert[];
  stats: {
    depthReduction: number;
    orphanRescue: number;
    linkVelocity: number;
    anchorDiversity: number;
    total: number;
  };
  cappedAtLimit: boolean;
}

/**
 * Detect all link opportunities for an audit.
 *
 * Combines depth reduction, orphan rescue, link velocity, and anchor diversity
 * opportunities. Caps total at MAX_OPPORTUNITIES_PER_AUDIT for DoS protection.
 *
 * @param params - Detection parameters
 * @returns Detected opportunities with statistics
 */
export function detectOpportunities(
  params: DetectOpportunitiesParams
): DetectOpportunitiesResult {
  const { clientId, auditId, pageMetrics, orphanPages } = params;
  const baseParams = { clientId, auditId };

  // Detect all opportunity types
  const depthOpportunities = detectDepthReductionOpportunities({
    ...baseParams,
    pageMetrics,
  });

  const orphanOpportunities = detectOrphanRescueOpportunities({
    ...baseParams,
    orphanPages,
  });

  const velocityOpportunities = detectLinkVelocityOpportunities({
    ...baseParams,
    pageMetrics,
  });

  const diversityOpportunities = detectAnchorDiversityOpportunities({
    ...baseParams,
    pageMetrics,
  });

  // Combine all opportunities
  const allOpportunities = [
    ...depthOpportunities,
    ...orphanOpportunities,
    ...velocityOpportunities,
    ...diversityOpportunities,
  ];

  // Sort by urgency (highest first) for prioritization when capping
  allOpportunities.sort((a, b) => (b.urgency ?? 0) - (a.urgency ?? 0));

  // Cap at limit
  const cappedAtLimit = allOpportunities.length > MAX_OPPORTUNITIES_PER_AUDIT;
  const opportunities = allOpportunities.slice(0, MAX_OPPORTUNITIES_PER_AUDIT);

  // Count by type in final result
  const stats = {
    depthReduction: opportunities.filter(
      (o) => o.opportunityType === "depth_reduction"
    ).length,
    orphanRescue: opportunities.filter(
      (o) => o.opportunityType === "orphan_rescue"
    ).length,
    linkVelocity: opportunities.filter(
      (o) => o.opportunityType === "link_velocity"
    ).length,
    anchorDiversity: opportunities.filter(
      (o) => o.opportunityType === "anchor_diversity"
    ).length,
    total: opportunities.length,
  };

  return {
    opportunities,
    stats,
    cappedAtLimit,
  };
}

/**
 * Detect depth reduction opportunities.
 *
 * Pages with click depth > 3 from homepage are candidates.
 * Urgency increases with depth (capped at 1.0).
 */
export function detectDepthReductionOpportunities(
  params: DetectParams & { pageMetrics: PageMetrics[] }
): LinkOpportunitiesInsert[] {
  const { clientId, auditId, pageMetrics } = params;
  const opportunities: LinkOpportunitiesInsert[] = [];

  for (const page of pageMetrics) {
    const depth = page.clickDepthFromHome;

    // Skip pages without valid depth or depth <= threshold
    if (depth === null || !Number.isFinite(depth) || depth <= DEPTH_THRESHOLD) {
      continue;
    }

    // Calculate urgency: deeper = more urgent
    // depth 4 -> 0.25, depth 5 -> 0.5, depth 6 -> 0.75, depth 7+ -> approaching 1.0
    const urgency = Math.min(1.0, (depth - DEPTH_THRESHOLD) / 4);

    opportunities.push({
      id: nanoid(),
      clientId,
      auditId,
      pageId: page.pageId,
      pageUrl: page.pageUrl,
      opportunityType: "depth_reduction" as OpportunityType,
      urgency,
      currentDepth: depth,
      targetDepth: TARGET_DEPTH,
      currentInboundCount: null,
      currentExactMatchCount: null,
      suggestedSourcePages: null,
      suggestedAnchorText: null,
      reason: `Page is ${depth} clicks from homepage. Reducing to ${TARGET_DEPTH} clicks improves crawlability and link equity distribution.`,
      status: "pending",
      implementedAt: null,
      implementedByChangeId: null,
    });
  }

  return opportunities;
}

/**
 * Detect orphan rescue opportunities.
 *
 * Pages with zero inbound internal links get maximum urgency (1.0).
 */
export function detectOrphanRescueOpportunities(
  params: DetectParams & { orphanPages: OrphanPage[] }
): LinkOpportunitiesInsert[] {
  const { clientId, auditId, orphanPages } = params;
  const opportunities: LinkOpportunitiesInsert[] = [];

  for (const page of orphanPages) {
    const titlePart = page.pageTitle ? ` "${page.pageTitle}"` : "";

    opportunities.push({
      id: nanoid(),
      clientId,
      auditId,
      pageId: page.pageId,
      pageUrl: page.pageUrl,
      opportunityType: "orphan_rescue" as OpportunityType,
      urgency: 1.0, // Maximum urgency - orphans are critical issues
      currentDepth: null,
      targetDepth: null,
      currentInboundCount: 0,
      currentExactMatchCount: null,
      suggestedSourcePages: null,
      suggestedAnchorText: null,
      reason: `Page${titlePart} has zero inbound internal links. Search engines may not discover or properly value this content.`,
      status: "pending",
      implementedAt: null,
      implementedByChangeId: null,
    });
  }

  return opportunities;
}

/**
 * Detect link velocity opportunities.
 *
 * Pages with fewer than 40 inbound links are candidates.
 * Urgency is higher for pages with very few links.
 */
export function detectLinkVelocityOpportunities(
  params: DetectParams & { pageMetrics: PageMetrics[] }
): LinkOpportunitiesInsert[] {
  const { clientId, auditId, pageMetrics } = params;
  const opportunities: LinkOpportunitiesInsert[] = [];

  for (const page of pageMetrics) {
    const inboundCount = page.inboundTotal;

    // Skip pages with sufficient inbound links
    if (inboundCount >= INBOUND_LINKS_THRESHOLD) {
      continue;
    }

    // Calculate urgency: fewer links = higher urgency
    // 0 links -> 1.0, 20 links -> 0.5, 39 links -> ~0.03
    const urgency = 1 - inboundCount / INBOUND_LINKS_THRESHOLD;

    opportunities.push({
      id: nanoid(),
      clientId,
      auditId,
      pageId: page.pageId,
      pageUrl: page.pageUrl,
      opportunityType: "link_velocity" as OpportunityType,
      urgency,
      currentDepth: null,
      targetDepth: null,
      currentInboundCount: inboundCount,
      currentExactMatchCount: null,
      suggestedSourcePages: null,
      suggestedAnchorText: null,
      reason: `Page has only ${inboundCount} inbound links. Adding more internal links increases PageRank flow and improves ranking potential.`,
      status: "pending",
      implementedAt: null,
      implementedByChangeId: null,
    });
  }

  return opportunities;
}

/**
 * Detect anchor diversity opportunities.
 *
 * Pages with zero exact-match anchor text are candidates.
 * Urgency is higher for pages with more generic links (more opportunity).
 */
export function detectAnchorDiversityOpportunities(
  params: DetectParams & { pageMetrics: PageMetrics[] }
): LinkOpportunitiesInsert[] {
  const { clientId, auditId, pageMetrics } = params;
  const opportunities: LinkOpportunitiesInsert[] = [];

  for (const page of pageMetrics) {
    const exactMatchCount = page.inboundExactMatch;

    // Skip pages that already have exact-match anchors
    if (exactMatchCount > 0) {
      continue;
    }

    // Calculate urgency based on how many links lack exact-match
    // More inbound links without exact-match = higher opportunity
    // Cap at reasonable value
    const urgency = Math.min(1.0, page.inboundTotal / 50);

    opportunities.push({
      id: nanoid(),
      clientId,
      auditId,
      pageId: page.pageId,
      pageUrl: page.pageUrl,
      opportunityType: "anchor_diversity" as OpportunityType,
      urgency,
      currentDepth: null,
      targetDepth: null,
      currentInboundCount: page.inboundTotal,
      currentExactMatchCount: exactMatchCount,
      suggestedSourcePages: null,
      suggestedAnchorText: null,
      reason: `Page has no exact-match anchor text among ${page.inboundTotal} inbound links. Using target keywords in anchor text improves relevance signals.`,
      status: "pending",
      implementedAt: null,
      implementedByChangeId: null,
    });
  }

  return opportunities;
}
