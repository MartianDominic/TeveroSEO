/**
 * Tier 2 Anchor Text Analysis (T2-06 to T2-08)
 * Phase 32: 107 SEO Checks Implementation
 *
 * Analyzes internal link anchor text patterns.
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/**
 * Extract internal links from the page.
 */
function extractInternalLinks(
  $: CheckContext["$"],
  pageUrl: string
): Array<{ href: string; anchor: string; position: number }> {
  const links: Array<{ href: string; anchor: string; position: number }> = [];

  // Parse page URL for comparison
  let pageHost: string;
  try {
    pageHost = new URL(pageUrl).hostname;
  } catch {
    pageHost = "";
  }

  // Get body content for position calculation
  const bodyText = $("body").text();
  const bodyLength = bodyText.length;

  $("a[href]").each((index, el) => {
    const href = $(el).attr("href") ?? "";
    const anchor = $(el).text().trim();

    // Skip empty anchors or non-links
    if (!anchor || !href) return;

    // Determine if internal link
    let isInternal = false;
    try {
      if (href.startsWith("/") || href.startsWith("#")) {
        isInternal = true;
      } else if (href.startsWith("http")) {
        const linkHost = new URL(href).hostname;
        isInternal = linkHost === pageHost;
      }
    } catch {
      // Invalid URL, skip
      return;
    }

    if (!isInternal) return;

    // Calculate position as percentage of document
    const textBefore = bodyText.indexOf(anchor);
    const position = textBefore > 0 && bodyLength > 0 ? (textBefore / bodyLength) * 100 : 50;

    links.push({ href, anchor, position });
  });

  return links;
}

/**
 * Categorize anchor text type.
 */
function categorizeAnchor(
  anchor: string,
  keyword?: string,
  brandName?: string
): "exact" | "branded" | "misc" {
  const anchorLower = anchor.toLowerCase();

  // Check for exact match (keyword in anchor)
  if (keyword) {
    const keywordLower = keyword.toLowerCase();
    if (anchorLower.includes(keywordLower)) {
      return "exact";
    }
  }

  // Check for branded (brand name in anchor)
  if (brandName) {
    const brandLower = brandName.toLowerCase();
    if (anchorLower.includes(brandLower)) {
      return "branded";
    }
  }

  // Default to misc
  return "misc";
}

/**
 * T2-06: >=10 unique anchor variations
 * Diversity signal for internal linking.
 */
registerCheck({
  id: "T2-06",
  name: ">=10 unique anchor variations",
  tier: 2,
  category: "anchor-analysis",
  severity: "low",
  autoEditable: true,
  editRecipe: "Vary anchor text: use different phrases, partial matches, and natural variations",
  run: (ctx: CheckContext): CheckResult => {
    const links = extractInternalLinks(ctx.$, ctx.url);

    // Skip if no internal links
    if (links.length === 0) {
      return {
        checkId: "T2-06",
        passed: true,
        severity: "info",
        message: "No internal links found for anchor analysis",
        details: { linkCount: 0, skipped: true },
        autoEditable: false,
      };
    }

    // Count unique anchor texts
    const uniqueAnchors = new Set(links.map((l) => l.anchor.toLowerCase()));
    const uniqueCount = uniqueAnchors.size;
    const passed = uniqueCount >= 10;

    return {
      checkId: "T2-06",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `Found ${uniqueCount} unique anchor variations (target: >= 10)`
        : `Only ${uniqueCount} unique anchor variations, should have 10+ for diversity`,
      details: {
        totalLinks: links.length,
        uniqueAnchors: uniqueCount,
        target: 10,
        examples: Array.from(uniqueAnchors).slice(0, 5),
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : `Add ${10 - uniqueCount} more unique anchor text variations`,
    };
  },
});

/**
 * T2-07: 50% exact / 25% branded / 25% misc ratio
 * Natural anchor text distribution.
 */
registerCheck({
  id: "T2-07",
  name: "50% exact / 25% branded / 25% misc ratio",
  tier: 2,
  category: "anchor-analysis",
  severity: "low",
  autoEditable: true,
  editRecipe: "Adjust anchor text ratio: aim for 50% keyword-rich, 25% branded, 25% generic",
  run: (ctx: CheckContext): CheckResult => {
    const links = extractInternalLinks(ctx.$, ctx.url);

    // Skip if too few links
    if (links.length < 4) {
      return {
        checkId: "T2-07",
        passed: true,
        severity: "info",
        message: "Too few internal links for ratio analysis (need 4+)",
        details: { linkCount: links.length, skipped: true },
        autoEditable: false,
      };
    }

    // Get brand name from schema or page analysis
    const $ = ctx.$;
    let brandName: string | undefined;

    // Try to extract from Organization schema
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const schema = JSON.parse($(el).text());
        if (schema["@type"] === "Organization" && schema.name) {
          brandName = schema.name;
        } else if (schema.publisher?.name) {
          brandName = schema.publisher.name;
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    // Categorize each anchor
    const categories = links.map((l) => categorizeAnchor(l.anchor, ctx.keyword, brandName));

    const exactCount = categories.filter((c) => c === "exact").length;
    const brandedCount = categories.filter((c) => c === "branded").length;
    const miscCount = categories.filter((c) => c === "misc").length;
    const total = categories.length;

    const exactPercent = (exactCount / total) * 100;
    const brandedPercent = (brandedCount / total) * 100;
    const miscPercent = (miscCount / total) * 100;

    // Ideal: 50% exact, 25% branded, 25% misc (with 15% tolerance)
    const exactOk = exactPercent >= 35 && exactPercent <= 65;
    const brandedOk = brandedPercent >= 10 && brandedPercent <= 40;
    const miscOk = miscPercent >= 10 && miscPercent <= 40;

    const passed = exactOk && brandedOk && miscOk;

    return {
      checkId: "T2-07",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `Anchor ratio is balanced: ${exactPercent.toFixed(0)}% exact, ${brandedPercent.toFixed(0)}% branded, ${miscPercent.toFixed(0)}% misc`
        : `Anchor ratio imbalanced: ${exactPercent.toFixed(0)}% exact, ${brandedPercent.toFixed(0)}% branded, ${miscPercent.toFixed(0)}% misc (target: ~50/25/25)`,
      details: {
        totalLinks: total,
        exact: { count: exactCount, percent: Math.round(exactPercent) },
        branded: { count: brandedCount, percent: Math.round(brandedPercent) },
        misc: { count: miscCount, percent: Math.round(miscPercent) },
        targetRatio: "50% exact / 25% branded / 25% misc",
        brandNameUsed: brandName ?? null,
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : "Rebalance anchor text: adjust keyword-rich, branded, and generic anchor proportions",
    };
  },
});

/**
 * T2-08: Links evenly distributed
 * Flag if >50% of links are in one quartile of the page.
 */
registerCheck({
  id: "T2-08",
  name: "Links evenly distributed",
  tier: 2,
  category: "anchor-analysis",
  severity: "low",
  autoEditable: true,
  editRecipe: "Redistribute internal links throughout the content, not just in one section",
  run: (ctx: CheckContext): CheckResult => {
    const links = extractInternalLinks(ctx.$, ctx.url);

    // Skip if too few links
    if (links.length < 4) {
      return {
        checkId: "T2-08",
        passed: true,
        severity: "info",
        message: "Too few internal links for distribution analysis (need 4+)",
        details: { linkCount: links.length, skipped: true },
        autoEditable: false,
      };
    }

    // Group links by quartile (0-25%, 25-50%, 50-75%, 75-100%)
    const quartiles = [0, 0, 0, 0];
    for (const link of links) {
      const quartileIndex = Math.min(3, Math.floor(link.position / 25));
      quartiles[quartileIndex]++;
    }

    const total = links.length;
    const quartilePercents = quartiles.map((count) => (count / total) * 100);

    // Check if any quartile has >50% of links
    const maxPercent = Math.max(...quartilePercents);
    const maxQuartileIndex = quartilePercents.indexOf(maxPercent);
    const quartileLabels = ["first (0-25%)", "second (25-50%)", "third (50-75%)", "fourth (75-100%)"];

    const passed = maxPercent <= 50;

    return {
      checkId: "T2-08",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `Links are evenly distributed across page (max ${maxPercent.toFixed(0)}% in any quartile)`
        : `${maxPercent.toFixed(0)}% of links are bunched in the ${quartileLabels[maxQuartileIndex]} quartile (should be <= 50%)`,
      details: {
        totalLinks: total,
        quartiles: {
          "0-25%": { count: quartiles[0], percent: Math.round(quartilePercents[0]) },
          "25-50%": { count: quartiles[1], percent: Math.round(quartilePercents[1]) },
          "50-75%": { count: quartiles[2], percent: Math.round(quartilePercents[2]) },
          "75-100%": { count: quartiles[3], percent: Math.round(quartilePercents[3]) },
        },
        maxQuartilePercent: Math.round(maxPercent),
        threshold: 50,
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : `Move some links from the ${quartileLabels[maxQuartileIndex]} quartile to other sections`,
    };
  },
});

// Export check IDs for documentation
export const anchorAnalysisCheckIds = ["T2-06", "T2-07", "T2-08"];
