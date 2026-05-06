/**
 * T5-12: Sentence Length Distribution
 *
 * Analyzes sentence length distribution for readability.
 * Ideal: average 15-25 words, maximum 40 words per sentence.
 *
 * Blocking: No (quality recommendation)
 * Cost: $0 (rule-based)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/**
 * Ideal sentence length range (words).
 */
const IDEAL_MIN = 15;
const IDEAL_MAX = 25;
const ABSOLUTE_MAX = 40;

/**
 * Parse sentences from text.
 */
function parseSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Count words in a sentence.
 */
function countWords(sentence: string): number {
  return sentence.split(/\s+/).filter((w) => w.length > 0).length;
}

registerCheck({
  id: "T5-12",
  name: "Sentence Length Distribution",
  tier: 5,
  category: "writing-quality",
  severity: "low",
  autoEditable: true,
  editRecipe: "Break long sentences (>40 words) into shorter ones; combine very short sentences",
  // NOT blocking - quality recommendation
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;
    const text = $("body").text();
    const sentences = parseSentences(text);

    if (sentences.length < 5) {
      return {
        checkId: "T5-12",
        passed: true,
        severity: "info",
        message: "Not enough sentences to analyze distribution",
        autoEditable: false,
      };
    }

    // Calculate sentence length stats
    const lengths = sentences.map(countWords);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);

    // Count sentences in each category
    const tooShort = lengths.filter((l) => l < 8).length;
    const ideal = lengths.filter((l) => l >= IDEAL_MIN && l <= IDEAL_MAX).length;
    const long = lengths.filter((l) => l > IDEAL_MAX && l <= ABSOLUTE_MAX).length;
    const tooLong = lengths.filter((l) => l > ABSOLUTE_MAX).length;

    // Calculate distribution percentages
    const idealPercent = (ideal / lengths.length) * 100;
    const tooLongPercent = (tooLong / lengths.length) * 100;

    // Pass criteria:
    // - Average within ideal range (15-25)
    // - No more than 10% of sentences exceed 40 words
    // - At least 40% of sentences in ideal range
    const avgInRange = avg >= IDEAL_MIN && avg <= IDEAL_MAX;
    const fewTooLong = tooLongPercent <= 10;
    const goodDistribution = idealPercent >= 40;

    const passed = avgInRange && fewTooLong && goodDistribution;

    // Calculate score (0-100)
    let score = 50;

    // Bonus for avg in range
    if (avgInRange) score += 30;
    else if (avg > IDEAL_MAX) score -= 10 * Math.min(3, (avg - IDEAL_MAX) / 5);
    else if (avg < IDEAL_MIN) score -= 10 * Math.min(3, (IDEAL_MIN - avg) / 5);

    // Bonus for ideal distribution
    score += idealPercent * 0.2;

    // Penalty for too long sentences
    score -= tooLongPercent * 0.5;

    score = Math.max(0, Math.min(100, score));

    let message = "";
    if (passed) {
      message = `Good sentence length: avg ${avg.toFixed(0)} words, ${idealPercent.toFixed(0)}% in ideal range`;
    } else if (tooLongPercent > 10) {
      message = `${tooLong} sentences exceed 40 words (${tooLongPercent.toFixed(0)}%) - consider breaking them up`;
    } else if (!avgInRange && avg > IDEAL_MAX) {
      message = `Average sentence too long: ${avg.toFixed(0)} words (ideal: ${IDEAL_MIN}-${IDEAL_MAX})`;
    } else if (!avgInRange) {
      message = `Average sentence too short: ${avg.toFixed(0)} words (ideal: ${IDEAL_MIN}-${IDEAL_MAX})`;
    } else {
      message = `Only ${idealPercent.toFixed(0)}% of sentences in ideal length range`;
    }

    return {
      checkId: "T5-12",
      passed,
      severity: passed ? "info" : "low",
      message,
      details: {
        score: Math.round(score),
        sentenceCount: sentences.length,
        avgLength: Math.round(avg * 10) / 10,
        minLength: min,
        maxLength: max,
        distribution: {
          tooShort,
          ideal,
          long,
          tooLong,
        },
        idealPercent: Math.round(idealPercent),
      },
      autoEditable: !passed,
      // No blocking field - this check is advisory only
    };
  },
});
