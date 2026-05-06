/**
 * T1-76: Winner declaration present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: comparison page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-76",
  name: "Winner declaration present",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add a clear winner/recommendation section at the end of the comparison",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "comparison" && pageType !== "unknown") {
      return {
        checkId: "T1-76",
        passed: true,
        severity: "info",
        message: `Winner declaration not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    const text = $("body").text().toLowerCase();
    const winnerPatterns = [
      /\b(winner|best (overall|choice|pick)|our (pick|recommendation)|top choice)\b/,
      /\bwe recommend\b/,
      /\bthe verdict\b/,
      /\b(bottom line|final recommendation)\b/,
    ];

    const hasWinner = winnerPatterns.some(p => p.test(text));

    return {
      checkId: "T1-76",
      passed: hasWinner,
      severity: hasWinner ? "info" : "medium",
      message: hasWinner
        ? "Winner/recommendation declaration found"
        : "Missing winner declaration - add clear recommendation at end",
      autoEditable: !hasWinner,
    };
  },
});
