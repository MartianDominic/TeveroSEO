/**
 * Tier 1 URL Structure Checks (T1-21 to T1-25)
 * Category D: URL optimization
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// T1-21: Hyphens not underscores
registerCheck({
  id: "T1-21",
  name: "URL uses hyphens not underscores",
  tier: 1,
  category: "url-structure",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    try {
      const urlObj = new URL(ctx.url);
      const path = urlObj.pathname;
      const hasUnderscores = path.includes("_");
      const passed = !hasUnderscores;
      return {
        checkId: "T1-21",
        passed,
        severity: passed ? "info" : "medium",
        message: passed ? "URL uses hyphens for word separation" : "URL contains underscores (use hyphens instead)",
        details: { path },
        autoEditable: false,
      };
    } catch {
      return { checkId: "T1-21", passed: false, severity: "high", message: "Invalid URL", autoEditable: false };
    }
  },
});

// T1-22: All lowercase
registerCheck({
  id: "T1-22",
  name: "URL is lowercase",
  tier: 1,
  category: "url-structure",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    try {
      const urlObj = new URL(ctx.url);
      const path = urlObj.pathname;
      const passed = path === path.toLowerCase();
      return {
        checkId: "T1-22",
        passed,
        severity: passed ? "info" : "medium",
        message: passed ? "URL is lowercase" : "URL contains uppercase characters",
        details: { path },
        autoEditable: false,
      };
    } catch {
      return { checkId: "T1-22", passed: false, severity: "high", message: "Invalid URL", autoEditable: false };
    }
  },
});

// T1-23: 3-5 words in slug
registerCheck({
  id: "T1-23",
  name: "URL slug has 3-5 words",
  tier: 1,
  category: "url-structure",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    try {
      const urlObj = new URL(ctx.url);
      const slug = urlObj.pathname.split("/").filter(Boolean).pop() ?? "";
      const words = slug.split("-").filter(Boolean);
      const count = words.length;
      const passed = count >= 3 && count <= 5;
      return {
        checkId: "T1-23",
        passed,
        severity: passed ? "info" : "low",
        message: passed ? `Slug has ${count} words (optimal)` : `Slug has ${count} words (optimal 3-5)`,
        details: { slug, wordCount: count },
        autoEditable: false,
      };
    } catch {
      return { checkId: "T1-23", passed: false, severity: "high", message: "Invalid URL", autoEditable: false };
    }
  },
});

// T1-24: No keyword repetition in path
registerCheck({
  id: "T1-24",
  name: "No keyword repetition in URL path",
  tier: 1,
  category: "url-structure",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const { url, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-24", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      const kw = keyword.toLowerCase().replace(/\s+/g, "-");
      const matches = path.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) ?? [];
      const passed = matches.length <= 1;
      return {
        checkId: "T1-24",
        passed,
        severity: passed ? "info" : "medium",
        message: passed ? "Keyword not repeated in URL" : `Keyword appears ${matches.length}x in URL (over-optimization)`,
        details: { path, keywordCount: matches.length },
        autoEditable: false,
      };
    } catch {
      return { checkId: "T1-24", passed: false, severity: "high", message: "Invalid URL", autoEditable: false };
    }
  },
});

// T1-25: Max 2 subfolder depth
registerCheck({
  id: "T1-25",
  name: "URL depth max 2 subfolders",
  tier: 1,
  category: "url-structure",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    try {
      const urlObj = new URL(ctx.url);
      const segments = urlObj.pathname.split("/").filter(Boolean);
      const depth = segments.length;
      const passed = depth <= 3; // domain/cat/subcat/page = 3 segments = 2 subfolder depth
      return {
        checkId: "T1-25",
        passed,
        severity: passed ? "info" : "low",
        message: passed ? `URL depth is ${depth} (good)` : `URL depth is ${depth} (max 3 recommended)`,
        details: { depth, segments },
        autoEditable: false,
      };
    } catch {
      return { checkId: "T1-25", passed: false, severity: "high", message: "Invalid URL", autoEditable: false };
    }
  },
});
