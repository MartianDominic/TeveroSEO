import { NextResponse } from "next/server";

import { validateCsrf, RATE_LIMITS } from "@/lib/api/security";
import { requireAuth, AuthError } from "@/lib/auth";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";
import {
  detectPlatformSchema,
  safeParseJson,
  formatValidationErrors,
} from "@/lib/validations/api-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DetectionResult {
  platform: string;
  confidence: "high" | "medium" | "low";
  signals: Array<{
    type: string;
    platform: string;
    weight: number;
    found: string;
  }>;
}

export async function POST(request: Request) {
  try {
    // Rate limit to prevent SSRF probing (stricter limit - 20/minute)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const identifier = `${ip}:/api/site-connections/detect`;
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
    const csrfError = validateCsrf(request);
    if (csrfError) return csrfError;

    // Require authentication to prevent SSRF reconnaissance attacks
    await requireAuth();

    // Safe JSON parsing
    const jsonResult = await safeParseJson(request);
    if (!jsonResult.success) {
      return NextResponse.json(
        { error: jsonResult.error },
        { status: 400 }
      );
    }

    // Validate with Zod schema
    const parsed = detectPlatformSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: formatValidationErrors(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;

    const data = await postOpenSeo<DetectionResult>(
      "/api/detect-platform",
      body
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
