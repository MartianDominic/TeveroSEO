/**
 * Accept Proposal API Route
 * Phase 65: User Journey Fix - CRIT-J1
 *
 * POST /api/proposals/[proposalId]/accept
 *
 * Accepts a proposal and initiates the agreement generation flow.
 * Called from the public proposal view (/p/[token]) when client clicks
 * "Accept Proposal & Proceed to Agreement".
 *
 * Returns:
 * - agreementToken: Token for the agreement signing page (/c/[agreementToken])
 * - redirectUrl: Alternative redirect URL if agreementToken not available
 *
 * SECURITY (HIGH-25): Rate limited to prevent brute-force attacks.
 * Public endpoint - strict rate limiting (5 requests per minute per IP).
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { RateLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { getOpenSeoUrl } from "@/lib/env";

import { logger } from '@/lib/logger';

/**
 * Strict rate limiter for public proposal acceptance endpoint.
 * 5 attempts per minute per IP to prevent brute-force attacks.
 * Fails closed on Redis outage to prevent abuse.
 */
const acceptLimiter = new RateLimiter({
  maxRequests: 5,
  windowSeconds: 60, // 1 minute
  prefix: "ratelimit:proposal-accept",
  failClosed: true,
});

interface AcceptRequest {
  token?: string; // Public link token for validation
}

interface AcceptResponse {
  success: boolean;
  agreementToken?: string;
  redirectUrl?: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
): Promise<NextResponse<AcceptResponse>> {
  // SECURITY (HIGH-25): Rate limit public endpoint to prevent brute-force attacks
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitResult = await acceptLimiter.limit(ip);

  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: `Too many accept attempts. Please try again in ${retryAfter} seconds.`
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          ...rateLimitHeaders(rateLimitResult),
        },
      }
    );
  }

  try {
    const { proposalId } = await params;
    const body: AcceptRequest = await request.json().catch(() => ({}));

    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: "Proposal ID is required" },
        { status: 400 }
      );
    }

    // Forward the accept request to open-seo-main API
    const response = await fetch(
      `${getOpenSeoUrl()}/api/proposals/${proposalId}/accept`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: body.token,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 404) {
        return NextResponse.json(
          { success: false, error: "Proposal not found" },
          { status: 404 }
        );
      }

      if (response.status === 410) {
        return NextResponse.json(
          { success: false, error: "Proposal has expired" },
          { status: 410 }
        );
      }

      if (response.status === 409) {
        return NextResponse.json(
          { success: false, error: errorData.error || "Proposal already accepted or declined" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: errorData.error || "Failed to accept proposal" },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Return the agreement token or redirect URL for the next step
    return NextResponse.json({
      success: true,
      agreementToken: result.agreementToken,
      redirectUrl: result.redirectUrl,
    });
  } catch (error) {
    logger.error("[AcceptProposal] Error", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
