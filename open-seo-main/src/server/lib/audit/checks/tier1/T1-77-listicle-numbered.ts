/**
 * T1-77: Listicle items numbered check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: listicle page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-77",
  name: "Listicle items numbered",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Use numbered headings (1. Item Name, 2. Item Name) for listicle items",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "listicle" && pageType !== "unknown") {
      return {
        checkId: "T1-77",
        passed: true,
        severity: "info",
        message: `Numbered items not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Check for ordered list
    const hasOrderedList = $("ol").filter((_, el) => $(el).children("li").length >= 3).length > 0;

    // Check for numbered headings (1. Title, 2. Title, etc.)
    const h2h3 = $("h2, h3");
    let numberedHeadings = 0;
    h2h3.each((_, el) => {
      const text = $(el).text().trim();
      if (/^\d+[\.\)]\s/.test(text)) {
        numberedHeadings++;
      }
    });
    const hasNumberedHeadings = numberedHeadings >= 3;

    const passed = hasOrderedList || hasNumberedHeadings;

    return {
      checkId: "T1-77",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? "Listicle items are numbered"
        : "Listicle items should be numbered for scannability",
      details: { hasOrderedList, numberedHeadings },
      autoEditable: !passed,
    };
  },
});
