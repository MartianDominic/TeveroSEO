/**
 * T5-11: Audience Alignment
 *
 * Checks for audience-appropriate language complexity.
 * Evaluates reading level, jargon usage, and accessibility.
 *
 * Blocking: No (quality recommendation)
 * Cost: ~$0.001 (rule-based analysis)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/**
 * Technical jargon patterns that may indicate audience mismatch.
 */
const JARGON_PATTERNS = [
  /\b[A-Z]{3,}\b/g, // Acronyms (API, SEO, CRM, etc.)
  /\bparadigm\b/gi,
  /\bsynergy\b/gi,
  /\bholistic\b/gi,
  /\boptimize\b/gi,
  /\bagile\b/gi,
  /\bscalable\b/gi,
  /\bstakeholder\b/gi,
  /\bdeployment\b/gi,
  /\binfrastructure\b/gi,
  /\barchitecture\b/gi,
  /\bframework\b/gi,
  /\bintegrate\b/gi,
  /\bimplement\b/gi,
  /\bleverage\b/gi,
];

/**
 * Complex words (3+ syllables) that may reduce accessibility.
 * Simple heuristic: words > 10 characters often have 3+ syllables.
 */
function countComplexWords(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.filter((w) => w.length > 10 && /^[a-zA-Z]+$/.test(w)).length;
}

/**
 * Calculate average sentence length (words per sentence).
 */
function avgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  const totalWords = sentences.reduce(
    (sum, s) => sum + s.split(/\s+/).filter((w) => w.length > 0).length,
    0
  );

  return totalWords / sentences.length;
}

registerCheck({
  id: "T5-11",
  name: "Audience Alignment",
  tier: 5,
  category: "voice-tone",
  severity: "low",
  autoEditable: false, // Requires editorial judgment
  editRecipe: "Simplify language, define acronyms, reduce sentence length for broader audience",
  // NOT blocking - quality recommendation
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;
    const text = $("body").text();
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

    if (wordCount < 200) {
      return {
        checkId: "T5-11",
        passed: true,
        severity: "info",
        message: "Content too short to analyze audience alignment",
        autoEditable: false,
      };
    }

    // Count jargon instances
    let jargonCount = 0;
    for (const pattern of JARGON_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) jargonCount += matches.length;
    }

    // Calculate metrics
    const jargonDensity = (jargonCount / wordCount) * 100;
    const complexWordCount = countComplexWords(text);
    const complexWordRatio = (complexWordCount / wordCount) * 100;
    const avgSentLen = avgSentenceLength(text);

    // Ideal targets:
    // - Jargon density < 5%
    // - Complex word ratio < 15%
    // - Average sentence length 15-25 words

    const hasExcessiveJargon = jargonDensity > 5;
    const hasExcessiveComplexity = complexWordRatio > 20;
    const hasPoorReadability = avgSentLen > 30 || avgSentLen < 8;

    const passed = !hasExcessiveJargon && !hasExcessiveComplexity && !hasPoorReadability;

    // Calculate score
    let score = 100;
    if (hasExcessiveJargon) score -= 20;
    if (hasExcessiveComplexity) score -= 20;
    if (hasPoorReadability) score -= 20;
    if (jargonDensity > 10) score -= 20; // Very high jargon
    if (avgSentLen > 35) score -= 10; // Very long sentences

    score = Math.max(0, score);

    let message = "";
    if (passed) {
      message = `Good audience alignment: ${jargonDensity.toFixed(1)}% jargon, ${avgSentLen.toFixed(0)} avg words/sentence`;
    } else if (hasExcessiveJargon) {
      message = `High jargon density: ${jargonDensity.toFixed(1)}% - consider defining terms or simplifying`;
    } else if (hasExcessiveComplexity) {
      message = `High complexity: ${complexWordRatio.toFixed(1)}% complex words - consider simplifying`;
    } else {
      message = `Readability issues: avg ${avgSentLen.toFixed(0)} words/sentence (ideal: 15-25)`;
    }

    return {
      checkId: "T5-11",
      passed,
      severity: passed ? "info" : "low",
      message,
      details: {
        score: Math.round(score),
        jargonCount,
        jargonDensity: Math.round(jargonDensity * 10) / 10,
        complexWordCount,
        complexWordRatio: Math.round(complexWordRatio * 10) / 10,
        avgSentenceLength: Math.round(avgSentLen * 10) / 10,
      },
      autoEditable: false,
      // No blocking field - this check is advisory only
    };
  },
});
