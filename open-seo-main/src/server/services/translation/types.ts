/**
 * Translation Service Types
 * Phase 55: Full Platform Internationalization (i18n)
 *
 * TypeScript interfaces and type definitions for the translation service.
 * Supports Lithuanian as the primary target language via Gemini API.
 */

/**
 * Supported locale codes.
 * Currently supports English and Lithuanian.
 */
export type SupportedLocale = "en" | "lt";

/**
 * Content context type determines translation style and formality defaults.
 * - ui: Button labels, navigation, form elements
 * - proposal: Sales proposals, quotes
 * - agreement: Legal contracts, terms of service
 * - email: Transactional emails, notifications
 * - report: SEO reports, analytics summaries
 */
export type ContextType = "ui" | "proposal" | "agreement" | "email" | "report";

/**
 * Formality level for Lithuanian translations.
 * - formal: Uses "jus" (you-formal) - appropriate for business
 * - informal: Uses "tu" (you-informal) - appropriate for casual contexts
 */
export type Formality = "formal" | "informal";

/**
 * Business domain for specialized terminology.
 * - seo: SEO-specific terms (backlink, SERP, CTR)
 * - business: General business vocabulary
 * - legal: Legal/contractual terminology
 * - technical: Technical/IT vocabulary
 */
export type Domain = "seo" | "business" | "legal" | "technical";

/**
 * Communication tone for translation style.
 * - professional: Standard business tone
 * - friendly: Warm, approachable tone
 * - urgent: Action-oriented, time-sensitive
 * - celebratory: Positive, congratulatory
 */
export type Tone = "professional" | "friendly" | "urgent" | "celebratory";

/**
 * Translation request parameters.
 */
export interface TranslationRequest {
  /** Text to translate */
  text: string;
  /** Source language (typically English) */
  sourceLang: SupportedLocale;
  /** Target language for translation */
  targetLang: SupportedLocale;
  /** Translation context affecting style and formality */
  context: TranslationContext;
  /** Optional maximum character length for translated text */
  maxLength?: number;
  /**
   * Whether to preserve placeholders like {{name}}, {count}, %s.
   * Defaults to true.
   */
  preservePlaceholders?: boolean;
}

/**
 * Context information affecting translation style.
 */
export interface TranslationContext {
  /** Content type (ui, proposal, agreement, email, report) */
  type: ContextType;
  /** Formality level (formal/informal) */
  formality: Formality;
  /** Optional business domain for specialized vocabulary */
  domain?: Domain;
  /** Optional communication tone */
  tone?: Tone;
  /** Optional workspace ID for custom translation overrides */
  workspaceId?: string;
}

/**
 * Result of a single translation operation.
 */
export interface TranslationResult {
  /** Translated text */
  text: string;
  /** Whether result came from cache */
  cached: boolean;
  /** Confidence score (0-1) based on quality metrics */
  confidence: number;
  /** Optional alternative translations for review */
  alternatives?: string[];
  /** SHA256 hash of source text (for cache lookup) */
  sourceHash?: string;
}

/**
 * Result of a batch translation operation.
 */
export interface BatchTranslationResult {
  /** Individual translation results */
  results: TranslationResult[];
  /** Count of results served from cache */
  totalCached: number;
  /** Count of results requiring API translation */
  totalTranslated: number;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Cached translation record for database storage.
 */
export interface CachedTranslation {
  id: string;
  sourceHash: string;
  sourceText: string;
  sourceLang: SupportedLocale;
  targetLang: SupportedLocale;
  translatedText: string;
  contextType: ContextType;
  formality: Formality;
  translator: string;
  modelVersion: string | null;
  qualityScore: number | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

/**
 * Workspace-specific translation override.
 */
export interface WorkspaceTranslationOverride {
  id: string;
  workspaceId: string;
  messageKey: string;
  language: SupportedLocale;
  customValue: string;
  createdBy: string | null;
  createdAt: Date;
}

/**
 * Translation quality metrics for scoring.
 */
export interface QualityMetrics {
  /** Ratio of translation length to source length */
  lengthRatio: number;
  /** Whether all placeholders were preserved */
  placeholdersPreserved: boolean;
  /** Whether Lithuanian diacritics are present */
  hasLithuanianChars: boolean;
  /** Whether the translation is within max length */
  withinLengthLimit: boolean;
}
