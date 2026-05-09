import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { logger } from '@/lib/logger';
import { getDashboardMetrics } from "@/server/features/command-center/api/metrics";

/**
 * Command Center Metrics API Route
 * Phase 62-05: Command Center Dashboard Core
 *
 * GET /api/command-center/metrics
 *
 * Returns pre-computed dashboard metrics for client-side refresh.
 * Validates workspace access via Clerk auth.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get workspace ID from header or use org/user fallback
    const headerWorkspaceId = request.headers.get("X-Workspace-Id");
    const workspaceId = headerWorkspaceId || orgId || userId;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing workspace ID" },
        { status: 400 }
      );
    }

    // T-62-05-01: Validate workspace access
    // For now, allow if user is part of the org or it's their personal workspace
    // A stricter check would query workspace membership
    if (headerWorkspaceId && headerWorkspaceId !== orgId && headerWorkspaceId !== userId) {
      // Allow only if workspace matches auth context
      // This prevents fetching metrics for workspaces user doesn't belong to
      return NextResponse.json(
        { error: "Access denied to workspace" },
        { status: 403 }
      );
    }

    // Fetch metrics from backend
    const metrics = await getDashboardMetrics(workspaceId);

    return NextResponse.json(metrics, {
      headers: {
        // Cache for 60 seconds on CDN
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    logger.error("[GET /api/command-center/metrics] Error", error instanceof Error ? error : { error: String(error) });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
