/**
 * Logo upload/delete proxy route.
 * Proxies to open-seo backend for logo management.
 *
 * POST /api/clients/:clientId/branding/logo - Upload logo
 * DELETE /api/clients/:clientId/branding/logo - Delete logo
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteOpenSeo, FastApiError } from "@/lib/server-fetch";
import { actionLimiters } from "@/lib/rate-limit/action-limiters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_SEO_URL = process.env.OPEN_SEO_URL ?? "http://open-seo:3001";

interface LogoResponse {
  logoUrl?: string;
  message: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    const { getToken, userId } = await auth();

    // Rate limit: 10 uploads per hour per user
    if (userId) {
      const result = await actionLimiters.upload.limit(userId);
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
    }

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
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    console.error("Logo upload proxy error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    const data = await deleteOpenSeo<LogoResponse>(
      `/api/branding/${clientId}/logo`,
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
