/**
 * Proposal Generation API
 * Phase 98-03: API Routes
 *
 * Creates proposal with magic link using Gemini 3.1 Pro for narrative.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createProposal } from "@/lib/seo-chat/proposal";
import { getSessionContext } from "@/lib/seo-chat/session";

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { sessionId, package: pkg, email, keywords } = await req.json();

  // Verify session ownership
  const session = await getSessionContext(sessionId);
  if (!session || session.workspaceId !== (orgId || userId)) {
    return new Response("Session not found", { status: 404 });
  }

  if (!session.prospectDomain) {
    return new Response("No prospect domain set in session", { status: 400 });
  }

  const proposal = await createProposal({
    sessionId,
    domain: session.prospectDomain,
    package: pkg,
    keywords,
    email,
    workspaceId: session.workspaceId,
  });

  return NextResponse.json({
    proposalId: proposal.id,
    magicLink: `${process.env.NEXT_PUBLIC_URL || "https://tevero.lt"}/p/${proposal.token}`,
    expiresAt: proposal.expiresAt.toISOString(),
    keywordsAssigned: keywords.length,
  });
}
