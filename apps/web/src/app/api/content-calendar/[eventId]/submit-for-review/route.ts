import { NextRequest, NextResponse } from "next/server";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { validateCsrf } from "@/lib/api/security";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";

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
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  // Rate limit: 30 requests per minute for actions
  const ip = getClientIpFromRequest(req);
  const rateLimitResult = await checkRateLimit(`${ip}:${req.nextUrl.pathname}`, RATE_LIMITS.ACTION.limit, RATE_LIMITS.ACTION.windowMs);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  const { eventId } = await params;
  try {
    // Auth + ownership check
    await fetchEventWithAuth(eventId);

    const data = await postFastApi(
      `/api/articles/${eventId}/submit-for-review`,
      {}
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
