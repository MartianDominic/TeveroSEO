/**
 * T1-84: ItemList schema present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: listicle page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-84",
  name: "ItemList schema present",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add ItemList JSON-LD schema with numbered itemListElement entries",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "listicle" && pageType !== "unknown") {
      return {
        checkId: "T1-84",
        passed: true,
        severity: "info",
        message: `ItemList schema check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Get JSON-LD scripts
    const jsonLd = $('script[type="application/ld+json"]').text();

    // Check for ItemList schema
    const hasItemListSchema = /"@type"\s*:\s*"ItemList"/.test(jsonLd);

    // Check for itemListElement
    const hasItemListElement = /"itemListElement"/.test(jsonLd);

    // Check for microdata ItemList
    const hasMicrodata = $('[itemtype*="ItemList"]').length > 0;

    const passed = (hasItemListSchema && hasItemListElement) || hasMicrodata;

    return {
      checkId: "T1-84",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? "ItemList schema found"
        : "Missing ItemList schema - add JSON-LD for carousel eligibility",
      details: { hasItemListSchema, hasItemListElement, hasMicrodata },
      autoEditable: !passed,
    };
  },
});
