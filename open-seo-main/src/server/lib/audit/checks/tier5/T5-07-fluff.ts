/**
 * T5-07: Fluff Detection
 *
 * Identifies filler content and weasel words that weaken content quality.
 * Includes phrases like "it goes without saying" and words like "may", "might".
 *
 * Blocking: No (quality improvement suggestion)
 * Cost: ~$0.001 (rule-based pattern matching)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";

registerCheck({
  id: "T5-07",
  name: "Fluff Detection",
  tier: 5,
  category: "writing-quality",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Remove filler phrases and replace weasel words with specific, confident language",
  // NOT blocking - quality improvement suggestion
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;

    // Extract text content
    const text = $("body").text();

    if (text.length < 200) {
      return {
        checkId: "T5-07",
        passed: true,
        severity: "info",
        message: "Content too short for fluff analysis",
        autoEditable: false,
      };
    }

    const gateService = getQualityGateService();
    const result = gateService.evaluateFluffDetection(text);

    return {
      checkId: "T5-07",
      passed: result.passed,
      severity: result.passed ? "info" : "medium",
      message: result.message,
      details: {
        score: result.score,
        method: result.method,
      },
      autoEditable: !result.passed,
      // No blocking field - this check is advisory only
    };
  },
});
