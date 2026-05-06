/**
 * T5-13: Paragraph Length Optimization
 *
 * Analyzes paragraph length distribution for readability.
 * Ideal: 3-5 sentences per paragraph, maximum 7 sentences.
 *
 * Blocking: No (quality recommendation)
 * Cost: $0 (rule-based)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/**
 * Ideal paragraph length range (sentences).
 */
const IDEAL_MIN_SENTENCES = 3;
const IDEAL_MAX_SENTENCES = 5;
const ABSOLUTE_MAX_SENTENCES = 7;

/**
 * Count sentences in a paragraph.
 */
function countSentences(paragraph: string): number {
  return paragraph.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

registerCheck({
  id: "T5-13",
  name: "Paragraph Length Optimization",
  tier: 5,
  category: "writing-quality",
  severity: "low",
  autoEditable: true,
  editRecipe: "Break long paragraphs (>7 sentences) into smaller chunks; combine single-sentence paragraphs",
  // NOT blocking - quality recommendation
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;

    // Extract paragraphs from p tags
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) {
        // Skip very short paragraphs (likely UI elements)
        paragraphs.push(text);
      }
    });

    if (paragraphs.length < 3) {
      return {
        checkId: "T5-13",
        passed: true,
        severity: "info",
        message: "Not enough paragraphs to analyze distribution",
        autoEditable: false,
      };
    }

    // Calculate sentence counts per paragraph
    const sentenceCounts = paragraphs.map(countSentences);
    const avg = sentenceCounts.reduce((a, b) => a + b, 0) / sentenceCounts.length;
    const min = Math.min(...sentenceCounts);
    const max = Math.max(...sentenceCounts);

    // Count paragraphs in each category
    const singleSentence = sentenceCounts.filter((c) => c === 1).length;
    const tooShort = sentenceCounts.filter((c) => c < IDEAL_MIN_SENTENCES && c > 1)
      .length;
    const ideal = sentenceCounts.filter(
      (c) => c >= IDEAL_MIN_SENTENCES && c <= IDEAL_MAX_SENTENCES
    ).length;
    const long = sentenceCounts.filter(
      (c) => c > IDEAL_MAX_SENTENCES && c <= ABSOLUTE_MAX_SENTENCES
    ).length;
    const tooLong = sentenceCounts.filter((c) => c > ABSOLUTE_MAX_SENTENCES).length;

    // Calculate distribution percentages
    const idealPercent = (ideal / sentenceCounts.length) * 100;
    const singlePercent = (singleSentence / sentenceCounts.length) * 100;
    const tooLongPercent = (tooLong / sentenceCounts.length) * 100;

    // Pass criteria:
    // - Average within ideal range (3-5)
    // - No more than 20% single-sentence paragraphs
    // - No more than 10% of paragraphs exceed 7 sentences
    // - At least 40% of paragraphs in ideal range
    const avgInRange = avg >= IDEAL_MIN_SENTENCES && avg <= IDEAL_MAX_SENTENCES;
    const fewSingle = singlePercent <= 20;
    const fewTooLong = tooLongPercent <= 10;
    const goodDistribution = idealPercent >= 40;

    const passed = avgInRange && fewSingle && fewTooLong && goodDistribution;

    // Calculate score (0-100)
    let score = 50;

    // Bonus for avg in range
    if (avgInRange) score += 30;
    else if (avg > IDEAL_MAX_SENTENCES)
      score -= 10 * Math.min(3, (avg - IDEAL_MAX_SENTENCES) / 2);
    else if (avg < IDEAL_MIN_SENTENCES)
      score -= 10 * Math.min(3, (IDEAL_MIN_SENTENCES - avg) / 1);

    // Bonus for ideal distribution
    score += idealPercent * 0.2;

    // Penalty for too many single-sentence paragraphs
    score -= singlePercent * 0.3;

    // Penalty for too long paragraphs
    score -= tooLongPercent * 0.5;

    score = Math.max(0, Math.min(100, score));

    let message = "";
    if (passed) {
      message = `Good paragraph structure: avg ${avg.toFixed(1)} sentences, ${idealPercent.toFixed(0)}% in ideal range`;
    } else if (tooLongPercent > 10) {
      message = `${tooLong} paragraphs exceed 7 sentences - consider breaking them up`;
    } else if (singlePercent > 20) {
      message = `${singleSentence} single-sentence paragraphs (${singlePercent.toFixed(0)}%) - consider combining`;
    } else if (!avgInRange && avg > IDEAL_MAX_SENTENCES) {
      message = `Average paragraph too long: ${avg.toFixed(1)} sentences (ideal: ${IDEAL_MIN_SENTENCES}-${IDEAL_MAX_SENTENCES})`;
    } else if (!avgInRange) {
      message = `Average paragraph too short: ${avg.toFixed(1)} sentences (ideal: ${IDEAL_MIN_SENTENCES}-${IDEAL_MAX_SENTENCES})`;
    } else {
      message = `Only ${idealPercent.toFixed(0)}% of paragraphs in ideal length range`;
    }

    return {
      checkId: "T5-13",
      passed,
      severity: passed ? "info" : "low",
      message,
      details: {
        score: Math.round(score),
        paragraphCount: paragraphs.length,
        avgSentences: Math.round(avg * 10) / 10,
        minSentences: min,
        maxSentences: max,
        distribution: {
          singleSentence,
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
