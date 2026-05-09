import { NextResponse } from "next/server";

import { z } from "zod";

import {
  badRequest,
  validationError,
  rateLimited,
  internalError,
  accepted,
} from "@/lib/api/responses";
import { validateCsrf, RATE_LIMITS } from "@/lib/api/security";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { logger } from '@/lib/logger';
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";
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
      return rateLimited("Too many requests", retryAfter);
    }

    // CSRF protection for state-changing request
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    // HIGH-INPUT-01 fix: Comprehensive Zod validation
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    // 422 for validation errors (semantic distinction from 400 bad request)
    const validation = generateReportSchema.safeParse(rawBody);
    if (!validation.success) {
      return validationError(validation.error);
    }

    const body = validation.data;

    // CRITICAL: Verify user has access to this client before generating report
    await requireClientAccess(body.clientId);

    const data = await postOpenSeo<GenerateReportResponse>(
      "/api/reports/generate",
      body,
    );

    return accepted(data);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    logger.error("Report generation error", err instanceof Error ? err : { error: String(err) });
    return internalError();
  }
}
