/**
 * Zod schemas for document processing service responses.
 * Phase 102: Shared validation for parser and OCR service responses.
 */

import { z } from "zod";

// =============================================================================
// Parser Service Response Schema
// =============================================================================

export const ParserServiceResponseSchema = z.object({
  success: z.boolean(),
  file_type: z.enum(["pdf", "docx"]),
  text: z.string(),
  page_count: z.number(),
  metadata: z
    .object({
      title: z.string().optional(),
      author: z.string().optional(),
      creator: z.string().optional(),
    })
    .optional()
    .default({}),
  fonts: z
    .array(
      z.object({
        font: z.string(),
        size: z.number(),
        usage: z.number(),
      })
    )
    .optional()
    .default([]),
  colors: z.array(z.string()).optional().default([]),
  has_images: z.boolean(),
  needs_ocr: z.boolean(),
  error: z.string().optional(),
});

export type ParserServiceResponse = z.infer<typeof ParserServiceResponseSchema>;

// =============================================================================
// OCR Service Response Schema
// =============================================================================

export const OcrTierSchema = z.enum(["tesseract", "deepseek", "gemini"]);

export const OcrServiceResponseSchema = z.object({
  text: z.string(),
  confidence: z.number(),
  tier: OcrTierSchema,
  cost: z.number(),
  escalation_reason: z.string().optional(),
});

export type OcrServiceResponse = z.infer<typeof OcrServiceResponseSchema>;

// =============================================================================
// Voice Analysis Response Schema (AI theme extraction)
// =============================================================================

export const VoiceAnalysisResponseSchema = z.object({
  tone: z.array(z.string()),
  vocabulary: z.array(z.string()),
  patterns: z.array(z.string()),
});

export type VoiceAnalysisResponse = z.infer<typeof VoiceAnalysisResponseSchema>;
