/**
 * T5-03: Prove-It Details
 *
 * Evaluates if every claim is backed by evidence in the same paragraph.
 * YMYL verticals receive LLM-based deeper analysis.
 *
 * Blocking: Yes (score < 30)
 * Cost: ~$0.003 (LLM for YMYL, rule-based otherwise)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";

registerCheck({
  id: "T5-03",
  name: "Prove-It Details",
  tier: 5,
  category: "quality-gates",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add statistics, citations, or specific examples to back up each claim",
  blocking: true,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const { $, vertical } = ctx;

    if (!vertical) {
      return {
        checkId: "T5-03",
        passed: true,
        severity: "info",
        message: "Prove-It check requires vertical classification",
        autoEditable: false,
      };
    }

    // Extract text content
    const text = $("body").text().replace(/\s+/g, " ").trim();

    if (text.length < 200) {
      return {
        checkId: "T5-03",
        passed: true,
        severity: "info",
        message: "Content too short for Prove-It analysis",
        autoEditable: false,
      };
    }

    const gateService = getQualityGateService();
    const result = await gateService.evaluateProveItDetails(text, vertical);

    const isBlocking = !result.passed && result.score < 30;

    return {
      checkId: "T5-03",
      passed: result.passed,
      severity: result.passed ? "info" : "high",
      message: result.message,
      details: {
        score: result.score,
        method: result.method,
        confidence: result.confidence,
      },
      autoEditable: !result.passed,
      blocking: isBlocking,
    };
  },
});
