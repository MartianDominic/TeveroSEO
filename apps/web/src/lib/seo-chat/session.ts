/**
 * SEO Chat Session Service
 * Phase 98-03: Session management and context persistence
 */

import { db } from "@/db";
import { seoChatSessions, seoChatMessages } from "@/db/schema/seo-chat";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { SessionContext } from "./types";

/**
 * Get session context with all accumulated state
 */
export async function getSessionContext(
  sessionId: string
): Promise<SessionContext | null> {
  const session = await db.query.seoChatSessions.findFirst({
    where: eq(seoChatSessions.id, sessionId),
    with: { messages: { orderBy: asc(seoChatMessages.createdAt) } },
  });

  if (!session) return null;

  // Build context from session metadata
  const metadata = session.metadata as any;
  return {
    sessionId: session.id,
    workspaceId: session.workspaceId,
    prospectDomain: session.prospectDomain,
    prospectName: (typeof metadata?.prospectName === 'string' ? metadata.prospectName : null),
    prospectEmail: (typeof metadata?.prospectEmail === 'string' ? metadata.prospectEmail : null),
    niche: (typeof metadata?.niche === 'string' ? metadata.niche : null),
    location: (typeof metadata?.location === 'string' ? metadata.location : null),
    keywordsAnalyzed: (typeof metadata?.keywordsAnalyzed === 'number' ? metadata.keywordsAnalyzed : 0),
    analysisHistory: (Array.isArray(metadata?.analysisHistory) ? metadata.analysisHistory : []),
    proposalId: (typeof metadata?.proposalId === 'string' ? metadata.proposalId : null),
    proposalStatus: (typeof metadata?.proposalStatus === 'string' ? metadata.proposalStatus as any : null),
  };
}

/**
 * Save a message to the session
 */
export async function saveMessage(
  sessionId: string,
  message: {
    role: string;
    content: string;
    toolCalls?: any[];
    toolResults?: any[];
  }
): Promise<void> {
  await db.insert(seoChatMessages).values({
    id: nanoid(),
    sessionId,
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls || [],
  });
}

/**
 * Update session context (merge with existing metadata)
 */
export async function updateSessionContext(
  sessionId: string,
  updates: Partial<SessionContext>
): Promise<void> {
  await db
    .update(seoChatSessions)
    .set({
      metadata: sql`metadata || ${JSON.stringify(updates)}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(seoChatSessions.id, sessionId));
}

/**
 * Create a new session
 */
export async function createSession(
  workspaceId: string,
  data: { prospectDomain?: string }
): Promise<any> {
  const [session] = await db
    .insert(seoChatSessions)
    .values({
      id: nanoid(),
      workspaceId,
      prospectDomain: data.prospectDomain,
      status: "active",
    })
    .returning();
  return session;
}

/**
 * List sessions for a workspace
 */
export async function listSessions(
  workspaceId: string,
  options: { limit?: number } = {}
): Promise<any[]> {
  return db.query.seoChatSessions.findMany({
    where: eq(seoChatSessions.workspaceId, workspaceId),
    orderBy: desc(seoChatSessions.updatedAt),
    limit: options.limit || 50,
  });
}

/**
 * Get a single session with messages and analyses
 */
export async function getSession(
  sessionId: string,
  workspaceId: string
): Promise<any | null> {
  return db.query.seoChatSessions.findFirst({
    where: and(
      eq(seoChatSessions.id, sessionId),
      eq(seoChatSessions.workspaceId, workspaceId)
    ),
    with: {
      messages: { orderBy: asc(seoChatMessages.createdAt) },
      analyses: true,
    },
  });
}

/**
 * Archive a session (soft delete)
 */
export async function archiveSession(
  sessionId: string,
  workspaceId: string
): Promise<void> {
  await db
    .update(seoChatSessions)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(
        eq(seoChatSessions.id, sessionId),
        eq(seoChatSessions.workspaceId, workspaceId)
      )
    );
}
