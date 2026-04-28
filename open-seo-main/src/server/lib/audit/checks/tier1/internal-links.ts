/**
 * Tier 1 Internal Links Checks (T1-39 to T1-43)
 * Category G: Internal linking optimization
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function isInternalLink(href: string, pageUrl: string): boolean {
  try {
    const linkUrl = new URL(href, pageUrl);
    const baseUrl = new URL(pageUrl);
    return linkUrl.hostname === baseUrl.hostname;
  } catch {
    return href.startsWith("/") || href.startsWith("#");
  }
}

// T1-39: 3-10 internal links in body
registerCheck({
  id: "T1-39",
  name: "3-10 internal links in body",
  tier: 1,
  category: "internal-links",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add 3-10 internal links to relevant pages within main content",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    // Exclude nav, header, footer, sidebar
    const bodyContent = $("article, main, .content, [role='main']").length > 0
      ? $("article, main, .content, [role='main']")
      : $("body");
    const links = bodyContent.find("a[href]").not("nav a, header a, footer a, aside a").toArray();
    let internal = 0;
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      if (isInternalLink(href, ctx.url) && !href.startsWith("#")) internal++;
    }
    const passed = internal >= 3 && internal <= 10;
    return {
      checkId: "T1-39",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? `${internal} internal links (optimal 3-10)` : `${internal} internal links (optimal 3-10)`,
      details: { count: internal },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add 3-10 internal links to relevant pages within main content",
    };
  },
});

// T1-40: First link in first 2 paragraphs
registerCheck({
  id: "T1-40",
  name: "Internal link in first 2 paragraphs",
  tier: 1,
  category: "internal-links",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add an internal link in the first or second paragraph",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const firstTwoP = $("p").slice(0, 2);
    let hasLink = false;
    firstTwoP.find("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (isInternalLink(href, ctx.url)) hasLink = true;
    });
    return {
      checkId: "T1-40",
      passed: hasLink,
      severity: hasLink ? "info" : "medium",
      message: hasLink ? "Internal link found in first 2 paragraphs" : "No internal link in first 2 paragraphs",
      autoEditable: !hasLink,
      editRecipe: hasLink ? undefined : "Add an internal link in the first or second paragraph",
    };
  },
});

// T1-41: No duplicate anchors to same URL
registerCheck({
  id: "T1-41",
  name: "No duplicate anchor text to same URL",
  tier: 1,
  category: "internal-links",
  severity: "low",
  autoEditable: true,
  editRecipe: "Vary anchor text for links pointing to the same URL",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const links = $("a[href]").toArray();
    const urlAnchors = new Map<string, Set<string>>();
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      const anchor = $(link).text().trim().toLowerCase();
      if (!href || !anchor) continue;
      const existing = urlAnchors.get(href) ?? new Set();
      existing.add(anchor);
      urlAnchors.set(href, existing);
    }
    // Find URLs with duplicate same anchor
    let duplicates = 0;
    for (const [, anchors] of urlAnchors) {
      // If there are links but all have same anchor, it's not varied
      // We want to detect if same anchor used multiple times for same URL
    }
    // Simpler: count links where same URL + same anchor appears multiple times
    const seen = new Map<string, number>();
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      const anchor = $(link).text().trim().toLowerCase();
      const key = `${href}::${anchor}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const count of seen.values()) {
      if (count > 1) duplicates++;
    }
    const passed = duplicates === 0;
    return {
      checkId: "T1-41",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "No duplicate anchors to same URL" : `${duplicates} duplicate anchor(s) found`,
      details: { duplicates },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Vary anchor text for links pointing to the same URL",
    };
  },
});

// T1-42: At least one exact-match anchor
registerCheck({
  id: "T1-42",
  name: "Exact-match anchor text exists",
  tier: 1,
  category: "internal-links",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add at least one internal link with keyword as anchor text",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword, url } = ctx;
    if (!keyword) {
      return { checkId: "T1-42", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const links = $("a[href]").toArray();
    let exactMatch = false;
    const regex = keywordRegex(keyword);
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      if (!isInternalLink(href, url)) continue;
      const anchor = $(link).text().trim();
      if (regex.test(anchor)) { exactMatch = true; break; }
    }
    return {
      checkId: "T1-42",
      passed: exactMatch,
      severity: exactMatch ? "info" : "medium",
      message: exactMatch ? "Exact-match anchor text found" : "No exact-match keyword anchor found",
      autoEditable: !exactMatch,
      editRecipe: exactMatch ? undefined : "Add at least one internal link with keyword as anchor text",
    };
  },
});

// T1-43: No empty anchor links
registerCheck({
  id: "T1-43",
  name: "No empty anchor links",
  tier: 1,
  category: "internal-links",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add descriptive text to empty anchor links",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    // Empty = no text and no img child
    const emptyLinks = $("a[href]").filter((_, el) => {
      const text = $(el).text().trim();
      const hasImg = $(el).find("img").length > 0;
      const hasAriaLabel = $(el).attr("aria-label");
      return !text && !hasImg && !hasAriaLabel;
    }).length;
    const passed = emptyLinks === 0;
    return {
      checkId: "T1-43",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "No empty anchor links" : `${emptyLinks} empty anchor link(s) found`,
      details: { emptyLinks },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add descriptive text to empty anchor links",
    };
  },
});
