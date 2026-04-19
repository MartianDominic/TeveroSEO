import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_SEO_URL = process.env.OPEN_SEO_URL ?? "http://open-seo:3001";

/**
 * GET /api/reports/[id]/download
 *
 * Download report PDF.
 * Returns PDF binary with correct Content-Type header.
 */
export async function GET(
  _req: Request,
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

    // Fetch PDF bytes from open-seo backend
    const response = await fetch(`${OPEN_SEO_URL}/api/reports/${id}/download`, {
      headers,
    });

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
