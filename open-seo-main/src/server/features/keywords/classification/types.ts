/**
 * Classification types for Phase 63 Keyword Intelligence.
 *
 * Defines schemas and interfaces for the two-pass classification cascade:
 * - Pass 1: Grok 4.1 high-volume filtering ($0.20/1M input)
 * - Pass 2: Claude refinement for low-confidence results
 */
import { z } from "zod";

/**
 * Keyword intent/type classification.
 * Used to categorize keywords for prioritization and content strategy.
 */
export const KeywordTypeEnum = z.enum([
  "product", // Direct product/service searches
  "long_tail", // Specific multi-word phrases
  "question", // Question-based searches
  "local", // Location-based searches
  "comparison", // Comparison searches (vs, best, review)
]);
export type KeywordType = z.infer<typeof KeywordTypeEnum>;

/**
 * Single keyword classification result.
 */
export const ClassificationItemSchema = z.object({
  /** The keyword being classified */
  keyword: z.string(),
  /** Whether to include this keyword for the business */
  include: z.boolean(),
  /** Classification confidence from 0 to 1 */
  confidence: z.number().min(0).max(1),
  /** Keyword type/intent, null if unclear */
  type: KeywordTypeEnum.nullable(),
  /** Brief explanation of classification decision */
  reasoning: z.string(),
});
export type ClassificationItem = z.infer<typeof ClassificationItemSchema>;

/**
 * Full classification response from LLM.
 */
export const ClassificationResponseSchema = z.object({
  classifications: z.array(ClassificationItemSchema),
});
export type ClassificationResponse = z.infer<typeof ClassificationResponseSchema>;

/**
 * Business context for classification decisions.
 * Provides classifier with understanding of what the business does/doesn't do.
 */
export interface BusinessContext {
  businessName: string;
  industry: string;
  services: string[];
  targetAudience: string;
  negativeAssociations?: NegativeAssociations;
}

/**
 * Negative associations for filtering adjacent verticals.
 * Critical for avoiding semantically similar but contextually wrong keywords.
 *
 * Example: Embroidery company that BUYS embroidery should EXCLUDE
 * "embroidery services" because they don't SELL embroidery.
 */
export interface NegativeAssociations {
  /** Services the business explicitly does NOT provide */
  notServices: string[];
  /** Known competitor types or domains to exclude */
  competitors: string[];
  /** Related but wrong verticals (e.g., hair salon != hair transplant clinic) */
  adjacentVerticals: string[];
  /** Intent signals indicating wrong audience (e.g., "free", "DIY" for B2B) */
  wrongIntent: string[];
}

/**
 * Classified keyword with pass information.
 * Tracks which pass (1 or 2) made the final classification.
 */
export interface ClassifiedKeyword {
  keyword: string;
  include: boolean;
  confidence: number;
  type: KeywordType | null;
  reasoning: string;
  /** Which pass made the final decision (1=Grok, 2=Claude) */
  pass: 1 | 2;
}
