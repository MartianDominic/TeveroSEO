import { NextRequest, NextResponse } from "next/server";
import { getFastApi, postFastApi, patchFastApi, deleteFastApi, FastApiError } from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { validateCsrf, RATE_LIMITS } from "@/lib/api/security";
import { getClientIpFromRequest, checkRateLimit } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ articleId: string }>;

interface ArticleResponse {
  id: string;
  client_id: string;
  [key: string]: unknown;
}

/**
 * Check rate limit for article operations.
 * Returns 429 response if rate limited, null otherwise.
 */
async function checkArticleRateLimit(req: NextRequest | Request): Promise<NextResponse | null> {
  const ip = req instanceof NextRequest
    ? getClientIpFromRequest(req)
    : req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const identifier = `${ip}:/api/articles`;

  const result = await checkRateLimit(identifier, RATE_LIMITS.API.limit, RATE_LIMITS.API.windowMs);

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMITS.API.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
        }
      }
    );
  }

  return null;
}

/**
 * Fetch article and verify client ownership.
 * Returns 404 for both not-found and unauthorized (to avoid leaking existence).
 */
async function fetchArticleWithAuth(articleId: string): Promise<ArticleResponse> {
  await requireAuth();

  // Fetch article to get client_id
  const article = await getFastApi(`/api/articles/${articleId}`) as ArticleResponse;

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

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    // Rate limit check
    const rateLimitResponse = await checkArticleRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { articleId } = await params;

    // Auth + ownership check
    await fetchArticleWithAuth(articleId);

    // Re-fetch with any query params (the auth fetch was minimal)
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const data = await getFastApi(`/api/articles/${articleId}${qs}`);
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

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    // Rate limit check
    const rateLimitResponse = await checkArticleRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // CSRF protection for state-changing request
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    const { articleId } = await params;

    // Auth + ownership check
    await fetchArticleWithAuth(articleId);

    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const body = await req.json();
    const data = await patchFastApi(`/api/articles/${articleId}${qs}`, body);
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

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    // Rate limit check
    const rateLimitResponse = await checkArticleRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // CSRF protection for state-changing request
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    const { articleId } = await params;

    // Auth + ownership check
    await fetchArticleWithAuth(articleId);

    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    await deleteFastApi(`/api/articles/${articleId}${qs}`);
    return new NextResponse(null, { status: 204 });
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

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    // Rate limit check
    const rateLimitResponse = await checkArticleRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    // CSRF protection for state-changing request
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    const { articleId } = await params;

    // Auth + ownership check
    await fetchArticleWithAuth(articleId);

    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const body = await req.json().catch(() => ({}));
    const data = await postFastApi(`/api/articles/${articleId}${qs}`, body);
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
