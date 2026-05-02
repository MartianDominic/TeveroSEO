/**
 * Wix OAuth Callback Endpoint
 * Phase 61-03: Platform Integration Excellence
 *
 * Handles OAuth callback from Wix.
 * GET /api/oauth/wix/callback?code=xxx&state=xxx
 */
import { NextRequest, NextResponse } from "next/server";
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
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/settings/connections`;

  if (error) {
    return NextResponse.redirect(
      `${settingsUrl}?error=${encodeURIComponent(error)}&provider=wix`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${settingsUrl}?error=invalid_request&provider=wix`
    );
  }

  try {
    const storedState = await getOpenSeo<OAuthState | null>(
      `/api/oauth/states/${encodeURIComponent(state)}`
    );

    if (!storedState) {
      return NextResponse.redirect(
        `${settingsUrl}?error=invalid_state&provider=wix`
      );
    }

    if (new Date(storedState.expiresAt) < new Date()) {
      return NextResponse.redirect(
        `${settingsUrl}?error=state_expired&provider=wix`
      );
    }

    if (storedState.usedAt) {
      return NextResponse.redirect(
        `${settingsUrl}?error=state_reused&provider=wix`
      );
    }

    await postOpenSeo<void>(
      `/api/oauth/states/${storedState.id}/mark-used`,
      {}
    );

    const clientId = process.env.WIX_CLIENT_ID;
    const clientSecret = process.env.WIX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${settingsUrl}?error=server_config&provider=wix`
      );
    }

    const tokenResponse = await fetch(
      "https://www.wixapis.com/oauth/access",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        `${settingsUrl}?error=token_exchange_failed&provider=wix`
      );
    }

    const tokens = await tokenResponse.json();

    const connectionPayload: CreateConnectionPayload = {
      workspaceId: storedState.workspaceId,
      prospectId: storedState.prospectId,
      platform: "wix",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresIn: tokens.expires_in ?? 3600,
      tokenType: "Bearer",
      scopesRequested: storedState.scopes,
      scopesGranted: storedState.scopes,
      connectedBy: storedState.userId,
    };

    await postOpenSeo<{ id: string }>(
      "/api/oauth/connections",
      connectionPayload
    );

    try {
      await deleteOpenSeo(`/api/oauth/states/${storedState.id}`);
    } catch {
      // Non-critical
    }

    return NextResponse.redirect(`${settingsUrl}?success=wix`);
  } catch (err) {
    console.error("[OAuth] Wix callback failed:", err);
    return NextResponse.redirect(
      `${settingsUrl}?error=internal_error&provider=wix`
    );
  }
}
