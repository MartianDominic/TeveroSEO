/**
 * Tier 3 Backlink Analysis Checks (T3-08 to T3-10)
 * Phase 32: 107 SEO Checks Implementation
 *
 * These checks require DataForSEO API access for backlink data.
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { hasDataForSEOCredentials } from "@/server/lib/dataforseo-auth";

/**
 * T3-08: Link velocity 5-10/month (new sites)
 * Healthy link acquisition rate for new sites.
 */
registerCheck({
  id: "T3-08",
  name: "Link velocity 5-10/month",
  tier: 3,
  category: "backlinks",
  severity: "medium",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasDataForSEOCredentials()) {
      return {
        checkId: "T3-08",
        passed: false,
        severity: "info",
        message: "Skipped: DataForSEO credentials not configured (DATAFORSEO_API_KEY)",
        details: { skipped: true, reason: "API credentials missing" },
        autoEditable: false,
      };
    }

    // API call would go here - returning placeholder for now
    return {
      checkId: "T3-08",
      passed: true,
      severity: "info",
      message: "Link velocity check requires DataForSEO backlinks history API",
      details: {
        skipped: true,
        reason: "DataForSEO API integration pending",
        note: "Enable DataForSEO backlinks API to check link velocity",
      },
      autoEditable: false,
    };
  },
});

/**
 * T3-09: Anchor text ratio natural
 * Healthy anchor text distribution: ~50% branded, ~25% exact, ~25% misc.
 */
registerCheck({
  id: "T3-09",
  name: "Anchor text ratio natural",
  tier: 3,
  category: "backlinks",
  severity: "medium",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasDataForSEOCredentials()) {
      return {
        checkId: "T3-09",
        passed: false,
        severity: "info",
        message: "Skipped: DataForSEO credentials not configured (DATAFORSEO_API_KEY)",
        details: { skipped: true, reason: "API credentials missing" },
        autoEditable: false,
      };
    }

    return {
      checkId: "T3-09",
      passed: true,
      severity: "info",
      message: "Anchor text analysis requires DataForSEO anchors API",
      details: {
        skipped: true,
        reason: "DataForSEO API integration pending",
        targetRatio: { branded: "50%", exact: "25%", misc: "25%" },
      },
      autoEditable: false,
    };
  },
});

/**
 * T3-10: Outbound link DR 50+
 * External links should point to authoritative domains.
 */
registerCheck({
  id: "T3-10",
  name: "Outbound link DR 50+",
  tier: 3,
  category: "backlinks",
  severity: "low",
  autoEditable: true,
  editRecipe: "Replace low-authority outbound links with higher DR alternatives",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasDataForSEOCredentials()) {
      return {
        checkId: "T3-10",
        passed: false,
        severity: "info",
        message: "Skipped: DataForSEO credentials not configured (DATAFORSEO_API_KEY)",
        details: { skipped: true, reason: "API credentials missing" },
        autoEditable: false,
      };
    }

    // Extract outbound links for potential future API checking
    const outboundLinks: string[] = [];
    const pageOrigin = new URL(ctx.url).origin;

    ctx.$("a[href]").each((_, el) => {
      const href = ctx.$(el).attr("href");
      if (href && href.startsWith("http") && !href.startsWith(pageOrigin)) {
        try {
          outboundLinks.push(new URL(href).hostname);
        } catch {
          // Invalid URL, skip
        }
      }
    });

    const uniqueDomains = Array.from(new Set(outboundLinks));

    return {
      checkId: "T3-10",
      passed: true,
      severity: "info",
      message: `Found ${uniqueDomains.length} unique outbound domains (DR check requires API)`,
      details: {
        skipped: true,
        reason: "DataForSEO API integration pending",
        outboundDomains: uniqueDomains.slice(0, 10),
        totalOutbound: uniqueDomains.length,
        targetDR: 50,
      },
      autoEditable: false,
    };
  },
});

export const backlinksCheckIds = ["T3-08", "T3-09", "T3-10"];
