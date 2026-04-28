/**
 * Voice analysis types for AI-powered voice extraction.
 * Phase 37: Brand Voice Management
 */

import type { Archetype, ContractionUsage, HeadingStyle, VocabularyPatterns } from "@/db/voice-schema";

/**
 * 12 voice dimensions extracted from content by Claude AI.
 */
export interface ExtractedVoiceDimensions {
  tone_primary: string;
  tone_secondary: string | null;
  formality_level: number; // 1-10
  personality_traits: string[];
  archetype: Archetype;
  sentence_length_avg: number;
  paragraph_length_avg: number;
  contraction_usage: ContractionUsage;
  vocabulary_patterns: VocabularyPatterns;
  signature_phrases: string[];
  forbidden_phrases: string[];
  heading_style: HeadingStyle;
}

/**
 * Result of voice extraction from a single page.
 */
export interface VoiceExtractionResult {
  dimensions: ExtractedVoiceDimensions;
  confidence: number; // 0-100
  sample_sentences: string[];
  reasoning: string;
}

/**
 * Job data for BullMQ voice analysis queue.
 */
export interface VoiceAnalysisJobData {
  clientId: string;
  profileId: string;
  urls: string[]; // Pages to analyze
  progress?: VoiceAnalysisProgress;
}

/**
 * Progress tracking for resumable voice analysis jobs.
 */
export interface VoiceAnalysisProgress {
  completedUrls: number;
  totalUrls: number;
}

/**
 * Dead-letter queue job data for failed voice analysis jobs.
 */
export interface VoiceAnalysisDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: VoiceAnalysisJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}
