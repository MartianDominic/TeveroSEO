/**
 * Beacon endpoint for proposal view tracking.
 * Phase 46-47: Proposal System
 *
 * GET /api/proposals/beacon?t=<token>
 * Returns a 1x1 transparent GIF and triggers view tracking.
 * Used for tracking email opens and page views without JavaScript.
 *
 * SECURITY: No authentication required - tracking is best-effort.
 * Uses fire-and-forget pattern to not block image response.
 */
import { NextRequest, NextResponse } from "next/server";

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Cache headers to prevent caching (ensures tracking fires each time)
const NO_CACHE_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("t");

  // Always return the pixel immediately, even without token
  if (!token) {
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  }

  // Forward to open-seo-main for tracking (fire-and-forget)
  const openSeoUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  try {
    const userAgent = request.headers.get("user-agent") || "";
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    // Fire-and-forget tracking call (don't block image response)
    fetch(`${openSeoUrl}/api/proposals/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        userAgent,
        ipAddress,
      }),
    }).catch(() => {
      // Ignore errors, tracking is best-effort
    });
  } catch {
    // Ignore errors, tracking is best-effort
  }

  // Always return the pixel immediately
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}
