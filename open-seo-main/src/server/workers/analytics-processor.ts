/**
 * Sandboxed BullMQ processor for analytics sync jobs.
 *
 * Runs in a child process to isolate Google API calls from the main event loop.
 *
 * Job types:
 *   - sync-all-clients: Fan-out to per-client jobs
 *   - sync-client-analytics: Actual GSC/GA4 sync for one client
 */
import type { Job } from "bullmq";
import type {
  AnalyticsSyncJobData,
  SyncAllClientsJobData,
  SyncStage,
} from "@/server/queues/analyticsQueue";
import { analyticsQueue } from "@/server/queues/analyticsQueue";
import { createLogger, type Logger } from "@/server/lib/logger";
import { getValidCredentials } from "@/server/services/analytics/google-auth";
import {
  fetchGSCDateMetrics,
  fetchGSCTopQueries,
  getGSCDateRange,
} from "@/server/services/analytics/gsc-client";
import {
  fetchGA4Metrics,
  getGA4DateRange,
} from "@/server/services/analytics/ga4-client";
import { db } from "@/db";
import {
  gscSnapshots,
  gscQuerySnapshots,
  ga4Snapshots,
} from "@/db/schema";
import type {
  GSCSnapshotInsert,
  GSCQuerySnapshotInsert,
  GA4SnapshotInsert,
} from "@/db/analytics-schema";
import { sql } from "drizzle-orm";
import { alwrityPool } from "@/server/lib/alwrity-db";

/**
 * Default chunk size for batch inserts.
 * PostgreSQL can handle larger batches, but 100 provides a good balance
 * between performance and memory usage.
 */
const BATCH_CHUNK_SIZE = 100;

/**
 * Process an array in chunks with checkpoint-based progress tracking.
 * If the job has existing progress for this stage, resumes from the last completed chunk.
 * After each chunk, updates job data with the checkpoint so retries resume correctly.
 *
 * @param job - BullMQ job with progress tracking in data
 * @param rows - Array of items to process
 * @param stage - Current processing stage (gsc, queries, ga4)
 * @param chunkSize - Number of items per chunk
 * @param processor - Async function to process each chunk
 * @param logger - Logger for checkpoint events
 */
async function processChunksWithCheckpoint<T>(
  job: Job<AnalyticsSyncJobData>,
  rows: T[],
  stage: SyncStage,
  chunkSize: number,
  processor: (chunk: T[]) => Promise<void>,
  logger: Logger,
): Promise<void> {
  if (rows.length === 0) {
    logger.debug(`No rows to process for stage ${stage}`);
    return;
  }

  // Determine starting point - resume from last checkpoint if same stage
  const startChunk =
    job.data.progress?.stage === stage ? job.data.progress.chunksCompleted : 0;

  const totalChunks = Math.ceil(rows.length / chunkSize);

  if (startChunk > 0) {
    logger.info(`Resuming ${stage} from chunk ${startChunk + 1}/${totalChunks}`);
  }

  for (let i = startChunk; i < totalChunks; i++) {
    const start = i * chunkSize;
    const chunk = rows.slice(start, start + chunkSize);

    await processor(chunk);

    // Checkpoint progress after each chunk
    await job.updateData({
      ...job.data,
      progress: { stage, chunksCompleted: i + 1 },
    });

    logger.debug(`Checkpoint: ${stage} chunk ${i + 1}/${totalChunks}`);
  }

  logger.info(`Completed all ${totalChunks} chunks for stage ${stage}`);
}

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processAnalyticsJob(
  job: Job<AnalyticsSyncJobData | SyncAllClientsJobData>,
): Promise<void> {
  const logger = createLogger({
    module: "analytics-processor",
    jobId: job.id,
  });

  if (job.name === "sync-all-clients") {
    const data = job.data as SyncAllClientsJobData;
    await fanOutToClients(data.mode, logger);
    return;
  }

  if (job.name === "sync-client-analytics") {
    await syncClientAnalytics(job as Job<AnalyticsSyncJobData>, logger);
    return;
  }

  logger.error(`Unknown job name: ${job.name}`);
}

/**
 * Fan-out: Query all clients with active Google tokens, enqueue per-client jobs.
 * Uses the shared alwrityPool instead of creating a new Pool per call.
 */
async function fanOutToClients(
  mode: "incremental" | "backfill",
  logger: Logger,
): Promise<void> {
  logger.info("Fan-out: querying active Google clients", { mode });

  // Query AI-Writer DB for active Google tokens using shared pool
  const result = await alwrityPool.query(`
    SELECT DISTINCT client_id::text as client_id
    FROM client_oauth_tokens
    WHERE provider = 'google' AND is_active = true
  `);

  const clientIds = result.rows.map((r) => r.client_id);
  logger.info("Found clients with active Google tokens", {
    clientCount: clientIds.length,
  });

  for (const clientId of clientIds) {
    await analyticsQueue.add(
      "sync-client-analytics",
      {
        clientId,
        provider: "google",
        mode,
      },
      {
        jobId: `sync-${clientId}-${Date.now()}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      },
    );
  }

  logger.info("Enqueued per-client sync jobs", {
    jobCount: clientIds.length,
  });
}

/**
 * Per-client sync: Fetch tokens, call GSC/GA4 APIs, write snapshots.
 * Supports checkpoint-based resume - skips stages that are already complete.
 */
async function syncClientAnalytics(
  job: Job<AnalyticsSyncJobData>,
  _parentLogger: Logger,
): Promise<void> {
  const { clientId, mode, progress } = job.data;
  const logger = createLogger({
    module: "analytics-processor",
    jobId: job.id,
    clientId,
  });

  // Log resume state if applicable
  if (progress) {
    logger.info("Resuming client analytics sync", {
      mode,
      resumeStage: progress.stage,
      chunksCompleted: progress.chunksCompleted,
    });
  } else {
    logger.info("Starting client analytics sync", { mode });
  }

  // Step 1: Get valid credentials (refreshes if needed)
  let creds;
  try {
    creds = await getValidCredentials(clientId);
  } catch (err) {
    logger.error("Failed to get credentials", err as Error);
    throw err; // Let BullMQ retry
  }

  const { accessToken, gscSiteUrl, ga4PropertyId } = creds;

  // Determine which stages to skip based on progress
  const currentStage = progress?.stage;
  const shouldSkipGSC = currentStage === "queries" || currentStage === "ga4" || currentStage === "complete";
  const shouldSkipQueries = currentStage === "ga4" || currentStage === "complete";
  const shouldSkipGA4 = currentStage === "complete";

  // Step 2: Sync GSC data if site URL configured (unless resuming past this stage)
  if (gscSiteUrl && !shouldSkipGSC) {
    await syncGSCData(job, accessToken, gscSiteUrl, logger);
  } else if (!gscSiteUrl) {
    logger.info("No GSC site URL configured, skipping GSC sync");
  } else if (shouldSkipGSC) {
    logger.info("Skipping GSC sync (already complete)");
  }

  // Step 3: Sync GSC query data (unless resuming past this stage)
  if (gscSiteUrl && !shouldSkipQueries) {
    await syncGSCQueryData(job, accessToken, gscSiteUrl, logger);
  } else if (shouldSkipQueries && gscSiteUrl) {
    logger.info("Skipping GSC query sync (already complete)");
  }

  // Step 4: Sync GA4 data if property ID configured (unless resuming past this stage)
  if (ga4PropertyId && !shouldSkipGA4) {
    await syncGA4Data(job, accessToken, ga4PropertyId, logger);
  } else if (!ga4PropertyId) {
    logger.info("No GA4 property ID configured, skipping GA4 sync");
  } else if (shouldSkipGA4) {
    logger.info("Skipping GA4 sync (already complete)");
  }

  // Mark job as complete
  await job.updateData({
    ...job.data,
    progress: { stage: "complete", chunksCompleted: 0 },
  });

  logger.info("Sync complete");
}

/**
 * Sync GSC daily metrics with checkpoint-based progress tracking.
 * After completion, advances stage to 'queries'.
 */
async function syncGSCData(
  job: Job<AnalyticsSyncJobData>,
  accessToken: string,
  siteUrl: string,
  logger: Logger,
): Promise<void> {
  const { clientId, mode } = job.data;
  const { startDate, endDate } = getGSCDateRange(mode);
  logger.info("Fetching GSC daily metrics", { startDate, endDate, siteUrl });

  // Fetch daily metrics
  const dateMetrics = await fetchGSCDateMetrics(
    accessToken,
    siteUrl,
    startDate,
    endDate,
  );
  logger.info("Got GSC daily rows", { rowCount: dateMetrics.length });

  // Prepare rows for batch upsert
  const gscRows: GSCSnapshotInsert[] = dateMetrics.map((row) => ({
    clientId,
    date: row.date,
    siteUrl,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  // Process with checkpointing
  await processChunksWithCheckpoint(
    job,
    gscRows,
    "gsc",
    BATCH_CHUNK_SIZE,
    async (chunk) => {
      await db
        .insert(gscSnapshots)
        .values(chunk)
        .onConflictDoUpdate({
          target: [gscSnapshots.clientId, gscSnapshots.date],
          set: {
            clicks: sql`excluded.clicks`,
            impressions: sql`excluded.impressions`,
            ctr: sql`excluded.ctr`,
            position: sql`excluded.position`,
            syncedAt: sql`NOW()`,
          },
        });
    },
    logger,
  );

  // Advance stage to queries
  await job.updateData({
    ...job.data,
    progress: { stage: "queries", chunksCompleted: 0 },
  });
  logger.info("GSC daily sync complete, advancing to queries stage");
}

/**
 * Sync GSC query data with checkpoint-based progress tracking.
 * After completion, advances stage to 'ga4'.
 */
async function syncGSCQueryData(
  job: Job<AnalyticsSyncJobData>,
  accessToken: string,
  siteUrl: string,
  logger: Logger,
): Promise<void> {
  const { clientId, mode } = job.data;
  const { startDate, endDate } = getGSCDateRange(mode);
  logger.info("Fetching GSC query metrics", { startDate, endDate, siteUrl });

  // Fetch top queries
  const queryMetrics = await fetchGSCTopQueries(
    accessToken,
    siteUrl,
    startDate,
    endDate,
  );
  logger.info("Got GSC query rows", { rowCount: queryMetrics.length });

  // Prepare rows for batch upsert
  const queryRows: GSCQuerySnapshotInsert[] = queryMetrics.map((row) => ({
    clientId,
    date: row.date,
    query: row.query,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  // Process with checkpointing
  await processChunksWithCheckpoint(
    job,
    queryRows,
    "queries",
    BATCH_CHUNK_SIZE,
    async (chunk) => {
      await db
        .insert(gscQuerySnapshots)
        .values(chunk)
        .onConflictDoUpdate({
          target: [
            gscQuerySnapshots.clientId,
            gscQuerySnapshots.date,
            gscQuerySnapshots.query,
          ],
          set: {
            clicks: sql`excluded.clicks`,
            impressions: sql`excluded.impressions`,
            ctr: sql`excluded.ctr`,
            position: sql`excluded.position`,
          },
        });
    },
    logger,
  );

  // Advance stage to ga4
  await job.updateData({
    ...job.data,
    progress: { stage: "ga4", chunksCompleted: 0 },
  });
  logger.info("GSC query sync complete, advancing to GA4 stage");
}

/**
 * Sync GA4 metrics with checkpoint-based progress tracking.
 * This is the final data stage before job completion.
 */
async function syncGA4Data(
  job: Job<AnalyticsSyncJobData>,
  accessToken: string,
  propertyId: string,
  logger: Logger,
): Promise<void> {
  const { clientId, mode } = job.data;
  const { startDate, endDate } = getGA4DateRange(mode);
  logger.info("Fetching GA4 data", { startDate, endDate, propertyId });

  const metrics = await fetchGA4Metrics(
    accessToken,
    propertyId,
    startDate,
    endDate,
  );
  logger.info("Got GA4 daily rows", { rowCount: metrics.length });

  // Prepare rows for batch upsert
  const ga4Rows: GA4SnapshotInsert[] = metrics.map((row) => ({
    clientId,
    date: row.date,
    propertyId,
    sessions: row.sessions,
    users: row.users,
    newUsers: row.newUsers,
    bounceRate: row.bounceRate,
    avgSessionDuration: row.avgSessionDuration,
    conversions: row.conversions,
    revenue: row.revenue,
  }));

  // Process with checkpointing
  await processChunksWithCheckpoint(
    job,
    ga4Rows,
    "ga4",
    BATCH_CHUNK_SIZE,
    async (chunk) => {
      await db
        .insert(ga4Snapshots)
        .values(chunk)
        .onConflictDoUpdate({
          target: [ga4Snapshots.clientId, ga4Snapshots.date],
          set: {
            sessions: sql`excluded.sessions`,
            users: sql`excluded.users`,
            newUsers: sql`excluded.new_users`,
            bounceRate: sql`excluded.bounce_rate`,
            avgSessionDuration: sql`excluded.avg_session_duration`,
            conversions: sql`excluded.conversions`,
            revenue: sql`excluded.revenue`,
            syncedAt: sql`NOW()`,
          },
        });
    },
    logger,
  );

  logger.info("GA4 sync complete");
}
