import { NextResponse } from "next/server";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateReportRequest {
  clientId: string;
  reportType?: string;
  dateRange?: { start: string; end: string };
  locale?: string;
}

interface GenerateReportResponse {
  reportId: string;
  status: string;
}

/**
 * POST /api/reports/generate
 *
 * Enqueue a report generation job.
 * Returns 202 Accepted with reportId for async processing.
 */
export async function POST(req: Request) {
  try {
    const body: GenerateReportRequest = await req.json();

    // Validate required field
    if (!body.clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 },
      );
    }

    const data = await postOpenSeo<GenerateReportResponse>(
      "/api/reports/generate",
      body,
    );

    return NextResponse.json(data, { status: 202 }); // 202 Accepted - async processing
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    console.error("Report generation error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
