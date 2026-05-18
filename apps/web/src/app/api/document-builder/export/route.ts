/**
 * Document Builder PDF Export API Route
 * Phase 102: PDF export endpoint
 *
 * POST endpoint for exporting proposals to PDF.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { proposals } from "@/db/schema/seo-chat";
import { and, eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { exportToPdf } from "@/lib/document-processing/pdf-export";
import {
  unauthorized,
  badRequest,
  validationError,
  notFound,
  internalError,
} from "@/lib/api/responses";
import { validateCsrf } from "@/lib/api/security";

// ---------------------------------------------------------------------------
// Error Types (M-ERR-02)
// ---------------------------------------------------------------------------

/**
 * Export error types for granular error handling.
 * M-ERR-02: Allows clients to handle specific error cases appropriately.
 */
export type ExportErrorType =
  | "PROPOSAL_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "PDF_GENERATION_FAILED"
  | "INVALID_REQUEST"
  | "INTERNAL_ERROR";

/**
 * Create an error response with type classification.
 */
function exportError(
  type: ExportErrorType,
  message: string,
  statusCode: number = 500
) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        type,
        message,
      },
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// Use Node.js runtime for Puppeteer
export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Request Validation Schema
// ---------------------------------------------------------------------------

const variableContextSchema = z.object({
  prospect: z.record(z.string(), z.string()).optional(),
  client: z.record(z.string(), z.string()).optional(),
  agency: z.record(z.string(), z.string()).optional(),
  custom: z.record(z.string(), z.string()).optional(),
});

const exportRequestSchema = z.object({
  proposalId: z.string().uuid(),
  variableContext: variableContextSchema.optional(),
  includeTheme: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // CSRF protection for state-changing request
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    // Authentication check
    const { userId, orgId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    // Content-Type validation
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return badRequest("Content-Type must be application/json");
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const parseResult = exportRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { proposalId, variableContext, includeTheme } = parseResult.data;

    // Determine user's workspace (org takes precedence over personal workspace)
    const userWorkspaceId = orgId || userId;

    // Verify proposal exists AND belongs to user's workspace (IDOR protection)
    const proposal = await db.query.proposals.findFirst({
      where: and(
        eq(proposals.id, proposalId),
        eq(proposals.workspaceId, userWorkspaceId)
      ),
      with: {
        session: true,
      },
    });

    // Return 404 for both not-found and unauthorized (don't reveal existence)
    if (!proposal) {
      return notFound("Proposal not found");
    }

    // Log access for audit trail
    logger.debug("[doc-builder/export] Access check passed", {
      userId,
      orgId,
      workspaceId: userWorkspaceId,
      proposalId,
    });

    logger.info("[doc-builder/export] Exporting PDF", {
      userId,
      proposalId,
      includeTheme,
    });

    // Generate PDF
    const pdfBuffer = await exportToPdf({
      proposalId,
      variableContext: variableContext ?? {},
      includeTheme,
    });

    // Return PDF with appropriate headers
    // Convert Buffer to Uint8Array for Response compatibility
    const pdfUint8Array = new Uint8Array(pdfBuffer);
    return new NextResponse(pdfUint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposal-${proposalId}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-cache",
        // M-SEC-03: Security headers for PDF response
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    logger.error(
      "[doc-builder/export] Export failed",
      error instanceof Error ? error : { error: String(error) }
    );

    // M-ERR-02: Classify error type for better client handling
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";

    // Check for specific error types
    if (errorMessage.includes("puppeteer") || errorMessage.includes("browser") || errorMessage.includes("pdf")) {
      return exportError(
        "PDF_GENERATION_FAILED",
        "PDF generation failed. Please try again or contact support if the issue persists.",
        500
      );
    }

    if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
      return exportError(
        "PDF_GENERATION_FAILED",
        "PDF generation timed out. The proposal may be too large. Please try again.",
        504
      );
    }

    // Default internal error
    return exportError(
      "INTERNAL_ERROR",
      "An unexpected error occurred during export. Please try again.",
      500
    );
  }
}
