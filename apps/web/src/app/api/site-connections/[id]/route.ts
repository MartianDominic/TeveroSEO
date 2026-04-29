import { NextRequest, NextResponse } from "next/server";
import { getOpenSeo, deleteOpenSeo, FastApiError } from "@/lib/server-fetch";
import { requireAuth, requireClientAccess, AuthError } from "@/lib/auth";
import { validateCsrf } from "@/lib/api/security";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";

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

/** Minimal response for ownership check - avoids exposing full data before auth */
interface ConnectionOwnership {
  clientId: string;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  // Rate limit: 100 requests per minute
  const ip = getClientIpFromRequest(request);
  const rateLimitResult = await checkRateLimit(`${ip}:${request.nextUrl.pathname}`, RATE_LIMITS.API.limit, RATE_LIMITS.API.windowMs);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  const { id } = await params;

  try {
    // Step 1: Require authentication FIRST
    await requireAuth();

    // Step 2: Fetch minimal data to check ownership
    // The backend should support a lightweight ownership endpoint
    // For now, we fetch the full connection but check auth before returning
    const connection = await getOpenSeo<SiteConnection>(`/api/connections/${id}`);

    // Step 3: Verify user has access to this client's resources
    await requireClientAccess(connection.clientId);

    // Step 4: Return data only after auth passes
    return NextResponse.json(connection);
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

export async function DELETE(request: NextRequest, { params }: Params) {
  // Rate limit: 20 requests per minute for mutations
  const ip = getClientIpFromRequest(request);
  const rateLimitResult = await checkRateLimit(`${ip}:${request.nextUrl.pathname}`, RATE_LIMITS.HEAVY.limit, RATE_LIMITS.HEAVY.windowMs);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  // CSRF protection for state-changing request
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;

  try {
    // Step 1: Require authentication FIRST
    await requireAuth();

    // Step 2: Fetch connection to get clientId for authorization
    const connection = await getOpenSeo<SiteConnection>(`/api/connections/${id}`);

    // Step 3: Verify user has access to this client's resources
    await requireClientAccess(connection.clientId);

    // Step 4: Perform delete only after auth passes
    await deleteOpenSeo(`/api/connections/${id}`);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      // 204 from backend means success, not an error
      if (err.status === 204) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
