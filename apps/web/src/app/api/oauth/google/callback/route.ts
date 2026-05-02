/**
 * Google OAuth Callback Endpoint
 * Phase 61-02: Platform Integration Excellence
 *
 * Handles OAuth 2.0 callback from Google:
 * 1. Validates state parameter (CSRF protection)
 * 2. Exchanges authorization code for tokens
 * 3. Encrypts and stores tokens via backend
 * 4. Redirects to settings page with success/error
 *
 * GET /api/oauth/google/callback?code=xxx&state=xxx
 */
import { NextRequest, NextResponse } from "next/server";
import { getOpenSeo, postOpenSeo, deleteOpenSeo } from "@/lib/server-fetch";

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

/**
 * GET /api/oauth/google/callback
 *
 * Query params from Google:
 * - code: Authorization code to exchange for tokens
 * - state: CSRF state parameter
 * - error: Error code if user denied access
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/settings/connections`;

  // Handle OAuth errors from Google
  if (error) {
    console.warn("[OAuth] Google returned error:", error, errorDescription);
    const errorParam = encodeURIComponent(error);
    return NextResponse.redirect(
      `${settingsUrl}?error=${errorParam}&provider=google`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    console.error("[OAuth] Missing code or state parameter");
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
      console.error("[OAuth] State not found or expired:", state);
      return NextResponse.redirect(
        `${settingsUrl}?error=invalid_state&provider=google`
      );
    }

    // Check expiration
    if (new Date(storedState.expiresAt) < new Date()) {
      console.error("[OAuth] State expired:", state);
      return NextResponse.redirect(
        `${settingsUrl}?error=state_expired&provider=google`
      );
    }

    // Check if already used (prevent replay)
    if (storedState.usedAt) {
      console.error("[OAuth] State already used:", state);
      return NextResponse.redirect(
        `${settingsUrl}?error=state_reused&provider=google`
      );
    }

    // Mark state as used (via backend)
    await postOpenSeo<void>(`/api/oauth/states/${storedState.id}/mark-used`, {});

    // Exchange authorization code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[OAuth] Google credentials not configured");
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
      console.error("[OAuth] Token exchange failed:", errorText);
      return NextResponse.redirect(
        `${settingsUrl}?error=token_exchange_failed&provider=google`
      );
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // SECURITY: Never log tokens
    // Store encrypted tokens via backend
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
      connectionPayload
    );

    // Clean up state record
    try {
      await deleteOpenSeo(`/api/oauth/states/${storedState.id}`);
    } catch (cleanupErr) {
      // Non-critical, log but don't fail
      console.warn("[OAuth] Failed to cleanup state:", cleanupErr);
    }

    // Redirect to settings with success
    return NextResponse.redirect(`${settingsUrl}?success=google`);
  } catch (err) {
    console.error("[OAuth] Callback processing failed:", err);
    return NextResponse.redirect(
      `${settingsUrl}?error=internal_error&provider=google`
    );
  }
}
