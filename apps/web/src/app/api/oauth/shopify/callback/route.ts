/**
 * Shopify OAuth Callback Endpoint
 * Phase 61-03: Platform Integration Excellence
 *
 * Handles OAuth callback from Shopify:
 * 1. Rate limits requests (10/minute per IP) to prevent state brute-forcing
 * 2. Validates state parameter (CSRF protection)
 * 3. Exchanges authorization code for tokens
 * 4. Stores tokens via backend
 * 5. Redirects to settings page with success/error
 *
 * GET /api/oauth/shopify/callback?code=xxx&state=xxx&shop=xxx
 */
import { NextRequest, NextResponse } from "next/server";

import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIpFromRequest } from "@/lib/middleware/rate-limit";
import { getOpenSeo, postOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OAuthState {
  id: string;
  state: string;
  platform: string;
  workspaceId: string;
  prospectId: string | null;
  userId: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: string;
  usedAt: string | null;
  metadata: { shop?: string };
}

interface CreateConnectionPayload {
  workspaceId: string;
  prospectId: string | null;
  platform: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  tokenType: string;
  scopesRequested: string[];
  scopesGranted: string[];
  connectedBy: string;
  metadata: Record<string, string>;
}

/** OAuth callback rate limit: 10 requests per minute per IP */
const OAUTH_CALLBACK_RATE_LIMIT = 10;
const OAUTH_CALLBACK_WINDOW_MS = 60000; // 1 minute

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/settings/connections`;

  // Rate limit OAuth callbacks to prevent state brute-forcing attacks
  const ip = getClientIpFromRequest(request);
  const rateLimitKey = `oauth:shopify:callback:${ip}`;
  const rateLimitResult = await checkRateLimit(
    rateLimitKey,
    OAUTH_CALLBACK_RATE_LIMIT,
    OAUTH_CALLBACK_WINDOW_MS
  );

  if (!rateLimitResult.success) {
    logger.warn("[OAuth] Rate limit exceeded for IP", { value: ip });
    return NextResponse.redirect(
      `${settingsUrl}?error=rate_limited&provider=shopify`
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const shop = searchParams.get("shop");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(error)}&provider=shopify`
    );
  }

  if (!code || !state || !shop) {
    return NextResponse.redirect(
      `${settingsUrl}?error=invalid_request&provider=shopify`
    );
  }

  try {
    const storedState = await getOpenSeo<OAuthState | null>(
      `/api/oauth/states/${encodeURIComponent(state)}`
    );

    if (!storedState) {
      return NextResponse.redirect(
        `${settingsUrl}?error=invalid_state&provider=shopify`
      );
    }

    if (new Date(storedState.expiresAt) < new Date()) {
      return NextResponse.redirect(
        `${settingsUrl}?error=state_expired&provider=shopify`
      );
    }

    if (storedState.usedAt) {
      return NextResponse.redirect(
        `${settingsUrl}?error=state_reused&provider=shopify`
      );
    }

    // FIX MED-08: Do NOT mark state as used here - wait until after successful token exchange

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${settingsUrl}?error=server_config&provider=shopify`
      );
    }

    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        `${settingsUrl}?error=token_exchange_failed&provider=shopify`
      );
    }

    const tokens = await tokenResponse.json();

    // FIX MED-08: Mark state as used AFTER successful token exchange
    await postOpenSeo<void>(
      `/api/oauth/states/${storedState.id}/mark-used`,
      {}
    );

    // Shopify tokens do NOT expire
    // FIX CRIT-12: Add idempotency key to prevent duplicate token storage on retry
    const idempotencyKey = `oauth-shopify-${state}-${storedState.workspaceId}`;
    const connectionPayload: CreateConnectionPayload = {
      workspaceId: storedState.workspaceId,
      prospectId: storedState.prospectId,
      platform: "shopify",
      accessToken: tokens.access_token,
      refreshToken: null,
      expiresIn: Number.MAX_SAFE_INTEGER,
      tokenType: "Bearer",
      scopesRequested: storedState.scopes,
      scopesGranted: tokens.scope.split(","),
      connectedBy: storedState.userId,
      metadata: { shop },
    };

    await postOpenSeo<{ id: string }>(
      "/api/oauth/connections",
      connectionPayload,
      {
        headers: {
          "X-Idempotency-Key": idempotencyKey,
        },
      }
    );

    try {
      await deleteOpenSeo(`/api/oauth/states/${storedState.id}`);
    } catch {
      // Non-critical
    }

    return NextResponse.redirect(`${settingsUrl}?success=shopify`);
  } catch (err) {
    logger.error("[OAuth] Shopify callback failed", err instanceof Error ? err : { error: String(err) });
    return NextResponse.redirect(
      `${settingsUrl}?error=internal_error&provider=shopify`
    );
  }
}
