/**
 * EntityExtractor - NLP entity extraction with PII stripping
 * Phase 92: On-Page SEO Mastery
 *
 * Provides:
 * - Named entity extraction (people, places, organizations)
 * - Date and number extraction
 * - Fact density calculation
 * - PII detection and stripping (email, phone, SSN)
 * - Evidence density scoring
 *
 * Requirements: OPM-15 (entity extraction with PII stripping)
 */

import nlp from "compromise";
import dates from "compromise-dates";

// Extend nlp with dates plugin
nlp.plugin(dates);

/**
 * Extracted entities from text
 */
export interface ExtractedEntities {
  people: string[];
  places: string[];
  organizations: string[];
  dates: string[];
  numbers: string[];
  factDensity: number;
}

// PII detection patterns
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const SSN_PATTERN = /\d{3}-\d{2}-\d{4}/g;

/**
 * Clean extracted entity text by removing trailing punctuation.
 */
function cleanEntity(entity: string): string {
  return entity.replace(/[.,;:!?]+$/, "").trim();
}

/**
 * Extract named entities from text using NLP.
 *
 * @param text - Plain text to analyze
 * @returns ExtractedEntities object with categorized entities
 */
export function extractEntities(text: string): ExtractedEntities {
  if (!text || text.trim().length === 0) {
    return {
      people: [],
      places: [],
      organizations: [],
      dates: [],
      numbers: [],
      factDensity: 0,
    };
  }

  const doc = nlp(text);

  // Extract people names
  const people = doc
    .people()
    .out("array")
    .map((p: string) => cleanEntity(p))
    .filter((p: string) => p.length > 0);

  // Extract places
  const places = doc
    .places()
    .out("array")
    .map((p: string) => cleanEntity(p))
    .filter((p: string) => p.length > 0);

  // Extract organizations
  const organizations = doc
    .organizations()
    .out("array")
    .map((o: string) => cleanEntity(o))
    .filter((o: string) => o.length > 0);

  // Extract dates using compromise's date detection
  const extractedDates = doc
    .dates()
    .out("array")
    .map((d: string) => cleanEntity(d))
    .filter((d: string) => d.length > 0);

  // Extract numbers/values
  const numbers = doc
    .values()
    .out("array")
    .map((n: string) => cleanEntity(n))
    .filter((n: string) => n.length > 0);

  // Calculate fact density (entities per 100 words)
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const totalEntities =
    people.length +
    places.length +
    organizations.length +
    extractedDates.length +
    numbers.length;

  const factDensity = wordCount > 0 ? (totalEntities / wordCount) * 100 : 0;

  return {
    people,
    places,
    organizations,
    dates: extractedDates,
    numbers,
    factDensity,
  };
}

/**
 * Strip PII (Personally Identifiable Information) from text.
 * Replaces emails, phone numbers, and SSNs with placeholder tokens.
 *
 * @param text - Text that may contain PII
 * @returns Sanitized text with PII replaced by tokens
 */
export function stripPII(text: string): string {
  let sanitized = text;

  // Replace SSNs first (more specific pattern)
  sanitized = sanitized.replace(SSN_PATTERN, "[SSN]");

  // Replace emails
  sanitized = sanitized.replace(EMAIL_PATTERN, "[EMAIL]");

  // Replace phone numbers
  sanitized = sanitized.replace(PHONE_PATTERN, "[PHONE]");

  return sanitized;
}

/**
 * Check if text contains any PII.
 *
 * @param text - Text to check
 * @returns True if PII is detected
 */
export function containsPII(text: string): boolean {
  return (
    EMAIL_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    SSN_PATTERN.test(text)
  );
}

// Evidence patterns for density calculation
const PERCENTAGE_PATTERN = /\d+(?:\.\d+)?%/g;
const STATISTIC_PATTERN = /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;
const CITATION_PATTERN =
  /\([A-Z][a-z]+(?:\s+et\s+al\.?)?\s*,?\s*\d{4}\)|\[\d+\]/g;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/g;

/**
 * Calculate evidence density in text.
 * Counts statistics, percentages, and citations per 200 words.
 *
 * @param text - Text to analyze
 * @returns Evidence density score (evidence items per 200 words)
 */
export function calculateEvidenceDensity(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  if (wordCount === 0) {
    return 0;
  }

  // Count evidence types
  const percentages = (text.match(PERCENTAGE_PATTERN) || []).length;
  const statistics = (text.match(STATISTIC_PATTERN) || []).length;
  const citations = (text.match(CITATION_PATTERN) || []).length;
  const years = (text.match(YEAR_PATTERN) || []).length;

  // Total evidence items
  const totalEvidence = percentages + statistics + citations + years;

  // Normalize to per 200 words
  const density = (totalEvidence / wordCount) * 200;

  return density;
}
