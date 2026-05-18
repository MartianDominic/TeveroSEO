/**
 * PDF Download API Route
 * Phase 59-07: Agreement PDF generation endpoint
 *
 * GET /api/agreements/:agreementId/pdf
 *
 * Returns PDF as attachment with proper headers.
 *
 * Query params:
 * - signatures: "false" to exclude signature section
 * - locale: "lt" for Lithuanian date formats (default: "en")
 *
 * Security:
 * - Requires authentication
 * - Returns 404 for non-existent agreement
 * - Cache-Control: no-store prevents caching of sensitive documents
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/lib/auth/api-auth";
import { logger } from '@/lib/logger';
import { getOpenSeo, FastApiError } from "@/lib/server-fetch";
import { getPdfGenerationService } from "@/server/services/pdf-generation-service";
import {
  badRequest,
  notFound,
  unauthorized,
  internalError,
} from "@/lib/api/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgreementBasic {
  id: string;
  title: string;
  workspaceId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agreementId: string }> }
): Promise<NextResponse> {
  try {
    // Require authentication
    await requireAuth();

    const { agreementId } = await params;

    // Validate agreementId format
    if (!agreementId || typeof agreementId !== "string") {
      return badRequest("Invalid agreement ID");
    }

    // Verify agreement exists (this also checks workspace access via open-seo-main auth)
    let agreement: AgreementBasic;
    try {
      agreement = await getOpenSeo<AgreementBasic>(
        `/api/agreements/${agreementId}`
      );
    } catch (err) {
      if (err instanceof FastApiError && err.status === 404) {
        return notFound("Agreement not found");
      }
      throw err;
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const includeSignatures = searchParams.get("signatures") !== "false";
    const localeParam = searchParams.get("locale");
    const locale = localeParam === "lt" ? "lt" : "en";

    // Generate PDF
    const pdfService = getPdfGenerationService();
    const pdfBytes = await pdfService.generateAgreementPdf(agreementId, {
      includeSignatures,
      locale,
    });

    // Create safe filename from agreement title
    const safeTitle = agreement.title
      .replace(/[^a-z0-9]/gi, "-")
      .replace(/-+/g, "-")
      .substring(0, 50)
      .replace(/^-|-$/g, "");

    const filename = `${safeTitle || "agreement"}-${agreementId}.pdf`;

    // Return PDF response with proper headers
    // Convert Uint8Array to Buffer for NextResponse compatibility
    const pdfBuffer = Buffer.from(pdfBytes);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.length.toString(),
        // Prevent caching of sensitive documents
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    // Handle authentication errors using standardized response helper
    if (err instanceof AuthError) {
      return unauthorized(err.message);
    }

    // Handle API errors from open-seo-main using standardized response helper
    if (err instanceof FastApiError) {
      // Use internalError for backend failures - don't expose internal error codes
      logger.error("[PDF Route] Backend error", {
        status: err.status,
        message: err.sanitizedBody.error,
      });
      return internalError("Backend service error");
    }

    // Log unexpected errors (don't expose details to client)
    logger.error("[PDF Route] Generation error", err instanceof Error ? err : { error: String(err) });

    return internalError("Failed to generate PDF");
  }
}
