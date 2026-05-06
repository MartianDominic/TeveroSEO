/**
 * T1-82: Published date visible check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: article page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-82",
  name: "Published date visible",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add visible publication date near the article title or byline",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "article" && pageType !== "unknown") {
      return {
        checkId: "T1-82",
        passed: true,
        severity: "info",
        message: `Published date check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Check for time element with datetime
    const hasTimeElement = $("time[datetime]").length > 0;

    // Check for published date classes
    const hasPublishedClass = $(".published-date, .publish-date, .post-date, [class*='date'], [itemprop='datePublished']").length > 0;

    // Check for date patterns in text (simple check)
    const text = $("body").text();
    // Match common date formats: Jan 1, 2024 | 01/01/2024 | 2024-01-01
    const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/i;
    const hasDateText = datePattern.test(text);

    // Check for datePublished in JSON-LD
    const jsonLd = $('script[type="application/ld+json"]').text();
    const hasDateSchema = /"datePublished"/.test(jsonLd);

    const passed = hasTimeElement || hasPublishedClass || hasDateText || hasDateSchema;

    return {
      checkId: "T1-82",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? "Published date visible"
        : "Missing visible publication date - helps with freshness signals",
      details: { hasTimeElement, hasPublishedClass, hasDateText, hasDateSchema },
      autoEditable: !passed,
    };
  },
});
