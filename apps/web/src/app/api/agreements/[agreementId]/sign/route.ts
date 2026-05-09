/**
 * Sign Agreement API Route
 * Phase 65: User Journey Fix - CRIT-J1
 *
 * POST /api/agreements/[agreementId]/sign
 *
 * Signs an agreement electronically and triggers the invoice/payment flow.
 *
 * Returns:
 * - paymentUrl: URL for the payment page (Stripe/Revolut)
 * - redirectUrl: Alternative redirect URL if payment URL not available
 *
 * SECURITY (HIGH-24): Rate limited to prevent brute-force token guessing.
 * Public endpoint - strict rate limiting (5 requests per minute per IP).
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 */
import { NextRequest, NextResponse } from "next/server";

import { getOpenSeoUrl } from "@/lib/env";
import { logger } from '@/lib/logger';
import { RateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

/**
 * Strict rate limiter for public agreement signing endpoint.
 * 5 attempts per minute per IP to prevent brute-force attacks.
 * Fails closed on Redis outage to prevent abuse.
 */
const signLimiter = new RateLimiter({
  maxRequests: 5,
  windowSeconds: 60, // 1 minute
  prefix: "ratelimit:agreement-sign",
  failClosed: true,
});

interface SignRequest {
  token: string;
  signature: string;
}

interface SignResponse {
  success: boolean;
  paymentUrl?: string;
  redirectUrl?: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agreementId: string }> }
): Promise<NextResponse<SignResponse>> {
  // SECURITY (HIGH-24): Rate limit public endpoint to prevent brute-force attacks
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitResult = await signLimiter.limit(ip);

  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: `Too many sign attempts. Please try again in ${retryAfter} seconds.`
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
    const { agreementId } = await params;
    const body: SignRequest = await request.json();

    if (!agreementId) {
      return NextResponse.json(
        { success: false, error: "Agreement ID is required" },
        { status: 400 }
      );
    }

    if (!body.signature || body.signature.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Signature is required" },
        { status: 400 }
      );
    }

    // Forward the sign request to open-seo-main API
    const response = await fetch(
      `${getOpenSeoUrl()}/api/agreements/${agreementId}/sign`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: body.token,
          signature: body.signature.trim(),
          signedAt: new Date().toISOString(),
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] ||
            request.headers.get("x-real-ip") ||
            "127.0.0.1",
          userAgent: request.headers.get("user-agent") || "",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 404) {
        return NextResponse.json(
          { success: false, error: "Agreement not found" },
          { status: 404 }
        );
      }

      if (response.status === 410) {
        return NextResponse.json(
          { success: false, error: "Agreement has expired" },
          { status: 410 }
        );
      }

      if (response.status === 409) {
        return NextResponse.json(
          { success: false, error: errorData.error || "Agreement already signed" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: errorData.error || "Failed to sign agreement" },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Return the payment URL or redirect URL for the next step
    return NextResponse.json({
      success: true,
      paymentUrl: result.paymentUrl,
      redirectUrl: result.redirectUrl,
    });
  } catch (error) {
    logger.error("[SignAgreement] Error", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
