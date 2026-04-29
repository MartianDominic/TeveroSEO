import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { downloadLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { validateClientOwnership } from "@/lib/auth/client-ownership";
import { getOpenSeoUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open SEO URL from centralized env (validated at startup) */
const OPEN_SEO_URL = getOpenSeoUrl();

/**
 * Report metadata response from backend.
 * Used to get clientId for ownership verification.
 */
interface ReportMetadata {
  id: string;
  clientId: string;
  title?: string;
}

/**
 * GET /api/reports/[id]/download
 *
 * Download report PDF.
 * Returns PDF binary with correct Content-Type header.
 *
 * SECURITY (AUTH-H02 fix): Verifies client ownership before allowing download.
 * Rate limit: 20 downloads per hour per user (2026-04-28)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Rate limit: 20 downloads per hour per user
    const { userId, getToken } = await auth();
    const rateLimitId = userId ?? "anonymous";
    const rateLimitResult = await downloadLimiter.limit(rateLimitId);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // AUTH-H02 FIX: Require authentication
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

    // AUTH-H02 FIX: Fetch report metadata first to get clientId for ownership check
    const metadataController = new AbortController();
    const metadataTimeoutId = setTimeout(() => metadataController.abort(), 10000);

    let metadataResponse: Response;
    try {
      metadataResponse = await fetch(`${OPEN_SEO_URL}/api/reports/${id}`, {
        headers,
        signal: metadataController.signal,
      });
    } finally {
      clearTimeout(metadataTimeoutId);
    }

    if (!metadataResponse.ok) {
      if (metadataResponse.status === 404) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch report metadata" },
        { status: metadataResponse.status }
      );
    }

    const metadata = await metadataResponse.json() as ReportMetadata;

    // AUTH-H02 FIX: Verify user has access to this client's reports
    try {
      await validateClientOwnership(userId, metadata.clientId);
    } catch {
      // Log for security audit but return generic 403
      console.warn(`[reports/download] Access denied: userId=${userId} reportId=${id} clientId=${metadata.clientId}`);
      return NextResponse.json(
        { error: "Access denied to this report" },
        { status: 403 }
      );
    }

    // Fetch PDF bytes from open-seo backend with timeout (user has verified access)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let response: Response;
    try {
      response = await fetch(`${OPEN_SEO_URL}/api/reports/${id}/download`, {
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || "Download failed" },
        { status: response.status },
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${id}.pdf"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("Report download error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
