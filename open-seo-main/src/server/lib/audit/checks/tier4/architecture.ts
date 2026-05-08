/**
 * Tier 4 Site Architecture Checks (T4-01 to T4-05)
 * Phase 32: 107 SEO Checks Implementation
 * Phase 40: Analytics integration for topic cluster checks
 *
 * These checks require site-wide crawl data (SiteContext).
 * T4-03, T4-04, T4-05 now consume P96 analytics data via AnalyticsAuditBridge.
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, SiteContext } from "../types";
import { getAnalyticsAuditBridge } from "@/server/features/analytics/bridge";

/**
 * Check if SiteContext has required crawl data.
 */
function hasCrawlData(siteContext?: SiteContext): siteContext is SiteContext {
  return !!siteContext && siteContext.totalPages > 0;
}

/**
 * T4-01: Click depth <= 3
 * All important pages should be reachable within 3 clicks from homepage.
 */
registerCheck({
  id: "T4-01",
  name: "Click depth <= 3",
  tier: 4,
  category: "architecture",
  severity: "medium",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-01",
        passed: false,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required" },
        autoEditable: false,
      };
    }

    const { clickDepths } = ctx.siteContext;

    if (!clickDepths || clickDepths.size === 0) {
      return {
        checkId: "T4-01",
        passed: true,
        severity: "info",
        message: "Click depth data not computed in crawl",
        details: { skipped: true, reason: "clickDepths not in SiteContext" },
        autoEditable: false,
      };
    }

    // Check current page's click depth
    const pageDepth = clickDepths.get(ctx.url);

    if (pageDepth === undefined) {
      return {
        checkId: "T4-01",
        passed: true,
        severity: "info",
        message: "Page not found in click depth map",
        details: { skipped: true, url: ctx.url },
        autoEditable: false,
      };
    }

    const passed = pageDepth <= 3;

    return {
      checkId: "T4-01",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `Page is ${pageDepth} clicks from homepage (target: <= 3)`
        : `Page is ${pageDepth} clicks from homepage, exceeds 3 click maximum`,
      details: {
        clickDepth: pageDepth,
        threshold: 3,
        url: ctx.url,
      },
      autoEditable: false,
    };
  },
});

/**
 * T4-02: No orphan pages
 * Every page should have at least one internal link pointing to it.
 */
registerCheck({
  id: "T4-02",
  name: "No orphan pages",
  tier: 4,
  category: "architecture",
  severity: "high",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-02",
        passed: false,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required" },
        autoEditable: false,
      };
    }

    const { linkGraph } = ctx.siteContext;

    if (!linkGraph || linkGraph.size === 0) {
      return {
        checkId: "T4-02",
        passed: true,
        severity: "info",
        message: "Link graph not computed in crawl",
        details: { skipped: true, reason: "linkGraph not in SiteContext" },
        autoEditable: false,
      };
    }

    // Count inbound links to current page
    let inboundCount = 0;
    linkGraph.forEach((outbound) => {
      if (outbound.includes(ctx.url)) {
        inboundCount++;
      }
    });

    const passed = inboundCount > 0;

    return {
      checkId: "T4-02",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? `Page has ${inboundCount} internal links pointing to it`
        : "Page is orphaned (no internal links point to it)",
      details: {
        inboundLinkCount: inboundCount,
        url: ctx.url,
        isOrphan: !passed,
      },
      autoEditable: false,
    };
  },
});

/**
 * T4-03: Pillar links to all spokes
 * Hub pages should link to all related spoke/cluster pages.
 *
 * FIX-13 (CRIT-SEO-01): Changed to passed=true when skipped to avoid
 * negatively impacting score. Skipped checks should be N/A, not failures.
 *
 * Phase 40: Now uses AnalyticsAuditBridge to get topic cluster data from P96.
 */
registerCheck({
  id: "T4-03",
  name: "Pillar links to all spokes",
  tier: 4,
  category: "architecture",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add links from pillar page to all spoke pages in the topic cluster",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-03",
        passed: true, // FIX-13: N/A should not penalize score
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required", status: "not-applicable" },
        autoEditable: false,
      };
    }

    // Extract siteId from URL (domain-based lookup)
    const siteId = extractSiteId(ctx.url);
    if (!siteId) {
      return {
        checkId: "T4-03",
        passed: true,
        severity: "info",
        message: "Skipped: Could not determine site ID from URL",
        details: { skipped: true, reason: "Site ID extraction failed", url: ctx.url },
        autoEditable: false,
      };
    }

    try {
      const bridge = getAnalyticsAuditBridge();
      const hubSpokeData = await bridge.getHubSpokeLinkingData(siteId, ctx.url);

      // If page is not a hub, this check doesn't apply
      if (!hubSpokeData.isHub) {
        return {
          checkId: "T4-03",
          passed: true,
          severity: "info",
          message: "Not applicable: Page is not a hub/pillar page",
          details: {
            skipped: true,
            status: "not-applicable",
            isHub: false,
            isSpoke: hubSpokeData.isSpoke,
            clusterName: hubSpokeData.clusterName,
          },
          autoEditable: false,
        };
      }

      // Hub page: check if it links to all spokes
      const linkedSpokes = hubSpokeData.linkedSpokes ?? [];
      const missingSpokes = hubSpokeData.missingSpokes ?? [];
      const totalSpokes = linkedSpokes.length + missingSpokes.length;

      if (totalSpokes === 0) {
        return {
          checkId: "T4-03",
          passed: true,
          severity: "info",
          message: "Hub page has no spoke pages defined",
          details: {
            clusterId: hubSpokeData.clusterId,
            clusterName: hubSpokeData.clusterName,
            spokeCount: 0,
          },
          autoEditable: false,
        };
      }

      const passed = missingSpokes.length === 0;
      const linkingScore = hubSpokeData.linkingScore;

      return {
        checkId: "T4-03",
        passed,
        severity: passed ? "info" : "medium",
        message: passed
          ? `Hub page links to all ${totalSpokes} spoke pages in the cluster`
          : `Hub page is missing links to ${missingSpokes.length} of ${totalSpokes} spoke pages`,
        details: {
          clusterId: hubSpokeData.clusterId,
          clusterName: hubSpokeData.clusterName,
          linkedSpokes: linkedSpokes.length,
          missingSpokes: missingSpokes.slice(0, 10), // Limit for readability
          totalSpokes,
          linkingScore,
          recommendation: passed
            ? undefined
            : "Add internal links from this pillar page to all spoke pages in the cluster",
        },
        autoEditable: !passed,
        editRecipe: passed
          ? undefined
          : `Add links to: ${missingSpokes.slice(0, 5).join(", ")}${missingSpokes.length > 5 ? ` and ${missingSpokes.length - 5} more` : ""}`,
      };
    } catch (error) {
      // Graceful fallback if analytics service is unavailable
      return {
        checkId: "T4-03",
        passed: true,
        severity: "info",
        message: "Skipped: Topic cluster data unavailable",
        details: {
          skipped: true,
          reason: "Analytics service error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        autoEditable: false,
      };
    }
  },
});

/**
 * T4-04: Spokes link back to pillar
 * Spoke pages should link back to their pillar/hub page.
 *
 * FIX-13 (CRIT-SEO-01): Changed to passed=true when skipped to avoid
 * negatively impacting score. Skipped checks should be N/A, not failures.
 *
 * Phase 40: Now uses AnalyticsAuditBridge to get topic cluster data from P96.
 */
registerCheck({
  id: "T4-04",
  name: "Spokes link back to pillar",
  tier: 4,
  category: "architecture",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add link from spoke page back to pillar page",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-04",
        passed: true, // FIX-13: N/A should not penalize score
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required", status: "not-applicable" },
        autoEditable: false,
      };
    }

    // Extract siteId from URL (domain-based lookup)
    const siteId = extractSiteId(ctx.url);
    if (!siteId) {
      return {
        checkId: "T4-04",
        passed: true,
        severity: "info",
        message: "Skipped: Could not determine site ID from URL",
        details: { skipped: true, reason: "Site ID extraction failed", url: ctx.url },
        autoEditable: false,
      };
    }

    try {
      const bridge = getAnalyticsAuditBridge();
      const hubSpokeData = await bridge.getHubSpokeLinkingData(siteId, ctx.url);

      // If page is not a spoke, this check doesn't apply
      if (!hubSpokeData.isSpoke) {
        return {
          checkId: "T4-04",
          passed: true,
          severity: "info",
          message: "Not applicable: Page is not a spoke page in any cluster",
          details: {
            skipped: true,
            status: "not-applicable",
            isHub: hubSpokeData.isHub,
            isSpoke: false,
          },
          autoEditable: false,
        };
      }

      // Spoke page: check if it links back to hub
      const linksToHub = hubSpokeData.linksToHub ?? false;
      const hubPageUrl = hubSpokeData.hubPageUrl;

      return {
        checkId: "T4-04",
        passed: linksToHub,
        severity: linksToHub ? "info" : "medium",
        message: linksToHub
          ? `Spoke page correctly links back to hub page`
          : `Spoke page does not link back to its hub/pillar page`,
        details: {
          clusterId: hubSpokeData.clusterId,
          clusterName: hubSpokeData.clusterName,
          hubPageUrl,
          linksToHub,
          linkingScore: hubSpokeData.linkingScore,
          recommendation: linksToHub
            ? undefined
            : `Add an internal link from this page to the hub page at ${hubPageUrl}`,
        },
        autoEditable: !linksToHub,
        editRecipe: linksToHub
          ? undefined
          : `Add internal link to pillar page: ${hubPageUrl}`,
      };
    } catch (error) {
      // Graceful fallback if analytics service is unavailable
      return {
        checkId: "T4-04",
        passed: true,
        severity: "info",
        message: "Skipped: Topic cluster data unavailable",
        details: {
          skipped: true,
          reason: "Analytics service error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        autoEditable: false,
      };
    }
  },
});

/**
 * T4-05: 15-25 spokes per cluster
 * Topic clusters should have appropriate depth.
 *
 * FIX-13 (CRIT-SEO-01): Changed to passed=true when skipped to avoid
 * negatively impacting score. Skipped checks should be N/A, not failures.
 *
 * Phase 40: Now uses AnalyticsAuditBridge to get topic cluster data from P96.
 */
registerCheck({
  id: "T4-05",
  name: "15-25 spokes per cluster",
  tier: 4,
  category: "architecture",
  severity: "low",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-05",
        passed: true, // FIX-13: N/A should not penalize score
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required", status: "not-applicable" },
        autoEditable: false,
      };
    }

    // Extract siteId from URL (domain-based lookup)
    const siteId = extractSiteId(ctx.url);
    if (!siteId) {
      return {
        checkId: "T4-05",
        passed: true,
        severity: "info",
        message: "Skipped: Could not determine site ID from URL",
        details: { skipped: true, reason: "Site ID extraction failed", url: ctx.url },
        autoEditable: false,
      };
    }

    try {
      const bridge = getAnalyticsAuditBridge();
      const clusterSizeData = await bridge.getClusterSizeData(siteId, ctx.url);

      // If page is not part of any cluster, this check doesn't apply
      if (!clusterSizeData) {
        return {
          checkId: "T4-05",
          passed: true,
          severity: "info",
          message: "Not applicable: Page is not part of any topic cluster",
          details: {
            skipped: true,
            status: "not-applicable",
            targetRange: "15-25 spokes per cluster",
          },
          autoEditable: false,
        };
      }

      const { spokeCount, targetMin, targetMax, withinRange, suggestion, sizeScore } = clusterSizeData;

      let message: string;
      let severity: "info" | "low" = "info";

      if (withinRange) {
        message = `Cluster "${clusterSizeData.clusterName}" has ${spokeCount} spokes (optimal: ${targetMin}-${targetMax})`;
      } else if (spokeCount < targetMin) {
        message = `Cluster "${clusterSizeData.clusterName}" has only ${spokeCount} spokes (target: ${targetMin}-${targetMax})`;
        severity = "low";
      } else {
        message = `Cluster "${clusterSizeData.clusterName}" has ${spokeCount} spokes, exceeding target of ${targetMax}`;
        severity = "low";
      }

      return {
        checkId: "T4-05",
        passed: withinRange,
        severity,
        message,
        details: {
          clusterId: clusterSizeData.clusterId,
          clusterName: clusterSizeData.clusterName,
          spokeCount,
          targetMin,
          targetMax,
          withinRange,
          suggestion,
          sizeScore,
          recommendation: suggestion === "add_content"
            ? `Add ${targetMin - spokeCount} more spoke pages to reach optimal cluster depth`
            : suggestion === "consider_splitting"
            ? "Consider splitting this cluster into sub-topics for better organization"
            : undefined,
        },
        autoEditable: false,
      };
    } catch (error) {
      // Graceful fallback if analytics service is unavailable
      return {
        checkId: "T4-05",
        passed: true,
        severity: "info",
        message: "Skipped: Topic cluster data unavailable",
        details: {
          skipped: true,
          reason: "Analytics service error",
          error: error instanceof Error ? error.message : "Unknown error",
          targetRange: "15-25 spokes per cluster",
        },
        autoEditable: false,
      };
    }
  },
});

/**
 * Extract site ID from URL for analytics lookups.
 * Returns the domain as the site identifier.
 */
function extractSiteId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Use the full origin as site ID (includes protocol and port)
    return parsed.origin;
  } catch {
    return null;
  }
}

export const architectureCheckIds = ["T4-01", "T4-02", "T4-03", "T4-04", "T4-05"];
