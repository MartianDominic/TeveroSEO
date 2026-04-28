/**
 * Tier 1 External Links Checks (T1-44 to T1-47)
 * Category H: External linking best practices
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import type { CheerioAPI } from "cheerio";

function isExternalLink(href: string, pageUrl: string): boolean {
  try {
    const linkUrl = new URL(href, pageUrl);
    const baseUrl = new URL(pageUrl);
    return linkUrl.hostname !== baseUrl.hostname && linkUrl.protocol.startsWith("http");
  } catch {
    return false;
  }
}

function getWordCount($: CheerioAPI): number {
  const body = $("body").clone();
  body.find("script, style, nav, header, footer").remove();
  const text = body.text().replace(/\s+/g, " ").trim();
  return text.split(/\s+/).filter(Boolean).length;
}

// T1-44: 2-5 outbound links per 1500 words
registerCheck({
  id: "T1-44",
  name: "Outbound links per 1500 words",
  tier: 1,
  category: "external-links",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const wordCount = getWordCount($);
    const links = $("a[href]").toArray();
    let external = 0;
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      if (isExternalLink(href, ctx.url)) external++;
    }
    // Calculate expected: 2-5 per 1500 words
    const ratio = wordCount / 1500;
    const minExpected = Math.max(2, Math.floor(ratio * 2));
    const maxExpected = Math.max(5, Math.ceil(ratio * 5));
    const passed = external >= 2 && external <= Math.max(5, maxExpected);
    return {
      checkId: "T1-44",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `${external} outbound links (good for ${wordCount} words)` : `${external} outbound links for ${wordCount} words (aim for 2-5 per 1500 words)`,
      details: { external, wordCount },
      autoEditable: false,
    };
  },
});

// T1-45: No nofollow on citations
registerCheck({
  id: "T1-45",
  name: "Citations not nofollowed",
  tier: 1,
  category: "external-links",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Remove nofollow from citation links to authoritative sources",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const links = $("a[href][rel*='nofollow']").toArray();
    let nofollowedCitations = 0;
    // Check if external link with nofollow goes to likely citation domain
    const citationDomains = ["wikipedia.org", "gov", "edu", "pubmed", "ncbi.nlm.nih", "nature.com", "sciencedirect", "springer", "wiley"];
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      if (isExternalLink(href, ctx.url)) {
        const lower = href.toLowerCase();
        if (citationDomains.some(d => lower.includes(d))) nofollowedCitations++;
      }
    }
    const passed = nofollowedCitations === 0;
    return {
      checkId: "T1-45",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "No citations are nofollowed" : `${nofollowedCitations} citation link(s) have nofollow`,
      details: { nofollowedCitations },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Remove nofollow from citation links to authoritative sources",
    };
  },
});

// T1-46: target="_blank" on external
registerCheck({
  id: "T1-46",
  name: "External links open in new tab",
  tier: 1,
  category: "external-links",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add target=\"_blank\" to external links",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const links = $("a[href]").toArray();
    let missing = 0;
    let total = 0;
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      if (isExternalLink(href, ctx.url)) {
        total++;
        if ($(link).attr("target") !== "_blank") missing++;
      }
    }
    const passed = missing === 0;
    return {
      checkId: "T1-46",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `All ${total} external links open in new tab` : `${missing}/${total} external links missing target="_blank"`,
      details: { total, missing },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add target=\"_blank\" to external links",
    };
  },
});

// T1-47: rel="noopener" on external
registerCheck({
  id: "T1-47",
  name: "External links have noopener",
  tier: 1,
  category: "external-links",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add rel=\"noopener\" to external links for security",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const links = $("a[href][target='_blank']").toArray();
    let missing = 0;
    let total = 0;
    for (const link of links) {
      const href = $(link).attr("href") ?? "";
      if (isExternalLink(href, ctx.url)) {
        total++;
        const rel = $(link).attr("rel") ?? "";
        if (!rel.includes("noopener")) missing++;
      }
    }
    const passed = missing === 0;
    return {
      checkId: "T1-47",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "All external _blank links have noopener" : `${missing}/${total} external links missing rel="noopener"`,
      details: { total, missing },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add rel=\"noopener\" to external links for security",
    };
  },
});
