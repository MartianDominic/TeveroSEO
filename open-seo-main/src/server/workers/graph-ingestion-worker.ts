/**
 * BullMQ Worker for GraphRAG document ingestion.
 *
 * Processes pages from the graph-ingestion queue and sends them to
 * LightRAG for entity extraction and knowledge graph updates.
 *
 * Per HIGH-INT-03: Connects crawling results to GraphRAG ingestion.
 *
 * @module graph-ingestion-worker
 */

import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  GRAPH_INGESTION_QUEUE_NAME,
  type GraphIngestionJobData,
} from "@/server/queues/graphIngestionQueue";
import { getLightRAGService } from "@/server/lib/lightrag";

const workerLog = createLogger({ module: "graph-ingestion-worker" });

const LOCK_DURATION_MS = 180_000; // 3 min for entity extraction
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;

let worker: Worker<GraphIngestionJobData> | null = null;

/**
 * Process a graph ingestion job.
 *
 * Extracts text content from HTML and sends to LightRAG for entity extraction.
 */
async function processGraphIngestion(
  job: Job<GraphIngestionJobData>
): Promise<void> {
  const { tenantId, url, html, docId } = job.data;

  workerLog.info("Processing graph ingestion", {
    jobId: job.id,
    tenantId,
    url,
    htmlLength: html.length,
  });

  const lightrag = getLightRAGService();

  // Check if service is available before processing
  // Per H-65-03: Graceful fallback when LightRAG Python service is unavailable
  const health = await lightrag.healthCheck(tenantId);
  if (!health.healthy) {
    workerLog.warn("LightRAG service unavailable, skipping ingestion", {
      jobId: job.id,
      tenantId,
      url,
    });
    // Return successfully to avoid retries - service may be down intentionally
    return;
  }

  // Initialize tenant if needed
  if (!health.tenantInitialized) {
    try {
      await lightrag.initializeTenant(tenantId);
    } catch (error) {
      workerLog.warn("Failed to initialize tenant, skipping ingestion", {
        jobId: job.id,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  // Extract text content from HTML (strip tags)
  const textContent = extractTextContent(html);

  if (textContent.length < 50) {
    workerLog.debug("Content too short for ingestion, skipping", {
      jobId: job.id,
      tenantId,
      url,
      contentLength: textContent.length,
    });
    return;
  }

  // Insert document for entity extraction
  const results = await lightrag.insertDocuments(tenantId, [
    {
      id: docId ?? url,
      content: textContent,
      url,
    },
  ]);

  workerLog.info("Graph ingestion complete", {
    jobId: job.id,
    tenantId,
    url,
    entitiesExtracted: results[0]?.entitiesExtracted ?? 0,
    chunksProcessed: results[0]?.chunksProcessed ?? 0,
  });
}

/**
 * Extract readable text content from HTML.
 *
 * Removes scripts, styles, and HTML tags to get clean text for entity extraction.
 */
function extractTextContent(html: string): string {
  // Remove script and style content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Start the graph ingestion worker.
 */
export function startGraphIngestionWorker(): Worker<GraphIngestionJobData> {
  if (worker) return worker;

  worker = new Worker<GraphIngestionJobData>(
    GRAPH_INGESTION_QUEUE_NAME,
    processGraphIngestion,
    {
      connection: getSharedBullMQConnection("worker:graph-ingestion"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 2, // Process 2 documents at a time
    }
  );

  worker.on("completed", (job) => {
    workerLog.debug("Job completed", { jobId: job.id });
  });

  worker.on("failed", (job, error) => {
    workerLog.error(
      "Job failed",
      error instanceof Error ? error : new Error(String(error)),
      { jobId: job?.id, attemptsMade: job?.attemptsMade }
    );
  });

  worker.on("error", (error) => {
    workerLog.error("Worker error", error instanceof Error ? error : new Error(String(error)));
  });

  workerLog.info("Graph ingestion worker started");
  return worker;
}

/**
 * Stop the graph ingestion worker gracefully.
 */
export async function stopGraphIngestionWorker(): Promise<void> {
  if (!worker) return;

  workerLog.info("Stopping graph ingestion worker...");

  try {
    await worker.close(false); // Wait for current jobs
    await Promise.race([
      worker.disconnect(),
      new Promise((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
    ]);
  } catch (error) {
    workerLog.error(
      "Error stopping worker",
      error instanceof Error ? error : new Error(String(error))
    );
  }

  worker = null;
  workerLog.info("Graph ingestion worker stopped");
}
