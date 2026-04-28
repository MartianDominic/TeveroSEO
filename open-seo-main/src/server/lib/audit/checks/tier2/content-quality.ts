/**
 * Tier 2 Content Quality Metrics (T2-01 to T2-05)
 * Phase 32: 107 SEO Checks Implementation
 *
 * These checks require light computation on text content.
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, ExtendedPageAnalysis } from "../types";

/**
 * Count syllables in a word using standard heuristics.
 * Rules:
 * 1. Count vowel groups (a, e, i, o, u, y)
 * 2. Subtract 1 for silent 'e' at end
 * 3. Minimum 1 syllable per word
 */
function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.length <= 2) return 1;

  // Count vowel groups
  const vowelGroups = lower.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Subtract for silent e at end (but not "le" endings like "table")
  if (lower.endsWith("e") && !lower.endsWith("le")) {
    count = Math.max(1, count - 1);
  }

  // Subtract for common silent endings
  if (lower.endsWith("es") || lower.endsWith("ed")) {
    count = Math.max(1, count - 1);
  }

  return Math.max(1, count);
}

/**
 * Extract plain text from HTML, excluding scripts and styles.
 */
function extractText($: CheckContext["$"]): string {
  // Remove scripts and styles
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

/**
 * Count words in text.
 */
function countWords(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/**
 * Count sentences in text.
 */
function countSentences(text: string): number {
  // Split on sentence-ending punctuation
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return Math.max(1, sentences.length);
}

/**
 * Calculate Flesch Reading Ease score.
 * Formula: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
 *
 * Score interpretation:
 * - 90-100: 5th grade (very easy)
 * - 80-89: 6th grade (easy)
 * - 70-79: 7th grade (fairly easy)
 * - 60-69: 8-9th grade (standard)
 * - 50-59: 10-12th grade (fairly difficult)
 * - 30-49: College (difficult)
 * - 0-29: Graduate (very difficult)
 */
function calculateFleschReadingEase(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  const sentenceCount = countSentences(text);
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllableCount / wordCount;

  const score = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Flesch-Kincaid Grade Level.
 * Formula: 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59
 *
 * Returns grade level (e.g., 9 = 9th grade).
 */
function calculateFleschKincaidGrade(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  const sentenceCount = countSentences(text);
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllableCount / wordCount;

  const grade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

/**
 * T2-01: Reading level <= Grade 9
 * AEO readability requirement for AI visibility.
 */
registerCheck({
  id: "T2-01",
  name: "Reading level <= Grade 9",
  tier: 2,
  category: "content-quality",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Simplify sentences: break long sentences, use shorter words, reduce jargon",
  run: (ctx: CheckContext): CheckResult => {
    const text = extractText(ctx.$);
    const wordCount = countWords(text);

    // Skip if too little content
    if (wordCount < 50) {
      return {
        checkId: "T2-01",
        passed: true,
        severity: "info",
        message: "Content too short for reliable readability analysis",
        details: { wordCount, skipped: true },
        autoEditable: false,
      };
    }

    const gradeLevel = calculateFleschKincaidGrade(text);
    const fleschScore = calculateFleschReadingEase(text);
    const passed = gradeLevel <= 9;

    return {
      checkId: "T2-01",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `Reading level is Grade ${gradeLevel} (target: <= 9)`
        : `Reading level is Grade ${gradeLevel}, should be Grade 9 or lower for optimal AI visibility`,
      details: {
        gradeLevel,
        fleschReadingEase: Math.round(fleschScore),
        wordCount,
        targetGrade: 9,
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : "Simplify sentences: break long sentences, use shorter words, reduce jargon",
    };
  },
});

/**
 * T2-02: Keyword density < 3%
 * Over-optimization risk if keyword appears too frequently.
 */
registerCheck({
  id: "T2-02",
  name: "Keyword density < 3%",
  tier: 2,
  category: "content-quality",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Reduce keyword repetition: use synonyms, remove redundant mentions",
  run: (ctx: CheckContext): CheckResult => {
    const text = extractText(ctx.$);
    const wordCount = countWords(text);

    // Skip if no keyword provided
    if (!ctx.keyword) {
      return {
        checkId: "T2-02",
        passed: true,
        severity: "info",
        message: "No keyword provided for density analysis",
        details: { skipped: true },
        autoEditable: false,
      };
    }

    // Skip if too little content
    if (wordCount < 50) {
      return {
        checkId: "T2-02",
        passed: true,
        severity: "info",
        message: "Content too short for keyword density analysis",
        details: { wordCount, skipped: true },
        autoEditable: false,
      };
    }

    // Count keyword occurrences (case-insensitive, word boundaries)
    const keywordLower = ctx.keyword.toLowerCase();
    const textLower = text.toLowerCase();
    const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = textLower.match(regex);
    const keywordCount = matches ? matches.length : 0;

    const density = (keywordCount / wordCount) * 100;
    const passed = density < 3;

    return {
      checkId: "T2-02",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `Keyword density is ${density.toFixed(2)}% (target: < 3%)`
        : `Keyword density is ${density.toFixed(2)}%, exceeds 3% threshold (over-optimization risk)`,
      details: {
        keyword: ctx.keyword,
        keywordCount,
        wordCount,
        density: Math.round(density * 100) / 100,
        threshold: 3,
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : "Reduce keyword repetition: use synonyms, remove redundant mentions",
    };
  },
});

/**
 * Word count benchmarks by query type.
 */
const WORD_COUNT_BENCHMARKS: Record<string, { min: number; max: number; label: string }> = {
  informational: { min: 1500, max: 2500, label: "Informational" },
  transactional: { min: 500, max: 1000, label: "Transactional" },
  commercial: { min: 800, max: 1500, label: "Commercial" },
  navigational: { min: 300, max: 600, label: "Navigational" },
  default: { min: 800, max: 1800, label: "General" },
};

/**
 * T2-03: Word count by query type
 * Compare content length to benchmark ranges.
 */
registerCheck({
  id: "T2-03",
  name: "Word count by query type",
  tier: 2,
  category: "content-quality",
  severity: "low",
  autoEditable: true,
  editRecipe: "Adjust content length to match query type benchmark",
  run: (ctx: CheckContext): CheckResult => {
    const text = extractText(ctx.$);
    const wordCount = countWords(text);

    // Determine query type from page analysis or default
    const extendedAnalysis = ctx.pageAnalysis as ExtendedPageAnalysis | undefined;
    const queryType = extendedAnalysis?.queryType ?? "default";
    const benchmark = WORD_COUNT_BENCHMARKS[queryType] ?? WORD_COUNT_BENCHMARKS.default;

    const passed = wordCount >= benchmark.min && wordCount <= benchmark.max;
    const belowMin = wordCount < benchmark.min;

    return {
      checkId: "T2-03",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `Word count (${wordCount}) is within ${benchmark.label} benchmark (${benchmark.min}-${benchmark.max})`
        : belowMin
          ? `Word count (${wordCount}) is below ${benchmark.label} minimum of ${benchmark.min}`
          : `Word count (${wordCount}) exceeds ${benchmark.label} maximum of ${benchmark.max}`,
      details: {
        wordCount,
        queryType,
        benchmark: benchmark.label,
        minWords: benchmark.min,
        maxWords: benchmark.max,
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : belowMin
          ? `Add ${benchmark.min - wordCount} more words to meet ${benchmark.label} benchmark`
          : `Consider trimming content or splitting into multiple pages`,
    };
  },
});

/**
 * T2-04: Statistics every 150-200 words
 * Presence of data/statistics improves AI visibility by 37%.
 */
registerCheck({
  id: "T2-04",
  name: "Statistics every 150-200 words",
  tier: 2,
  category: "content-quality",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add statistics, percentages, or data points throughout content",
  run: (ctx: CheckContext): CheckResult => {
    const text = extractText(ctx.$);
    const wordCount = countWords(text);

    // Skip if too little content
    if (wordCount < 200) {
      return {
        checkId: "T2-04",
        passed: true,
        severity: "info",
        message: "Content too short for statistics density analysis",
        details: { wordCount, skipped: true },
        autoEditable: false,
      };
    }

    // Match statistics patterns: numbers with context
    // Patterns: percentages, large numbers, comparisons
    const statPatterns = [
      /\d+%/g, // Percentages
      /\d{1,3}(?:,\d{3})+/g, // Large numbers with commas
      /\d+(?:\.\d+)?\s*(?:million|billion|trillion)/gi, // Millions/billions
      /\d+x\b/gi, // Multipliers (e.g., "3x faster")
      /\$\d+/g, // Money amounts
      /\d+\s*(?:times|percent|%|points)/gi, // Comparisons
    ];

    let statCount = 0;
    for (const pattern of statPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        statCount += matches.length;
      }
    }

    // Target: 1 stat per 150-200 words
    const expectedStats = Math.floor(wordCount / 175);
    const passed = statCount >= expectedStats;

    return {
      checkId: "T2-04",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `Found ${statCount} statistics (target: ${expectedStats}+ for ${wordCount} words)`
        : `Found only ${statCount} statistics, should have ${expectedStats}+ for ${wordCount} words`,
      details: {
        statisticsFound: statCount,
        expectedStatistics: expectedStats,
        wordCount,
        targetRatio: "1 per 150-200 words",
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : `Add ${expectedStats - statCount} more statistics, percentages, or data points`,
    };
  },
});

/**
 * T2-05: Section word count 167-278
 * Kyle Roof's LSI development specification.
 */
registerCheck({
  id: "T2-05",
  name: "Section word count 167-278",
  tier: 2,
  category: "content-quality",
  severity: "low",
  autoEditable: true,
  editRecipe: "Adjust section lengths to 167-278 words for optimal LSI development",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;

    // Get all H2 sections
    const h2Elements = $("h2");
    if (h2Elements.length === 0) {
      return {
        checkId: "T2-05",
        passed: true,
        severity: "info",
        message: "No H2 sections found for section analysis",
        details: { sectionCount: 0, skipped: true },
        autoEditable: false,
      };
    }

    const sections: Array<{ heading: string; wordCount: number; inRange: boolean }> = [];

    h2Elements.each((i, el) => {
      const headingText = $(el).text().trim();

      // Get content until next H2 or end
      let content = "";
      let current = $(el).next();

      while (current.length > 0 && !current.is("h2")) {
        content += " " + current.text();
        current = current.next();
      }

      const sectionWordCount = countWords(content);
      const inRange = sectionWordCount >= 167 && sectionWordCount <= 278;

      sections.push({
        heading: headingText.substring(0, 50),
        wordCount: sectionWordCount,
        inRange,
      });
    });

    const sectionsInRange = sections.filter((s) => s.inRange).length;
    const totalSections = sections.length;
    const percentInRange = (sectionsInRange / totalSections) * 100;

    // Pass if at least 70% of sections are in range
    const passed = percentInRange >= 70;

    return {
      checkId: "T2-05",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `${sectionsInRange}/${totalSections} sections (${percentInRange.toFixed(0)}%) are within 167-278 words`
        : `Only ${sectionsInRange}/${totalSections} sections (${percentInRange.toFixed(0)}%) are within 167-278 words (target: 70%+)`,
      details: {
        totalSections,
        sectionsInRange,
        percentInRange: Math.round(percentInRange),
        targetRange: "167-278 words",
        sections: sections.slice(0, 10), // Limit details to first 10
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : "Adjust section lengths: expand short sections, split long sections",
    };
  },
});

// Export check IDs for documentation
export const contentQualityCheckIds = ["T2-01", "T2-02", "T2-03", "T2-04", "T2-05"];
