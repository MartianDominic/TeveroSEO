/**
 * T1-81: Author byline present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: article page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-81",
  name: "Author byline present",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add author byline with name and link to author bio page",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "article" && pageType !== "unknown") {
      return {
        checkId: "T1-81",
        passed: true,
        severity: "info",
        message: `Author byline check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Check for author link
    const hasAuthorLink = $('[rel="author"], a[href*="/author"], a[href*="/authors"]').length > 0;

    // Check for author class/element
    const hasAuthorElement = $(".author, .byline, [class*='author'], [class*='byline'], [itemprop='author']").length > 0;

    // Check for "by" pattern
    const text = $("body").text();
    const hasByPattern = /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i.test(text);

    // Check for author in JSON-LD
    const jsonLd = $('script[type="application/ld+json"]').text();
    const hasAuthorSchema = /"author"/.test(jsonLd);

    const passed = hasAuthorLink || hasAuthorElement || hasByPattern || hasAuthorSchema;

    return {
      checkId: "T1-81",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? "Author byline found"
        : "Missing author byline - important for E-E-A-T",
      details: { hasAuthorLink, hasAuthorElement, hasByPattern, hasAuthorSchema },
      autoEditable: !passed,
    };
  },
});
