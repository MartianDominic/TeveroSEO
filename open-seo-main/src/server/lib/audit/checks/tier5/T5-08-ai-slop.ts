/**
 * T5-08: AI Slop Detection
 *
 * Detects generic AI-generated content patterns:
 * - Opening phrases like "In today's digital age"
 * - Filler phrases like "it is important to note"
 * - Generic conclusions like "in conclusion"
 *
 * Blocking: Yes (score < 40)
 * Cost: ~$0.002 (rule-based pattern matching)
 *
 * @see 92-CONTEXT.md for Tier 5 specifications
 * @see 92-EXTRACTED-RULES.md for AI slop patterns
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/**
 * AI-generated content patterns that indicate low-quality "slop".
 * From 92-EXTRACTED-RULES.md banned phrases.
 */
const AI_SLOP_PATTERNS: RegExp[] = [
  // Opening phrases (instant red flags)
  /^in today'?s digital (age|world|landscape)/i,
  /^in the world of/i,
  /^in the realm of/i,
  /^when it comes to/i,
  /^it goes without saying/i,
  /^needless to say/i,
  /^as we all know/i,
  /^have you ever wondered/i,
  /^let'?s face it/i,

  // Filler phrases (content padding)
  /\bit is important to note that\b/gi,
  /\bit is worth noting that\b/gi,
  /\bit'?s no secret that\b/gi,
  /\bat the end of the day\b/gi,
  /\bthe bottom line is\b/gi,
  /\ball in all\b/gi,
  /\bthe fact of the matter\b/gi,
  /\ball things considered\b/gi,
  /\bsimply put\b/gi,
  /\bfor what it'?s worth\b/gi,
  /\bthat being said\b/gi,
  /\bwith that said\b/gi,

  // Generic conclusions
  /\bin conclusion\b/gi,
  /\bto conclude\b/gi,
  /\bto sum up\b/gi,
  /\bin summary\b/gi,
  /\bto summarize\b/gi,
  /\bfinal thoughts\b/gi,

  // Hyperbolic phrases
  /\btake your .* to the next level\b/gi,
  /\bunlock (the|your) (full )?potential\b/gi,
  /\bembark on (a|your) journey\b/gi,
  /\bdive (deep )?into\b/gi,
  /\bgame.?changer\b/gi,
  /\bleverage (the power of|your)\b/gi,
  /\bseamlessly integrate\b/gi,
  /\brobust (solution|framework|platform)\b/gi,
  /\bcutting.?edge\b/gi,
  /\bstate.?of.?the.?art\b/gi,
  /\bworld.?class\b/gi,
];

registerCheck({
  id: "T5-08",
  name: "AI Slop Detection",
  tier: 5,
  category: "writing-quality",
  severity: "high",
  autoEditable: true,
  editRecipe: "Remove generic AI-generated phrases and replace with specific, original language",
  blocking: true,
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;
    const text = $("body").text();
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

    if (wordCount < 100) {
      return {
        checkId: "T5-08",
        passed: true,
        severity: "info",
        message: "Content too short for AI slop detection",
        autoEditable: false,
      };
    }

    // Count AI slop patterns
    let slopCount = 0;
    const foundPatterns: string[] = [];

    for (const pattern of AI_SLOP_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        slopCount += matches.length;
        // Limit examples per pattern to avoid huge arrays
        foundPatterns.push(...matches.slice(0, 2));
      }
    }

    // Calculate slop density (per 1000 words)
    const slopDensity = (slopCount / wordCount) * 1000;

    // Score: 100 = no slop, 0 = excessive slop
    // 10 slop items per 1000 words = score 0
    const score = Math.max(0, 100 - slopDensity * 10);
    const passed = score >= 60;
    const isBlocking = !passed && score < 40;

    return {
      checkId: "T5-08",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? `Low AI slop density: ${slopDensity.toFixed(1)} per 1000 words`
        : `High AI slop density: ${slopDensity.toFixed(1)} per 1000 words - ${foundPatterns.slice(0, 3).map((p) => `"${p}"`).join(", ")}`,
      details: {
        slopCount,
        slopDensity: Math.round(slopDensity * 10) / 10,
        score: Math.round(score),
        foundPatterns: foundPatterns.slice(0, 5),
      },
      autoEditable: !passed,
      blocking: isBlocking,
    };
  },
});
