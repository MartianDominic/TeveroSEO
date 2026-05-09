/**
 * Session Detail API Route
 * Phase 82: Chat Integration
 *
 * GET /api/keyword-chat/sessions/:sessionId - Get session with result
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

// Shared in-memory store (same as in route.ts)
// TODO: Replace with database calls

interface Session {
  id: string;
  clientId: string;
  workspaceId: string;
  createdAt: string;
  conversation: string;
  constraintsHash: string;
  keywordCount: number;
  selectedCount: number;
  excludedCount: number;
  breakdown: Record<string, unknown>;
  result?: Record<string, unknown>;
}

const sessions = new Map<string, Session>();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const session = sessions.get(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Extract result separately for the response
  const { result, ...summary } = session;

  return NextResponse.json({
    session: summary,
    result: result || null,
  });
}
