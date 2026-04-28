import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getFastApi,
  patchFastApi,
  deleteFastApi,
  postFastApi,
  FastApiError,
} from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth/api-auth";

/**
 * Schema for validating eventId route parameter.
 */
const eventIdSchema = z.string().uuid();

/**
 * Schema for partial event/article updates (PATCH).
 * All fields optional since it's a partial update.
 */
const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // Validate eventId is a valid UUID
  const idParseResult = eventIdSchema.safeParse(eventId);
  if (!idParseResult.success) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  try {
    // Auth + ownership check
    const data = await fetchEventWithAuth(idParseResult.data);
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // Validate eventId is a valid UUID
  const idParseResult = eventIdSchema.safeParse(eventId);
  if (!idParseResult.success) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bodyParseResult = updateEventSchema.safeParse(body);
  if (!bodyParseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: bodyParseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    // Auth + ownership check
    await fetchEventWithAuth(idParseResult.data);

    const data = await patchFastApi(`/api/articles/${idParseResult.data}`, bodyParseResult.data);
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // Validate eventId is a valid UUID
  const idParseResult = eventIdSchema.safeParse(eventId);
  if (!idParseResult.success) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  try {
    // Auth + ownership check
    await fetchEventWithAuth(idParseResult.data);

    const data = await deleteFastApi(`/api/articles/${idParseResult.data}`);
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

// Article action sub-routes are handled via POST to /api/content-calendar/[eventId]
// with an action body. However the CRA stores call /api/articles/{id}/approve etc.
// These are proxied by catching the action in the path. Since Next.js route params
// only catch a single segment, action sub-routes like /approve, /reject, etc. are
// separately proxied here via a POST fallback that forwards to FastAPI.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  // Validate eventId is a valid UUID
  const idParseResult = eventIdSchema.safeParse(eventId);
  if (!idParseResult.success) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  const validatedEventId = idParseResult.data;

  try {
    // Auth + ownership check
    await fetchEventWithAuth(validatedEventId);

    // Extract action from URL path suffix if present
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const action = pathParts[pathParts.length - 1];
    // If the eventId segment IS the action (e.g. /api/content-calendar/approve)
    // this route won't be hit — only if the path is /api/content-calendar/{eventId}
    // with a POST body containing an action.
    const fastApiPath =
      action && action !== validatedEventId
        ? `/api/articles/${validatedEventId}/${action}`
        : `/api/articles/${validatedEventId}`;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine for action endpoints
    }
    const data = await postFastApi(fastApiPath, body);
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
