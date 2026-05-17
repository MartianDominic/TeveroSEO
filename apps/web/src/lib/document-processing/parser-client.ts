/**
 * TypeScript client for Document Parser service.
 * Phase 102-08: Task 4 - Client to call Python parsing service.
 *
 * Fetches documents from R2, sends to Python parser, returns structured results.
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { ParserServiceResponseSchema } from "./schemas";

const PARSER_SERVICE_URL =
  process.env.DOCUMENT_PARSER_URL || "http://localhost:8001";

const FETCH_TIMEOUT_MS = 60000; // 60 seconds

// =============================================================================
// Types
// =============================================================================

export interface ParserResult {
  success: boolean;
  fileType: "pdf" | "docx";
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
  };
  fonts: Array<{
    font: string;
    size: number;
    usage: number;
  }>;
  colors: string[];
  hasImages: boolean;
  needsOcr: boolean;
  error?: string;
}

// =============================================================================
// R2 Client (lazy initialization singleton)
// =============================================================================

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 credentials not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY."
      );
    }

    r2Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return r2Client;
}

// =============================================================================
// Parser Client
// =============================================================================

/**
 * Parse a document from R2 storage.
 *
 * @param r2Key - Key of the document in R2
 * @param fileType - Type of file ('pdf' | 'docx')
 * @returns Parsed document with text, fonts, colors, and metadata
 *
 * @throws Error if parsing fails or service unavailable
 */
export async function parseDocument(
  r2Key: string,
  fileType: "pdf" | "docx"
): Promise<ParserResult> {
  const r2 = getR2Client();

  // Fetch file from R2
  const getCommand = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET || "documents",
    Key: r2Key,
  });

  const r2Response = await r2.send(getCommand);
  const fileBuffer = await r2Response.Body?.transformToByteArray();

  if (!fileBuffer) {
    throw new Error("Failed to fetch document from R2");
  }

  // Create form data for parser service
  const formData = new FormData();
  const mimeType =
    fileType === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // Convert Uint8Array to ArrayBuffer for Blob compatibility
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  formData.append("file", blob, `document.${fileType}`);

  // Call parser service with retry
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${PARSER_SERVICE_URL}/parse`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Parser service error: ${errorText}`);
      }

      const rawData = await response.json();
      const parseResult = ParserServiceResponseSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid parser response: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;

      return {
        success: data.success,
        fileType: data.file_type,
        text: data.text,
        pageCount: data.page_count,
        metadata: data.metadata,
        fonts: data.fonts,
        colors: data.colors,
        hasImages: data.has_images,
        needsOcr: data.needs_ocr,
        error: data.error,
      };
    } catch (e) {
      clearTimeout(timeoutId);

      if (e instanceof Error && e.name === "AbortError") {
        lastError = new Error("Parser service timeout");
      } else {
        lastError = e instanceof Error ? e : new Error(String(e));
      }

      // Don't retry for password-protected error
      if (lastError.message.includes("Password-protected")) {
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Parser service unavailable");
}

/**
 * Check if the parser service is healthy.
 */
export async function checkParserHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

  try {
    const response = await fetch(`${PARSER_SERVICE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

/**
 * Parse a document directly from a buffer (for testing or direct upload).
 *
 * @param buffer - File content as Uint8Array
 * @param fileType - Type of file ('pdf' | 'docx')
 * @param fileName - Original file name
 * @returns Parsed document with text, fonts, colors, and metadata
 */
export async function parseDocumentFromBuffer(
  buffer: Uint8Array,
  fileType: "pdf" | "docx",
  fileName: string
): Promise<ParserResult> {
  const formData = new FormData();
  const mimeType =
    fileType === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // Convert Uint8Array to ArrayBuffer for Blob compatibility
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  formData.append("file", blob, fileName);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${PARSER_SERVICE_URL}/parse`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Parser service error: ${errorText}`);
      }

      const rawData = await response.json();
      const parseResult = ParserServiceResponseSchema.safeParse(rawData);

      if (!parseResult.success) {
        throw new Error(
          `Invalid parser response: ${parseResult.error.message}`
        );
      }

      const data = parseResult.data;

      return {
        success: data.success,
        fileType: data.file_type,
        text: data.text,
        pageCount: data.page_count,
        metadata: data.metadata,
        fonts: data.fonts,
        colors: data.colors,
        hasImages: data.has_images,
        needsOcr: data.needs_ocr,
        error: data.error,
      };
    } catch (e) {
      clearTimeout(timeoutId);

      if (e instanceof Error && e.name === "AbortError") {
        lastError = new Error("Parser service timeout");
      } else {
        lastError = e instanceof Error ? e : new Error(String(e));
      }

      if (lastError.message.includes("Password-protected")) {
        throw lastError;
      }

      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Parser service unavailable");
}
