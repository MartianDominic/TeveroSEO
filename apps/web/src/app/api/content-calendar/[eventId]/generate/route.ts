import { NextResponse } from "next/server";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { validateCsrf, RATE_LIMITS } from "@/lib/api/security";
import { checkRateLimit } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ArticleResponse {
  id: string;
  client_id: string;
  [key: string]: unknown;
}

/**
 * Fetch article/event and verify client ownership.
 * Returns 404 for both not-found and unauthorized (to avoid leaking existence).
 */
async function fetchEventWithAuth(eventId: string): Promise<ArticleResponse> {
  await requireAuth();

  // Fetch article to get client_id
  const article = await getFastApi(`/api/articles/${eventId}`) as ArticleResponse;

  if (!article || !article.client_id) {
    throw new AuthError("Not found", 404);
  }

  // Verify ownership - throws 403 if no access
  try {
    await requireClientAccess(article.client_id);
  } catch (err) {
    // Return 404 instead of 403 to avoid exposing resource existence
    if (err instanceof AuthError && err.statusCode === 403) {
      throw new AuthError("Not found", 404);
    }
    throw err;
  }

  return article;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  try {
    // Heavy rate limit for AI generation (20/minute)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const identifier = `${ip}:/api/content-calendar/generate`;
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMITS.HEAVY.limit, RATE_LIMITS.HEAVY.windowMs);

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests. AI generation is rate limited.", retryAfter },
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

    // Auth + ownership check
    await fetchEventWithAuth(eventId);

    const data = await postFastApi(`/api/articles/${eventId}/generate`, {});
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
