/**
 * Connection Sync API
 * Phase 61-06: Platform Integration Excellence
 *
 * POST /api/connections/:id/sync - Trigger manual sync
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { logger } from '@/lib/logger';
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const response = await fetch(
      `${backendUrl}/api/platform-connections/${id}/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-workspace-id": orgId,
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (response.status === 400) {
      const data = await response.json();
      return NextResponse.json(
        { error: data.error || "Bad request" },
        { status: 400 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Backend sync error", { error: errorText });
      return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      syncedAt: data.syncedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to sync connection", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
