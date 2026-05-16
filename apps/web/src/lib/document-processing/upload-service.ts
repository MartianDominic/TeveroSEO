/**
 * Document Upload Service
 * Phase 102-07: Task 2 - R2 upload service
 *
 * Handles file upload to R2, validation, and database record creation.
 * Queues uploaded documents for async processing.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

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
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      `Unsupported file type: ${file.type}. Allowed: PDF, DOCX, PNG, JPG`
    );
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    throw new Error(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 20MB`
    );
  }

  const documentId = nanoid();
  const r2Key = `${workspaceId}/${documentId}/${file.name}`;
  const fileType = getFileType(file.type);
  const bucket = process.env.R2_BUCKET || "documents";

  logger.info("[upload-service] Uploading document", {
    documentId,
    fileName: file.name,
    fileType,
    fileSize: file.size,
    workspaceId,
  });

  // Upload to R2
  const buffer = Buffer.from(await file.arrayBuffer());
  const r2 = getR2Client();

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  // Create database record
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

// =============================================================================
// Helpers
// =============================================================================

/**
 * Map MIME type to file type category.
 */
function getFileType(mimeType: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("document")) return "docx";
  return "image";
}
