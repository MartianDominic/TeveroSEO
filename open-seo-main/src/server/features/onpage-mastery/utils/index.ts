/**
 * On-Page SEO Mastery - Text Processing Utilities
 * Phase 92: On-Page SEO Mastery
 *
 * Central export point for all text processing utilities.
 */

export {
  countTokens,
  batchCountTokens,
  extractText,
  extractChunks,
  extractSimpleChunks,
  extractPathPattern,
  type SemanticChunk,
  type ChunkExtractionResult,
} from "./ChunkExtractor";

export {
  analyzeReadability,
  getVerticalReadabilityThreshold,
  type ReadabilityScores,
} from "./ReadabilityScorer";

export {
  extractEntities,
  stripPII,
  containsPII,
  calculateEvidenceDensity,
  type ExtractedEntities,
} from "./EntityExtractor";

export {
  generateArticleSchema,
  generateProductSchema,
  generateLocalBusinessSchema,
  generateServiceSchema,
  generateCourseSchema,
  generateSoftwareSchema,
  getSchemaTypesForVertical,
  validateJsonLd,
  type ArticleData,
  type ProductData,
  type LocalBusinessData,
  type ServiceData,
  type CourseData,
  type SoftwareData,
  type JsonLdValidationResult,
} from "./SchemaGenerator";
