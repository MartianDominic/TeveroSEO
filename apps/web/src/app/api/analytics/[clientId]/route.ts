import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { analyticsLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/[clientId]
 *
 * Fetch analytics data for a client.
 * Rate limit: 30 queries per minute per user (2026-04-28)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    // Rate limit: 30 analytics queries per minute per user
    const { userId } = await auth();
    const rateLimitId = userId ?? "anonymous";
    const rateLimitResult = await analyticsLimiter.limit(rateLimitId);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    await requireClientAccess(clientId);
    const data = await getFastApi(`/api/clients/${clientId}/analytics`);
    return NextResponse.json(data, { headers: rateLimitHeaders(rateLimitResult) });
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
