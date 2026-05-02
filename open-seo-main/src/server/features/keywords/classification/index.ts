/**
 * Classification module exports for Phase 63 Keyword Intelligence.
 */

// Types
export {
  KeywordTypeEnum,
  ClassificationItemSchema,
  ClassificationResponseSchema,
  type KeywordType,
  type ClassificationItem,
  type ClassificationResponse,
  type BusinessContext,
  type NegativeAssociations,
  type ClassifiedKeyword,
} from "./types";

// Config
export {
  CLASSIFICATION_CONFIG,
  GROK_CONFIG,
  GEMINI_CONFIG,
  CLAUDE_CONFIG,
} from "./config";

// Classifiers
export { GrokClassifier, CircuitOpenError } from "./GrokClassifier";
