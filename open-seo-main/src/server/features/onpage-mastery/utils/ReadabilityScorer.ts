/**
 * ReadabilityScorer - Content readability analysis utilities
 * Phase 92: On-Page SEO Mastery
 *
 * Provides:
 * - Flesch Reading Ease scoring
 * - Flesch-Kincaid Grade Level
 * - Gunning Fog Index
 * - SMOG Index
 * - Automated Readability Index (ARI)
 * - Vertical-specific thresholds
 *
 * Requirements: OPM-14 (readability scoring)
 */

import Readability from "text-readability";

/**
 * Readability scores and recommendations
 */
export interface ReadabilityScores {
  fleschEase: number;
  gradeLevel: number;
  gunningFog: number;
  smog: number;
  ari: number;
  recommendation: string;
  isAccessible: boolean;
}

// Minimum word count for reliable readability analysis
const MIN_WORD_COUNT = 20;

/**
 * Analyze text readability using multiple scoring algorithms.
 *
 * @param text - Plain text to analyze
 * @returns ReadabilityScores object with all metrics
 */
export function analyzeReadability(text: string): ReadabilityScores {
  // Handle empty or very short text
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

  if (wordCount < MIN_WORD_COUNT) {
    return {
      fleschEase: 100,
      gradeLevel: 0,
      gunningFog: 0,
      smog: 0,
      ari: 0,
      recommendation: "Text is too short for reliable readability analysis",
      isAccessible: true,
    };
  }

  // Calculate all readability scores
  const fleschEase = Readability.fleschReadingEase(text);
  const gradeLevel = Readability.fleschKincaidGrade(text);
  const gunningFog = Readability.gunningFog(text);
  const smog = Readability.smogIndex(text);
  const ari = Readability.automatedReadabilityIndex(text);

  // Determine accessibility (grade 8 or below is widely accessible)
  const isAccessible = gradeLevel <= 8;

  // Generate recommendation based on grade level
  const recommendation = generateRecommendation(gradeLevel, fleschEase);

  return {
    fleschEase,
    gradeLevel,
    gunningFog,
    smog,
    ari,
    recommendation,
    isAccessible,
  };
}

/**
 * Generate readability recommendation based on scores.
 *
 * @param gradeLevel - Flesch-Kincaid grade level
 * @param fleschEase - Flesch Reading Ease score
 * @returns Recommendation string
 */
function generateRecommendation(
  gradeLevel: number,
  fleschEase: number
): string {
  if (gradeLevel <= 5) {
    return "Text is very easy to read (elementary school level)";
  }
  if (gradeLevel <= 8) {
    return "Text is easy to read (middle school level)";
  }
  if (gradeLevel <= 12) {
    return "Text is moderately difficult (high school level)";
  }
  if (gradeLevel <= 16) {
    return "Text requires college-level reading ability";
  }
  return "Text is very difficult (graduate/professional level)";
}

/**
 * Vertical-specific readability thresholds.
 * Different industries have different acceptable complexity levels.
 */
const VERTICAL_THRESHOLDS: Record<string, number> = {
  healthcare: 10, // Medical content should be accessible
  legal: 12, // Legal content is inherently complex
  financial: 10, // Financial advice should be clear
  saas: 14, // Technical audience can handle more
  ecommerce: 8, // Shopping should be easy
  education: 10, // Educational content varies
  general: 12, // Default threshold
};

// YMYL (Your Money Your Life) content should be more accessible
const YMYL_CAP = 10;

/**
 * Get the recommended readability threshold for a vertical.
 *
 * @param vertical - Industry vertical (healthcare, legal, financial, saas, etc.)
 * @param isYMYL - Whether this is YMYL content (health, finance, safety)
 * @returns Maximum recommended grade level
 */
export function getVerticalReadabilityThreshold(
  vertical: string,
  isYMYL: boolean
): number {
  const baseThreshold = VERTICAL_THRESHOLDS[vertical] ?? VERTICAL_THRESHOLDS.general;

  // YMYL content should be capped at grade 10 for accessibility
  if (isYMYL) {
    return Math.min(baseThreshold, YMYL_CAP);
  }

  return baseThreshold;
}
