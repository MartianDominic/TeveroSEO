import { NextResponse } from "next/server";
import { getOpenSeo, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReportMetadata {
  id: string;
  clientId: string;
  reportType: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  locale: string;
  contentHash: string;
  pdfPath: string | null;
  status: string;
  errorMessage: string | null;
  generatedAt: string | null;
  createdAt: string;
}

/**
 * GET /api/reports/[id]
 *
 * Get report metadata by ID.
 * Returns report status and metadata.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await getOpenSeo<ReportMetadata>(`/api/reports/${id}`);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    console.error("Report fetch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
