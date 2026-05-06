/**
 * T1-74: Comparison table present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: comparison page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-74",
  name: "Comparison table present",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add a comparison table with features/specs for the items being compared",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    // Only applies to comparison pages
    if (pageType && pageType !== "comparison" && pageType !== "unknown") {
      return {
        checkId: "T1-74",
        passed: true,
        severity: "info",
        message: `Comparison table check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Check for tables
    const tables = $("table");
    const hasComparisonTable = tables.filter((_, el) => {
      const $table = $(el);
      // Table should have headers and multiple rows
      const hasHeaders = $table.find("th").length >= 2;
      const hasRows = $table.find("tr").length >= 3;
      return hasHeaders && hasRows;
    }).length > 0;

    // Also check for styled comparison sections
    const hasComparisonSection = $(".comparison, [class*='comparison'], .vs-table, [class*='vs-']").length > 0;

    const passed = hasComparisonTable || hasComparisonSection;

    return {
      checkId: "T1-74",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? "Comparison table found"
        : "Missing comparison table - add feature/spec comparison for items",
      autoEditable: !passed,
    };
  },
});
