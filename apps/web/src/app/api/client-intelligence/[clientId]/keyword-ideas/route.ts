import { NextResponse } from "next/server";

import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { apiCostLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { getFastApi, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    const authResult = await requireClientAccess(clientId);

    // Rate limit: 100 API calls per hour (keyword ideas uses external APIs)
    const rateLimitResult = await apiCostLimiter.limit(authResult.userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const url = new URL(req.url);
    const qs = url.search;
    const data = await getFastApi(
      `/api/clients/${clientId}/intelligence/keyword-ideas${qs}`
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
