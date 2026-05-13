/**
 * SEO Chat Sessions API - Get/Delete by ID
 * Phase 98-03: API Routes
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSession, archiveSession } from "@/lib/seo-chat/session";

/**
 * GET /api/seo-chat/sessions/[id]
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const session = await getSession(id, orgId || userId);
  if (!session) return new Response("Not found", { status: 404 });

  return NextResponse.json(session);
}

/**
 * DELETE /api/seo-chat/sessions/[id] - Archive (soft delete)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  await archiveSession(id, orgId || userId);
  return new Response(null, { status: 204 });
}
