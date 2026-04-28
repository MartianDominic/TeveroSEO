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
        passed: false,
        severity: "info",
        message: "Skipped: Site crawl data not available",
        details: { skipped: true, reason: "SiteContext required" },
        autoEditable: false,
      };
    }

    // Extract main content text
    const $ = ctx.$;
    $("script, style, noscript, nav, footer, header, aside").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();

    if (text.length < 500) {
      return {
        checkId: "T4-06",
        passed: true,
        severity: "info",
        message: "Content too short for similarity analysis",
        details: { skipped: true, contentLength: text.length },
        autoEditable: false,
      };
    }

    // Calculate fingerprint for this page
    const fingerprint = contentFingerprint(text);

    // Without other page fingerprints in context, we can only prepare the hash
    return {
      checkId: "T4-06",
      passed: true,
      severity: "info",
      message: "Content fingerprint computed; cross-page comparison requires full crawl data",
      details: {
        skipped: true,
        reason: "Page fingerprints not in SiteContext",
        fingerprint,
        contentLength: text.length,
        note: "Enable crawl fingerprinting to detect duplicate content",
      },
      autoEditable: false,
    };
  },
});

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

    // Analyze page for template patterns
    const $ = ctx.$;
    $("script, style, noscript").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();

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
