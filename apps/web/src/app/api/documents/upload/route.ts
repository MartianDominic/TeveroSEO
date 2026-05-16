/**
 * Document Upload API Route
 * Phase 102-07: Task 4 - Upload API with auth and rate limiting
 *
 * POST /api/documents/upload - Upload a document
 * GET /api/documents/upload?documentId=xxx - Get document status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { checkRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { logger } from "@/lib/logger";
import { uploadDocument, getDocumentStatus } from "@/lib/document-processing/upload-service";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many uploads. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.reset / 1000)),
          },
        }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const workspaceId = (formData.get("workspaceId") as string) || orgId || userId;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    logger.info("[upload-api] Upload request", {
      userId,
      workspaceId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    // Upload and queue for processing
    const result = await uploadDocument(file, workspaceId);

    return NextResponse.json(
      {
        success: true,
        documentId: result.documentId,
        status: result.status,
        message: "Document uploaded and queued for processing",
      },
      {
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.reset / 1000)),
        },
      }
    );
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
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error.message.includes("R2 credentials not configured")) {
        return NextResponse.json(
          { error: "Storage service unavailable" },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Document Status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documentId = request.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json(
        { error: "documentId required" },
        { status: 400 }
      );
    }

    const status = await getDocumentStatus(documentId);

    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    logger.error("[upload-api] Status error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
