/**
 * T5-01: Reddit Test
 *
 * Evaluates if content would survive scrutiny on r/[vertical] without being
 * criticized for vagueness or lack of expertise.
 *
 * Blocking: Yes (score < 50)
 * Cost: ~$0.002 (embedding + LLM fallback)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";

registerCheck({
  id: "T5-01",
  name: "Reddit Test",
  tier: 5,
  category: "quality-gates",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add specific examples, numbers, case studies; avoid generic advice",
  blocking: true,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const { $, vertical } = ctx;

    if (!vertical) {
      return {
        checkId: "T5-01",
        passed: true,
        severity: "info",
        message: "Reddit Test requires vertical classification",
        autoEditable: false,
      };
    }

    // Extract text content
    const text = $("body").text().replace(/\s+/g, " ").trim();

    if (text.length < 200) {
      return {
        checkId: "T5-01",
        passed: true,
        severity: "info",
        message: "Content too short for Reddit Test evaluation",
        autoEditable: false,
      };
    }

    // Get quality gate service
    const gateService = getQualityGateService();
    const result = await gateService.evaluateRedditTest(text, vertical);

    const isBlocking = !result.passed && result.score < 50;

    return {
      checkId: "T5-01",
      passed: result.passed,
      severity: result.passed ? "info" : "high",
      message: result.message,
      details: {
        score: result.score,
        method: result.method,
        embeddingSimilarity: result.embeddingSimilarity,
        confidence: result.confidence,
      },
      autoEditable: !result.passed,
      blocking: isBlocking,
    };
  },
});
