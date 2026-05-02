/**
 * Classification types for keyword intelligence system.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Keyword Types
// ─────────────────────────────────────────────────────────────────────────────

export type KeywordType = "product" | "long_tail" | "question" | "local" | "comparison";

// ─────────────────────────────────────────────────────────────────────────────
// Business Context
// ─────────────────────────────────────────────────────────────────────────────

export interface NegativeAssociations {
  notServices: string[];
  adjacentVerticals: string[];
}

export interface BusinessContext {
  businessName: string;
  industry: string;
  services: string[];
  targetAudience: string;
  negativeAssociations?: NegativeAssociations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification Items
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassificationItem {
  keyword: string;
  include: boolean;
  confidence: number;
  type: KeywordType | null;
  reasoning: string;
}

export interface ClassifiedKeyword extends ClassificationItem {
  pass: 1 | 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schemas for API Response Validation
// ─────────────────────────────────────────────────────────────────────────────

export const ClassificationItemSchema = z.object({
  keyword: z.string(),
  include: z.boolean(),
  confidence: z.number().min(0).max(1),
  type: z.enum(["product", "long_tail", "question", "local", "comparison"]).nullable(),
  reasoning: z.string(),
});

export const ClassificationResponseSchema = z.object({
  classifications: z.array(ClassificationItemSchema),
});

export type ClassificationResponse = z.infer<typeof ClassificationResponseSchema>;
