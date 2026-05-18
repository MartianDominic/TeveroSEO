/**
 * TypeScript client for OCR operations.
 * Phase 102-09: Task 5 - OCR client for direct OCR calls if needed.
 *
 * OCR is primarily handled server-side in the parser service,
 * but this client allows direct OCR calls for specific use cases.
 */

import { logger } from "@/lib/logger";
import { OcrServiceResponseSchema, OcrTierSchema } from "./schemas";

const PARSER_SERVICE_URL =
  process.env.DOCUMENT_PARSER_URL || "http://localhost:8001";

/** OCR request timeout in milliseconds (60 seconds) */
const OCR_TIMEOUT_MS = 60_000;

/** Maximum retry attempts for transient failures */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff in milliseconds */
const BASE_RETRY_DELAY_MS = 1_000;

// =============================================================================
// Types
// =============================================================================

export type OcrTier = "tesseract" | "deepseek" | "gemini";

export interface OcrResult {
  text: string;
  confidence: number;
  tier: OcrTier;
  cost: number;
  escalationReason?: string;
}

export interface OcrParseResult {
  success: boolean;
  text: string;
  ocrTier?: OcrTier;
  ocrConfidence?: number;
  ocrCost?: number;
  error?: string;
}

// =============================================================================
// Retry Helpers
// =============================================================================

/**
 * Check if an error is retryable (transient network/server issue).
 */
function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Retry on network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // Retry on server errors (5xx) but not client errors (4xx)
  if (statusCode !== undefined && statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // Retry on timeout
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  return false;
}

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// OCR Client
// =============================================================================

/**
 * Request OCR processing for image buffers.
 *
 * @param imageBuffers - Array of image buffers (PNG/JPEG)
 * @returns OCR result with text, confidence, tier used, and cost
 *
 * @throws Error if OCR fails, service unavailable, or timeout exceeded after retries
 */
export async function requestOcr(imageBuffers: Buffer[]): Promise<OcrResult> {
  const startTime = Date.now();
  const totalSize = imageBuffers.reduce((sum, buf) => sum + buf.length, 0);

  logger.info("[ocr-client] Starting OCR request", {
    imageCount: imageBuffers.length,
    totalSizeBytes: totalSize,
  });

  const formData = new FormData();

  // Add each image to form data
  imageBuffers.forEach((buffer, index) => {
    const blob = new Blob([buffer], { type: "image/png" });
    formData.append("images", blob, `page_${index + 1}.png`);
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    try {
      const response = await fetch(`${PARSER_SERVICE_URL}/ocr`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`OCR service error: ${errorText}`);

        // Check if we should retry server errors
        if (
          isRetryableError(error, response.status) &&
          attempt < MAX_RETRIES - 1
        ) {
          lastError = error;
          clearTimeout(timeoutId);
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        throw error;
      }

      const data = await response.json();

      // Validate response with Zod schema
      const parseResult = OcrServiceResponseSchema.safeParse(data);
      if (!parseResult.success) {
        throw new Error(
          `Invalid OCR response: ${parseResult.error.issues.map((i) => i.message).join(", ")}`
        );
      }

      const validated = parseResult.data;

      const durationMs = Date.now() - startTime;
      logger.info("[ocr-client] OCR request completed", {
        imageCount: imageBuffers.length,
        durationMs,
        tier: validated.tier,
        confidence: validated.confidence,
        cost: validated.cost,
        textLength: validated.text.length,
        escalationReason: validated.escalation_reason,
      });

      return {
        text: validated.text,
        confidence: validated.confidence,
        tier: validated.tier,
        cost: validated.cost,
        escalationReason: validated.escalation_reason,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(`OCR request timed out after ${OCR_TIMEOUT_MS}ms`);

        logger.warn("[ocr-client] OCR request timed out, retrying", {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          timeoutMs: OCR_TIMEOUT_MS,
        });

        // Retry timeouts
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        logger.error("[ocr-client] OCR request failed after all retries (timeout)", {
          imageCount: imageBuffers.length,
          durationMs: Date.now() - startTime,
        });

        throw lastError;
      }

      // For non-retryable errors, throw immediately
      if (!isRetryableError(error)) {
        logger.error("[ocr-client] OCR request failed (non-retryable)", {
          imageCount: imageBuffers.length,
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn("[ocr-client] OCR request failed, retrying", {
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        error: lastError.message,
      });

      // Exponential backoff before retry
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // All retries exhausted
  logger.error("[ocr-client] OCR request failed after all retries", {
    imageCount: imageBuffers.length,
    durationMs: Date.now() - startTime,
    error: lastError?.message,
  });

  throw lastError ?? new Error("OCR request failed after all retries");
}

/**
 * Extract OCR fields from a parser response.
 * Helper to map snake_case API response to camelCase with validation.
 */
export function extractOcrFields(apiResponse: Record<string, unknown>): {
  ocrTier?: OcrTier;
  ocrConfidence?: number;
  ocrCost?: number;
} {
  // Validate ocr_tier if present
  let ocrTier: OcrTier | undefined;
  if (apiResponse.ocr_tier != null) {
    const tierResult = OcrTierSchema.safeParse(apiResponse.ocr_tier);
    ocrTier = tierResult.success ? tierResult.data : undefined;
  }

  return {
    ocrTier,
    ocrConfidence:
      apiResponse.ocr_confidence != null
        ? Number(apiResponse.ocr_confidence)
        : undefined,
    ocrCost:
      apiResponse.ocr_cost != null ? Number(apiResponse.ocr_cost) : undefined,
  };
}

/**
 * Calculate estimated OCR cost based on page count.
 *
 * Cost estimates:
 * - Tesseract: $0 (free, local)
 * - DeepSeek: ~$0.002/page
 * - Gemini: ~$0.004/page
 *
 * Average estimate assumes 70% Tesseract success rate.
 */
export function estimateOcrCost(pageCount: number): {
  min: number;
  max: number;
  expected: number;
} {
  // Best case: Tesseract handles everything
  const min = 0;

  // Worst case: All pages need Gemini
  const max = pageCount * 0.006; // DeepSeek + Gemini for each page

  // Expected: 70% Tesseract, 25% DeepSeek, 5% Gemini
  const expected =
    pageCount * 0.7 * 0 + // Tesseract (free)
    pageCount * 0.25 * 0.002 + // DeepSeek
    pageCount * 0.05 * 0.006; // DeepSeek + Gemini

  return {
    min,
    max: Math.round(max * 10000) / 10000,
    expected: Math.round(expected * 10000) / 10000,
  };
}
