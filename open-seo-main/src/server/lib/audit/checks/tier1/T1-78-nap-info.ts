/**
 * T1-78: NAP information present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: local page types
 * Severity: CRITICAL - NAP is essential for local SEO
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-78",
  name: "NAP information present",
  tier: 1,
  category: "content-structure",
  severity: "critical",
  autoEditable: true,
  editRecipe: "Add Name, Address, and Phone (NAP) information in a consistent format",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "local" && pageType !== "unknown") {
      return {
        checkId: "T1-78",
        passed: true,
        severity: "info",
        message: `NAP check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    const text = $("body").text();

    // Check for address pattern
    const addressPattern = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln)/i;
    const hasAddress = addressPattern.test(text) || $('[itemtype*="PostalAddress"], address').length > 0;

    // Check for phone number
    const phonePattern = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;
    const hasPhone = phonePattern.test(text) || $('a[href^="tel:"]').length > 0;

    // Check for business name in structured data or prominent position
    const hasName = $('[itemtype*="LocalBusiness"] [itemprop="name"]').length > 0 ||
                    $("h1").text().length > 0;

    const napScore = (hasName ? 1 : 0) + (hasAddress ? 1 : 0) + (hasPhone ? 1 : 0);
    const passed = napScore >= 2; // At least 2 of 3 NAP elements

    return {
      checkId: "T1-78",
      passed,
      severity: passed ? "info" : "critical",
      message: passed
        ? `NAP information present (${napScore}/3 elements found)`
        : `Missing NAP information (only ${napScore}/3 found) - critical for local SEO`,
      details: { hasName, hasAddress, hasPhone, napScore },
      autoEditable: !passed,
    };
  },
});
