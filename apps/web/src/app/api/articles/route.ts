import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { llmLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/api/security";

// Zod schema for creating an article
const createArticleSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().optional(),
  status: z.enum(["draft", "published", "scheduled", "archived"]).optional(),
  targetKeyword: z.string().max(255).optional(),
  metaDescription: z.string().max(320).optional(),
  scheduledAt: z.string().datetime().optional(),
  voiceProfileId: z.string().uuid().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    // If clientId is provided, verify access; otherwise require basic auth
    if (clientId) {
      // CRITICAL: Verify user has access to this client before listing articles
      await requireClientAccess(clientId);
    } else {
      // For non-client-specific queries, just require authentication
      await requireAuth();
    }

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const data = await getFastApi(`/api/articles${qs}`);
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

export async function POST(req: Request) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  // Parse JSON body with error handling
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate request body with Zod
  const parsed = createArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    // CRITICAL: Verify user has access to this client before creating article
    const authResult = await requireClientAccess(parsed.data.clientId);

    // Rate limit: 50 LLM calls per hour (article creation uses LLM)
    const rateLimitResult = await llmLimiter.limit(authResult.userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const data = await postFastApi(`/api/articles${qs}`, parsed.data);
    return NextResponse.json(data, { status: 201 });
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
