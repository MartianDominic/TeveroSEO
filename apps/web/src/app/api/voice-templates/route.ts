import { NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";
import { requireAuth, AuthError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/voice-templates
 *
 * Returns available voice templates.
 * Requires authentication - templates are platform resources
 * that should only be accessible to authenticated users.
 */
export async function GET() {
  try {
    // Require authentication to access voice templates
    await requireAuth();

    const data = await getFastApi("/api/voice-templates");
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
