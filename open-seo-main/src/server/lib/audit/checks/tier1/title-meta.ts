/**
 * Tier 1 Title/Meta Checks (T1-14 to T1-20)
 * Category C: Title and meta description optimization
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// T1-14: Title 50-60 chars
registerCheck({
  id: "T1-14",
  name: "Title length 50-60 characters",
  tier: 1,
  category: "title-meta",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Adjust title to 50-60 characters",
  run: (ctx: CheckContext): CheckResult => {
    const title = ctx.$("title").text().trim();
    const len = title.length;
    const passed = len >= 50 && len <= 60;
    return {
      checkId: "T1-14",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? `Title is ${len} characters (optimal)` : `Title is ${len} characters (optimal 50-60)`,
      details: { titleLength: len, title: title.slice(0, 70) },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Adjust title to 50-60 characters",
    };
  },
});

// T1-15: Keyword in first 30 chars of title
registerCheck({
  id: "T1-15",
  name: "Keyword in first 30 chars of title",
  tier: 1,
  category: "title-meta",
  severity: "high",
  autoEditable: true,
  editRecipe: "Move keyword to the beginning of the title",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-15", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const title = $("title").text().trim();
    const first30 = title.slice(0, 30);
    const passed = keywordRegex(keyword).test(first30);
    return {
      checkId: "T1-15",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? "Keyword in first 30 chars of title" : "Keyword not front-loaded in title",
      details: { first30 },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Move keyword to the beginning of the title",
    };
  },
});

// T1-16: Brackets/parentheses in title
registerCheck({
  id: "T1-16",
  name: "Brackets or parentheses in title",
  tier: 1,
  category: "title-meta",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add brackets like [2026] or (Guide) to title for +40% CTR",
  run: (ctx: CheckContext): CheckResult => {
    const title = ctx.$("title").text();
    const passed = /[\[\]\(\)]/.test(title);
    return {
      checkId: "T1-16",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Title has brackets/parentheses (CTR boost)" : "Consider adding brackets to title for CTR",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add brackets like [2026] or (Guide) to title for +40% CTR",
    };
  },
});

// T1-17: Year in title
registerCheck({
  id: "T1-17",
  name: "Year in title",
  tier: 1,
  category: "title-meta",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add current year to title for freshness signal",
  run: (ctx: CheckContext): CheckResult => {
    const title = ctx.$("title").text();
    // Match years 2024-2030
    const passed = /\b(202[4-9]|2030)\b/.test(title);
    return {
      checkId: "T1-17",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Title contains year (freshness signal)" : "Consider adding year to title",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add current year to title for freshness signal",
    };
  },
});

// T1-18: Meta description 140-160 chars
registerCheck({
  id: "T1-18",
  name: "Meta description 140-160 characters",
  tier: 1,
  category: "title-meta",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Adjust meta description to 140-160 characters",
  run: (ctx: CheckContext): CheckResult => {
    const meta = ctx.$('meta[name="description"]').attr("content") ?? "";
    const len = meta.length;
    const passed = len >= 140 && len <= 160;
    return {
      checkId: "T1-18",
      passed,
      severity: len === 0 ? "high" : passed ? "info" : "medium",
      message: len === 0 ? "No meta description found" : passed ? `Meta description is ${len} chars (optimal)` : `Meta description is ${len} chars (optimal 140-160)`,
      details: { metaLength: len },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Adjust meta description to 140-160 characters",
    };
  },
});

// T1-19: Meta description has keyword
registerCheck({
  id: "T1-19",
  name: "Meta description contains keyword",
  tier: 1,
  category: "title-meta",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add keyword to meta description",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-19", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const meta = $('meta[name="description"]').attr("content") ?? "";
    const passed = keywordRegex(keyword).test(meta);
    return {
      checkId: "T1-19",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "Keyword found in meta description" : "Keyword missing from meta description",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword to meta description",
    };
  },
});

// T1-20: Meta description has CTA verb
registerCheck({
  id: "T1-20",
  name: "Meta description has call-to-action",
  tier: 1,
  category: "title-meta",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add CTA verb (Learn, Discover, Get, Find, etc.) to meta description",
  run: (ctx: CheckContext): CheckResult => {
    const meta = ctx.$('meta[name="description"]').attr("content") ?? "";
    // Common CTA verbs
    const ctaPattern = /\b(learn|discover|get|find|explore|try|start|join|see|read|download|buy|shop|save|compare|check|view|unlock|access)\b/i;
    const passed = ctaPattern.test(meta);
    return {
      checkId: "T1-20",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Meta description has CTA verb" : "Add CTA verb to meta description",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add CTA verb (Learn, Discover, Get, Find, etc.) to meta description",
    };
  },
});
