/**
 * T1-73: H2 spacing optimal check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: article page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

function getWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

registerCheck({
  id: "T1-73",
  name: "H2 spacing optimal",
  tier: 1,
  category: "content-structure",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    // Only applies to article pages
    if (pageType && pageType !== "article" && pageType !== "unknown") {
      return {
        checkId: "T1-73",
        passed: true,
        severity: "info",
        message: `H2 spacing check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    const h2s = $("h2");
    if (h2s.length < 2) {
      return {
        checkId: "T1-73",
        passed: true,
        severity: "info",
        message: "Not enough H2s to check spacing",
        autoEditable: false,
      };
    }

    // Calculate word counts between H2s
    const sections: number[] = [];
    h2s.each((i, el) => {
      const $el = $(el);
      const nextH2 = $el.nextAll("h2").first();

      let content = "";
      if (nextH2.length > 0) {
        content = $el.nextUntil("h2").text();
      } else {
        content = $el.nextAll().text();
      }

      const wordCount = getWords(content.trim()).length;
      sections.push(wordCount);
    });

    // Optimal: 150-600 words per H2 section
    const optimalSections = sections.filter(w => w >= 150 && w <= 600);
    const ratio = optimalSections.length / sections.length;
    const passed = ratio >= 0.7; // 70% of sections should be optimal

    return {
      checkId: "T1-73",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `H2 spacing optimal (${Math.round(ratio * 100)}% of sections in 150-600 word range)`
        : `H2 sections may be too short or too long (${Math.round(ratio * 100)}% optimal)`,
      details: { sections, optimalRatio: ratio },
      autoEditable: false,
    };
  },
});
