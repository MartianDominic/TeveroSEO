/**
 * T1-71: Value proposition above fold check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: All page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

registerCheck({
  id: "T1-71",
  name: "Value proposition above fold",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add a clear value proposition within the first 200 words or in a prominent hero section",
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;

    // Check for hero/banner sections
    const hasHero = $(".hero, .banner, [class*='hero'], [class*='banner']").length > 0;

    // Check H1 + subheading pattern
    const h1 = $("h1").first();
    const hasSubheading = h1.next("p, .subtitle, .tagline, [class*='subtitle']").length > 0;

    // Check for benefit-focused language in first 500 chars
    const firstContent = $("main, article, body").text().slice(0, 500);
    const benefitPatterns = [
      /\b(save|increase|improve|boost|reduce|eliminate|transform)\b/i,
      /\b(you'll|you will|get|achieve|discover)\b/i,
      /\b(free|fast|easy|simple|quick)\b/i,
    ];
    const hasBenefitLanguage = benefitPatterns.some(p => p.test(firstContent));

    const passed = hasHero || (hasSubheading && hasBenefitLanguage);

    return {
      checkId: "T1-71",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? "Value proposition present above the fold"
        : "Missing clear value proposition - add hero section with benefits",
      details: { hasHero, hasSubheading, hasBenefitLanguage },
      autoEditable: !passed,
      editRecipe: !passed ? "Add a hero section with a clear value proposition and benefits" : undefined,
    };
  },
});
