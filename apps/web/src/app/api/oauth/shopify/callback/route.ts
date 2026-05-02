/**
 * Shopify OAuth Callback Endpoint
 * Phase 61-03: Platform Integration Excellence
 *
 * Handles OAuth callback from Shopify.
 * GET /api/oauth/shopify/callback?code=xxx&state=xxx&shop=xxx
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const shop = searchParams.get("shop");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/settings/connections`;

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

    await postOpenSeo<void>(
      `/api/oauth/states/${storedState.id}/mark-used`,
      {}
    );

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

    // Shopify tokens do NOT expire
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
      connectionPayload
    );

    try {
      await deleteOpenSeo(`/api/oauth/states/${storedState.id}`);
    } catch {
      // Non-critical
    }

    return NextResponse.redirect(`${settingsUrl}?success=shopify`);
  } catch (err) {
    console.error("[OAuth] Shopify callback failed:", err);
    return NextResponse.redirect(
      `${settingsUrl}?error=internal_error&provider=shopify`
    );
  }
}
