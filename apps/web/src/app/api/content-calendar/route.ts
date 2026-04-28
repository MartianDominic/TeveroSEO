import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";

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

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const qs = url.search; // forward query string (e.g. ?client_id=X&status=...)
  try {
    const data = await getFastApi(`/api/articles${qs}`);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const data = await postFastApi("/api/articles", parseResult.data);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
