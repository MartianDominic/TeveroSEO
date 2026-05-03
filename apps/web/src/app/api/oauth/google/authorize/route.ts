/**
 * Google OAuth Authorization Endpoint
 * Phase 61-02: Platform Integration Excellence
 *
 * Initiates Google OAuth 2.0 flow for GSC, GA, and/or GBP access.
 * Creates state record for CSRF protection, then redirects to Google.
 *
 * Usage: GET /api/oauth/google/authorize?services=searchConsole,analytics&prospectId=123
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { postOpenSeo } from "@/lib/server-fetch";

import { logger } from '@/lib/logger';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google API scopes for different services.
 */
const GOOGLE_SCOPES = {
  searchConsole: "https://www.googleapis.com/auth/webmasters.readonly",
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
  businessProfile: "https://www.googleapis.com/auth/business.manage",
} as const;

type GoogleService = keyof typeof GOOGLE_SCOPES;

/**
 * OAuth state stored in backend for CSRF validation.
 */
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

/**
 * GET /api/oauth/google/authorize
 *
 * Query params:
 * - services: Comma-separated list of services (searchConsole, analytics, businessProfile)
 * - prospectId: Optional prospect ID to associate connection with
 *
 * Redirects to Google OAuth consent screen.
 */
export async function GET(request: NextRequest) {
  // Require authentication
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized: Authentication required" },
      { status: 401 }
    );
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const servicesParam = searchParams.get("services");
  const prospectId = searchParams.get("prospectId");

  // Parse services (default to searchConsole and analytics if not specified)
  const requestedServices: GoogleService[] = servicesParam
    ? (servicesParam.split(",") as GoogleService[]).filter(
        (s) => s in GOOGLE_SCOPES
      )
    : ["searchConsole", "analytics"];

  // Build scopes string
  const scopes = requestedServices.map((s) => GOOGLE_SCOPES[s]);

  // Generate CSRF state token
  // SEC-07 FIX: Reduced TTL from 10 minutes to 5 minutes for tighter security
  const state = nanoid(32);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes (SEC-07 FIX: reduced from 10)

  // Build redirect URI
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  try {
    // Store state in backend for validation on callback
    const statePayload: OAuthStatePayload = {
      state,
      platform: "google",
      workspaceId: orgId,
      prospectId: prospectId || null,
      userId,
      redirectUri,
      scopes: requestedServices,
      expiresAt: expiresAt.toISOString(),
    };

    await postOpenSeo<{ id: string }>("/api/oauth/states", statePayload);

    // Build Google authorization URL
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      logger.error("[OAuth] GOOGLE_CLIENT_ID not configured");
      return NextResponse.json(
        { error: "Google OAuth not configured" },
        { status: 500 }
      );
    }

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state,
      access_type: "offline", // D-08: Always get refresh token
      prompt: "consent", // D-08: Force consent to ensure refresh token
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

    // Redirect to Google
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error("[OAuth] Failed to initiate authorization", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
