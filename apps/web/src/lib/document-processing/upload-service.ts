/**
 * Document Upload Service
 * Phase 102-07: Task 2 - R2 upload service
 *
 * Handles file upload to R2, validation, and database record creation.
 * Queues uploaded documents for async processing.
 */

import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/db";
import { uploadedDocuments } from "@/db/schema/document-builder";
import { logger } from "@/lib/logger";
import { documentProcessingQueue } from "./processing-queue";

// =============================================================================
// Configuration
// =============================================================================

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
];

/**
 * Magic byte signatures for file type validation.
 * Prevents MIME type spoofing attacks (H2 security fix).
 */
const MAGIC_SIGNATURES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    [0x50, 0x4b, 0x03, 0x04], // PK (ZIP format)
    [0x50, 0x4b, 0x05, 0x06], // PK (empty ZIP)
    [0x50, 0x4b, 0x07, 0x08], // PK (spanned ZIP)
  ],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], // PNG signature
  "image/jpeg": [
    [0xff, 0xd8, 0xff, 0xe0], // JFIF
    [0xff, 0xd8, 0xff, 0xe1], // EXIF
    [0xff, 0xd8, 0xff, 0xdb], // Other JPEG
  ],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF (need to also check "WEBP" at offset 8)
};

/**
 * Memory constraint constants (issue 05-01).
 *
 * Memory usage profile:
 * - Small files (<5MB): Single buffer, ~10MB peak (file + R2 request overhead)
 * - Large files (5-20MB): Streaming multipart, ~15MB peak (MAX_BUFFER_SIZE + chunk)
 * - Backpressure triggers when buffer exceeds MAX_BUFFER_SIZE, forcing flush before accepting more data
 *
 * These limits prevent OOM during:
 * - Network stalls (slow client uploads)
 * - R2 throttling (slow S3 responses)
 * - Concurrent uploads (multiple files in parallel)
 */
const MAX_SIZE = 20 * 1024 * 1024; // 20MB - maximum file size accepted
const STREAMING_THRESHOLD = 5 * 1024 * 1024; // 5MB - use streaming for larger files
const MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB - S3 multipart minimum chunk size
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB - backpressure trigger point

// =============================================================================
// R2 Client (lazy initialization)
// =============================================================================

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 credentials not configured. Required: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
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
// Types
// =============================================================================

export interface UploadResult {
  documentId: string;
  status: string;
}

export interface DocumentStatus {
  id: string;
  fileName: string;
  status: string;
  progress: number;
  error: string | null;
  ocrTier: string | null;
  confidence: number | null;
}

export interface DocumentWithWorkspace {
  id: string;
  workspaceId: string;
}

// =============================================================================
// Upload Document
// =============================================================================

/**
 * Upload a document to R2 and queue for processing.
 *
 * @param file - The file to upload
 * @param workspaceId - Workspace ID for scoped storage
 * @returns Upload result with documentId and status
 * @throws Error if validation fails or upload fails
 */
export async function uploadDocument(
  file: File,
  workspaceId: string
): Promise<UploadResult> {
  // Validate zero-byte files (CRITICAL: issue 20-01)
  if (file.size === 0) {
    throw new Error("Empty file: cannot process zero-byte files");
  }

  // Validate file type (MIME from client - can be spoofed)
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      `Unsupported file type: ${file.type}. Allowed: PDF, DOCX, PNG, JPG, WEBP`
    );
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    throw new Error(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 20MB`
    );
  }

  // Validate magic bytes to prevent MIME type spoofing (H2 security fix)
  const headerBytes = Buffer.from(await file.slice(0, 12).arrayBuffer());
  if (!validateMagicBytes(headerBytes, file.type)) {
    throw new Error(
      `File content does not match claimed type. Ensure you are uploading a valid ${file.type.split("/")[1].toUpperCase()} file.`
    );
  }

  const documentId = nanoid();
  // Sanitize filename to prevent path traversal and special character issues
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const r2Key = `${workspaceId}/${documentId}/${sanitizedFileName}`;
  const fileType = getFileType(file.type);
  const bucket = process.env.R2_BUCKET || "documents";
  const r2 = getR2Client();

  logger.info("[upload-service] Uploading document", {
    documentId,
    fileName: file.name,
    sanitizedFileName,
    fileType,
    fileSize: file.size,
    workspaceId,
    useStreaming: file.size > STREAMING_THRESHOLD,
  });

  // Upload to R2 - use streaming for large files to prevent OOM
  try {
    if (file.size > STREAMING_THRESHOLD) {
      await uploadMultipart(r2, bucket, r2Key, file);
    } else {
      // Small files can be buffered safely
      const buffer = Buffer.from(await file.arrayBuffer());
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: r2Key,
          Body: buffer,
          ContentType: file.type,
        })
      );
    }
  } catch (uploadError) {
    logger.error("[upload-service] R2 upload failed", {
      documentId,
      error: uploadError instanceof Error ? uploadError.message : "Unknown error",
    });
    throw uploadError;
  }

  // Create database record - cleanup R2 on failure
  try {
    await db.insert(uploadedDocuments).values({
      id: documentId,
      workspaceId,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      mimeType: file.type,
      r2Key,
      r2Bucket: bucket,
      status: "pending",
      processingProgress: 0,
    });
  } catch (dbError) {
    // Cleanup orphan file from R2
    logger.error("[upload-service] DB insert failed, cleaning up R2 object", {
      documentId,
      r2Key,
    });
    try {
      await r2.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: r2Key,
        })
      );
    } catch (cleanupError) {
      logger.error("[upload-service] Failed to cleanup R2 object", {
        documentId,
        r2Key,
        error: cleanupError instanceof Error ? cleanupError.message : "Unknown error",
      });
    }
    throw dbError;
  }

  // Queue for processing
  await documentProcessingQueue.add(
    "process",
    { documentId },
    {
      jobId: documentId,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    }
  );

  logger.info("[upload-service] Document queued for processing", {
    documentId,
    r2Key,
  });

  return { documentId, status: "pending" };
}

// =============================================================================
// Get Document Status
// =============================================================================

/**
 * Get the current processing status of a document.
 *
 * @param documentId - The document ID
 * @returns Current document status
 * @throws Error if document not found
 */
export async function getDocumentStatus(
  documentId: string
): Promise<DocumentStatus> {
  const doc = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.id, documentId),
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  return {
    id: doc.id,
    fileName: doc.fileName,
    status: doc.status,
    progress: doc.processingProgress,
    error: doc.processingError,
    ocrTier: doc.ocrTier,
    confidence: doc.ocrConfidence,
  };
}

/**
 * Get document with workspace ID for authorization checks.
 *
 * @param documentId - The document ID
 * @returns Document ID and workspace ID
 * @throws Error if document not found
 */
export async function getDocumentWithWorkspace(
  documentId: string
): Promise<DocumentWithWorkspace> {
  const doc = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.id, documentId),
    columns: {
      id: true,
      workspaceId: true,
    },
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  return {
    id: doc.id,
    workspaceId: doc.workspaceId,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Upload large files using multipart upload to avoid memory issues.
 * Streams file in chunks instead of loading entire file into memory.
 */
async function uploadMultipart(
  r2: S3Client,
  bucket: string,
  key: string,
  file: File
): Promise<void> {
  // Initiate multipart upload
  const createResponse = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: file.type,
    })
  );

  const uploadId = createResponse.UploadId;
  if (!uploadId) {
    throw new Error("Failed to initiate multipart upload");
  }

  const parts: { ETag: string; PartNumber: number }[] = [];

  try {
    // Stream file in chunks with backpressure control (issue 20-02)
    const stream = file.stream();
    const reader = stream.getReader();
    let partNumber = 1;
    let buffer = new Uint8Array(0);

    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        // Check buffer size limit before appending (prevents unbounded growth on network stalls)
        if (buffer.length + value.length > MAX_BUFFER_SIZE) {
          logger.warn("[upload-service] Buffer limit reached, applying backpressure", {
            key,
            currentBufferSize: buffer.length,
            incomingSize: value.length,
            maxBufferSize: MAX_BUFFER_SIZE,
          });
          // Flush buffer before accepting more data
          while (buffer.length >= MULTIPART_CHUNK_SIZE) {
            const chunk = buffer.slice(0, MULTIPART_CHUNK_SIZE);
            buffer = buffer.slice(MULTIPART_CHUNK_SIZE);

            const uploadResponse = await r2.send(
              new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: chunk,
              })
            );

            if (!uploadResponse.ETag) {
              throw new Error(`Missing ETag for part ${partNumber}`);
            }

            parts.push({
              ETag: uploadResponse.ETag,
              PartNumber: partNumber,
            });

            partNumber++;
          }
        }

        // Append chunk to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
      }

      // Upload when buffer reaches chunk size or stream ends
      while (buffer.length >= MULTIPART_CHUNK_SIZE || (done && buffer.length > 0)) {
        const chunk = buffer.slice(0, MULTIPART_CHUNK_SIZE);
        buffer = buffer.slice(MULTIPART_CHUNK_SIZE);

        const uploadResponse = await r2.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: chunk,
          })
        );

        if (!uploadResponse.ETag) {
          throw new Error(`Missing ETag for part ${partNumber}`);
        }

        parts.push({
          ETag: uploadResponse.ETag,
          PartNumber: partNumber,
        });

        partNumber++;

        // Break inner loop if no more data
        if (buffer.length < MULTIPART_CHUNK_SIZE && done) {
          break;
        }
      }

      if (done) break;
    }

    // Complete multipart upload
    await r2.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      })
    );
  } catch (error) {
    // Abort multipart upload on failure to clean up incomplete parts
    try {
      await r2.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        })
      );
    } catch (abortError) {
      logger.error("[upload-service] Failed to abort multipart upload", {
        key,
        uploadId,
        error: abortError instanceof Error ? abortError.message : "Unknown error",
      });
    }
    throw error;
  }
}

/**
 * Validate file magic bytes match claimed MIME type.
 * Prevents MIME type spoofing attacks (H2 security fix).
 *
 * @param buffer - File content buffer
 * @param claimedType - MIME type claimed by client
 * @returns True if magic bytes match claimed type
 */
function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  const signatures = MAGIC_SIGNATURES[claimedType];
  if (!signatures) {
    // Unknown type - reject
    return false;
  }

  // Special case for WebP: check RIFF at start and WEBP at offset 8
  if (claimedType === "image/webp") {
    if (buffer.length < 12) return false;
    const riff = [0x52, 0x49, 0x46, 0x46];
    const webp = [0x57, 0x45, 0x42, 0x50];
    const startsWithRiff = riff.every((byte, i) => buffer[i] === byte);
    const hasWebp = webp.every((byte, i) => buffer[8 + i] === byte);
    return startsWithRiff && hasWebp;
  }

  // Check if any signature matches
  for (const signature of signatures) {
    if (buffer.length < signature.length) continue;
    const matches = signature.every((byte, index) => buffer[index] === byte);
    if (matches) return true;
  }

  return false;
}

/**
 * Map MIME type to file type category.
 */
function getFileType(mimeType: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("document")) return "docx";
  return "image";
}
