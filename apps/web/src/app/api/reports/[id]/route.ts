import { NextResponse } from "next/server";
import { getOpenSeo, FastApiError } from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth";

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
 * Validates that the user has access to the client that owns this report.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Step 1: Require authentication FIRST
    await requireAuth();

    // Step 2: Fetch report to get clientId for ownership check
    const report = await getOpenSeo<ReportMetadata>(`/api/reports/${id}`);

    // Step 3: Verify user has access to the client that owns this report
    await requireClientAccess(report.clientId);

    // Step 4: Return data only after auth passes
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    console.error("Report fetch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
