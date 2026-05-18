/**
 * Document Processing Public API
 * Phase 102: Barrel file for document-processing module
 *
 * Exports only the public API for external consumers.
 * Internal utilities should not be imported directly from submodules.
 */

// ---------------------------------------------------------------------------
// Upload Service - Document upload and status
// ---------------------------------------------------------------------------

export {
  uploadDocument,
  getDocumentStatus,
  type UploadResult,
  type DocumentStatus,
} from "./upload-service";

// ---------------------------------------------------------------------------
// Parser Client - Document parsing
// ---------------------------------------------------------------------------

export {
  parseDocument,
  parseDocumentFromBuffer,
  checkParserHealth,
  type ParserResult,
} from "./parser-client";

// ---------------------------------------------------------------------------
// Processing Queue - Job queue management
// ---------------------------------------------------------------------------

export {
  documentProcessingQueue,
  createDocumentProcessingWorker,
  type ProcessingJob,
  type JobOptions,
} from "./processing-queue";

// ---------------------------------------------------------------------------
// OCR Client - Optical character recognition
// ---------------------------------------------------------------------------

export {
  requestOcr,
  extractOcrFields,
  estimateOcrCost,
  type OcrTier,
  type OcrResult,
  type OcrParseResult,
} from "./ocr-client";

// ---------------------------------------------------------------------------
// Structure Detector - AI block detection
// ---------------------------------------------------------------------------

export {
  detectStructure,
  type DetectedBlock,
  type BlockVariable,
  type DocumentMetadata,
  type StructureDetectionResult,
} from "./structure-detector";

// ---------------------------------------------------------------------------
// Variable Detector - Variable extraction
// ---------------------------------------------------------------------------

export {
  detectVariables,
  type VariableType,
  type VariablePosition,
  type DetectedVariable,
  type VariableDetectionResult,
} from "./variable-detector";

// ---------------------------------------------------------------------------
// Theme Extractor - Brand theme extraction
// ---------------------------------------------------------------------------

export {
  extractTheme,
  classifyFonts,
  calculateConfidence,
  type BrandTheme,
} from "./theme-extractor";

// ---------------------------------------------------------------------------
// Schemas - Zod validation schemas
// ---------------------------------------------------------------------------

export {
  ParserServiceResponseSchema,
  OcrTierSchema,
  OcrServiceResponseSchema,
  type ParserServiceResponse,
  type OcrServiceResponse,
} from "./schemas";

// ---------------------------------------------------------------------------
// HTML Escape - XSS prevention utility
// ---------------------------------------------------------------------------

export { escapeHtml, unescapeHtml } from "./html-escape";
