/**
 * T5-05: QDD Vulnerability
 *
 * Query Deserves Diversity - checks if content is too similar to existing SERP results.
 * High similarity to any single SERP result indicates vulnerability to QDD filtering.
 *
 * Blocking: No (informational)
 * Cost: ~$0.002 (embedding comparison)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";

registerCheck({
  id: "T5-05",
  name: "QDD Vulnerability",
  tier: 5,
  category: "quality-gates",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Differentiate content with unique angles, formats, or perspectives to avoid QDD filtering",
  // NOT blocking - informational check
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const { $, serpContent } = ctx;

    if (!serpContent || serpContent.length === 0) {
      return {
        checkId: "T5-05",
        passed: true,
        severity: "info",
        message: "QDD check requires SERP content for comparison",
        autoEditable: false,
      };
    }

    // Extract text content
    const text = $("body").text().replace(/\s+/g, " ").trim();

    if (text.length < 200) {
      return {
        checkId: "T5-05",
        passed: true,
        severity: "info",
        message: "Content too short for QDD analysis",
        autoEditable: false,
      };
    }

    const gateService = getQualityGateService();
    const result = await gateService.evaluateQDDVulnerability(text, serpContent);

    return {
      checkId: "T5-05",
      passed: result.passed,
      severity: result.passed ? "info" : "medium",
      message: result.message,
      details: {
        score: result.score,
        method: result.method,
        similarity: result.embeddingSimilarity,
        confidence: result.confidence,
      },
      autoEditable: !result.passed,
      // No blocking field - this check is advisory only
    };
  },
});
