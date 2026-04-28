/**
 * Lithuanian Text Normalizer for E-commerce Keyword Intelligence
 *
 * Handles Lithuanian morphological normalization with a cascade:
 * 1. Stanza (best for Baltic languages) - if available
 * 2. Rule-based LEMMA_MAP (domain-specific fallback)
 * 3. Lowercase passthrough (last resort)
 *
 * Lithuanian has 7 grammatical cases that affect all nouns/adjectives.
 * E-commerce category names often use Dative case ("Dažytiems plaukams")
 * while product types use Nominative ("Šampūnas").
 *
 * @example
 * ```typescript
 * const normalizer = new LithuanianNormalizer();
 * normalizer.lemmatize("dažytiems plaukams"); // "dažytas plaukai"
 * normalizer.normalizeForSearch("šampūnas"); // "sampunas"
 * ```
 */

import {
  LEMMA_MAP,
  LITHUANIAN_DIACRITIC_MAP,
} from "../data/lithuanian-lemmas";

/**
 * Stanza pipeline interface for type safety.
 * Stanza is a Python library - this interface is for potential
 * future Node.js bindings or subprocess communication.
 */
interface StanzaPipeline {
  process(text: string): StanzaDocument;
}

interface StanzaDocument {
  sentences: StanzaSentence[];
}

interface StanzaSentence {
  words: StanzaWord[];
}

interface StanzaWord {
  text: string;
  lemma: string;
}

/**
 * Result of lemmatization with metadata about the method used.
 */
export interface LemmatizationResult {
  /** The lemmatized text */
  text: string;
  /** Method used for lemmatization */
  method: "stanza" | "rules" | "passthrough";
  /** Number of words that were lemmatized vs passed through */
  stats: {
    total: number;
    lemmatized: number;
    passedThrough: number;
  };
}

/**
 * Configuration options for LithuanianNormalizer.
 */
export interface LithuanianNormalizerOptions {
  /**
   * Whether to attempt loading Stanza pipeline.
   * Default: false (Stanza requires Python, not available in pure Node.js)
   */
  useStanza?: boolean;

  /**
   * Custom lemma map to merge with the default domain terms.
   */
  customLemmas?: Record<string, string>;

  /**
   * Whether to preserve casing in brand names during alias extraction.
   * Default: false
   */
  preserveBrandCasing?: boolean;
}

/**
 * Lithuanian text normalizer with morphology-aware lemmatization.
 *
 * Designed for hair care e-commerce domain but extensible via custom lemmas.
 */
export class LithuanianNormalizer {
  private readonly lemmaMap: Record<string, string>;
  private readonly diacriticMap: Record<string, string>;
  private readonly preserveBrandCasing: boolean;
  private stanzaPipeline: StanzaPipeline | null = null;

  constructor(options: LithuanianNormalizerOptions = {}) {
    const { customLemmas = {}, preserveBrandCasing = false } = options;

    // Merge default lemmas with custom ones (custom takes precedence)
    this.lemmaMap = { ...LEMMA_MAP, ...customLemmas };
    this.diacriticMap = LITHUANIAN_DIACRITIC_MAP;
    this.preserveBrandCasing = preserveBrandCasing;

    // Note: Stanza initialization is async and requires Python runtime.
    // For pure TypeScript usage, we rely on the rule-based fallback.
    // Stanza can be integrated via subprocess or Python microservice.
    if (options.useStanza) {
      this.initStanza();
    }
  }

  /**
   * Initialize Stanza pipeline (placeholder for future Python integration).
   *
   * In production, this would communicate with a Python microservice
   * running Stanza for Lithuanian lemmatization.
   */
  private initStanza(): void {
    // Stanza requires Python runtime. For production use:
    // 1. Run a Python FastAPI service with Stanza
    // 2. Call it via HTTP from this normalizer
    // 3. Or use child_process to run a Python script
    //
    // Example Python service endpoint:
    // POST /lemmatize { text: "dažytiems plaukams" }
    // Response: { lemmas: ["dažytas", "plaukai"] }
    //
    // For now, we rely entirely on the rule-based approach which
    // is sufficient for domain-specific hair care terminology.
    this.stanzaPipeline = null;
  }

  /**
   * Lemmatize text to nominative case.
   *
   * Uses a cascade:
   * 1. Stanza (if available and working)
   * 2. Rule-based LEMMA_MAP lookup
   * 3. Lowercase passthrough for unknown words
   *
   * @param text - Input text in any Lithuanian case
   * @returns Lemmatized text with nominative forms
   *
   * @example
   * ```typescript
   * normalizer.lemmatize("dažytiems plaukams");
   * // Returns: "dažytas plaukai"
   *
   * normalizer.lemmatize("šampūnai kondicionieriai");
   * // Returns: "šampūnas kondicionierius"
   * ```
   */
  public lemmatize(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    const result = this.lemmatizeWithStats(text);
    return result.text;
  }

  /**
   * Lemmatize with detailed statistics about the process.
   *
   * @param text - Input text to lemmatize
   * @returns Lemmatization result with stats
   */
  public lemmatizeWithStats(text: string): LemmatizationResult {
    if (!text || typeof text !== "string") {
      return {
        text: "",
        method: "passthrough",
        stats: { total: 0, lemmatized: 0, passedThrough: 0 },
      };
    }

    const textLower = text.toLowerCase().trim();

    // Try Stanza first (if available)
    if (this.stanzaPipeline) {
      try {
        const doc = this.stanzaPipeline.process(textLower);
        const lemmas = doc.sentences.flatMap((sent) =>
          sent.words.map((word) => word.lemma)
        );
        return {
          text: lemmas.join(" "),
          method: "stanza",
          stats: {
            total: lemmas.length,
            lemmatized: lemmas.length,
            passedThrough: 0,
          },
        };
      } catch {
        // Fall through to rule-based
      }
    }

    // Rule-based fallback
    const words = textLower.split(/\s+/).filter(Boolean);
    let lemmatizedCount = 0;

    const lemmatizedWords = words.map((word) => {
      const lemma = this.lemmaMap[word];
      if (lemma) {
        lemmatizedCount++;
        return lemma;
      }
      return word;
    });

    return {
      text: lemmatizedWords.join(" "),
      method: "rules",
      stats: {
        total: words.length,
        lemmatized: lemmatizedCount,
        passedThrough: words.length - lemmatizedCount,
      },
    };
  }

  /**
   * Normalize text for search: lemmatize and remove diacritics.
   *
   * This produces a canonical form suitable for:
   * - Database indexing
   * - Fuzzy matching
   * - URL slug generation
   *
   * @param text - Input text
   * @returns Normalized ASCII text without diacritics
   *
   * @example
   * ```typescript
   * normalizer.normalizeForSearch("Šampūnas dažytiems plaukams");
   * // Returns: "sampunas dazytas plaukai"
   * ```
   */
  public normalizeForSearch(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    const lemmatized = this.lemmatize(text);
    return this.removeDiacritics(lemmatized);
  }

  /**
   * Remove Lithuanian diacritics for ASCII-safe output.
   *
   * @param text - Input text with potential diacritics
   * @returns ASCII text with diacritics replaced
   *
   * @example
   * ```typescript
   * normalizer.removeDiacritics("šampūnas");
   * // Returns: "sampunas"
   * ```
   */
  public removeDiacritics(text: string): string {
    if (!text || typeof text !== "string") {
      return "";
    }

    let result = text;
    for (const [diacritic, ascii] of Object.entries(this.diacriticMap)) {
      result = result.split(diacritic).join(ascii);
    }
    return result;
  }

  /**
   * Extract brand name aliases for matching.
   *
   * Generates multiple variations of a brand name to handle:
   * - Case variations
   * - Apostrophe variations (L'Oréal, L'Oreal, LOreal)
   * - Diacritic removal
   * - Special character removal
   *
   * @param name - Brand name (e.g., "L'Oréal")
   * @returns Array of unique aliases for matching
   *
   * @example
   * ```typescript
   * normalizer.extractBrandAliases("L'Oréal");
   * // Returns: ["l'oréal", "loreal", "l'oreal", "loréal", ...]
   *
   * normalizer.extractBrandAliases("Schwarzkopf");
   * // Returns: ["schwarzkopf"]
   * ```
   */
  public extractBrandAliases(name: string): string[] {
    if (!name || typeof name !== "string") {
      return [];
    }

    const aliases = new Set<string>();

    // Original (optionally preserve casing)
    if (this.preserveBrandCasing) {
      aliases.add(name);
    }

    // Lowercase
    const lower = name.toLowerCase();
    aliases.add(lower);

    // Without diacritics
    const noDiacritics = this.removeDiacritics(lower);
    aliases.add(noDiacritics);

    // Handle apostrophe variations
    const apostropheVariants = [
      lower,
      lower.replace(/'/g, "'"), // curly to straight
      lower.replace(/'/g, "'"), // straight to curly
      lower.replace(/['']/g, ""), // remove all apostrophes
    ];

    for (const variant of apostropheVariants) {
      aliases.add(variant);
      aliases.add(this.removeDiacritics(variant));
    }

    // Remove all special characters (keep alphanumeric and spaces)
    const alphanumericOnly = lower.replace(/[^a-zA-ZąčęėįšųūžĄČĘĖĮŠŲŪŽ0-9\s]/g, "");
    aliases.add(alphanumericOnly);
    aliases.add(this.removeDiacritics(alphanumericOnly));

    // Remove spaces as well (for compacted forms)
    const noSpaces = alphanumericOnly.replace(/\s+/g, "");
    if (noSpaces !== alphanumericOnly) {
      aliases.add(noSpaces);
      aliases.add(this.removeDiacritics(noSpaces));
    }

    // Filter out empty strings and return unique array
    return Array.from(aliases).filter(Boolean);
  }

  /**
   * Check if a word exists in the lemma map.
   *
   * @param word - Word to check
   * @returns true if the word has a known lemma
   */
  public hasLemma(word: string): boolean {
    if (!word || typeof word !== "string") {
      return false;
    }
    return word.toLowerCase() in this.lemmaMap;
  }

  /**
   * Get the lemma for a single word.
   *
   * @param word - Word to lemmatize
   * @returns The lemma if found, otherwise the original word lowercased
   */
  public getLemma(word: string): string {
    if (!word || typeof word !== "string") {
      return "";
    }
    const lower = word.toLowerCase();
    return this.lemmaMap[lower] ?? lower;
  }

  /**
   * Get statistics about the lemma map.
   *
   * @returns Object with lemma count and coverage info
   */
  public getStats(): {
    totalLemmas: number;
    hasStanza: boolean;
  } {
    return {
      totalLemmas: Object.keys(this.lemmaMap).length,
      hasStanza: this.stanzaPipeline !== null,
    };
  }

  /**
   * Add custom lemmas to the normalizer at runtime.
   *
   * @param lemmas - Record of inflected form -> lemma mappings
   */
  public addLemmas(lemmas: Record<string, string>): void {
    for (const [inflected, lemma] of Object.entries(lemmas)) {
      this.lemmaMap[inflected.toLowerCase()] = lemma.toLowerCase();
    }
  }

  /**
   * Tokenize text into words.
   *
   * @param text - Input text
   * @returns Array of word tokens
   */
  public tokenize(text: string): string[] {
    if (!text || typeof text !== "string") {
      return [];
    }
    return text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  /**
   * Normalize a category path (e.g., from breadcrumbs).
   *
   * @param categories - Array of category names
   * @returns Array of lemmatized category names
   *
   * @example
   * ```typescript
   * normalizer.normalizeCategoryPath([
   *   "Plaukų priežiūra",
   *   "Šampūnai",
   *   "Dažytiems plaukams"
   * ]);
   * // Returns: ["plaukai priežiūra", "šampūnas", "dažytas plaukai"]
   * ```
   */
  public normalizeCategoryPath(categories: string[]): string[] {
    if (!Array.isArray(categories)) {
      return [];
    }
    return categories.map((cat) => this.lemmatize(cat));
  }
}

// Export a default singleton instance for convenience
export const lithuanianNormalizer = new LithuanianNormalizer();
