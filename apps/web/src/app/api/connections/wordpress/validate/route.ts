/**
 * WordPress Credential Validation API
 * Phase 61-04: Platform Integration Excellence
 *
 * POST /api/connections/wordpress/validate
 * Validates WordPress Application Password credentials.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const validateSchema = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
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

  // MED-API-01: Use 422 for validation errors (semantic distinction from 400 bad request)
  const result = validateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 422 }
    );
  }

  const { siteUrl, username, appPassword } = result.data;

  // Normalize URL
  const normalizedUrl = siteUrl.replace(/\/$/, "");

  try {
    // Validate credentials via WordPress REST API
    const response = await fetch(
      `${normalizedUrl}/wp-json/wp/v2/users/me`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${username}:${appPassword}`
          ).toString("base64")}`,
        },
      }
    );

    if (response.status === 401) {
      return NextResponse.json({
        valid: false,
        error: "Invalid username or application password",
      });
    }

    if (response.status === 403) {
      return NextResponse.json({
        valid: false,
        error: "Insufficient permissions",
      });
    }

    if (!response.ok) {
      return NextResponse.json({
        valid: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const user = await response.json();
    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        slug: user.slug,
        roles: user.roles ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
