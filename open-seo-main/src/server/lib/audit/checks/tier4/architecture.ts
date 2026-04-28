/**
 * Tier 4 Site Architecture Checks (T4-01 to T4-05)
 * Phase 32: 107 SEO Checks Implementation
 *
 * These checks require site-wide crawl data (SiteContext).
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, SiteContext } from "../types";

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
        passed: false,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required" },
        autoEditable: false,
      };
    }

    // This check requires topic cluster mapping which isn't in basic SiteContext
    return {
      checkId: "T4-03",
      passed: true,
      severity: "info",
      message: "Pillar-spoke analysis requires topic cluster mapping",
      details: {
        skipped: true,
        reason: "Topic cluster data required",
        note: "Define topic clusters to enable hub-spoke validation",
      },
      autoEditable: false,
    };
  },
});

/**
 * T4-04: Spokes link back to pillar
 * Spoke pages should link back to their pillar/hub page.
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
        passed: false,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required" },
        autoEditable: false,
      };
    }

    return {
      checkId: "T4-04",
      passed: true,
      severity: "info",
      message: "Spoke-to-pillar analysis requires topic cluster mapping",
      details: {
        skipped: true,
        reason: "Topic cluster data required",
        note: "Define topic clusters to enable spoke validation",
      },
      autoEditable: false,
    };
  },
});

/**
 * T4-05: 15-25 spokes per cluster
 * Topic clusters should have appropriate depth.
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
        passed: false,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required" },
        autoEditable: false,
      };
    }

    return {
      checkId: "T4-05",
      passed: true,
      severity: "info",
      message: "Cluster size analysis requires topic cluster mapping",
      details: {
        skipped: true,
        reason: "Topic cluster data required",
        targetRange: "15-25 spokes per cluster",
      },
      autoEditable: false,
    };
  },
});

export const architectureCheckIds = ["T4-01", "T4-02", "T4-03", "T4-04", "T4-05"];
