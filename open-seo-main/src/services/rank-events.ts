/**
 * Rank drop events service.
 *
 * Records and queries ranking drops for the alert system.
 */
import { eq, isNull, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { rankDropEvents, type RankDropEventInsert } from "@/db/rank-events-schema";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const logger = createLogger({ module: "rank-events" });

export interface RecordDropEventParams {
  keywordId: string;
  projectId: string;
  clientId: string | null;
  keyword: string;
  previousPosition: number;
  currentPosition: number;
  dropAmount: number;
  threshold: number;
}

/**
 * Record a rank drop event.
 */
export async function recordDropEvent(params: RecordDropEventParams): Promise<string> {
  const id = crypto.randomUUID();
  const event: RankDropEventInsert = {
    id,
    keywordId: params.keywordId,
    projectId: params.projectId,
    clientId: params.clientId,
    keyword: params.keyword,
    previousPosition: params.previousPosition,
    currentPosition: params.currentPosition,
    dropAmount: params.dropAmount,
    threshold: params.threshold,
  };

  try {
    await db.insert(rankDropEvents).values(event);
    return id;
  } catch (error) {
    logger.error("Failed to record drop event", error instanceof Error ? error : undefined, {
      keywordId: params.keywordId,
      projectId: params.projectId,
      clientId: params.clientId,
    });
    throw new AppError("DROP_EVENT_FAILED", "Failed to record ranking drop event");
  }
}

/**
 * Get unprocessed drop events for a client.
 * Used by Phase 18 alert worker.
 */
export async function getUnprocessedDropEvents(clientId: string) {
  return db
    .select()
    .from(rankDropEvents)
    .where(
      and(
        eq(rankDropEvents.clientId, clientId),
        isNull(rankDropEvents.processedAt),
      ),
    )
    .orderBy(desc(rankDropEvents.detectedAt));
}

/**
 * Mark drop events as processed.
 * Uses batch update to avoid N+1 query pattern.
 */
export async function markDropEventsProcessed(
  eventIds: string[],
  processedBy: string,
): Promise<void> {
  if (eventIds.length === 0) return;

  // Batch update instead of loop to avoid N+1
  await db
    .update(rankDropEvents)
    .set({
      processedAt: new Date(),
      processedBy,
    })
    .where(inArray(rankDropEvents.id, eventIds));
}

/**
 * Get recent drop events for a client (for UI display).
 */
export async function getRecentDropEvents(clientId: string, limit = 50) {
  return db
    .select()
    .from(rankDropEvents)
    .where(eq(rankDropEvents.clientId, clientId))
    .orderBy(desc(rankDropEvents.detectedAt))
    .limit(limit);
}
