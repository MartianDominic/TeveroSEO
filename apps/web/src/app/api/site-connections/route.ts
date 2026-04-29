import { NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { z } from "zod";
import { getOpenSeo, postOpenSeo, FastApiError } from "@/lib/server-fetch";
import { validateCsrf } from "@/lib/api/security";
import { generalApiLimiter, connectionTestLimiter, rateLimitHeaders } from "@/lib/rate-limit";

// Zod schema for creating a site connection
const createConnectionSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  platform: z.enum(["wordpress", "shopify", "wix", "squarespace", "webflow", "custom"]),
  siteUrl: z.string().url("siteUrl must be a valid URL"),
  displayName: z.string().optional(),
  credentials: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
    appPassword: z.string().optional(),
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    siteId: z.string().optional(),
    accountId: z.string().optional(),
  }).optional(),
});

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

/**
 * GET /api/site-connections
 *
 * List site connections for a client.
 * Rate limit: 100 requests per minute per user (2026-04-28)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  try {
    // CRITICAL: Verify user has access to this client before listing connections
    const authContext = await requireClientAccess(clientId);

    // Rate limit: 100 requests per minute
    const rateLimitResult = await generalApiLimiter.limit(authContext.userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const data = await getOpenSeo<SiteConnection[]>(
      `/api/connections?clientId=${encodeURIComponent(clientId)}`
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

/**
 * POST /api/site-connections
 *
 * Create a new site connection.
 * Rate limit: 10 connections per minute per user (SSRF protection) (2026-04-28)
 */
export async function POST(request: Request) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  // Parse JSON body with error handling
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate request body with Zod
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    // CRITICAL: Verify user has access to this client before creating connection
    const authContext = await requireClientAccess(parsed.data.clientId);

    // Rate limit: 10 connection creations per minute (SSRF protection)
    const rateLimitResult = await connectionTestLimiter.limit(authContext.userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const data = await postOpenSeo<SiteConnection>("/api/connections", parsed.data);
    return NextResponse.json(data, { status: 201, headers: rateLimitHeaders(rateLimitResult) });
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
