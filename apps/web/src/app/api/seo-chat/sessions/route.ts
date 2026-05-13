/**
 * SEO Chat Sessions API - List/Create
 * Phase 98-03: API Routes
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSession, listSessions } from "@/lib/seo-chat/session";

/**
 * GET /api/seo-chat/sessions - List sessions
 */
export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const sessions = await listSessions(orgId || userId, { limit: 50 });
  return NextResponse.json(sessions);
}

/**
 * POST /api/seo-chat/sessions - Create session
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { prospectDomain } = await req.json();
  const session = await createSession(orgId || userId, { prospectDomain });
  return NextResponse.json(session);
}
