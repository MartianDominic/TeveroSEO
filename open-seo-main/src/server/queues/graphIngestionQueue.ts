/**
 * BullMQ Queue for GraphRAG document ingestion.
 *
 * Receives crawled page content from delta-cascade and triggers
 * LightRAG document ingestion for entity extraction and graph updates.
 *
 * Per HIGH-INT-03: Connects crawling results to GraphRAG ingestion.
 *
 * @module graphIngestionQueue
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

export const GRAPH_INGESTION_QUEUE_NAME = "graph-ingestion" as const;

/**
 * Job data for GraphRAG ingestion.
 */
export interface GraphIngestionJobData {
  /** Tenant ID for data isolation */
  tenantId: string;
  /** Source URL of the crawled page */
  url: string;
  /** HTML content of the page */
  html: string;
  /** Timestamp when the page was crawled */
  crawledAt: number;
  /** Optional document ID (defaults to URL) */
  docId?: string;
}

/**
 * Default job options for graph ingestion jobs.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 * Keep 500 completed jobs for debugging and 1000 failed jobs for 7 days.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 500 },
  removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
});

/**
 * Queue for GraphRAG document ingestion jobs.
 *
 * Jobs are added by delta-cascade after successful L3 processing.
 * Worker (graph-ingestion-worker.ts) processes jobs and calls LightRAG service.
 */
export const graphIngestionQueue = new Queue<GraphIngestionJobData>(
  GRAPH_INGESTION_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:graph-ingestion"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Add a page to the GraphRAG ingestion queue.
 *
 * @param data - Ingestion job data
 * @returns Job ID
 */
export async function enqueueGraphIngestion(
  data: GraphIngestionJobData,
): Promise<string> {
  const job = await graphIngestionQueue.add(
    "ingest",
    data,
    {
      // Use URL as job ID to prevent duplicate processing
      jobId: `${data.tenantId}:${data.url}:${data.crawledAt}`,
    },
  );
  return job.id ?? "";
}
