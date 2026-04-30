/**
 * Lithuanian Translation Prompt Templates
 * Phase 55: Full Platform Internationalization (i18n)
 *
 * Gemini-optimized prompts for high-quality Lithuanian translations.
 * Includes linguistic rules, formality guidelines, and placeholder handling.
 */

import type { TranslationContext, Formality, Tone } from "./types";

/**
 * System prompt for Lithuanian translation with linguistic rules.
 * Designed for Gemini 1.5 Pro which has strong Lithuanian training data.
 */
export const LITHUANIAN_SYSTEM_PROMPT = `You are an expert Lithuanian translator specializing in B2B SaaS and SEO industry content.

LINGUISTIC RULES:
1. FORMALITY: Use {formality} consistently
   - Formal (jus): "Jus galite...", "Jusu paskyra...", "Prasome..."
   - Informal (tu): "Tu gali...", "Tavo paskyra...", "Prasau..."

2. CASE AGREEMENT: Ensure proper grammatical cases
   - Nominative for subjects
   - Accusative for direct objects
   - Genitive for possession and quantities
   - Dative for indirect objects
   - Instrumental for means/tools
   - Locative for location
   - Vocative for addressing

3. TECHNICAL TERMS: Keep these in English (they're industry standard in Lithuania):
   - SEO, URL, API, CMS, HTML, CSS, JavaScript
   - backlink, keyword, SERP, CTR, ROI
   - dashboard, frontend, backend, database
   - PDF, CSV, JSON, XML

4. BUSINESS TERMS: Use proper Lithuanian business vocabulary:
   - proposal = pasiulymas
   - agreement/contract = sutartis
   - invoice = saskaita faktura
   - client = klientas
   - prospect = potencialus klientas
   - workspace = darbo erdve
   - settings = nustatymai
   - report = ataskaita

5. PLACEHOLDERS: Preserve exactly as written:
   - {{name}}, {{count}}, {{date}}, {{value}}
   - {name}, {count}, {0}, {1}
   - %s, %d, %f
   - Do NOT translate content inside placeholders
   - Do NOT add spaces around placeholders

6. LENGTH CONSTRAINT: {maxLengthInstruction}

7. TONE: Maintain {tone} tone throughout

CONTEXT: {contextDescription}

OUTPUT REQUIREMENTS:
- Provide ONLY the Lithuanian translation
- No explanations, notes, or alternatives
- Preserve all formatting (newlines, bullets, etc.)
- Preserve all HTML tags if present`;

/**
 * Common Lithuanian abbreviations for space-constrained contexts.
 * Used when translations exceed maxLength.
 */
export const LITHUANIAN_ABBREVIATIONS: Record<string, string> = {
  pasiulymas: "pas.",
  nustatymai: "nust.",
  ataskaita: "atask.",
  informacija: "inf.",
  dokumentas: "dok.",
  potencialus: "pot.",
  klientas: "kl.",
  saskaita: "sask.",
  faktura: "fakt.",
  sutartis: "sutr.",
  "saskaita faktura": "SF",
  "darbo erdve": "d.e.",
  veiksmai: "veiks.",
  rezultatai: "rez.",
  statistika: "stat.",
  patvirtinti: "patv.",
  atsaukti: "ats.",
  istrinti: "istr.",
  redaguoti: "red.",
  kopijuoti: "kop.",
  atsisiusti: "ats.",
};

/**
 * Context descriptions for translation prompts.
 */
const CONTEXT_DESCRIPTIONS: Record<string, string> = {
  ui: "UI elements like buttons, labels, menu items, and form fields. Keep concise.",
  proposal:
    "Sales proposals for SEO services. Professional, persuasive, benefit-focused.",
  agreement:
    "Legal contracts and agreements. Formal, precise, legally accurate.",
  email:
    "Transactional emails and notifications. Clear, actionable, appropriately formal.",
  report: "SEO reports and analytics. Technical accuracy, clear data presentation.",
};

/**
 * Tone descriptions for translation prompts.
 */
const TONE_DESCRIPTIONS: Record<Tone, string> = {
  professional:
    "Standard business tone - clear, respectful, and competent.",
  friendly:
    "Warm and approachable while remaining professional. Use softer language.",
  urgent:
    "Action-oriented and time-sensitive. Emphasize importance without being alarming.",
  celebratory:
    "Positive and congratulatory. Express enthusiasm appropriately for business context.",
};

/**
 * Formality descriptions for translation prompts.
 */
const FORMALITY_DESCRIPTIONS: Record<Formality, string> = {
  formal:
    "jus (formal you) - appropriate for business communications, contracts, and professional contexts",
  informal:
    "tu (informal you) - appropriate for casual contexts, internal communications, or when specifically requested",
};

/**
 * Build a complete translation prompt from request parameters.
 *
 * @param context - Translation context with type, formality, tone
 * @param maxLength - Optional maximum character length
 * @returns Formatted system prompt string
 */
export function buildTranslationPrompt(
  context: TranslationContext,
  maxLength?: number
): string {
  const formalityDesc = FORMALITY_DESCRIPTIONS[context.formality];
  const toneDesc = context.tone
    ? TONE_DESCRIPTIONS[context.tone]
    : TONE_DESCRIPTIONS.professional;
  const contextDesc =
    CONTEXT_DESCRIPTIONS[context.type] || CONTEXT_DESCRIPTIONS.ui;

  const maxLengthInstruction = maxLength
    ? `CRITICAL: Maximum ${maxLength} characters. If translation exceeds limit, use shorter synonyms or abbreviations.`
    : "No strict length limit, but keep translations concise where appropriate.";

  return LITHUANIAN_SYSTEM_PROMPT.replace("{formality}", formalityDesc)
    .replace("{maxLengthInstruction}", maxLengthInstruction)
    .replace("{tone}", toneDesc)
    .replace("{contextDescription}", contextDesc);
}

/**
 * Build the user prompt with source text.
 *
 * @param sourceText - Text to translate
 * @returns Formatted user prompt
 */
export function buildUserPrompt(sourceText: string): string {
  return `Translate the following English text to Lithuanian:

"""
${sourceText}
"""

Lithuanian translation:`;
}

/**
 * Build a retry prompt for when translation exceeds maxLength.
 *
 * @param originalTranslation - The too-long translation
 * @param maxLength - Target maximum length
 * @returns Retry prompt
 */
export function buildRetryPrompt(
  originalTranslation: string,
  maxLength: number
): string {
  return `The following Lithuanian translation is ${originalTranslation.length} characters but must be ${maxLength} characters or less.

Original translation:
"""
${originalTranslation}
"""

Shorten it using:
1. Lithuanian abbreviations (pasiulymas -> pas., nustatymai -> nust.)
2. Shorter synonyms
3. Remove unnecessary words

Provide ONLY the shortened translation (max ${maxLength} chars):`;
}
