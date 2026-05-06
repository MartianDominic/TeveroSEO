/**
 * T5-09: Voice Consistency
 *
 * Analyzes point-of-view (POV) consistency throughout the content.
 * Checks for mixed usage of first person (I/we), second person (you),
 * and third person (they/one).
 *
 * Blocking: No (quality recommendation)
 * Cost: ~$0.001 (rule-based analysis)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

registerCheck({
  id: "T5-09",
  name: "Voice Consistency",
  tier: 5,
  category: "voice-tone",
  severity: "medium",
  autoEditable: false, // Requires editorial judgment
  // NOT blocking - quality recommendation
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;
    const text = $("body").text();
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

    if (wordCount < 200) {
      return {
        checkId: "T5-09",
        passed: true,
        severity: "info",
        message: "Content too short to analyze voice consistency",
        autoEditable: false,
      };
    }

    // Count POV markers
    const firstPerson = (text.match(/\b(I|we|our|us|my|me)\b/gi) || []).length;
    const secondPerson = (text.match(/\b(you|your|yours|yourself)\b/gi) || [])
      .length;
    const thirdPerson = (
      text.match(/\b(they|their|theirs|one should|one must|it is)\b/gi) || []
    ).length;

    const total = firstPerson + secondPerson + thirdPerson;

    if (total < 10) {
      return {
        checkId: "T5-09",
        passed: true,
        severity: "info",
        message: "Not enough POV markers to analyze voice consistency",
        autoEditable: false,
      };
    }

    // Calculate dominant voice
    const povRatios = [
      { pov: "first", count: firstPerson, label: "First person (I/we)" },
      { pov: "second", count: secondPerson, label: "Second person (you)" },
      { pov: "third", count: thirdPerson, label: "Third person (they/one)" },
    ].sort((a, b) => b.count - a.count);

    const dominantRatio = povRatios[0].count / total;
    const passed = dominantRatio >= 0.5; // Dominant POV should be > 50%

    // Calculate score (0-100)
    const score = Math.min(100, dominantRatio * 100 + 20);

    return {
      checkId: "T5-09",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `Consistent ${povRatios[0].label} voice (${Math.round(dominantRatio * 100)}% of markers)`
        : `Mixed voice POV - ${povRatios[0].label} is only ${Math.round(dominantRatio * 100)}% of markers`,
      details: {
        score: Math.round(score),
        firstPerson,
        secondPerson,
        thirdPerson,
        dominantPov: povRatios[0].pov,
        dominantRatio: Math.round(dominantRatio * 100),
      },
      autoEditable: false,
      // No blocking field - this check is advisory only
    };
  },
});
