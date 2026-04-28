/**
 * Tier 1 Heading Structure Checks (T1-06 to T1-13)
 * Category B: Heading hierarchy and keyword placement
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// T1-06: Single H1
registerCheck({
  id: "T1-06",
  name: "Single H1",
  tier: 1,
  category: "heading-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Ensure only one H1 tag exists on the page",
  run: (ctx: CheckContext): CheckResult => {
    const count = ctx.$("h1").length;
    const passed = count === 1;
    return {
      checkId: "T1-06",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? "Page has exactly one H1" : `Page has ${count} H1 tags (should be 1)`,
      details: { h1Count: count },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Ensure only one H1 tag exists on the page",
    };
  },
});

// T1-07: H1 under 65 chars
registerCheck({
  id: "T1-07",
  name: "H1 under 65 characters",
  tier: 1,
  category: "heading-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Shorten H1 to under 65 characters",
  run: (ctx: CheckContext): CheckResult => {
    const h1Text = ctx.$("h1").first().text().trim();
    const len = h1Text.length;
    const passed = len > 0 && len <= 65;
    return {
      checkId: "T1-07",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? `H1 is ${len} characters (good)` : len === 0 ? "No H1 found" : `H1 is ${len} characters (max 65)`,
      details: { h1Length: len, h1Text: h1Text.slice(0, 100) },
      autoEditable: !passed && len > 65,
      editRecipe: len > 65 ? "Shorten H1 to under 65 characters" : undefined,
    };
  },
});

// T1-08: H1 matches Title
registerCheck({
  id: "T1-08",
  name: "H1 matches title",
  tier: 1,
  category: "heading-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Make H1 match or closely align with title tag",
  run: (ctx: CheckContext): CheckResult => {
    const h1 = ctx.$("h1").first().text().trim().toLowerCase();
    const title = ctx.$("title").text().trim().toLowerCase();
    // Check if H1 is contained in title or title contains H1
    const passed = h1.length > 0 && title.length > 0 && (title.includes(h1) || h1.includes(title) || h1 === title);
    return {
      checkId: "T1-08",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "H1 aligns with title" : "H1 does not match title",
      details: { h1: h1.slice(0, 60), title: title.slice(0, 60) },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Make H1 match or closely align with title tag",
    };
  },
});

// T1-09: H3 nesting under H2
registerCheck({
  id: "T1-09",
  name: "H3 properly nested under H2",
  tier: 1,
  category: "heading-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Ensure H3 tags appear after an H2 tag",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const headings = $("h1, h2, h3, h4, h5, h6").toArray();
    let lastH2Seen = false;
    let orphanH3 = false;
    for (const h of headings) {
      const tag = h.tagName.toLowerCase();
      if (tag === "h2") lastH2Seen = true;
      if (tag === "h3" && !lastH2Seen) { orphanH3 = true; break; }
    }
    const passed = !orphanH3;
    return {
      checkId: "T1-09",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "H3 tags properly nested under H2" : "H3 tag found before any H2",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Ensure H3 tags appear after an H2 tag",
    };
  },
});

// T1-10: H4 nesting under H3
registerCheck({
  id: "T1-10",
  name: "H4 properly nested under H3",
  tier: 1,
  category: "heading-structure",
  severity: "low",
  autoEditable: true,
  editRecipe: "Ensure H4 tags appear after an H3 tag",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const headings = $("h1, h2, h3, h4, h5, h6").toArray();
    let lastH3Seen = false;
    let orphanH4 = false;
    for (const h of headings) {
      const tag = h.tagName.toLowerCase();
      if (tag === "h3") lastH3Seen = true;
      if (tag === "h4" && !lastH3Seen) { orphanH4 = true; break; }
    }
    const passed = !orphanH4;
    return {
      checkId: "T1-10",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "H4 tags properly nested under H3" : "H4 tag found before any H3",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Ensure H4 tags appear after an H3 tag",
    };
  },
});

// T1-11: Keyword in first H2
registerCheck({
  id: "T1-11",
  name: "Keyword in first H2",
  tier: 1,
  category: "heading-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add keyword to the first H2 heading",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-11", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const firstH2 = $("h2").first().text();
    const passed = keywordRegex(keyword).test(firstH2);
    return {
      checkId: "T1-11",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "Keyword found in first H2" : "Keyword not in first H2",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword to the first H2 heading",
    };
  },
});

// T1-12: Keyword in last H2
registerCheck({
  id: "T1-12",
  name: "Keyword in last H2",
  tier: 1,
  category: "heading-structure",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add keyword to the last H2 heading",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-12", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const lastH2 = $("h2").last().text();
    const passed = keywordRegex(keyword).test(lastH2);
    return {
      checkId: "T1-12",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in last H2" : "Keyword not in last H2",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword to the last H2 heading",
    };
  },
});

// T1-13: H2 count in 5-12 range
registerCheck({
  id: "T1-13",
  name: "H2 count in optimal range",
  tier: 1,
  category: "heading-structure",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const count = ctx.$("h2").length;
    const passed = count >= 5 && count <= 12;
    return {
      checkId: "T1-13",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `${count} H2 tags (optimal 5-12)` : `${count} H2 tags (optimal is 5-12)`,
      details: { h2Count: count },
      autoEditable: false,
    };
  },
});
