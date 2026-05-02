/**
 * Configuration for keyword classification pipeline.
 */

export const CLASSIFICATION_CONFIG = {
  /** Confidence threshold for Pass 1 resolution */
  CONFIDENCE_THRESHOLD: 0.85,
  /** Maximum keywords per batch */
  BATCH_SIZE: 50,
  /** Maximum retries for API calls */
  MAX_RETRIES: 2,
} as const;

export const GROK_CONFIG = {
  /** Grok model for Pass 1 */
  model: "grok-4.1",
  /** Maximum output tokens */
  maxTokens: 4096,
  /** Temperature for classification */
  temperature: 0.1,
} as const;

export const GEMINI_CONFIG = {
  /** Gemini model for Pass 1 fallback */
  model: "gemini-2.5-flash-lite",
  /** Maximum output tokens */
  maxTokens: 4096,
  /** Temperature for classification */
  temperature: 0.1,
} as const;
