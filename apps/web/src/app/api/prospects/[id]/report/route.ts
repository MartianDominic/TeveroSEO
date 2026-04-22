/**
 * Prospect Report PDF Download API Route
 * Phase 30-05: Analysis PDF Export
 *
 * GET /api/prospects/:id/report - Download prospect analysis PDF
 *
 * Proxies to open-seo backend for PDF generation.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_SEO_URL = process.env.OPEN_SEO_URL ?? "http://open-seo:3001";

/**
 * GET /api/prospects/[id]/report
 *
 * Download prospect analysis report as PDF.
 * Optionally pass ?analysisId=xxx for a specific analysis.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Get auth token for backend request
    const { getToken } = await auth();
    const token = await getToken();
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

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
