/**
 * Sandboxed processor for keyword ranking checks.
 *
 * Queries all tracking-enabled keywords, fetches SERP data from DataForSEO,
 * and stores daily position snapshots.
 *
 * Features:
 * - Idempotent: duplicate processing on same day is safely handled
 * - Transaction-safe: database operations use proper error handling
 * - Rate limited: respects DataForSEO API limits
 * - Batch processing: handles large keyword sets efficiently
 * - Input validation: Zod schemas prevent injection attacks
 */

import type { Job } from "bullmq";
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { savedKeywords, projects } from "@/db/app.schema";
import { keywordRankings } from "@/db/ranking-schema";
import { fetchLiveSerpItemsRaw, type SerpLiveItem } from "@/server/lib/dataforseo";
import { createLogger } from "@/server/lib/logger";
import type { RankingJobData } from "@/server/queues/rankingQueue";
import { recordDropEvent } from "@/services/rank-events";
import { withRetry, fireAndForget } from "./utils/error-handler";

const log = createLogger({ module: "ranking-processor" });

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY_MS = 100; // 100ms between API calls to respect rate limits

/**
 * Zod schema for ranking job data validation.
 * Validates job payloads to prevent injection attacks and malformed data.
 */
const RankingJobDataSchema = z.object({
  triggeredAt: z.string().datetime({ message: "triggeredAt must be a valid ISO datetime string" }),
  offset: z.number().int().min(0).optional(),
});

/**
 * Validate job data and throw descriptive error if invalid.
 */
function validateRankingJobData(data: unknown): z.infer<typeof RankingJobDataSchema> {
  const result = RankingJobDataSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Invalid ranking job data: ${errors}`);
  }
  return result.data;
}

/**
 * Extract position from SERP results for a target domain.
 * Returns 0 if not ranking in top 100.
 */
function extractPosition(
  items: SerpLiveItem[],
  targetDomain: string | null,
): { position: number; url: string | null } {
  if (!targetDomain) {
    // No domain set on project, return first organic result position
    const firstOrganic = items.find((item) => item.type === "organic");
    return {
      position: firstOrganic?.rank_absolute ?? 0,
      url: firstOrganic?.url ?? null,
    };
  }

  // Find organic result matching project domain
  const matchingResult = items.find(
    (item) =>
      item.type === "organic" &&
      item.domain?.includes(targetDomain),
  );

  return {
    position: matchingResult?.rank_absolute ?? 0,
    url: matchingResult?.url ?? null,
  };
}

/**
 * Extract SERP features present in results.
 */
function extractSerpFeatures(items: SerpLiveItem[]): string[] {
  const features = new Set<string>();
  for (const item of items) {
    if (item.type && item.type !== "organic" && item.type !== "paid") {
      features.add(item.type);
    }
  }
  return Array.from(features);
}

/**
 * Sleep utility for rate limiting.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get previous position for a keyword (most recent ranking).
 */
async function getPreviousPosition(keywordId: string): Promise<number | null> {
  const [lastRanking] = await db
    .select({ position: keywordRankings.position })
    .from(keywordRankings)
    .where(eq(keywordRankings.keywordId, keywordId))
    .orderBy(desc(keywordRankings.date))
    .limit(1);

  return lastRanking?.position ?? null;
}

/**
 * Check if a ranking record already exists for the given keyword and date.
 * Returns the existing record if found, null otherwise.
 * This enables idempotent processing - duplicate job runs are safe.
 */
async function getExistingRanking(
  keywordId: string,
  date: Date,
): Promise<{ position: number; url: string | null } | null> {
  const [existing] = await db
    .select({
      position: keywordRankings.position,
      url: keywordRankings.url,
    })
    .from(keywordRankings)
    .where(
      and(
        eq(keywordRankings.keywordId, keywordId),
        eq(keywordRankings.date, date),
      ),
    )
    .limit(1);

  return existing ?? null;
}

/**
 * Insert or update a ranking record.
 * Uses ON CONFLICT DO UPDATE for idempotency - safe to retry.
 */
async function upsertRanking(
  keywordId: string,
  position: number,
  previousPosition: number | null,
  url: string | null,
  date: Date,
  serpFeatures: string[],
): Promise<void> {
  await db
    .insert(keywordRankings)
    .values({
      id: crypto.randomUUID(),
      keywordId,
      position,
      previousPosition,
      url,
      date,
      serpFeatures,
    })
    .onConflictDoUpdate({
      target: [keywordRankings.keywordId, keywordRankings.date],
      set: {
        position,
        previousPosition,
        url,
        serpFeatures,
        // Note: id is not updated to preserve the original record ID
      },
    });
}

/**
 * Process a batch of keywords.
 * Each keyword is processed independently - failures don't affect others.
 */
async function processBatch(
  keywords: Array<{
    id: string;
    keyword: string;
    locationCode: number;
    languageCode: string;
    projectDomain: string | null;
    projectId: string;
    clientId: string | null;
    dropAlertThreshold: number | null;
  }>,
  today: Date,
): Promise<{ success: number; failed: number; drops: number; skipped: number }> {
  let success = 0;
  let failed = 0;
  let drops = 0;
  let skipped = 0;

  for (const kw of keywords) {
    try {
      // Idempotency check: skip if already processed today
      const existing = await getExistingRanking(kw.id, today);
      if (existing) {
        log.debug("Skipping already processed keyword", {
          keywordId: kw.id,
          keyword: kw.keyword,
          existingPosition: existing.position,
        });
        skipped++;
        continue;
      }

      // Fetch SERP data from DataForSEO with retry logic
      const response = await withRetry(
        () => fetchLiveSerpItemsRaw(kw.keyword, kw.locationCode, kw.languageCode),
        {
          maxAttempts: 2,
          initialDelayMs: 500,
          shouldRetry: (error) => {
            // Only retry on transient errors, not on auth/quota errors
            const err = error instanceof Error ? error : new Error(String(error));
            const isTransient = err.message.includes("ETIMEDOUT") ||
              err.message.includes("ECONNRESET") ||
              err.message.includes("503") ||
              err.message.includes("429");
            return isTransient;
          },
        },
      );

      const items = response.data;
      const { position, url } = extractPosition(items, kw.projectDomain);
      const serpFeatures = extractSerpFeatures(items);
      const previousPosition = await getPreviousPosition(kw.id);

      // Upsert ranking record (idempotent)
      await upsertRanking(
        kw.id,
        position,
        previousPosition,
        url,
        today,
        serpFeatures,
      );

      // Check for rank drop and record event if threshold exceeded
      // Use fire-and-forget for non-critical alert recording
      const threshold = kw.dropAlertThreshold ?? 5;
      if (previousPosition !== null && position > 0 && previousPosition > 0) {
        const dropAmount = position - previousPosition;
        if (dropAmount >= threshold) {
          fireAndForget(
            `record-drop-${kw.id}`,
            recordDropEvent({
              keywordId: kw.id,
              projectId: kw.projectId,
              clientId: kw.clientId,
              keyword: kw.keyword,
              previousPosition,
              currentPosition: position,
              dropAmount,
              threshold,
            }),
          );
          drops++;
          log.warn("Rank drop detected", {
            keywordId: kw.id,
            keyword: kw.keyword,
            previousPosition,
            currentPosition: position,
            dropAmount,
            threshold,
          });
        }
      }

      success++;
      log.info("Ranking recorded", {
        keywordId: kw.id,
        keyword: kw.keyword,
        position,
        previousPosition,
      });
    } catch (error) {
      failed++;
      log.error("Failed to check ranking", error instanceof Error ? error : new Error(String(error)), {
        keywordId: kw.id,
        keyword: kw.keyword,
      });
      // Continue processing other keywords - don't let one failure stop the batch
    }

    // Rate limiting delay
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  return { success, failed, drops, skipped };
}

/**
 * Main processor function for ranking checks.
 *
 * This processor is idempotent - running multiple times on the same day
 * will skip already-processed keywords and only process new ones.
 * Validates job data before processing to prevent injection attacks.
 */
export default async function processor(job: Job<RankingJobData>): Promise<void> {
  const jobLogger = createLogger({ module: "ranking-processor", jobId: job.id });

  // Validate job data before processing
  const validatedData = validateRankingJobData(job.data);

  // Resume from checkpoint offset if this is a retry
  let offset = validatedData.offset ?? 0;
  const isRetry = job.attemptsMade > 0;

  jobLogger.info("Starting ranking check", {
    triggeredAt: validatedData.triggeredAt,
    attempt: job.attemptsMade + 1,
    resumeOffset: isRetry ? offset : undefined,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalDrops = 0;
  let totalSkipped = 0;

  // Process in batches
  while (true) {
    // Query tracking-enabled keywords with project domain and alert config
    let keywords;
    try {
      keywords = await db
        .select({
          id: savedKeywords.id,
          keyword: savedKeywords.keyword,
          locationCode: savedKeywords.locationCode,
          languageCode: savedKeywords.languageCode,
          projectDomain: projects.domain,
          projectId: savedKeywords.projectId,
          clientId: projects.organizationId, // organizationId maps to clientId
          dropAlertThreshold: savedKeywords.dropAlertThreshold,
        })
        .from(savedKeywords)
        .innerJoin(projects, eq(savedKeywords.projectId, projects.id))
        .where(eq(savedKeywords.trackingEnabled, true))
        .limit(BATCH_SIZE)
        .offset(offset);
    } catch (dbError) {
      jobLogger.error(
        "Database error fetching keywords",
        dbError instanceof Error ? dbError : new Error(String(dbError)),
        { offset, batchSize: BATCH_SIZE }
      );
      throw dbError; // Re-throw to trigger job retry
    }

    if (keywords.length === 0) {
      break;
    }

    const { success, failed, drops, skipped } = await processBatch(keywords, today);
    totalSuccess += success;
    totalFailed += failed;
    totalDrops += drops;
    totalSkipped += skipped;
    offset += BATCH_SIZE;

    // Checkpoint progress in job data for resumable processing on retry
    await job.updateData({ ...job.data, offset });

    // Update job progress for long-running batches
    const progress = Math.min(99, Math.floor((offset / (offset + BATCH_SIZE)) * 100));
    await job.updateProgress(progress);

    jobLogger.info("Batch completed", {
      batchSize: keywords.length,
      success,
      failed,
      drops,
      skipped,
      totalProcessed: offset,
    });
  }

  // Final progress update
  await job.updateProgress(100);

  jobLogger.info("Ranking check completed", {
    totalSuccess,
    totalFailed,
    totalDrops,
    totalSkipped,
    totalProcessed: totalSuccess + totalFailed + totalSkipped,
  });

  // If all keywords failed, throw to trigger retry
  if (totalSuccess === 0 && totalFailed > 0 && totalSkipped === 0) {
    throw new Error(`All ${totalFailed} keywords failed to process`);
  }
}
