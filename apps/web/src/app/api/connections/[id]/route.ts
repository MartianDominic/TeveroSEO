/**
 * Connection Detail API
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/connections/:id - Get single connection
 * DELETE /api/connections/:id - Remove connection
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const response = await fetch(
      `${backendUrl}/api/platform-connections/${id}`,
      {
        headers: {
          "x-user-id": userId,
          "x-workspace-id": orgId,
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch connection" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ connection: data.connection ?? data });
  } catch (error) {
    console.error("Failed to fetch connection:", error);
    return NextResponse.json(
      { error: "Failed to fetch connection" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const response = await fetch(
      `${backendUrl}/api/platform-connections/${id}`,
      {
        method: "DELETE",
        headers: {
          "x-user-id": userId,
          "x-workspace-id": orgId,
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", errorText);
      return NextResponse.json(
        { error: "Failed to delete connection" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete connection:", error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
