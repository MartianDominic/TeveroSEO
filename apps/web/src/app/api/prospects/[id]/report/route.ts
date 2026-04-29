/**
 * Prospect Report PDF Download API Route
 * Phase 30-05: Analysis PDF Export
 *
 * GET /api/prospects/:id/report - Download prospect analysis PDF
 *
 * Proxies to open-seo backend for PDF generation.
 *
 * Security:
 * - AUTH-H03 fix: Verifies prospect ownership before allowing download
 * - Rate limited to 5 reports per hour per user (2026-04-28)
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { reportLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_SEO_URL = process.env.OPEN_SEO_URL ?? "http://open-seo:3001";

/**
 * Prospect metadata response from backend.
 * Used to verify ownership.
 */
interface ProspectMetadata {
  id: string;
  userId: string;
  organizationId?: string;
}

/**
 * GET /api/prospects/[id]/report
 *
 * Download prospect analysis report as PDF.
 * Optionally pass ?analysisId=xxx for a specific analysis.
 *
 * SECURITY (AUTH-H03 fix): Verifies prospect ownership before allowing download.
 * Rate limit: 5 reports per hour per user.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Rate limit: 5 reports per hour per user
    const { userId, orgId, getToken } = await auth();
    const rateLimitId = userId ?? "anonymous";
    const rateLimitResult = await reportLimiter.limit(rateLimitId);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // AUTH-H03 FIX: Require authentication
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get auth token for backend request
    const token = await getToken();
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    // AUTH-H03 FIX: Fetch prospect metadata to verify ownership
    const metadataController = new AbortController();
    const metadataTimeoutId = setTimeout(() => metadataController.abort(), 10000);

    let metadataResponse: Response;
    try {
      metadataResponse = await fetch(`${OPEN_SEO_URL}/api/prospects/${id}`, {
        headers,
        signal: metadataController.signal,
      });
    } finally {
      clearTimeout(metadataTimeoutId);
    }

    if (!metadataResponse.ok) {
      if (metadataResponse.status === 404) {
        return NextResponse.json(
          { error: "Prospect not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch prospect metadata" },
        { status: metadataResponse.status }
      );
    }

    const metadata = await metadataResponse.json() as ProspectMetadata;

    // AUTH-H03 FIX: Verify user owns this prospect or is in same org
    const isOwner = metadata.userId === userId;
    const isSameOrg = orgId && metadata.organizationId && orgId === metadata.organizationId;

    if (!isOwner && !isSameOrg) {
      console.warn(`[prospects/report] Access denied: userId=${userId} prospectId=${id} ownerId=${metadata.userId}`);
      return NextResponse.json(
        { error: "Access denied to this prospect" },
        { status: 403 }
      );
    }

    // Forward any query params (e.g., analysisId)
    const url = new URL(req.url);
    const analysisId = url.searchParams.get("analysisId");
    const backendUrl = new URL(`${OPEN_SEO_URL}/api/prospects/${id}/report`);
    if (analysisId) {
      backendUrl.searchParams.set("analysisId", analysisId);
    }

    // Fetch PDF from open-seo backend
    const response = await fetch(backendUrl.toString(), {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: { error?: string } = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { error: errorText || "Download failed" };
      }
      return NextResponse.json(
        { error: errorJson.error || "Download failed" },
        { status: response.status },
      );
    }

    // Get PDF binary and headers
    const pdfBuffer = await response.arrayBuffer();
    const contentDisposition = response.headers.get("Content-Disposition") ?? `attachment; filename="prospect-report-${id}.pdf"`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition,
        "Content-Length": pdfBuffer.byteLength.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Prospect report download error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
