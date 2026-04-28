/**
 * Tier 1 Content Structure Checks (T1-26 to T1-32)
 * Category E: Content organization and keyword placement
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import type { CheerioAPI } from "cheerio";

function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "gi");
}

function getBodyText($: CheerioAPI): string {
  // Remove script, style, nav, header, footer for body text
  const body = $("body").clone();
  body.find("script, style, nav, header, footer, aside").remove();
  return body.text().replace(/\s+/g, " ").trim();
}

function getWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

// T1-26: Keyword in first 100 words
registerCheck({
  id: "T1-26",
  name: "Keyword in first 100 words",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add keyword to the first 100 words of content",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-26", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const text = getBodyText($);
    const first100 = getWords(text).slice(0, 100).join(" ");
    const passed = keywordRegex(keyword).test(first100);
    return {
      checkId: "T1-26",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? "Keyword found in first 100 words" : "Keyword missing from first 100 words",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword to the first 100 words of content",
    };
  },
});

// T1-27: Keyword 2x in first 100 words
registerCheck({
  id: "T1-27",
  name: "Keyword 2x in first 100 words",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add keyword at least twice in the first 100 words",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-27", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const text = getBodyText($);
    const first100 = getWords(text).slice(0, 100).join(" ");
    const matches = first100.match(keywordRegex(keyword)) ?? [];
    const passed = matches.length >= 2;
    return {
      checkId: "T1-27",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? `Keyword appears ${matches.length}x in first 100 words` : `Keyword appears ${matches.length}x in first 100 words (need 2+)`,
      details: { count: matches.length },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword at least twice in the first 100 words",
    };
  },
});

// T1-28: Short intro 5-8 sentences before first H2
registerCheck({
  id: "T1-28",
  name: "Short intro before first H2",
  tier: 1,
  category: "content-structure",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const firstH2 = $("h2").first();
    if (firstH2.length === 0) {
      return { checkId: "T1-28", passed: true, severity: "info", message: "No H2 found", autoEditable: false };
    }
    // Get text before first H2
    let introText = "";
    const h1 = $("h1").first();
    if (h1.length > 0) {
      h1.nextUntil("h2").each((_, el) => { introText += $(el).text() + " "; });
    }
    // Count sentences (rough: split by . ! ?)
    const sentences = introText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const count = sentences.length;
    const passed = count >= 5 && count <= 8;
    return {
      checkId: "T1-28",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `Intro has ${count} sentences (optimal)` : `Intro has ${count} sentences (optimal 5-8)`,
      details: { sentenceCount: count },
      autoEditable: false,
    };
  },
});

// T1-29: 1-2 sentence paragraphs
registerCheck({
  id: "T1-29",
  name: "Short paragraphs (1-2 sentences)",
  tier: 1,
  category: "content-structure",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const paragraphs = $("article p, main p, .content p, body p").toArray();
    if (paragraphs.length === 0) {
      return { checkId: "T1-29", passed: true, severity: "info", message: "No paragraphs found", autoEditable: false };
    }
    let shortCount = 0;
    for (const p of paragraphs) {
      const text = $(p).text();
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length <= 2) shortCount++;
    }
    const ratio = shortCount / paragraphs.length;
    const passed = ratio >= 0.7; // 70% short paragraphs
    return {
      checkId: "T1-29",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `${Math.round(ratio * 100)}% short paragraphs (good)` : `Only ${Math.round(ratio * 100)}% short paragraphs (aim for 70%+)`,
      details: { shortCount, total: paragraphs.length, ratio },
      autoEditable: false,
    };
  },
});

// T1-30: TOC on pages >1500 words
registerCheck({
  id: "T1-30",
  name: "TOC on long content",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add table of contents for pages over 1500 words",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const text = getBodyText($);
    const wordCount = getWords(text).length;
    if (wordCount < 1500) {
      return { checkId: "T1-30", passed: true, severity: "info", message: `${wordCount} words (TOC not required)`, autoEditable: false };
    }
    // Detect TOC patterns
    const hasToc = $('[class*="toc"], [id*="toc"], nav[aria-label*="contents"], .table-of-contents, #table-of-contents').length > 0;
    return {
      checkId: "T1-30",
      passed: hasToc,
      severity: hasToc ? "info" : "medium",
      message: hasToc ? "TOC found on long content" : `${wordCount} words but no TOC detected`,
      details: { wordCount },
      autoEditable: !hasToc,
      editRecipe: hasToc ? undefined : "Add table of contents for pages over 1500 words",
    };
  },
});

// T1-31: TOC anchors resolve
registerCheck({
  id: "T1-31",
  name: "TOC anchors resolve",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Fix broken TOC anchor links",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const tocLinks = $('[class*="toc"] a[href^="#"], [id*="toc"] a[href^="#"], .table-of-contents a[href^="#"]').toArray();
    if (tocLinks.length === 0) {
      return { checkId: "T1-31", passed: true, severity: "info", message: "No TOC anchor links found", autoEditable: false };
    }
    let broken = 0;
    for (const link of tocLinks) {
      const href = $(link).attr("href");
      if (href && href.startsWith("#")) {
        const targetId = href.slice(1);
        if ($(`#${CSS.escape(targetId)}`).length === 0) broken++;
      }
    }
    const passed = broken === 0;
    return {
      checkId: "T1-31",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "All TOC anchors resolve" : `${broken} broken TOC anchor(s)`,
      details: { total: tocLinks.length, broken },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Fix broken TOC anchor links",
    };
  },
});

// T1-32: 30-40 word answer after H2
registerCheck({
  id: "T1-32",
  name: "30-40 word answer after H2",
  tier: 1,
  category: "content-structure",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const h2s = $("h2").toArray();
    if (h2s.length === 0) {
      return { checkId: "T1-32", passed: true, severity: "info", message: "No H2 found", autoEditable: false };
    }
    let goodAnswers = 0;
    for (const h2 of h2s) {
      // Get next sibling text (first p after h2)
      const nextP = $(h2).next("p").text();
      const words = getWords(nextP);
      if (words.length >= 30 && words.length <= 40) goodAnswers++;
    }
    const ratio = goodAnswers / h2s.length;
    const passed = ratio >= 0.5; // At least 50% of H2s have good answer length
    return {
      checkId: "T1-32",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `${goodAnswers}/${h2s.length} H2s have optimal answer length` : `Only ${goodAnswers}/${h2s.length} H2s have 30-40 word answers`,
      details: { goodAnswers, total: h2s.length },
      autoEditable: false,
    };
  },
});
