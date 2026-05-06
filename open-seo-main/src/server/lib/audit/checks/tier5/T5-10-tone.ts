/**
 * T5-10: Tone Appropriateness
 *
 * Analyzes sentiment consistency and tone appropriateness.
 * Uses simple positive/negative word ratios to detect tone shifts.
 *
 * Blocking: No (quality recommendation)
 * Cost: ~$0.001 (rule-based analysis)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/**
 * Positive sentiment indicators (professional/confident tone).
 */
const POSITIVE_WORDS = [
  "excellent",
  "outstanding",
  "effective",
  "proven",
  "reliable",
  "successful",
  "innovative",
  "leading",
  "trusted",
  "professional",
  "quality",
  "benefit",
  "improve",
  "enhance",
  "achieve",
  "solution",
  "advantage",
  "expert",
  "recommended",
  "optimal",
];

/**
 * Negative sentiment indicators (may indicate issues or complaints).
 */
const NEGATIVE_WORDS = [
  "problem",
  "issue",
  "difficult",
  "complicated",
  "frustrating",
  "confusing",
  "expensive",
  "limited",
  "poor",
  "worst",
  "terrible",
  "avoid",
  "warning",
  "risk",
  "danger",
  "failure",
  "mistake",
  "error",
  "broken",
  "outdated",
];

/**
 * Overly promotional/salesy words (may indicate low credibility).
 */
const SALESY_WORDS = [
  "amazing",
  "incredible",
  "unbelievable",
  "revolutionary",
  "game-changing",
  "mind-blowing",
  "life-changing",
  "must-have",
  "guaranteed",
  "exclusive",
  "limited time",
  "act now",
  "don't miss",
  "hurry",
  "last chance",
];

registerCheck({
  id: "T5-10",
  name: "Tone Appropriateness",
  tier: 5,
  category: "voice-tone",
  severity: "low",
  autoEditable: false, // Requires editorial judgment
  // NOT blocking - quality recommendation
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;
    const text = $("body").text().toLowerCase();
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

    if (wordCount < 200) {
      return {
        checkId: "T5-10",
        passed: true,
        severity: "info",
        message: "Content too short to analyze tone",
        autoEditable: false,
      };
    }

    // Count sentiment words
    let positiveCount = 0;
    let negativeCount = 0;
    let salesyCount = 0;

    for (const word of POSITIVE_WORDS) {
      const matches = text.match(new RegExp(`\\b${word}\\b`, "gi"));
      if (matches) positiveCount += matches.length;
    }

    for (const word of NEGATIVE_WORDS) {
      const matches = text.match(new RegExp(`\\b${word}\\b`, "gi"));
      if (matches) negativeCount += matches.length;
    }

    for (const word of SALESY_WORDS) {
      const matches = text.match(new RegExp(`\\b${word}\\b`, "gi"));
      if (matches) salesyCount += matches.length;
    }

    const total = positiveCount + negativeCount + salesyCount;

    if (total < 5) {
      return {
        checkId: "T5-10",
        passed: true,
        severity: "info",
        message: "Not enough sentiment markers to analyze tone",
        autoEditable: false,
      };
    }

    // Calculate densities per 1000 words
    const positiveDensity = (positiveCount / wordCount) * 1000;
    const negativeDensity = (negativeCount / wordCount) * 1000;
    const salesyDensity = (salesyCount / wordCount) * 1000;

    // Ideal: positive > negative, minimal salesy
    const hasExcessiveNegative = negativeDensity > positiveDensity * 0.5;
    const hasExcessiveSalesy = salesyDensity > 5; // More than 5 per 1000 words

    const passed = !hasExcessiveNegative && !hasExcessiveSalesy;

    // Calculate score
    let score = 80;
    if (hasExcessiveNegative) score -= 20;
    if (hasExcessiveSalesy) score -= 30;
    if (positiveDensity > 10) score += 10;

    score = Math.max(0, Math.min(100, score));

    let message = "";
    if (passed) {
      message = `Appropriate professional tone: ${positiveDensity.toFixed(1)} positive, ${negativeDensity.toFixed(1)} negative per 1000 words`;
    } else if (hasExcessiveSalesy) {
      message = `Overly promotional tone: ${salesyDensity.toFixed(1)} salesy words per 1000 words`;
    } else {
      message = `Negative tone detected: ${negativeDensity.toFixed(1)} negative words per 1000 words`;
    }

    return {
      checkId: "T5-10",
      passed,
      severity: passed ? "info" : "low",
      message,
      details: {
        score: Math.round(score),
        positiveCount,
        negativeCount,
        salesyCount,
        positiveDensity: Math.round(positiveDensity * 10) / 10,
        negativeDensity: Math.round(negativeDensity * 10) / 10,
        salesyDensity: Math.round(salesyDensity * 10) / 10,
      },
      autoEditable: false,
      // No blocking field - this check is advisory only
    };
  },
});
