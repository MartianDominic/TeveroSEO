/**
 * Document Upload API Route
 * Phase 102-07: Task 4 - Upload API with auth and rate limiting
 *
 * POST /api/documents/upload - Upload a document
 * GET /api/documents/upload?documentId=xxx - Get document status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { logger } from "@/lib/logger";
import { uploadDocument, getDocumentStatus, getDocumentWithWorkspace } from "@/lib/document-processing/upload-service";
import {
  unauthorized,
  badRequest,
  validationError,
  forbidden,
  notFound,
  rateLimited,
  serviceUnavailable,
  internalError,
  success,
} from "@/lib/api/responses";

// =============================================================================
// Validation Schemas
// =============================================================================

const uploadFormSchema = z.object({
  workspaceId: z.string().min(1).max(100).optional(),
});

const documentIdSchema = z.string().min(1).max(50);

export const runtime = "nodejs";
export const maxDuration = 60;

// =============================================================================
// POST - Upload Document
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth
    const { userId, orgId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    // Rate limit: 10 uploads per minute
    const rateLimitKey = `document-upload:${userId}`;
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      10, // 10 uploads per minute
      60000 // 1 minute window
    );

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      return rateLimited(`Too many uploads. Please try again in ${retryAfter} seconds.`, retryAfter);
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawWorkspaceId = formData.get("workspaceId") as string | null;

    // Validate form data
    const formValidation = uploadFormSchema.safeParse({
      workspaceId: rawWorkspaceId || undefined,
    });

    if (!formValidation.success) {
      return validationError(formValidation.error);
    }

    if (!file) {
      return badRequest("No file provided");
    }

    // Determine and verify workspace access
    // User can only upload to their own workspace (orgId or userId)
    // If workspaceId is provided, verify it matches user's allowed workspace
    const userWorkspace = orgId || userId;
    const requestedWorkspace = formValidation.data.workspaceId;

    if (requestedWorkspace && requestedWorkspace !== userWorkspace) {
      logger.warn("[upload-api] Cross-workspace upload attempt blocked", {
        userId,
        userWorkspace,
        requestedWorkspace,
      });
      return forbidden("Access denied to workspace");
    }

    const workspaceId = requestedWorkspace || userWorkspace;

    logger.info("[upload-api] Upload request", {
      userId,
      workspaceId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    // Upload and queue for processing
    const result = await uploadDocument(file, workspaceId);

    return success({
      documentId: result.documentId,
      status: result.status,
      message: "Document uploaded and queued for processing",
    });
  } catch (error) {
    logger.error("[upload-api] Upload error", {
      error: error instanceof Error ? error.message : String(error),
    });

    // Return user-friendly error for validation failures
    if (error instanceof Error) {
      if (
        error.message.includes("Unsupported file type") ||
        error.message.includes("too large")
      ) {
        return badRequest(error.message);
      }

      if (error.message.includes("R2 credentials not configured")) {
        return serviceUnavailable("Storage service unavailable");
      }
    }

    return internalError("Upload failed");
  }
}

// =============================================================================
// GET - Document Status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    const rawDocumentId = request.nextUrl.searchParams.get("documentId");

    // Validate documentId parameter
    const documentIdValidation = documentIdSchema.safeParse(rawDocumentId);
    if (!documentIdValidation.success) {
      return badRequest("Invalid or missing documentId");
    }

    const documentId = documentIdValidation.data;

    // Fetch document with workspace info for authorization check
    const doc = await getDocumentWithWorkspace(documentId);

    // Verify user has access to this document's workspace
    const userWorkspace = orgId || userId;
    if (doc.workspaceId !== userWorkspace) {
      logger.warn("[upload-api] Cross-workspace document access blocked", {
        userId,
        userWorkspace,
        documentWorkspace: doc.workspaceId,
        documentId,
      });
      return notFound("Document not found"); // Return 404 to avoid leaking document existence
    }

    // Return status (without workspaceId in response)
    const status = await getDocumentStatus(documentId);
    return success(status);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound("Document not found");
    }

    logger.error("[upload-api] Status error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return internalError("Failed to get status");
  }
}
