/**
 * T5-02: Information Gain vs SERP
 *
 * Evaluates if content adds unique value compared to existing SERP results.
 * Uses embedding similarity to measure information gain.
 *
 * Blocking: Yes (score < 40)
 * Cost: ~$0.0001 (embedding only)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";

registerCheck({
  id: "T5-02",
  name: "Information Gain vs SERP",
  tier: 5,
  category: "quality-gates",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add unique insights, data, or perspectives not found in top SERP results",
  blocking: true,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const { $, serpContent } = ctx;

    if (!serpContent || serpContent.length === 0) {
      return {
        checkId: "T5-02",
        passed: true,
        severity: "info",
        message: "Information Gain check requires SERP content for comparison",
        autoEditable: false,
      };
    }

    // Extract text content
    const text = $("body").text().replace(/\s+/g, " ").trim();

    if (text.length < 200) {
      return {
        checkId: "T5-02",
        passed: true,
        severity: "info",
        message: "Content too short for information gain analysis",
        autoEditable: false,
      };
    }

    const gateService = getQualityGateService();
    const result = await gateService.evaluateInformationGain(text, serpContent);

    const isBlocking = !result.passed && result.score < 40;

    return {
      checkId: "T5-02",
      passed: result.passed,
      severity: result.passed ? "info" : "high",
      message: result.message,
      details: {
        score: result.score,
        method: result.method,
        similarity: result.embeddingSimilarity,
        confidence: result.confidence,
      },
      autoEditable: !result.passed,
      blocking: isBlocking,
    };
  },
});
