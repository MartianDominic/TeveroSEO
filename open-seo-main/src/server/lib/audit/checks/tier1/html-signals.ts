/**
 * Tier 1 HTML Signals Checks (T1-01 to T1-05)
 * Category A: Secondary HTML signals per Kyle Roof Group B/C
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, SEODataContext } from "../types";

/** Create word boundary regex for keyword matching */
function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// T1-01: Keyword in <strong>/<b>
registerCheck({
  id: "T1-01",
  name: "Keyword in strong/bold",
  tier: 1,
  category: "html-signals",
  severity: "low",
  autoEditable: true,
  editRecipe: "Wrap one instance of keyword in <strong> tag",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-01", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const text = $("strong, b").text();
    const passed = keywordRegex(keyword).test(text);
    return {
      checkId: "T1-01",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in strong/bold tag" : "Keyword not found in any strong/bold tag",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Wrap one instance of keyword in <strong> tag",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const { data, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-01", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    // TODO: Requires new field from Phase 100 Python update: keyword_in_strong
    const passed = (data as any).keyword_in_strong ?? false;
    return {
      checkId: "T1-01",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in strong/bold tag" : "Keyword not found in any strong/bold tag",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Wrap one instance of keyword in <strong> tag",
    };
  },
});

// T1-02: Keyword in <em>/<i>
registerCheck({
  id: "T1-02",
  name: "Keyword in em/italic",
  tier: 1,
  category: "html-signals",
  severity: "low",
  autoEditable: true,
  editRecipe: "Wrap one instance of keyword in <em> tag",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-02", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const text = $("em, i").text();
    const passed = keywordRegex(keyword).test(text);
    return {
      checkId: "T1-02",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in em/italic tag" : "Keyword not found in any em/italic tag",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Wrap one instance of keyword in <em> tag",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const { data, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-02", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    // TODO: Requires new field from Phase 100 Python update: keyword_in_emphasis
    const passed = (data as any).keyword_in_emphasis ?? false;
    return {
      checkId: "T1-02",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in em/italic tag" : "Keyword not found in any em/italic tag",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Wrap one instance of keyword in <em> tag",
    };
  },
});

// T1-03: Keyword in <a title="">
registerCheck({
  id: "T1-03",
  name: "Keyword in link title",
  tier: 1,
  category: "html-signals",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add title attribute with keyword to a relevant link",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-03", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const regex = keywordRegex(keyword);
    let found = false;
    $("a[title]").each((_, el) => {
      if (regex.test($(el).attr("title") ?? "")) found = true;
    });
    return {
      checkId: "T1-03",
      passed: found,
      severity: found ? "info" : "low",
      message: found ? "Keyword found in link title attribute" : "No link title contains keyword",
      autoEditable: !found,
      editRecipe: found ? undefined : "Add title attribute with keyword to a relevant link",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const { data, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-03", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    // TODO: Requires new field from Phase 100 Python update: keyword_in_link_title
    const passed = (data as any).keyword_in_link_title ?? false;
    return {
      checkId: "T1-03",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in link title attribute" : "No link title contains keyword",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add title attribute with keyword to a relevant link",
    };
  },
});

// T1-04: Keyword in <noscript>
registerCheck({
  id: "T1-04",
  name: "Keyword in noscript",
  tier: 1,
  category: "html-signals",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add keyword in noscript content",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-04", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const text = $("noscript").text();
    const passed = keywordRegex(keyword).test(text);
    return {
      checkId: "T1-04",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in noscript tag" : "Keyword not found in noscript content",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword in noscript content",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const { data, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-04", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    // TODO: Requires new field from Phase 100 Python update: keyword_in_noscript
    const passed = (data as any).keyword_in_noscript ?? false;
    return {
      checkId: "T1-04",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "Keyword found in noscript tag" : "Keyword not found in noscript content",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword in noscript content",
    };
  },
});

// T1-05: Keyword in first <p>
registerCheck({
  id: "T1-05",
  name: "Keyword in first paragraph",
  tier: 1,
  category: "html-signals",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add keyword to the first paragraph",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-05", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const firstP = $("p").first().text();
    const passed = keywordRegex(keyword).test(firstP);
    return {
      checkId: "T1-05",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "Keyword found in first paragraph" : "Keyword not in first paragraph",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword to the first paragraph",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const { data, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-05", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    // TODO: Requires new field from Phase 100 Python update: keyword_in_first_paragraph
    // Fallback: use keyword_in_first_100_words as approximation (first paragraph usually within first 100 words)
    const passed = (data as any).keyword_in_first_paragraph ?? data.keyword_in_first_100_words;
    return {
      checkId: "T1-05",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "Keyword found in first paragraph" : "Keyword not in first paragraph",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword to the first paragraph",
    };
  },
});
