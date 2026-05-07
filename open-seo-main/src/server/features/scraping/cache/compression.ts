/**
 * Compression Utilities
 * Phase 95-02: Multi-Level Caching
 *
 * Provides compression/decompression for cached HTML content.
 * Uses fflate for fast, pure JS compression.
 */

import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";

// =============================================================================
// Types
// =============================================================================

export type CompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface CompressionOptions {
  /** Compression level (1-9, higher = better compression but slower) */
  level?: CompressionLevel;
}

export interface CompressionResult {
  /** Compressed data */
  data: Uint8Array;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio (compressed/original) */
  ratio: number;
}

// =============================================================================
// Compression Functions
// =============================================================================

/**
 * Compress a string using gzip.
 *
 * Uses fflate's gzipSync for fast, synchronous compression.
 * Level 4 provides a good balance of speed and compression (similar to LZ4).
 */
export function compress(
  data: string,
  options: CompressionOptions = {}
): CompressionResult {
  const { level = 4 } = options;

  // Convert string to Uint8Array
  const input = strToU8(data);

  // Compress with gzip
  const compressed = gzipSync(input, { level });

  return {
    data: compressed,
    originalSize: input.length,
    compressedSize: compressed.length,
    ratio: compressed.length / input.length,
  };
}

/**
 * Decompress gzipped data to string.
 */
export function decompress(data: Uint8Array): string {
  const decompressed = gunzipSync(data);
  return strFromU8(decompressed);
}

/**
 * Compress string to base64 (for Redis storage).
 */
export function compressToBase64(
  data: string,
  options: CompressionOptions = {}
): string {
  const result = compress(data, options);
  return uint8ArrayToBase64(result.data);
}

/**
 * Decompress base64 string.
 */
export function decompressFromBase64(base64: string): string {
  const data = base64ToUint8Array(base64);
  return decompress(data);
}

/**
 * Compress string to Buffer (for PostgreSQL bytea storage).
 */
export function compressToBuffer(
  data: string,
  options: CompressionOptions = {}
): Buffer {
  const result = compress(data, options);
  return Buffer.from(result.data);
}

/**
 * Decompress Buffer to string.
 */
export function decompressFromBuffer(buffer: Buffer): string {
  const data = new Uint8Array(buffer);
  return decompress(data);
}

// =============================================================================
// Base64 Utilities
// =============================================================================

/**
 * Convert Uint8Array to base64 string.
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  // Use Buffer in Node.js environment
  if (typeof Buffer !== "undefined") {
    return Buffer.from(arr).toString("base64");
  }

  // Fallback for browser (not used in this project, but included for completeness)
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Use Buffer in Node.js environment
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  // Fallback for browser
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

// =============================================================================
// Estimation Functions
// =============================================================================

/**
 * Estimate compression ratio for HTML content.
 *
 * HTML typically compresses well due to repeated tags.
 * Returns estimated ratio (0.2-0.4 typical).
 */
export function estimateCompressionRatio(html: string): number {
  // Sample-based estimation for large content
  if (html.length > 10000) {
    // Take samples from beginning, middle, end
    const sampleSize = 3000;
    const sample =
      html.slice(0, sampleSize) +
      html.slice(html.length / 2 - sampleSize / 2, html.length / 2 + sampleSize / 2) +
      html.slice(-sampleSize);

    const result = compress(sample);
    return result.ratio;
  }

  // Full compression for small content
  const result = compress(html);
  return result.ratio;
}

/**
 * Check if compression would be beneficial.
 *
 * Compression overhead may not be worth it for very small content.
 */
export function shouldCompress(data: string, minSizeBytes = 512): boolean {
  return data.length >= minSizeBytes;
}
