/**
 * T5-06: Thin Content Detection
 *
 * Checks if word count meets vertical-specific minimum threshold.
 * YMYL verticals require more comprehensive content.
 *
 * Blocking: Yes (score < 20)
 * Cost: $0 (rule-based, word count)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";

registerCheck({
  id: "T5-06",
  name: "Thin Content Detection",
  tier: 5,
  category: "quality-gates",
  severity: "critical",
  autoEditable: true,
  editRecipe: "Expand content with more comprehensive coverage of the topic",
  blocking: true,
  run: (ctx: CheckContext): CheckResult => {
    const { $, vertical } = ctx;

    // Default to "general" if no vertical provided
    const effectiveVertical = vertical ?? "general";

    // Extract text content
    const text = $("body").text();

    const gateService = getQualityGateService();
    const result = gateService.evaluateThinContent(text, effectiveVertical);

    const isBlocking = !result.passed && result.score < 20;

    return {
      checkId: "T5-06",
      passed: result.passed,
      severity: result.passed ? "info" : "critical",
      message: result.message,
      details: {
        score: result.score,
        method: result.method,
        vertical: effectiveVertical,
      },
      autoEditable: !result.passed,
      blocking: isBlocking,
    };
  },
});
