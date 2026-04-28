import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-auth";
import { getFastApi, postFastApi, FastApiError } from "@/lib/server-fetch";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import type { Client } from "@tevero/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  try {
    await requireAuth();
    const data = await getFastApi<Client[]>("/api/clients");
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
  try {
    await requireAuth();
    const body = await req.json();
    const data = await postFastApi<Client>("/api/clients", body);
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

// Rate limit: 20 requests per minute for POST (heavy operation - client creation)
export const POST = withRateLimit(handlePost, RATE_LIMITS.HEAVY);
