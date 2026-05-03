/**
 * Wix OAuth Authorization Endpoint
 * Phase 61-03: Platform Integration Excellence
 *
 * Initiates Wix OAuth flow.
 * GET /api/oauth/wix/authorize?prospectId=123
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { postOpenSeo } from "@/lib/server-fetch";

import { logger } from '@/lib/logger';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OAuthStatePayload {
  state: string;
  platform: string;
  workspaceId: string;
  prospectId: string | null;
  userId: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: string;
}

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const prospectId = searchParams.get("prospectId");

  // SEC-07 FIX: Reduced TTL from 10 minutes to 5 minutes for tighter security
  const state = nanoid(32);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/oauth/wix/callback`;

  try {
    const statePayload: OAuthStatePayload = {
      state,
      platform: "wix",
      workspaceId: orgId,
      prospectId: prospectId || null,
      userId,
      redirectUri,
      scopes: ["WIX.SITE.READ", "WIX.CONTACTS.READ", "WIX.BLOG.READ"],
      expiresAt: expiresAt.toISOString(),
    };

    await postOpenSeo<{ id: string }>("/api/oauth/states", statePayload);

    const clientId = process.env.WIX_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Wix OAuth not configured" },
        { status: 500 }
      );
    }

    const authParams = new URLSearchParams({
      appId: clientId,
      redirectUrl: redirectUri,
      state,
    });

    const authUrl = `https://www.wix.com/installer/install?${authParams.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error("[OAuth] Failed to initiate Wix authorization", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
