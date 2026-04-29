import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { validateCsrf, RATE_LIMITS } from "@/lib/api/security";
import { checkRateLimit } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zod schema for report generation request validation.
 * HIGH-INPUT-01 fix: Add comprehensive validation with length constraints.
 */
const generateReportSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  reportType: z.enum(["seo", "content", "technical", "full", "performance", "backlinks"])
    .optional()
    .default("full"),
  dateRange: z.object({
    start: z.string().datetime("start must be a valid ISO datetime"),
    end: z.string().datetime("end must be a valid ISO datetime"),
  }).optional().refine(
    (range) => !range || new Date(range.start) <= new Date(range.end),
    { message: "start date must be before or equal to end date" }
  ),
  locale: z.string()
    .max(10, "locale must be at most 10 characters")
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "locale must be in format 'en' or 'en-US'")
    .optional()
    .default("en"),
});

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

    // HIGH-INPUT-01 fix: Comprehensive Zod validation
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const validation = generateReportSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const body = validation.data;

    // CRITICAL: Verify user has access to this client before generating report
    await requireClientAccess(body.clientId);

    const data = await postOpenSeo<GenerateReportResponse>(
      "/api/reports/generate",
      body,
    );

    return NextResponse.json(data, { status: 202 }); // 202 Accepted - async processing
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    console.error("Report generation error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
