import { NextRequest, NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";
import { requireAuth, AuthError } from "@/lib/auth";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/voice-templates
 *
 * Returns available voice templates.
 * Requires authentication - templates are platform resources
 * that should only be accessible to authenticated users.
 */
async function handleGet() {
  try {
    // Require authentication to access voice templates
    await requireAuth();

    const data = await getFastApi("/api/voice-templates");
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

// Rate limit: 100 requests per minute (standard API limit)
export const GET = withRateLimit(handleGet, RATE_LIMITS.API);
