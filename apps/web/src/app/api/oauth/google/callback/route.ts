/**
 * Google OAuth Callback Endpoint
 * Phase 61-02: Platform Integration Excellence
 *
 * Handles OAuth 2.0 callback from Google:
 * 1. Rate limits requests (10/minute per IP) to prevent state brute-forcing
 * 2. Validates state parameter (CSRF protection)
 * 3. Exchanges authorization code for tokens
 * 4. Encrypts and stores tokens via backend
 * 5. Redirects to settings page with success/error
 *
 * GET /api/oauth/google/callback?code=xxx&state=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { getOpenSeo, postOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";
import { checkRateLimit, getClientIpFromRequest } from "@/lib/middleware/rate-limit";

import { logger } from '@/lib/logger';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth state record from backend.
 */
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
}

/**
 * Token exchange response from Google.
 */
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Platform connection payload for backend.
 */
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
}

/** OAuth callback rate limit: 10 requests per minute per IP */
const OAUTH_CALLBACK_RATE_LIMIT = 10;
const OAUTH_CALLBACK_WINDOW_MS = 60000; // 1 minute

/**
 * GET /api/oauth/google/callback
 *
 * Query params from Google:
 * - code: Authorization code to exchange for tokens
 * - state: CSRF state parameter
 * - error: Error code if user denied access
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/settings/connections`;

  // Rate limit OAuth callbacks to prevent state brute-forcing attacks
  const ip = getClientIpFromRequest(request);
  const rateLimitKey = `oauth:google:callback:${ip}`;
  const rateLimitResult = await checkRateLimit(
    rateLimitKey,
    OAUTH_CALLBACK_RATE_LIMIT,
    OAUTH_CALLBACK_WINDOW_MS
  );

  if (!rateLimitResult.success) {
    logger.warn("[OAuth] Rate limit exceeded for IP", { value: ip });
    return NextResponse.redirect(
      `${settingsUrl}?error=rate_limited&provider=google`
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors from Google
  if (error) {
    logger.warn("[OAuth] Google returned error", { detail: error, errorDescription });
    const errorParam = encodeURIComponent(error);
    return NextResponse.redirect(
      `${settingsUrl}?error=${errorParam}&provider=google`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    logger.error("[OAuth] Missing code or state parameter");
    return NextResponse.redirect(
      `${settingsUrl}?error=invalid_request&provider=google`
    );
  }

  try {
    // Validate state against backend (CSRF protection)
    const storedState = await getOpenSeo<OAuthState | null>(
      `/api/oauth/states/${encodeURIComponent(state)}`
    );

    if (!storedState) {
      logger.error("[OAuth] State not found or expired", { state });
      return NextResponse.redirect(
        `${settingsUrl}?error=invalid_state&provider=google`
      );
    }

    // Check expiration
    if (new Date(storedState.expiresAt) < new Date()) {
      logger.error("[OAuth] State expired", { state });
      return NextResponse.redirect(
        `${settingsUrl}?error=state_expired&provider=google`
      );
    }

    // Check if already used (prevent replay)
    if (storedState.usedAt) {
      logger.error("[OAuth] State already used", { state });
      return NextResponse.redirect(
        `${settingsUrl}?error=state_reused&provider=google`
      );
    }

    // FIX MED-08: Do NOT mark state as used here - wait until after successful token exchange
    // This prevents marking state as used if token exchange fails

    // Exchange authorization code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error("[OAuth] Google credentials not configured");
      return NextResponse.redirect(
        `${settingsUrl}?error=server_config&provider=google`
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: storedState.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error("[OAuth] Token exchange failed", { error: errorText });
      return NextResponse.redirect(
        `${settingsUrl}?error=token_exchange_failed&provider=google`
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // FIX MED-08: Mark state as used AFTER successful token exchange
    // This ensures state is only marked used when we have valid tokens
    await postOpenSeo<void>(`/api/oauth/states/${storedState.id}/mark-used`, {});

    // SECURITY: Never log tokens
    // Store encrypted tokens via backend
    // FIX CRIT-12: Add idempotency key to prevent duplicate token storage on retry
    const idempotencyKey = `oauth-google-${state}-${storedState.workspaceId}`;
    const connectionPayload: CreateConnectionPayload = {
      workspaceId: storedState.workspaceId,
      prospectId: storedState.prospectId,
      platform: "google_search_console", // Primary platform identifier
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      scopesRequested: storedState.scopes,
      scopesGranted: tokens.scope.split(" "),
      connectedBy: storedState.userId,
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

    // Clean up state record
    try {
      await deleteOpenSeo(`/api/oauth/states/${storedState.id}`);
    } catch (cleanupErr) {
      // Non-critical, log but don't fail
      logger.warn("[OAuth] Failed to cleanup state", { value: cleanupErr });
    }

    // Redirect to settings with success
    return NextResponse.redirect(`${settingsUrl}?success=google`);
  } catch (err) {
    logger.error("[OAuth] Callback processing failed", err instanceof Error ? err : { error: String(err) });
    return NextResponse.redirect(
      `${settingsUrl}?error=internal_error&provider=google`
    );
  }
}
