import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { z } from "zod";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { validateCsrf } from "@/lib/api/security";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

/**
 * Schema for creating a new calendar event/article.
 * Validates required fields and constrains optional fields.
 */
const createEventSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  content: z.string().max(100000).optional(),
  status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  target_keyword: z.string().max(200).optional(),
  meta_description: z.string().max(320).optional(),
  slug: z.string().max(200).regex(/^[a-z0-9-]*$/).optional(),
  author: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  category: z.string().max(100).optional(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id");

    if (!clientId) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    // CRITICAL: Verify user has access to this client before listing articles
    await requireClientAccess(clientId);

    const qs = url.search; // forward query string (e.g. ?client_id=X&status=...)
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

async function handlePost(req: NextRequest) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate request body against schema
  const parseResult = createEventSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    // CRITICAL: Verify user has access to this client before creating article
    await requireClientAccess(parseResult.data.client_id);

    const data = await postFastApi("/api/articles", parseResult.data);
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

// Rate limit: 100 requests per minute for GET (standard API limit)
export const GET = withRateLimit(handleGet, RATE_LIMITS.API);

// Rate limit: 20 requests per minute for POST (content creation)
export const POST = withRateLimit(handlePost, RATE_LIMITS.HEAVY);
