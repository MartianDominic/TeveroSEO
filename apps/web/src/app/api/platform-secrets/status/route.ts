import { NextRequest, NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/lib/auth";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { getFastApi, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SecretStatus {
  key_name: string;
  required: boolean;
  configured: boolean;
}

async function handleGet() {
  try {
    // Authentication required - platform secrets are sensitive
    await requireAuth();

    const data = await getFastApi<SecretStatus[]>(
      "/api/platform-secrets/status"
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

// Rate limit: 100 requests per minute (standard API limit)
export const GET = withRateLimit(handleGet, RATE_LIMITS.API);
