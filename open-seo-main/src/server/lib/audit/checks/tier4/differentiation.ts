/**
 * Tier 4 Content Differentiation Checks (T4-06 to T4-07)
 * Phase 32: 107 SEO Checks Implementation
 *
 * These checks analyze content uniqueness across the site.
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, SiteContext } from "../types";

/**
 * Check if SiteContext has required crawl data.
 */
function hasCrawlData(siteContext?: SiteContext): siteContext is SiteContext {
  return !!siteContext && siteContext.totalPages > 0;
}

/**
 * Simple hash function for content fingerprinting.
 * Returns a numeric hash suitable for comparison.
 */
function simpleHash(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  let hash = 0;

  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
  }

  return Math.abs(hash);
}

/**
 * Calculate content fingerprint as hex string.
 */
function contentFingerprint(text: string): string {
  return simpleHash(text).toString(16);
}

/**
 * T4-06: 30-40% unique between similar pages
 * Pages targeting similar keywords should have sufficient content differentiation.
 *
 * FIX-13 (CRIT-SEO-01/02): Changed to passed=true when skipped to avoid
 * negatively impacting score. The duplicate content gate (>60% -> cap at 50)
 * only triggers when duplicatePercent is present in details AND >60%.
 * Skipped checks should be N/A, not failures.
 */
registerCheck({
  id: "T4-06",
  name: "30-40% unique content",
  tier: 4,
  category: "differentiation",
  severity: "high",
  autoEditable: true,
  editRecipe: "Differentiate content: add unique examples, perspectives, or data",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-06",
        passed: true, // FIX-13: N/A should not penalize score
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required", status: "not-applicable" },
        autoEditable: false,
      };
    }

    // Extract main content text using a cloned Cheerio instance
    // to avoid mutating the shared Cheerio state
    const $ = ctx.$;
    const $clone = $.root().clone();
    const $cloned = $.load($clone.html() ?? "");
    $cloned("script, style, noscript, nav, footer, header, aside").remove();
    const text = $cloned("body").text().replace(/\s+/g, " ").trim();

    if (text.length < 500) {
      return {
        checkId: "T4-06",
        passed: true, // FIX-13: N/A should not penalize score
        severity: "info",
        message: "Skipped: Content too short for similarity analysis (min 500 chars)",
        details: { skipped: true, contentLength: text.length, minRequired: 500, status: "not-applicable" },
        autoEditable: false,
      };
    }

    // Calculate fingerprint for this page
    const fingerprint = contentFingerprint(text);

    // Check if SiteContext has pageFingerprints for comparison
    // FIX-13 (CRIT-SEO-02): Implement fingerprint comparison when data available
    const siteContext = ctx.siteContext as SiteContext & { pageFingerprints?: Map<string, string> };
    if (siteContext.pageFingerprints && siteContext.pageFingerprints.size > 0) {
      // Compare against other page fingerprints
      let maxSimilarity = 0;
      let mostSimilarUrl = "";

      for (const [url, otherFingerprint] of siteContext.pageFingerprints) {
        if (url === ctx.url) continue; // Skip self

        // Simple similarity: compare fingerprint characters
        // This is a basic implementation - could be improved with shingle-based comparison
        const similarity = calculateFingerprintSimilarity(fingerprint, otherFingerprint);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          mostSimilarUrl = url;
        }
      }

      // Convert to duplicate percentage (inverse of uniqueness)
      const duplicatePercent = Math.round(maxSimilarity * 100);
      const uniquePercent = 100 - duplicatePercent;
      const passed = uniquePercent >= 30; // At least 30% unique content

      return {
        checkId: "T4-06",
        passed,
        severity: passed ? "info" : duplicatePercent > 60 ? "critical" : "high",
        message: passed
          ? `Page has ${uniquePercent}% unique content (target: >= 30%)`
          : `Page has only ${uniquePercent}% unique content (${duplicatePercent}% duplicate)`,
        details: {
          uniquePercent,
          duplicatePercent, // FIX-13: This enables the scoring gate when >60%
          fingerprint,
          contentLength: text.length,
          mostSimilarUrl: mostSimilarUrl || undefined,
        },
        autoEditable: !passed,
        editRecipe: passed ? undefined : "Differentiate content: add unique examples, perspectives, or data",
      };
    }

    // Without other page fingerprints in context, we cannot evaluate this check
    // FIX-13: Return passed=true so skipped checks don't penalize score
    return {
      checkId: "T4-06",
      passed: true, // FIX-13: N/A should not penalize score
      severity: "info",
      message: "Skipped: Cross-page fingerprint comparison not yet available",
      details: {
        skipped: true,
        reason: "Page fingerprints not in SiteContext",
        status: "not-applicable",
        fingerprint,
        contentLength: text.length,
        note: "Enable site-wide crawl with fingerprinting to detect duplicate content",
      },
      autoEditable: false,
    };
  },
});

/**
 * Calculate similarity between two fingerprints.
 * Returns a value between 0 (no similarity) and 1 (identical).
 * FIX-13: Added to enable duplicate content gate.
 */
function calculateFingerprintSimilarity(fp1: string, fp2: string): number {
  if (fp1 === fp2) return 1;
  if (!fp1 || !fp2) return 0;

  // Convert hex fingerprints to comparable form
  const len = Math.max(fp1.length, fp2.length);
  let matches = 0;

  for (let i = 0; i < len; i++) {
    if (fp1[i] === fp2[i]) matches++;
  }

  return matches / len;
}

/**
 * T4-07: No scaled content patterns
 * Detect template-based content that may trigger scaled content penalties.
 */
registerCheck({
  id: "T4-07",
  name: "No scaled content patterns",
  tier: 4,
  category: "differentiation",
  severity: "critical",
  autoEditable: false,
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    if (!hasCrawlData(ctx.siteContext)) {
      return {
        checkId: "T4-07",
        passed: false,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required" },
        autoEditable: false,
      };
    }

    // Analyze page for template patterns using a cloned Cheerio instance
    // to avoid mutating the shared Cheerio state
    const $ = ctx.$;
    const $clone = $.root().clone();
    const $cloned = $.load($clone.html() ?? "");
    $cloned("script, style, noscript").remove();
    const text = $cloned("body").text().replace(/\s+/g, " ").trim();

    // Check for common scaled content indicators
    const warnings: string[] = [];

    // 1. Placeholder patterns
    const placeholderPatterns = [
      /\[CITY\]/gi,
      /\[LOCATION\]/gi,
      /\[KEYWORD\]/gi,
      /\{CITY\}/gi,
      /\{LOCATION\}/gi,
      /\{\{[^}]+\}\}/g, // Template syntax
      /\$\{[^}]+\}/g, // JS template literals
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(text)) {
        warnings.push("Unfilled template placeholders detected");
        break;
      }
    }

    // 2. Repetitive sentence structures (basic heuristic)
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    if (sentences.length >= 5) {
      const firstWords = sentences.map((s) => s.trim().split(/\s+/).slice(0, 3).join(" ").toLowerCase());
      const wordCounts = new Map<string, number>();
      for (const fw of firstWords) {
        wordCounts.set(fw, (wordCounts.get(fw) || 0) + 1);
      }
      const maxRepeat = Math.max(...Array.from(wordCounts.values()));
      if (maxRepeat >= 3 && maxRepeat / sentences.length > 0.3) {
        warnings.push("Repetitive sentence structures detected");
      }
    }

    // 3. Very short unique content ratio
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;
    if (uniqueRatio < 0.3 && words.length > 200) {
      warnings.push("Low vocabulary diversity (possible template content)");
    }

    const passed = warnings.length === 0;

    return {
      checkId: "T4-07",
      passed,
      severity: passed ? "info" : "critical",
      message: passed
        ? "No scaled content patterns detected"
        : `Potential scaled content detected: ${warnings.join(", ")}`,
      details: {
        warnings,
        uniqueWordRatio: Math.round(uniqueRatio * 100) / 100,
        wordCount: words.length,
        uniqueWordCount: uniqueWords.size,
      },
      autoEditable: false,
    };
  },
});

export const differentiationCheckIds = ["T4-06", "T4-07"];
