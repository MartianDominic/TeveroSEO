import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-auth";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { llmLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
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
  try {
    const authResult = await requireAuth();

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
    const body = await req.json();
    const data = await postFastApi(`/api/articles${qs}`, body);
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
