/**
 * WordPress Connection API
 * Phase 61-04: Platform Integration Excellence
 *
 * POST /api/connections/wordpress/connect
 * Stores WordPress Application Password connection with encrypted credentials.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { nanoid } from "nanoid";

const connectSchema = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
  workspaceId: z.string().min(1),
  prospectId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = connectSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { siteUrl, username, appPassword, workspaceId, prospectId } =
    result.data;
  const normalizedUrl = siteUrl.replace(/\/$/, "");

  try {
    // First validate credentials
    const validateResponse = await fetch(
      `${normalizedUrl}/wp-json/wp/v2/users/me`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${username}:${appPassword}`
          ).toString("base64")}`,
        },
      }
    );

    if (!validateResponse.ok) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      );
    }

    const user = await validateResponse.json();

    // Get site info
    let siteName = normalizedUrl;
    try {
      const siteResponse = await fetch(`${normalizedUrl}/wp-json`);
      if (siteResponse.ok) {
        const siteData = await siteResponse.json();
        siteName = siteData.name || normalizedUrl;
      }
    } catch {
      // Use URL as fallback
    }

    // Store connection via backend API
    // credentialType: 'app_password' per D-15
    // CFG-CRIT-01 FIX: Standardized to OPEN_SEO_URL
    const backendUrl =
      process.env.OPEN_SEO_URL || "http://localhost:13001";

    const connectionId = nanoid();
    const storeResponse = await fetch(
      `${backendUrl}/api/platform-connections`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          id: connectionId,
          workspaceId,
          prospectId: prospectId || null,
          platform: "wordpress_org",
          platformAccountId: String(user.id),
          platformAccountName: user.name,
          platformSiteUrl: normalizedUrl,
          credentialType: "app_password",
          credentials: { username, appPassword },
          status: "active",
          connectedBy: userId,
        }),
      }
    );

    if (!storeResponse.ok) {
      const errorText = await storeResponse.text();
      return NextResponse.json(
        { error: `Failed to store connection: ${errorText}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      connectionId,
      platform: "wordpress_org",
      siteName,
      siteUrl: normalizedUrl,
      user: {
        id: user.id,
        name: user.name,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
