/**
 * Graph builder for internal linking analysis.
 * Phase 35-01: Link Graph Schema + Extraction
 *
 * Builds the link graph from audit pages, computes page metrics,
 * and detects orphan pages.
 */
import { nanoid } from "nanoid";
import type { LinkGraphInsert, PageLinksInsert, OrphanPagesInsert } from "@/db/link-schema";
import type { DetailedLink, UrlToPageMap } from "./types";
import { extractDetailedLinks } from "./link-extractor";

/**
 * Maximum links per page (DoS protection per threat model T-35-04).
 */
const MAX_LINKS_PER_PAGE = 1000;

/**
 * Maximum links per audit (DoS protection per threat model T-35-04).
 */
const MAX_LINKS_PER_AUDIT = 50000;

/**
 * Page data for graph building.
 */
export interface PageData {
  pageId: string;
  pageUrl: string;
  pageTitle: string | null;
}

/**
 * Parameters for building the link graph.
 */
export interface BuildLinkGraphParams {
  auditId: string;
  clientId: string;
  pages: PageData[];
  /** Function to retrieve cached HTML for a page URL */
  getPageHtml: (pageUrl: string, auditId: string) => Promise<string | null>;
  /** Site origin for filtering internal links */
  siteOrigin?: string;
}

/**
 * Result of building the link graph.
 */
export interface BuildLinkGraphResult {
  /** Link graph entries to insert */
  linkEntries: LinkGraphInsert[];
  /** Page link metrics to insert */
  pageMetrics: PageLinksInsert[];
  /** Orphan pages to insert */
  orphanPages: OrphanPagesInsert[];
  /** Statistics */
  stats: {
    totalLinks: number;
    pagesProcessed: number;
    orphansDetected: number;
    linksSkippedDueToLimit: number;
  };
}

/**
 * Build the complete link graph from audit pages.
 *
 * @param params - Build parameters
 * @returns Link graph entries, page metrics, and orphan pages
 */
export async function buildLinkGraph(
  params: BuildLinkGraphParams
): Promise<BuildLinkGraphResult> {
  const { auditId, clientId, pages, getPageHtml, siteOrigin } = params;

  // Build URL to page ID map
  const urlToPageMap: UrlToPageMap = new Map();
  for (const page of pages) {
    urlToPageMap.set(page.pageUrl, page.pageId);
    // Also map without trailing slash
    if (page.pageUrl.endsWith("/")) {
      urlToPageMap.set(page.pageUrl.slice(0, -1), page.pageId);
    } else {
      urlToPageMap.set(page.pageUrl + "/", page.pageId);
    }
  }

  // Determine site origin from first page if not provided
  const origin = siteOrigin || (pages.length > 0 ? new URL(pages[0].pageUrl).origin : "");

  const allLinkEntries: LinkGraphInsert[] = [];
  const pageOutboundCounts = new Map<string, { internal: number; external: number }>();
  let linksSkippedDueToLimit = 0;

  // Process each page to extract links
  for (const page of pages) {
    const html = await getPageHtml(page.pageUrl, auditId);
    if (!html) {
      // No HTML available, skip
      pageOutboundCounts.set(page.pageId, { internal: 0, external: 0 });
      continue;
    }

    const extractResult = extractDetailedLinks({
      html,
      pageUrl: page.pageUrl,
      siteOrigin: origin,
      urlToPageMap,
    });

    // Apply per-page limit
    let links = extractResult.links;
    if (links.length > MAX_LINKS_PER_PAGE) {
      linksSkippedDueToLimit += links.length - MAX_LINKS_PER_PAGE;
      links = links.slice(0, MAX_LINKS_PER_PAGE);
    }

    // Track outbound counts
    pageOutboundCounts.set(page.pageId, {
      internal: links.length,
      external: extractResult.externalLinksSkipped,
    });

    // Create link graph entries
    for (const link of links) {
      // Check audit-wide limit
      if (allLinkEntries.length >= MAX_LINKS_PER_AUDIT) {
        linksSkippedDueToLimit++;
        continue;
      }

      const entry = createLinkGraphEntry({
        link,
        clientId,
        auditId,
        sourceUrl: page.pageUrl,
        sourcePageId: page.pageId,
      });

      allLinkEntries.push(entry);
    }
  }

  // Group links by target URL for inbound metrics
  const inboundByTarget = new Map<string, LinkGraphInsert[]>();
  for (const entry of allLinkEntries) {
    const existing = inboundByTarget.get(entry.targetUrl) || [];
    existing.push(entry);
    inboundByTarget.set(entry.targetUrl, existing);
  }

  // Group links by source URL for outbound metrics
  const outboundBySource = new Map<string, LinkGraphInsert[]>();
  for (const entry of allLinkEntries) {
    const existing = outboundBySource.get(entry.sourceUrl) || [];
    existing.push(entry);
    outboundBySource.set(entry.sourceUrl, existing);
  }

  // Track pages with inbound links
  const pagesWithInboundLinks = new Set<string>();
  for (const entry of allLinkEntries) {
    if (entry.targetPageId) {
      pagesWithInboundLinks.add(entry.targetPageId);
    }
  }

  // Compute page metrics
  const pageMetrics: PageLinksInsert[] = [];
  for (const page of pages) {
    const inboundLinks = inboundByTarget.get(page.pageUrl) || [];
    const outboundLinks = outboundBySource.get(page.pageUrl) || [];
    const outboundCounts = pageOutboundCounts.get(page.pageId) || { internal: 0, external: 0 };

    const metrics = computePageLinkMetrics({
      pageUrl: page.pageUrl,
      inboundLinks,
      outboundLinks,
      totalOutbound: outboundCounts.internal + outboundCounts.external,
    });

    pageMetrics.push({
      id: nanoid(),
      clientId,
      auditId,
      pageId: page.pageId,
      pageUrl: page.pageUrl,
      ...metrics,
    });
  }

  // Detect orphan pages
  const orphanPages = detectOrphanPages({
    clientId,
    auditId,
    allPages: pages,
    pagesWithInboundLinks,
    discoverySource: "sitemap", // Default, can be enhanced later
  });

  return {
    linkEntries: allLinkEntries,
    pageMetrics,
    orphanPages,
    stats: {
      totalLinks: allLinkEntries.length,
      pagesProcessed: pages.length,
      orphansDetected: orphanPages.length,
      linksSkippedDueToLimit,
    },
  };
}

/**
 * Create a link graph entry from a detailed link.
 */
export function createLinkGraphEntry(params: {
  link: DetailedLink;
  clientId: string;
  auditId: string;
  sourceUrl: string;
  sourcePageId: string | null;
}): LinkGraphInsert {
  const { link, clientId, auditId, sourceUrl, sourcePageId } = params;

  const anchorTextLower = link.anchorText.toLowerCase();
  const isUrl = isUrlAnchor(link.anchorText);
  const isFirstParagraph = link.paragraphIndex === 1;
  const isSecondParagraph = link.paragraphIndex === 2;

  return {
    id: nanoid(),
    clientId,
    auditId,
    sourceUrl,
    sourcePageId,
    targetUrl: link.targetUrl,
    targetPageId: link.targetPageId,
    anchorText: link.anchorText,
    anchorTextLower,
    anchorContext: link.context || null,
    position: link.position,
    paragraphIndex: link.paragraphIndex,
    isFirstParagraph,
    isSecondParagraph,
    isDoFollow: link.isDoFollow,
    hasNoOpener: link.hasNoOpener,
    hasTitle: link.hasTitle,
    linkText: link.anchorText,
    linkType: link.linkType,
    isExactMatch: false, // Will be set by separate keyword matching
    isBranded: false, // Will be set by separate brand detection
    isUrl,
  };
}

/**
 * Check if anchor text is a URL.
 */
function isUrlAnchor(anchorText: string): boolean {
  const text = anchorText.trim().toLowerCase();
  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("www.")
  );
}

/**
 * Aggregate inbound metrics from link entries.
 */
export function aggregateInboundMetrics(
  links: LinkGraphInsert[]
): Pick<
  PageLinksInsert,
  | "inboundTotal"
  | "inboundBody"
  | "inboundNav"
  | "inboundFooter"
  | "inboundSidebar"
  | "inboundFirstParagraph"
  | "inboundExactMatch"
  | "inboundBranded"
  | "inboundDoFollow"
> {
  return {
    inboundTotal: links.length,
    inboundBody: links.filter((l) => l.position === "body").length,
    inboundNav: links.filter((l) => l.position === "nav").length,
    inboundFooter: links.filter((l) => l.position === "footer").length,
    inboundSidebar: links.filter((l) => l.position === "sidebar").length,
    inboundFirstParagraph: links.filter((l) => l.isFirstParagraph).length,
    inboundExactMatch: links.filter((l) => l.isExactMatch).length,
    inboundBranded: links.filter((l) => l.isBranded).length,
    inboundDoFollow: links.filter((l) => l.isDoFollow).length,
  };
}

/**
 * Aggregate outbound metrics from link entries.
 */
export function aggregateOutboundMetrics(
  links: LinkGraphInsert[],
  totalOutbound: number
): Pick<
  PageLinksInsert,
  "outboundTotal" | "outboundBody" | "outboundInternal" | "outboundExternal"
> {
  const internal = links.length;
  return {
    outboundTotal: totalOutbound,
    outboundBody: links.filter((l) => l.position === "body").length,
    outboundInternal: internal,
    outboundExternal: totalOutbound - internal,
  };
}

/**
 * Parameters for computing page link metrics.
 */
export interface ComputePageMetricsParams {
  pageUrl: string;
  inboundLinks: LinkGraphInsert[];
  outboundLinks: LinkGraphInsert[];
  totalOutbound: number;
}

/**
 * Compute page link metrics including anchor distribution.
 */
export function computePageLinkMetrics(
  params: ComputePageMetricsParams
): Omit<PageLinksInsert, "id" | "clientId" | "auditId" | "pageId" | "pageUrl"> {
  const { inboundLinks, outboundLinks, totalOutbound } = params;

  const inbound = aggregateInboundMetrics(inboundLinks);
  const outbound = aggregateOutboundMetrics(outboundLinks, totalOutbound);

  // Compute anchor distribution
  const anchorCounts = new Map<string, number>();
  for (const link of inboundLinks) {
    const anchor = link.anchorText || "";
    anchorCounts.set(anchor, (anchorCounts.get(anchor) || 0) + 1);
  }

  const uniqueAnchors = anchorCounts.size;
  const total = inboundLinks.length || 1; // Avoid division by zero

  // Anchor distribution as percentages
  const anchorDistribution: Record<string, number> = {};
  for (const [anchor, count] of anchorCounts) {
    anchorDistribution[anchor] = Math.round((count / total) * 100);
  }

  // Top anchors (limited to 10)
  const topAnchors = Array.from(anchorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([anchor, count]) => ({ anchor, count }));

  return {
    ...inbound,
    ...outbound,
    uniqueAnchors,
    anchorDistribution,
    topAnchors,
    clickDepthFromHome: null, // Computed separately via BFS
    linkScore: null, // Computed separately
    opportunityScore: null, // Computed separately
  };
}

/**
 * Parameters for detecting orphan pages.
 */
export interface DetectOrphanPagesParams {
  clientId: string;
  auditId: string;
  allPages: PageData[];
  pagesWithInboundLinks: Set<string>;
  discoverySource: "sitemap" | "gsc" | "manual";
}

/**
 * Detect orphan pages (pages with zero inbound internal links).
 */
export function detectOrphanPages(
  params: DetectOrphanPagesParams
): OrphanPagesInsert[] {
  const { clientId, auditId, allPages, pagesWithInboundLinks, discoverySource } = params;

  const orphans: OrphanPagesInsert[] = [];

  for (const page of allPages) {
    // Skip if page has inbound links
    if (pagesWithInboundLinks.has(page.pageId)) {
      continue;
    }

    // Skip homepage (root URL) - it's expected to not have inbound links from the site
    try {
      const url = new URL(page.pageUrl);
      if (url.pathname === "/" || url.pathname === "") {
        continue;
      }
    } catch {
      // Invalid URL, include as potential orphan
    }

    orphans.push({
      id: nanoid(),
      clientId,
      auditId,
      pageId: page.pageId,
      pageUrl: page.pageUrl,
      pageTitle: page.pageTitle,
      discoverySource,
      searchVolume: null,
      monthlyTraffic: null,
      targetKeyword: null,
      status: "detected",
      fixedAt: null,
      fixedByChangeId: null,
    });
  }

  return orphans;
}
