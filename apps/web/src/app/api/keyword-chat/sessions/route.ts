/**
 * Sessions API Routes
 * Phase 82: Chat Integration
 *
 * GET /api/keyword-chat/sessions - List sessions for a client
 * POST /api/keyword-chat/sessions - Create a new session
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

// Note: In production, this would call the open-seo-main API
// For now, we stub with in-memory storage for development

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

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  // TODO: Call open-seo-main API to get sessions
  // For now, return from in-memory store
  const clientSessions = Array.from(sessions.values())
    .filter((s) => s.clientId === clientId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit)
    .map(({ result: _result, ...summary }) => summary);

  return NextResponse.json(clientSessions);
}

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  const required = [
    "clientId",
    "workspaceId",
    "conversation",
    "constraintsHash",
    "keywordCount",
    "selectedCount",
    "excludedCount",
    "breakdown",
  ];
  for (const field of required) {
    if (!(field in body)) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // Generate ID
  const id = crypto.randomUUID();
  const session: Session = {
    id,
    clientId: body.clientId,
    workspaceId: body.workspaceId,
    createdAt: new Date().toISOString(),
    conversation: body.conversation,
    constraintsHash: body.constraintsHash,
    keywordCount: body.keywordCount,
    selectedCount: body.selectedCount,
    excludedCount: body.excludedCount,
    breakdown: body.breakdown,
    result: body.result,
  };

  // TODO: Call open-seo-main API to persist session
  // For now, store in memory
  sessions.set(id, session);

  return NextResponse.json({ id });
}
