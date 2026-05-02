/**
 * Connection List API
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/connections - List all connections for workspace
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prospectId = request.nextUrl.searchParams.get("prospectId");
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const params = new URLSearchParams({ workspaceId: orgId });
    if (prospectId) {
      params.set("prospectId", prospectId);
    }

    const response = await fetch(
      `${backendUrl}/api/platform-connections?${params}`,
      {
        headers: {
          "x-user-id": userId,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch connections" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ connections: data.connections ?? data });
  } catch (error) {
    console.error("Failed to fetch connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}
