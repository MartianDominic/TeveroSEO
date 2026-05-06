/**
 * T1-75: Pros/cons section present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: comparison page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-75",
  name: "Pros/cons section present",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add pros and cons sections for each item being compared",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    // Only applies to comparison pages
    if (pageType && pageType !== "comparison" && pageType !== "unknown") {
      return {
        checkId: "T1-75",
        passed: true,
        severity: "info",
        message: `Pros/cons check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    const text = $("body").text().toLowerCase();
    const hasPros = /\bpros?\b|\badvantages?\b|\bbenefits?\b|\bstrengths?\b/.test(text);
    const hasCons = /\bcons?\b|\bdisadvantages?\b|\bdrawbacks?\b|\bweaknesses?\b/.test(text);

    // Check for structured pros/cons lists
    const hasProsConsList = $(".pros, .cons, [class*='pros'], [class*='cons']").length >= 2;

    const passed = (hasPros && hasCons) || hasProsConsList;

    return {
      checkId: "T1-75",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? "Pros and cons sections found"
        : "Missing pros/cons - add balanced evaluation for each item",
      details: { hasPros, hasCons, hasProsConsList },
      autoEditable: !passed,
    };
  },
});
