/**
 * T5-04: Not For You Block
 *
 * Checks for audience qualification statements that help readers self-select.
 * Presence of "who this is for" or "prerequisites" sections.
 *
 * Blocking: No (bonus check, not a requirement)
 * Cost: $0 (rule-based)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { getQualityGateService } from "@/server/features/onpage-mastery/services/QualityGateService";

registerCheck({
  id: "T5-04",
  name: "Not For You Block",
  tier: 5,
  category: "quality-gates",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add a 'Who This Is For' or 'Prerequisites' section to help readers self-select",
  // NOT blocking - this is a bonus/recommendation
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;

    // Extract text content
    const text = $("body").text();

    const gateService = getQualityGateService();
    const result = gateService.evaluateNotForYou(text);

    return {
      checkId: "T5-04",
      passed: result.passed,
      severity: result.passed ? "info" : "low",
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
