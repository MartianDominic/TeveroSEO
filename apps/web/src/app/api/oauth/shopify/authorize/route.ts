/**
 * Shopify OAuth Authorization Endpoint
 * Phase 61-03: Platform Integration Excellence
 *
 * Initiates Shopify OAuth flow. Requires shop parameter.
 * GET /api/oauth/shopify/authorize?shop=example-shop&prospectId=123
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";

import { logger } from '@/lib/logger';
import { postOpenSeo } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOPIFY_SCOPES = [
  "read_products",
  "read_content",
  "read_themes",
  "read_online_store_pages",
  "read_publications",
].join(",");

interface OAuthStatePayload {
  state: string;
  platform: string;
  workspaceId: string;
  prospectId: string | null;
  userId: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: string;
  metadata: Record<string, string>;
}

/**
 * Validate and normalize Shopify shop domain.
 */
function normalizeShopDomain(shop: string): string {
  const normalized = shop.toLowerCase().trim();

  if (normalized.endsWith(".myshopify.com")) {
    const shopName = normalized.replace(".myshopify.com", "");
    if (!/^[a-z0-9-]+$/.test(shopName)) {
      throw new Error("Invalid shop domain format");
    }
    return normalized;
  }

  if (!/^[a-z0-9-]+$/.test(normalized)) {
    throw new Error("Invalid shop name format");
  }
  return `${normalized}.myshopify.com`;
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
  const shopParam = searchParams.get("shop");
  const prospectId = searchParams.get("prospectId");

  if (!shopParam) {
    return NextResponse.json(
      { error: "Missing required 'shop' parameter" },
      { status: 400 }
    );
  }

  let shop: string;
  try {
    shop = normalizeShopDomain(shopParam);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }

  // SEC-07 FIX: Reduced TTL from 10 minutes to 5 minutes for tighter security
  const state = nanoid(32);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/oauth/shopify/callback`;

  try {
    const statePayload: OAuthStatePayload = {
      state,
      platform: "shopify",
      workspaceId: orgId,
      prospectId: prospectId || null,
      userId,
      redirectUri,
      scopes: SHOPIFY_SCOPES.split(","),
      expiresAt: expiresAt.toISOString(),
      metadata: { shop },
    };

    await postOpenSeo<{ id: string }>("/api/oauth/states", statePayload);

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Shopify OAuth not configured" },
        { status: 500 }
      );
    }

    const authParams = new URLSearchParams({
      client_id: clientId,
      scope: SHOPIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://${shop}/admin/oauth/authorize?${authParams.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error("[OAuth] Failed to initiate Shopify authorization", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to initiate OAuth flow" },
      { status: 500 }
    );
  }
}
