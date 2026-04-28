import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { validateCsrf, RATE_LIMITS } from "@/lib/api/security";
import { checkRateLimit } from "@/lib/middleware/rate-limit";

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
    // Heavy rate limit for report generation (20/minute)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const identifier = `${ip}:/api/reports/generate`;
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMITS.HEAVY.limit, RATE_LIMITS.HEAVY.windowMs);

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests", retryAfter },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(RATE_LIMITS.HEAVY.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.reset / 1000)),
          }
        }
      );
    }

    // CSRF protection for state-changing request
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
