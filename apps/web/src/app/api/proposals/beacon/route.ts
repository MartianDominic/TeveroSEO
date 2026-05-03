/**
 * Beacon endpoint for proposal view tracking.
 * Phase 46-47: Proposal System
 *
 * GET /api/proposals/beacon?t=<token>
 * Returns a 1x1 transparent GIF and triggers view tracking.
 * Used for tracking email opens and page views without JavaScript.
 *
 * SECURITY:
 * - Supports both signed beacon tokens (HMAC-verified) and legacy raw tokens
 * - Signed tokens provide cryptographic validation and expiration
 * - Invalid/expired tokens are rejected and logged for monitoring
 * - Uses fire-and-forget pattern to not block image response
 */
import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  verifyBeaconToken,
  isSignedBeaconToken,
  BeaconTokenError,
} from "@/lib/auth/beacon-tokens";

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

/**
 * Validate and extract proposal token from beacon token.
 *
 * Supports two token formats:
 * 1. Signed beacon tokens (HMAC-verified, with expiration)
 * 2. Legacy raw proposal tokens (32-char nanoid, high entropy)
 *
 * @returns The proposal token if valid, null if invalid/expired
 */
async function extractProposalToken(token: string): Promise<string | null> {
  // Check if this is a signed beacon token
  if (isSignedBeaconToken(token)) {
    try {
      const { proposalToken, expiresAt } = await verifyBeaconToken(token);

      // Double-check expiration (verifyBeaconToken already checks, but be defensive)
      if (Date.now() > expiresAt) {
        logger.info("[beacon] Signed token expired", {
          proposalToken: proposalToken.slice(0, 8) + "...",
          expiredAt: new Date(expiresAt).toISOString(),
        });
        return null;
      }

      return proposalToken;
    } catch (error) {
      if (error instanceof BeaconTokenError) {
        logger.warn("[beacon] Token validation failed", {
          code: error.code,
          message: error.message,
        });
      }
      return null;
    }
  }

  // Legacy format: raw proposal token (32-char nanoid)
  // Validate basic format (alphanumeric, min 20 chars for entropy)
  if (token.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(token)) {
    logger.debug("[beacon] Using legacy raw token format", {
      tokenLength: token.length,
    });
    return token;
  }

  logger.warn("[beacon] Invalid token format", {
    tokenLength: token.length,
  });
  return null;
}

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

  // Validate and extract the proposal token
  const proposalToken = await extractProposalToken(token);

  if (!proposalToken) {
    // Invalid or expired token - return pixel but don't track
    // This prevents enumeration attacks while maintaining UX
    return new NextResponse(TRANSPARENT_GIF, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  }

  // Forward to open-seo-main for tracking (fire-and-forget)
  const openSeoUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  try {
    const userAgent = request.headers.get("user-agent") || "";

    // SECURITY: Validate X-Forwarded-For against trusted proxy
    // Only trust forwarded headers if request came through our verified proxy
    const proxySecret = request.headers.get("x-proxy-secret");
    const expectedSecret = process.env.PROXY_SECRET;
    const forwardedFor = request.headers.get("x-forwarded-for");

    let ipAddress: string;
    if (expectedSecret && proxySecret === expectedSecret && forwardedFor) {
      // Trust the forwarded IP from verified proxy
      ipAddress = forwardedFor.split(",")[0].trim();
    } else if (process.env.TRUST_CLOUDFLARE === "true") {
      // Cloudflare provides CF-Connecting-IP
      ipAddress = request.headers.get("cf-connecting-ip") || "127.0.0.1";
    } else if (process.env.VERCEL) {
      // Vercel provides x-vercel-forwarded-for
      ipAddress =
        request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
        "127.0.0.1";
    } else {
      // Fall back to x-real-ip only if no forwarded header (less spoofable)
      const realIp = request.headers.get("x-real-ip");
      ipAddress = realIp && !forwardedFor ? realIp.trim() : "127.0.0.1";
    }

    // Fire-and-forget tracking call (don't block image response)
    fetch(`${openSeoUrl}/api/proposals/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: proposalToken,
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
