/**
 * Theme Extractor Service
 * Phase 102-11: Task 2 - Theme extraction from documents
 *
 * Extracts brand themes (colors, fonts, voice) from uploaded documents
 * and stores them in the brandThemes table for proposal styling.
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/db";
import { uploadedDocuments, brandThemes } from "@/db/schema/document-builder";
import { eq } from "drizzle-orm";
import type { VoiceAttributes, FontInfo } from "@/db/schema/document-builder";
import { logger } from "@/lib/logger";
import {
  VoiceAnalysisResponseSchema,
  ExtractedMetadataSchema,
  ExtractedTextSchema,
  type RawFontInfo,
} from "./schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Brand theme extraction result.
 */
export interface BrandTheme {
  colors: string[];
  primaryColor?: string;
  secondaryColor?: string;
  fonts: FontInfo[];
  headingFont?: string;
  bodyFont?: string;
  voiceAttributes: VoiceAttributes;
  confidence: number;
}

// RawFontInfo type now imported from ./schemas

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Extract brand theme from a processed document.
 *
 * @param documentId - The uploaded document ID
 * @returns Extracted brand theme
 */
export async function extractTheme(documentId: string): Promise<BrandTheme> {
  // Get document with extracted metadata
  const doc = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.id, documentId),
  });

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Validate JSONB fields with Zod schemas
  const metadataResult = ExtractedMetadataSchema.safeParse(doc.extractedMetadata ?? {});
  const metadata = metadataResult.success ? metadataResult.data : { colors: [], fonts: [] };

  const textResult = ExtractedTextSchema.safeParse(doc.extractedText ?? {});
  const text = textResult.success ? textResult.data.text : "";

  // Extract colors from metadata (from PDF parser)
  const colors = metadata?.colors || [];
  const primaryColor = colors[0];
  const secondaryColor = colors[1];

  // Extract fonts from metadata
  const rawFonts = metadata?.fonts || [];
  const fonts = classifyFonts(rawFonts);
  const headingFont = fonts.find((f) => f.usage === "heading")?.name;
  const bodyFont = fonts.find((f) => f.usage === "body")?.name;

  // AI voice analysis
  const voiceAttributes = await analyzeVoice(text);

  const confidence = calculateConfidence(colors, fonts, voiceAttributes);

  const theme: BrandTheme = {
    colors,
    primaryColor,
    secondaryColor,
    fonts,
    headingFont,
    bodyFont,
    voiceAttributes,
    confidence,
  };

  // Save to database
  try {
    await db.insert(brandThemes).values({
      documentId,
      workspaceId: doc.workspaceId,
      colors,
      primaryColor,
      secondaryColor,
      fonts,
      headingFont,
      bodyFont,
      voiceAttributes,
      extractionConfidence: confidence,
    });

    logger.info("[theme-extractor] Theme saved", {
      documentId,
      colors: colors.length,
      fonts: fonts.length,
      confidence,
    });
  } catch (error) {
    logger.error("[theme-extractor] Failed to save theme", {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return theme;
}

// ---------------------------------------------------------------------------
// Helper Functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Classify fonts by usage (heading, body, accent).
 *
 * @param rawFonts - Raw font data from parser
 * @returns Classified fonts
 */
export function classifyFonts(rawFonts: RawFontInfo[]): FontInfo[] {
  if (rawFonts.length === 0) {
    return [];
  }

  // Sort by usage count (character count) descending
  const sorted = [...rawFonts].sort((a, b) => b.usage - a.usage);

  return sorted.slice(0, 5).map((f, index) => {
    let usage: FontInfo["usage"];

    // Large font sizes (>16) are likely headings
    if (f.size > 16) {
      usage = "heading";
    } else if (index === 0) {
      // Most used font is body
      usage = "body";
    } else {
      usage = "accent";
    }

    return {
      name: f.font,
      usage,
    };
  });
}

/**
 * Analyze document voice and tone using AI.
 *
 * @param text - Document text content
 * @returns Voice attributes
 */
async function analyzeVoice(text: string): Promise<VoiceAttributes> {
  // Skip AI analysis for short documents
  if (text.length < 100) {
    return { tone: [], vocabulary: [], patterns: [] };
  }

  try {
    const { text: analysis } = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: `Analyze the voice and tone of this business document:

---
${text.slice(0, 5000)}
---

Return JSON only, no markdown:
{
  "tone": ["formal"|"casual"|"technical"|"friendly"|"authoritative"|"persuasive"],
  "vocabulary": ["industry-specific terms found"],
  "patterns": ["common phrases or sentence structures"]
}

Return valid JSON only.`,
      temperature: 0.3,
    });

    // Parse JSON from response and validate with Zod
    const parsed = JSON.parse(analysis);
    const validated = VoiceAnalysisResponseSchema.safeParse(parsed);

    if (!validated.success) {
      logger.warn("[theme-extractor] Voice analysis response validation failed", {
        error: validated.error.message,
      });
      return { tone: ["professional"], vocabulary: [], patterns: [] };
    }

    return validated.data;
  } catch (error) {
    logger.warn("[theme-extractor] Voice analysis failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { tone: ["professional"], vocabulary: [], patterns: [] };
  }
}

/**
 * Calculate extraction confidence score.
 *
 * @param colors - Extracted colors
 * @param fonts - Classified fonts
 * @param voice - Voice attributes
 * @returns Confidence score 0-100
 */
export function calculateConfidence(
  colors: string[],
  fonts: FontInfo[],
  voice: VoiceAttributes
): number {
  let score = 50; // Base score

  // Colors contribute up to 15 points
  if (colors.length >= 2) score += 15;
  else if (colors.length >= 1) score += 8;

  // Fonts contribute up to 15 points
  if (fonts.length >= 2) score += 15;
  else if (fonts.length >= 1) score += 8;

  // Voice analysis contributes up to 20 points
  if (voice.tone.length > 0) score += 10;
  if (voice.vocabulary.length > 0) score += 5;
  if (voice.patterns.length > 0) score += 5;

  return Math.min(100, score);
}
