/**
 * T1-85: Social proof section present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: service page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-85",
  name: "Social proof section present",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add testimonials, reviews, ratings, or trust badges to build credibility",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "service" && pageType !== "unknown") {
      return {
        checkId: "T1-85",
        passed: true,
        severity: "info",
        message: `Social proof check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Check for testimonial sections
    const hasTestimonials = $(".testimonials, .testimonial, [class*='testimonial']").length > 0;

    // Check for reviews
    const hasReviews = $(".reviews, .review, [class*='review'], [itemtype*='Review']").length > 0;

    // Check for ratings
    const hasRatings = $(".ratings, .rating, [class*='rating'], .stars, [class*='stars']").length > 0;

    // Check for trust badges
    const hasTrustBadges = $(".trust-badge, [class*='trust'], [class*='badge'], .certifications").length > 0;

    // Check for case studies
    const hasCaseStudies = $(".case-study, .case-studies, [class*='case-study']").length > 0;

    // Check for client logos
    const hasClientLogos = $(".clients, .client-logos, [class*='client'], .partners, .as-seen").length > 0;

    // Check for Review schema in JSON-LD
    const jsonLd = $('script[type="application/ld+json"]').text();
    const hasReviewSchema = /"@type"\s*:\s*"Review"/.test(jsonLd) || /"aggregateRating"/.test(jsonLd);

    const socialProofCount = [
      hasTestimonials,
      hasReviews,
      hasRatings,
      hasTrustBadges,
      hasCaseStudies,
      hasClientLogos,
      hasReviewSchema,
    ].filter(Boolean).length;

    const passed = socialProofCount >= 1;

    return {
      checkId: "T1-85",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `Social proof found (${socialProofCount} element types detected)`
        : "Missing social proof - add testimonials, reviews, or trust badges",
      details: {
        hasTestimonials,
        hasReviews,
        hasRatings,
        hasTrustBadges,
        hasCaseStudies,
        hasClientLogos,
        hasReviewSchema,
        socialProofCount,
      },
      autoEditable: !passed,
    };
  },
});
