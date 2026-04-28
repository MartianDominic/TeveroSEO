/**
 * AI-powered voice extraction from page content.
 * Phase 37: Brand Voice Management
 *
 * Uses Claude to analyze scraped content and extract 12 voice dimensions.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { PageAnalysis } from "@/server/lib/audit/types";
import type { ExtractedVoiceDimensions, VoiceExtractionResult } from "../types";
import { createLogger } from "@/server/lib/logger";
import { ARCHETYPES, CONTRACTION_USAGE, HEADING_STYLES } from "@/db/voice-schema";

/** Claude model for voice extraction */
const CLAUDE_MODEL = process.env.CLAUDE_MODEL_VOICE_ANALYZER || "claude-3-5-sonnet-20241022";

/** Maximum tokens for Claude response */
const MAX_TOKENS = 2048;

const log = createLogger({ module: "voice-analyzer" });

// Zod schema for AI response validation
const VoiceExtractionSchema = z.object({
  tone_primary: z.string(),
  tone_secondary: z.string().nullable(),
  formality_level: z.number().min(1).max(10),
  personality_traits: z.array(z.string()),
  archetype: z.enum(ARCHETYPES),
  sentence_length_avg: z.number().positive(),
  paragraph_length_avg: z.number().positive(),
  contraction_usage: z.enum(CONTRACTION_USAGE),
  vocabulary_patterns: z.object({
    preferred: z.array(z.string()),
    avoided: z.array(z.string()),
  }),
  signature_phrases: z.array(z.string()),
  forbidden_phrases: z.array(z.string()),
  heading_style: z.enum(HEADING_STYLES),
  confidence: z.number().min(0).max(100),
  sample_sentences: z.array(z.string()),
  reasoning: z.string(),
});

/**
 * Analyze a single page's voice using Claude AI.
 *
 * @param page - PageAnalysis from scraper
 * @param domain - Domain being analyzed
 * @returns VoiceExtractionResult with 12 dimensions and confidence
 */
export async function analyzePageVoice(
  page: PageAnalysis,
  domain: string,
): Promise<VoiceExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log.warn("ANTHROPIC_API_KEY not set, returning low confidence result");
    return createEmptyResult("API key not configured");
  }

  const prompt = buildVoicePrompt([page]);

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text from response
    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    if (!textContent) {
      throw new Error("No text content in Claude response");
    }

    // Parse JSON response
    const parsed = JSON.parse(textContent.text) as unknown;

    // Validate with Zod
    const validated = VoiceExtractionSchema.parse(parsed);

    log.info("Voice extracted from page", {
      domain,
      url: page.url,
      confidence: validated.confidence,
      archetype: validated.archetype,
    });

    return {
      dimensions: {
        tone_primary: validated.tone_primary,
        tone_secondary: validated.tone_secondary,
        formality_level: validated.formality_level,
        personality_traits: validated.personality_traits,
        archetype: validated.archetype,
        sentence_length_avg: validated.sentence_length_avg,
        paragraph_length_avg: validated.paragraph_length_avg,
        contraction_usage: validated.contraction_usage,
        vocabulary_patterns: validated.vocabulary_patterns,
        signature_phrases: validated.signature_phrases,
        forbidden_phrases: validated.forbidden_phrases,
        heading_style: validated.heading_style,
      },
      confidence: validated.confidence,
      sample_sentences: validated.sample_sentences,
      reasoning: validated.reasoning,
    };
  } catch (error) {
    log.error(
      "Failed to extract voice",
      error instanceof Error ? error : new Error(String(error)),
      { domain, url: page.url },
    );
    throw error;
  }
}

/**
 * Build prompt for Claude including all 12 dimension definitions.
 */
export function buildVoicePrompt(pages: PageAnalysis[]): string {
  const pageContents = pages.map((page, idx) => `
PAGE ${idx + 1}: ${page.url}
Title: ${page.title || "(none)"}
Meta Description: ${page.metaDescription || "(none)"}
H1 Headings: ${page.h1s.join(", ") || "(none)"}
Word Count: ${page.wordCount}
`.trim()).join("\n\n---\n\n");

  return `You are analyzing website content to extract brand voice characteristics.

CONTENT TO ANALYZE:
${pageContents}

Extract the following 12 voice dimensions and return as JSON:

{
  "tone_primary": "The dominant tone (e.g., professional, friendly, authoritative, conversational, inspiring)",
  "tone_secondary": "Secondary tone or null if not applicable",
  "formality_level": 1-10 scale (1=very casual with slang, 5=balanced, 10=highly formal/academic),
  "personality_traits": ["Array of 3-5 personality traits like trustworthy, innovative, approachable"],
  "archetype": "professional" | "casual" | "technical" | "friendly" | "authoritative",
  "sentence_length_avg": average words per sentence (estimate from content),
  "paragraph_length_avg": average sentences per paragraph (estimate),
  "contraction_usage": "never" | "sometimes" | "frequently",
  "vocabulary_patterns": {
    "preferred": ["words/phrases the brand favors"],
    "avoided": ["words/phrases the brand avoids"]
  },
  "signature_phrases": ["recurring branded phrases or taglines"],
  "forbidden_phrases": ["phrases the brand explicitly avoids"],
  "heading_style": "title_case" | "sentence_case" | "all_caps",
  "confidence": 0-100 (how confident based on content quantity/clarity),
  "sample_sentences": ["2-3 example sentences that exemplify the voice"],
  "reasoning": "Brief explanation of voice analysis"
}

ARCHETYPE DEFINITIONS:
- professional: Business-focused, clear, credible, trustworthy
- casual: Relaxed, conversational, everyday language, relatable
- technical: Data-driven, precise, jargon-appropriate for experts
- friendly: Warm, approachable, personal, empathetic
- authoritative: Expert, commanding, definitive, educational

CONFIDENCE SCORING:
- 90-100: Rich content with clear, consistent voice signals
- 70-89: Good content with identifiable voice patterns
- 50-69: Moderate content, some voice signals detectable
- 30-49: Limited content, voice patterns unclear
- 0-29: Minimal/insufficient content for reliable analysis

Return ONLY valid JSON, no additional text.`;
}

/**
 * Aggregate multiple page voice analyses into a single profile.
 * Weights results by confidence score.
 */
export function aggregateVoiceResults(
  results: VoiceExtractionResult[],
): ExtractedVoiceDimensions {
  if (results.length === 0) {
    throw new Error("Cannot aggregate empty results");
  }

  if (results.length === 1) {
    return results[0].dimensions;
  }

  // Calculate total confidence for weighting
  const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);

  // Weighted average for numeric fields
  const weightedAvg = (getter: (d: ExtractedVoiceDimensions) => number): number => {
    const sum = results.reduce(
      (acc, r) => acc + getter(r.dimensions) * r.confidence,
      0,
    );
    return Math.round(sum / totalConfidence);
  };

  // Merge arrays with deduplication
  const mergeArrays = (getter: (d: ExtractedVoiceDimensions) => string[]): string[] => {
    const all = results.flatMap((r) => getter(r.dimensions));
    return [...new Set(all)];
  };

  // Pick most common categorical value (weighted by confidence)
  const pickMostCommon = <T extends string>(
    getter: (d: ExtractedVoiceDimensions) => T,
  ): T => {
    const counts = new Map<T, number>();
    for (const r of results) {
      const val = getter(r.dimensions);
      counts.set(val, (counts.get(val) || 0) + r.confidence);
    }
    let maxVal: T = getter(results[0].dimensions);
    let maxCount = 0;
    for (const [val, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxVal = val;
      }
    }
    return maxVal;
  };

  // Pick tone with highest total confidence
  const pickTone = (getter: (d: ExtractedVoiceDimensions) => string | null): string | null => {
    const counts = new Map<string, number>();
    for (const r of results) {
      const val = getter(r.dimensions);
      if (val) {
        counts.set(val, (counts.get(val) || 0) + r.confidence);
      }
    }
    if (counts.size === 0) return null;
    let maxVal = "";
    let maxCount = 0;
    for (const [val, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxVal = val;
      }
    }
    return maxVal || null;
  };

  // Merge vocabulary patterns
  const mergedVocabulary = {
    preferred: mergeArrays((d) => d.vocabulary_patterns.preferred),
    avoided: mergeArrays((d) => d.vocabulary_patterns.avoided),
  };

  return {
    tone_primary: pickTone((d) => d.tone_primary) || "professional",
    tone_secondary: pickTone((d) => d.tone_secondary),
    formality_level: weightedAvg((d) => d.formality_level),
    personality_traits: mergeArrays((d) => d.personality_traits),
    archetype: pickMostCommon((d) => d.archetype),
    sentence_length_avg: weightedAvg((d) => d.sentence_length_avg),
    paragraph_length_avg: weightedAvg((d) => d.paragraph_length_avg),
    contraction_usage: pickMostCommon((d) => d.contraction_usage),
    vocabulary_patterns: mergedVocabulary,
    signature_phrases: mergeArrays((d) => d.signature_phrases),
    forbidden_phrases: mergeArrays((d) => d.forbidden_phrases),
    heading_style: pickMostCommon((d) => d.heading_style),
  };
}

/**
 * Create empty result for error cases.
 */
function createEmptyResult(reasoning: string): VoiceExtractionResult {
  return {
    dimensions: {
      tone_primary: "professional",
      tone_secondary: null,
      formality_level: 5,
      personality_traits: [],
      archetype: "professional",
      sentence_length_avg: 15,
      paragraph_length_avg: 3,
      contraction_usage: "sometimes",
      vocabulary_patterns: { preferred: [], avoided: [] },
      signature_phrases: [],
      forbidden_phrases: [],
      heading_style: "sentence_case",
    },
    confidence: 0,
    sample_sentences: [],
    reasoning,
  };
}
