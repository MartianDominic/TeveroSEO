import { NextResponse } from "next/server";
import { postFastApi, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { rateLimitAction, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rate limit config for scrape operations: 5 scrapes per hour per user */
const SCRAPE_RATE_LIMIT = { limit: 5, windowMs: 3600000 }; // 1 hour

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  try {
    const authResult = await requireClientAccess(clientId);

    // Rate limit: 5 scrapes per hour per user (heavy operation)
    const { userId } = await auth();
    await rateLimitAction(`scrape:${clientId}`, userId, SCRAPE_RATE_LIMIT);

    const data = await postFastApi(
      `/api/clients/${clientId}/intelligence/scrape`,
      {}
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
    // Handle rate limit errors
    if (err instanceof Error && err.message.includes("Rate limit exceeded")) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
