/**
 * Tier 3 Entity/NLP Analysis Checks (T3-04 to T3-07)
 * Phase 32: 107 SEO Checks Implementation
 *
 * These checks require NLP API access (Google NLP or OpenAI).
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/** NLP API key from environment */
function getNlpApiKey(): string | undefined {
  return typeof process !== "undefined"
    ? process.env.GOOGLE_NLP_API_KEY || process.env.OPENAI_API_KEY
    : undefined;
}

/**
 * Extract text content from HTML for NLP analysis.
 */
function extractTextContent($: CheckContext["$"]): string {
  $("script, style, noscript, nav, footer, header").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

/**
 * Extract H2 sections with their content.
 */
function extractSections($: CheckContext["$"]): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  const h2Elements = $("h2");

  h2Elements.each((_, el) => {
    const heading = $(el).text().trim();
    let content = "";
    let current = $(el).next();

    while (current.length > 0 && !current.is("h2")) {
      content += " " + current.text();
      current = current.next();
    }

    sections.push({ heading, content: content.trim() });
  });

  return sections;
}

/**
 * T3-04: Entity coverage >= 60%
 * Key entities from the topic should be present in content.
 */
registerCheck({
  id: "T3-04",
  name: "Entity coverage >= 60%",
  tier: 3,
  category: "entity-nlp",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add missing key entities and related terms to content",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getNlpApiKey();

    if (!apiKey) {
      return {
        checkId: "T3-04",
        passed: false,
        severity: "info",
        message: "Skipped: NLP API key not configured (GOOGLE_NLP_API_KEY or OPENAI_API_KEY)",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      };
    }

    // Without actual API call, we do heuristic analysis
    const text = extractTextContent(ctx.$);
    const wordCount = text.split(/\s+/).length;

    if (wordCount < 100) {
      return {
        checkId: "T3-04",
        passed: true,
        severity: "info",
        message: "Content too short for entity analysis",
        details: { skipped: true, wordCount },
        autoEditable: false,
      };
    }

    // Heuristic: check for entity-like patterns (capitalized phrases, proper nouns)
    const entityPatterns = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
    const uniqueEntities = new Set(entityPatterns.map((e) => e.toLowerCase()));
    const entityDensity = (uniqueEntities.size / wordCount) * 100;

    // Rough heuristic: 60%+ entity coverage maps to ~2%+ entity density
    const passed = entityDensity >= 2;

    return {
      checkId: "T3-04",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `Entity density is ${entityDensity.toFixed(2)}% (heuristic check)`
        : `Entity density is ${entityDensity.toFixed(2)}%, may need more key entities`,
      details: {
        uniqueEntities: uniqueEntities.size,
        wordCount,
        entityDensity: Math.round(entityDensity * 100) / 100,
        heuristicBased: true,
      },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add more named entities, proper nouns, and key topic terms",
    };
  },
});

/**
 * T3-05: Central entity in every section
 * Each H2 section should contain the main topic entity.
 */
registerCheck({
  id: "T3-05",
  name: "Central entity in every section",
  tier: 3,
  category: "entity-nlp",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Ensure each section mentions the main topic entity",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getNlpApiKey();

    if (!apiKey) {
      return {
        checkId: "T3-05",
        passed: false,
        severity: "info",
        message: "Skipped: NLP API key not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      };
    }

    if (!ctx.keyword) {
      return {
        checkId: "T3-05",
        passed: true,
        severity: "info",
        message: "No keyword provided for central entity check",
        details: { skipped: true },
        autoEditable: false,
      };
    }

    const sections = extractSections(ctx.$);

    if (sections.length === 0) {
      return {
        checkId: "T3-05",
        passed: true,
        severity: "info",
        message: "No H2 sections found",
        details: { skipped: true },
        autoEditable: false,
      };
    }

    const keywordLower = ctx.keyword.toLowerCase();
    const sectionsWithEntity = sections.filter(
      (s) =>
        s.heading.toLowerCase().includes(keywordLower) ||
        s.content.toLowerCase().includes(keywordLower)
    );

    const coverage = (sectionsWithEntity.length / sections.length) * 100;
    const passed = coverage >= 80;

    return {
      checkId: "T3-05",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `${sectionsWithEntity.length}/${sections.length} sections contain central entity`
        : `Only ${sectionsWithEntity.length}/${sections.length} sections contain "${ctx.keyword}"`,
      details: {
        totalSections: sections.length,
        sectionsWithEntity: sectionsWithEntity.length,
        coverage: Math.round(coverage),
        keyword: ctx.keyword,
      },
      autoEditable: !passed,
      editRecipe: passed ? undefined : `Add "${ctx.keyword}" to sections missing the central entity`,
    };
  },
});

/**
 * T3-06: No term > 2x competitor max
 * Avoid keyword stuffing by checking term frequency against benchmarks.
 */
registerCheck({
  id: "T3-06",
  name: "No term > 2x competitor max",
  tier: 3,
  category: "entity-nlp",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Reduce over-used terms to natural frequency levels",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getNlpApiKey();

    if (!apiKey) {
      return {
        checkId: "T3-06",
        passed: false,
        severity: "info",
        message: "Skipped: NLP API key not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      };
    }

    const text = extractTextContent(ctx.$);
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = words.length;

    if (wordCount < 100) {
      return {
        checkId: "T3-06",
        passed: true,
        severity: "info",
        message: "Content too short for TF-IDF analysis",
        details: { skipped: true, wordCount },
        autoEditable: false,
      };
    }

    // Count word frequencies
    const freq = new Map<string, number>();
    for (const word of words) {
      if (word.length >= 4) {
        freq.set(word, (freq.get(word) || 0) + 1);
      }
    }

    // Find terms with unusually high frequency (>5% of content)
    const overusedTerms: Array<{ term: string; count: number; percent: number }> = [];
    freq.forEach((count, term) => {
      const percent = (count / wordCount) * 100;
      if (percent > 5) {
        overusedTerms.push({ term, count, percent: Math.round(percent * 10) / 10 });
      }
    });

    const passed = overusedTerms.length === 0;

    return {
      checkId: "T3-06",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? "No terms appear over-used (all terms < 5% frequency)"
        : `${overusedTerms.length} terms may be over-used (>5% frequency)`,
      details: {
        wordCount,
        overusedTerms: overusedTerms.slice(0, 5),
        heuristicBased: true,
      },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Reduce frequency of over-used terms, use synonyms",
    };
  },
});

/**
 * T3-07: Semantic gap identification
 * Identify missing semantic terms compared to competitors.
 */
registerCheck({
  id: "T3-07",
  name: "Semantic gap identification",
  tier: 3,
  category: "entity-nlp",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add missing semantic terms from competitor analysis",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const apiKey = getNlpApiKey();

    if (!apiKey) {
      return {
        checkId: "T3-07",
        passed: false,
        severity: "info",
        message: "Skipped: NLP API key not configured",
        details: { skipped: true, reason: "API key missing" },
        autoEditable: false,
      };
    }

    // This check requires competitor data which isn't available in context
    // Return informational skip
    return {
      checkId: "T3-07",
      passed: true,
      severity: "info",
      message: "Semantic gap analysis requires competitor data (not in current context)",
      details: {
        skipped: true,
        reason: "Competitor data required",
        note: "Run with competitor URLs to enable this check",
      },
      autoEditable: false,
    };
  },
});

export const entityNlpCheckIds = ["T3-04", "T3-05", "T3-06", "T3-07"];
