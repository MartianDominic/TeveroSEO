/**
 * TypeScript client for OCR operations.
 * Phase 102-09: Task 5 - OCR client for direct OCR calls if needed.
 *
 * OCR is primarily handled server-side in the parser service,
 * but this client allows direct OCR calls for specific use cases.
 */

const PARSER_SERVICE_URL =
  process.env.DOCUMENT_PARSER_URL || "http://localhost:8001";

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
// OCR Client
// =============================================================================

/**
 * Request OCR processing for image buffers.
 *
 * @param imageBuffers - Array of image buffers (PNG/JPEG)
 * @returns OCR result with text, confidence, tier used, and cost
 *
 * @throws Error if OCR fails or service unavailable
 */
export async function requestOcr(imageBuffers: Buffer[]): Promise<OcrResult> {
  const formData = new FormData();

  // Add each image to form data
  imageBuffers.forEach((buffer, index) => {
    const blob = new Blob([buffer], { type: "image/png" });
    formData.append("images", blob, `page_${index + 1}.png`);
  });

  const response = await fetch(`${PARSER_SERVICE_URL}/ocr`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR service error: ${errorText}`);
  }

  const data = await response.json();

  return {
    text: data.text,
    confidence: data.confidence,
    tier: data.tier as OcrTier,
    cost: data.cost,
    escalationReason: data.escalation_reason,
  };
}

/**
 * Extract OCR fields from a parser response.
 * Helper to map snake_case API response to camelCase.
 */
export function extractOcrFields(apiResponse: Record<string, unknown>): {
  ocrTier?: OcrTier;
  ocrConfidence?: number;
  ocrCost?: number;
} {
  return {
    ocrTier: apiResponse.ocr_tier as OcrTier | undefined,
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
