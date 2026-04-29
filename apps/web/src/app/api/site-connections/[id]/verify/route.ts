import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOpenSeo, postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/api/security";
import { verifyLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SiteConnection {
  id: string;
  clientId: string;
  platform: string;
  siteUrl: string;
  displayName: string | null;
  hasCredentials: boolean;
  capabilities: string[] | null;
  status: string;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VerifyResult {
  success: boolean;
  error?: string;
}

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;

  try {
    // Rate limit: 10 verifications per minute per user (SSRF protection)
    const { userId } = await auth();
    const rateLimitId = userId ?? "anonymous";
    const rateLimitResult = await verifyLimiter.limit(rateLimitId);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // Fetch connection first to get clientId for authorization
    const connection = await getOpenSeo<SiteConnection>(`/api/connections/${id}`);

    // Verify user has access to this client's resources
    await requireClientAccess(connection.clientId);

    const data = await postOpenSeo<VerifyResult>(
      `/api/connections/${id}/verify`,
      {}
    );
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
