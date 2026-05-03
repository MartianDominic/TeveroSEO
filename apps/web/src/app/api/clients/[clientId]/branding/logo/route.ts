/**
 * Logo upload/delete proxy route.
 * Proxies to open-seo backend for logo management.
 *
 * POST /api/clients/:clientId/branding/logo - Upload logo
 * DELETE /api/clients/:clientId/branding/logo - Delete logo
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { deleteOpenSeo, FastApiError } from "@/lib/server-fetch";
import { actionLimiters } from "@/lib/rate-limit/action-limiters";
import { validateCsrf } from "@/lib/api/security";
import { getClientIpFromRequest } from "@/lib/middleware/rate-limit";
import { getOpenSeoUrl } from "@/lib/env";

import { logger } from '@/lib/logger';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open SEO URL from centralized env (validated at startup) */
const OPEN_SEO_URL = getOpenSeoUrl();

interface LogoResponse {
  logoUrl?: string;
  message: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { clientId } = await params;
    const { getToken, userId } = await auth();

    // SECURITY: Always apply rate limiting, even for unauthenticated requests
    // Use userId if available, otherwise fall back to IP-based limiting
    const rateLimitKey = userId || `anon:${getClientIpFromRequest(req)}`;
    const result = await actionLimiters.upload.limit(rateLimitKey);
    if (!result.success) {
      const resetInMinutes = Math.ceil((result.resetAt - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Upload rate limit exceeded. Try again in ${resetInMinutes} minute(s).` },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // AUTH-H04 FIX: Verify user has access to this client before uploading logo
    // This was missing from POST but present in DELETE - now consistent
    await requireClientAccess(clientId);

    const token = await getToken();

    // Forward multipart form data directly to open-seo
    const formData = await req.formData();

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${OPEN_SEO_URL}/api/branding/${clientId}/logo`,
      {
        method: "POST",
        headers,
        body: formData,
      },
    );

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      return NextResponse.json(parsed ?? { error: "Upload failed" }, {
        status: response.status,
      });
    }

    return NextResponse.json(parsed as LogoResponse);
  } catch (err) {
    // AUTH-H04 FIX: Handle auth errors from requireClientAccess
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    logger.error("Logo upload proxy error", err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { clientId } = await params;

    // CRITICAL: Verify user has access to this client before deleting logo
    await requireClientAccess(clientId);

    const data = await deleteOpenSeo<LogoResponse>(
      `/api/branding/${clientId}/logo`,
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
