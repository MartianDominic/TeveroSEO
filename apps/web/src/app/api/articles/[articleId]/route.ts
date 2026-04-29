import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFastApi, postFastApi, patchFastApi, deleteFastApi, FastApiError } from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { validateCsrf, RATE_LIMITS } from "@/lib/api/security";
import { getClientIpFromRequest, checkRateLimit } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zod schema for PATCH request body validation.
 * Allows partial updates to article fields.
 * API-H07 fix: Validate input before passing to backend.
 */
const articlePatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500_000).optional(), // Max 500KB content
  excerpt: z.string().max(2000).optional(),
  status: z.enum(["draft", "review", "approved", "published", "archived"]).optional(),
  seo_title: z.string().max(200).optional(),
  seo_description: z.string().max(500).optional(),
  slug: z.string().max(200).regex(/^[a-z0-9-]+$/).optional(),
  featured_image: z.string().url().max(2000).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  categories: z.array(z.string().max(100)).max(20).optional(),
  author_id: z.string().uuid().optional(),
  publish_at: z.string().datetime().optional().nullable(),
  voice_compliance_score: z.number().min(0).max(100).optional(),
  seo_score: z.number().min(0).max(100).optional(),
}).strict(); // Reject unknown fields

/**
 * Zod schema for POST request body validation.
 * Used for creating article sub-resources (e.g., publish, schedule).
 * API-H07 fix: Validate input before passing to backend.
 */
const articlePostSchema = z.object({
  action: z.enum(["publish", "unpublish", "schedule", "duplicate", "archive"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  targetClientId: z.string().uuid().optional(), // For duplicate action
  metadata: z.record(z.string().max(100), z.unknown()).optional(),
}).strict(); // Reject unknown fields

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

    // API-H07 fix: Validate input before passing to backend
    const rawBody = await req.json();
    const validation = articlePatchSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = await patchFastApi(`/api/articles/${articleId}${qs}`, validation.data);
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

    // API-H07 fix: Validate input before passing to backend
    const rawBody = await req.json().catch(() => ({}));
    const validation = articlePostSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = await postFastApi(`/api/articles/${articleId}${qs}`, validation.data);
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
