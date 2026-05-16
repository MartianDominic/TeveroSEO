/**
 * Variable Detection Service
 * Phase 102-10: Task 3 - Variable detector
 *
 * Detects explicit variables ({{var}}) and implicit variables
 * (company names, prices, dates, domains, etc.) in document content.
 *
 * Supports Lithuanian content (UAB, AB, MB company prefixes).
 */

import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Variable type classification.
 */
export type VariableType =
  | "company_name"
  | "contact_name"
  | "contact_email"
  | "price"
  | "date"
  | "domain"
  | "percentage"
  | "custom";

/**
 * Position of a variable occurrence in text.
 */
export interface VariablePosition {
  start: number;
  end: number;
}

/**
 * A detected variable in content.
 */
export interface DetectedVariable {
  id: string;
  originalText: string;
  variablePath: string;
  suggestedVariable: string;
  variableType: VariableType;
  confidence: number;
  occurrences: number;
  positions: VariablePosition[];
}

/**
 * Result of variable detection.
 */
export interface VariableDetectionResult {
  /** Explicitly declared variables ({{...}}) */
  explicit: DetectedVariable[];
  /** Implicitly detected variables (company names, prices, etc.) */
  implicit: DetectedVariable[];
}

// ---------------------------------------------------------------------------
// Regex Patterns
// ---------------------------------------------------------------------------

/**
 * Explicit variable pattern: {{path.to.value}}
 */
const EXPLICIT_VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

/**
 * Lithuanian company prefixes (UAB, AB, MB, etc.)
 */
const LT_COMPANY_PATTERN = /\b(UAB|AB|MB)\s+([A-ZĄČĘĖĮŠŲŪŽa-ząčęėįšųūž][A-ZĄČĘĖĮŠŲŪŽa-ząčęėįšųūž\s]+?)(?=\s+(?:yra|buvo|tapo|,|\.|\s*$)|\s*[,\.])/gi;

/**
 * Common company name patterns (ending in LLC, Inc, Ltd, etc.)
 */
const COMPANY_SUFFIX_PATTERN = /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s*(LLC|Inc\.?|Ltd\.?|Corp\.?|GmbH|S\.A\.?|Co\.?)\b/g;

/**
 * CamelCase or PascalCase company names (TeveroSEO, GitHub, LinkedIn)
 * Matches words with mixed case that look like brand names.
 */
const CAMELCASE_COMPANY_PATTERN = /\b([A-Z][a-z]+(?:[A-Z][A-Za-z]*)+)\b/g;

/**
 * Currency amounts with various formats
 */
const CURRENCY_PATTERN = /(?:(?:€|EUR|\$|USD|£|GBP)\s*)?(\d{1,3}(?:[,\s]?\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|EUR|\$|USD|£|GBP|per\s+month|\/month|\/mo)?/gi;

/**
 * Percentage values
 */
const PERCENTAGE_PATTERN = /(\d+(?:[.,]\d+)?)\s*%/g;

/**
 * Date patterns
 */
const DATE_PATTERNS = [
  /\b(\d{4})-(\d{2})-(\d{2})\b/g, // ISO
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi, // US text
  /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi, // EU text
  /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/g, // Numeric
];

/**
 * Domain/URL patterns
 */
const DOMAIN_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z]{2,})+)(?:\/\S*)?\b/gi;

/**
 * Email pattern
 */
const EMAIL_PATTERN = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Find all occurrences of a pattern and their positions.
 */
function findAllMatches(
  text: string,
  pattern: RegExp,
  extractor: (match: RegExpMatchArray) => string
): Array<{ text: string; positions: VariablePosition[] }> {
  const results = new Map<string, VariablePosition[]>();
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const regex = new RegExp(pattern.source, flags);

  let match;
  while ((match = regex.exec(text)) !== null) {
    const extracted = extractor(match);
    if (!extracted) continue;

    const position: VariablePosition = {
      start: match.index,
      end: match.index + match[0].length,
    };

    if (results.has(extracted)) {
      results.get(extracted)!.push(position);
    } else {
      results.set(extracted, [position]);
    }
  }

  return Array.from(results.entries()).map(([text, positions]) => ({
    text,
    positions,
  }));
}

/**
 * Generate a suggested variable path based on type and content.
 */
function suggestVariablePath(type: VariableType, originalText: string): string {
  switch (type) {
    case "company_name":
      return "prospect.company";
    case "contact_name":
      return "prospect.contact_name";
    case "contact_email":
      return "prospect.email";
    case "price":
      // Try to infer tier from context
      if (/basic|start|entry/i.test(originalText)) return "pricing.basic";
      if (/premium|pro|advanced/i.test(originalText)) return "pricing.premium";
      if (/enterprise|unlimited/i.test(originalText)) return "pricing.enterprise";
      return "pricing.amount";
    case "date":
      if (/valid|expir/i.test(originalText)) return "dates.expiration";
      return "dates.proposal_date";
    case "domain":
      return "prospect.domain";
    case "percentage":
      if (/growth|increase/i.test(originalText)) return "seo_data.growth_percent";
      if (/ctr/i.test(originalText)) return "seo_data.ctr";
      return "seo_data.metric_percent";
    default:
      return "custom.value";
  }
}

/**
 * Check if a currency match is actually a price (not just a number).
 */
function isValidPrice(match: string): boolean {
  // Must have currency symbol or word
  const hasCurrencySymbol = /[€$£]|EUR|USD|GBP/i.test(match);
  if (!hasCurrencySymbol) {
    // Must be followed by "per month" or similar
    const hasMonthlyIndicator = /per\s+month|\/month|\/mo/i.test(match);
    if (!hasMonthlyIndicator) {
      // Must be a significant amount (at least 3 digits or have thousands separator)
      const numPart = match.replace(/[^\d.,]/g, "");
      if (numPart.length < 3 && !/[,\s]/.test(numPart)) {
        return false;
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main Detection Function
// ---------------------------------------------------------------------------

/**
 * Detect variables in document content.
 *
 * Finds both explicit variables ({{path.to.value}}) and implicit
 * variables (company names, prices, dates, etc.).
 *
 * @param text - The document text to analyze
 * @returns Detection result with explicit and implicit variables
 */
export function detectVariables(text: string): VariableDetectionResult {
  const explicit: DetectedVariable[] = [];
  const implicit: DetectedVariable[] = [];

  if (!text || text.trim().length === 0) {
    return { explicit, implicit };
  }

  // ---------------------------------------------------------------------------
  // 1. Detect explicit variables
  // ---------------------------------------------------------------------------
  const explicitMatches = findAllMatches(text, EXPLICIT_VARIABLE_PATTERN, (m) => m[0]);

  for (const match of explicitMatches) {
    const variablePath = match.text.slice(2, -2); // Remove {{ and }}
    explicit.push({
      id: `var-${nanoid(8)}`,
      originalText: match.text,
      variablePath,
      suggestedVariable: match.text, // Already in correct format
      variableType: "custom",
      confidence: 100, // Explicit variables are certain
      occurrences: match.positions.length,
      positions: match.positions,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Detect Lithuanian company names
  // ---------------------------------------------------------------------------
  const ltCompanyMatches = findAllMatches(text, LT_COMPANY_PATTERN, (m) => `${m[1]} ${m[2]}`.trim());

  for (const match of ltCompanyMatches) {
    implicit.push({
      id: `var-${nanoid(8)}`,
      originalText: match.text,
      variablePath: "prospect.company",
      suggestedVariable: "{{prospect.company}}",
      variableType: "company_name",
      confidence: 90,
      occurrences: match.positions.length,
      positions: match.positions,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Detect company names with suffixes (LLC, Inc, etc.)
  // ---------------------------------------------------------------------------
  const suffixCompanyMatches = findAllMatches(text, COMPANY_SUFFIX_PATTERN, (m) => m[0]);

  for (const match of suffixCompanyMatches) {
    implicit.push({
      id: `var-${nanoid(8)}`,
      originalText: match.text,
      variablePath: "prospect.company",
      suggestedVariable: "{{prospect.company}}",
      variableType: "company_name",
      confidence: 85,
      occurrences: match.positions.length,
      positions: match.positions,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Detect CamelCase company names (TeveroSEO, GitHub)
  // ---------------------------------------------------------------------------
  const camelCaseMatches = findAllMatches(text, CAMELCASE_COMPANY_PATTERN, (m) => m[1]);

  // Filter out common words
  const commonWords = new Set(["JavaScript", "TypeScript", "LinkedIn", "YouTube", "Facebook", "Instagram"]);

  for (const match of camelCaseMatches) {
    if (!commonWords.has(match.text)) {
      // Check if already found as LT or suffix company
      const alreadyFound = implicit.some((v) => v.originalText.includes(match.text));
      if (!alreadyFound) {
        implicit.push({
          id: `var-${nanoid(8)}`,
          originalText: match.text,
          variablePath: "prospect.company",
          suggestedVariable: "{{prospect.company}}",
          variableType: "company_name",
          confidence: 70,
          occurrences: match.positions.length,
          positions: match.positions,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Detect currency/prices
  // ---------------------------------------------------------------------------
  const currencyMatches = findAllMatches(text, CURRENCY_PATTERN, (m) => m[0].trim());

  for (const match of currencyMatches) {
    if (isValidPrice(match.text)) {
      const variablePath = suggestVariablePath("price", match.text);
      implicit.push({
        id: `var-${nanoid(8)}`,
        originalText: match.text,
        variablePath,
        suggestedVariable: `{{${variablePath}}}`,
        variableType: "price",
        confidence: 80,
        occurrences: match.positions.length,
        positions: match.positions,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Detect percentages
  // ---------------------------------------------------------------------------
  const percentMatches = findAllMatches(text, PERCENTAGE_PATTERN, (m) => m[0]);

  for (const match of percentMatches) {
    const contextStart = Math.max(0, match.positions[0].start - 20);
    const contextEnd = match.positions[0].end + 20;
    const context = text.slice(contextStart, contextEnd);
    const variablePath = suggestVariablePath("percentage", context);
    implicit.push({
      id: `var-${nanoid(8)}`,
      originalText: match.text,
      variablePath,
      suggestedVariable: `{{${variablePath}}}`,
      variableType: "percentage",
      confidence: 75,
      occurrences: match.positions.length,
      positions: match.positions,
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Detect dates
  // ---------------------------------------------------------------------------
  for (const pattern of DATE_PATTERNS) {
    const dateMatches = findAllMatches(text, pattern, (m) => m[0]);

    for (const match of dateMatches) {
      const contextStart = Math.max(0, match.positions[0].start - 30);
      const context = text.slice(contextStart, match.positions[0].end);
      const variablePath = suggestVariablePath("date", context);
      implicit.push({
        id: `var-${nanoid(8)}`,
        originalText: match.text,
        variablePath,
        suggestedVariable: `{{${variablePath}}}`,
        variableType: "date",
        confidence: 85,
        occurrences: match.positions.length,
        positions: match.positions,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Detect domains/URLs
  // ---------------------------------------------------------------------------
  const domainMatches = findAllMatches(text, DOMAIN_PATTERN, (m) => m[0]);

  for (const match of domainMatches) {
    implicit.push({
      id: `var-${nanoid(8)}`,
      originalText: match.text,
      variablePath: "prospect.domain",
      suggestedVariable: "{{prospect.domain}}",
      variableType: "domain",
      confidence: 90,
      occurrences: match.positions.length,
      positions: match.positions,
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Detect emails
  // ---------------------------------------------------------------------------
  const emailMatches = findAllMatches(text, EMAIL_PATTERN, (m) => m[0]);

  for (const match of emailMatches) {
    implicit.push({
      id: `var-${nanoid(8)}`,
      originalText: match.text,
      variablePath: "prospect.email",
      suggestedVariable: "{{prospect.email}}",
      variableType: "contact_email",
      confidence: 95,
      occurrences: match.positions.length,
      positions: match.positions,
    });
  }

  return { explicit, implicit };
}
