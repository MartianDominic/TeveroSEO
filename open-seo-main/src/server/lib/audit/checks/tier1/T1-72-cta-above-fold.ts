/**
 * T1-72: Primary CTA above fold check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: service, local page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-72",
  name: "Primary CTA above fold",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add a prominent call-to-action button in the hero/header section",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    // Only applies to service and local pages
    if (pageType && !["service", "local", "unknown"].includes(pageType)) {
      return {
        checkId: "T1-72",
        passed: true,
        severity: "info",
        message: `CTA check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Check for CTA elements in header/hero area
    const ctaSelectors = [
      ".hero a[href], .hero button",
      ".banner a[href], .banner button",
      "header a.btn, header a.button, header button",
      "[class*='cta'], [class*='call-to-action']",
    ];

    const hasCta = ctaSelectors.some(selector => $(selector).length > 0);

    // Check for common CTA text patterns
    const ctaTextPatterns = /\b(contact|get started|book|call|schedule|request|free|quote|demo)\b/i;
    const hasCtaText = $("a, button").filter((_, el) =>
      ctaTextPatterns.test($(el).text())
    ).length > 0;

    // Check for phone number in header (common for local businesses)
    const headerPhone = $("header a[href^='tel:']").length > 0;

    const passed = hasCta || hasCtaText || headerPhone;

    return {
      checkId: "T1-72",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? "Primary CTA found above the fold"
        : "Missing primary CTA - add contact/booking button in hero section",
      details: { hasCta, hasCtaText, headerPhone },
      autoEditable: !passed,
    };
  },
});
