/**
 * Classification configuration for Phase 63 Keyword Intelligence.
 *
 * Model selection based on cost/quality tradeoffs:
 * - Grok 4.1: $0.20/1M input, high-volume first pass
 * - Gemini Flash Lite: Fallback for Grok failures
 * - Claude Sonnet: High-quality refinement pass
 */

/**
 * Core classification behavior settings.
 */
export const CLASSIFICATION_CONFIG = {
  /** Confidence threshold for Pass 1 finality. Below this triggers Pass 2. */
  CONFIDENCE_THRESHOLD: 0.85,
  /** Maximum keywords per API call */
  BATCH_SIZE: 50,
  /** Maximum retry attempts per batch */
  MAX_RETRIES: 2,
} as const;

/**
 * Grok 4.1 configuration for Pass 1 high-volume classification.
 * Uses OpenAI SDK with xAI base URL.
 */
export const GROK_CONFIG = {
  /** xAI API endpoint */
  baseURL: "https://api.x.ai/v1",
  /** Fast model for high-volume classification */
  model: "grok-4.1-fast",
  /** Response length limit */
  maxTokens: 4000,
  /** Low temperature for consistent classification */
  temperature: 0.1,
} as const;

/**
 * Gemini Flash Lite configuration for Grok fallback.
 */
export const GEMINI_CONFIG = {
  /** Gemini model for Pass 1 fallback */
  model: "gemini-2.5-flash-lite",
  /** Maximum output tokens */
  maxTokens: 4096,
  /** Temperature for classification */
  temperature: 0.1,
} as const;

/**
 * Claude Sonnet configuration for Pass 2 refinement.
 * Used for keywords with confidence < CONFIDENCE_THRESHOLD.
 */
export const CLAUDE_CONFIG = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 2000,
  temperature: 0.1,
} as const;
