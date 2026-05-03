/**
 * MED-QUEUE-02 FIX: Centralized queue metrics and monitoring.
 *
 * Creates QueueEvents instances for key queues to enable:
 * - Event-based metrics collection (vs polling)
 * - Centralized job lifecycle monitoring
 * - Progress tracking for long-running jobs
 *
 * @module queue-metrics
 */

import { QueueEvents } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "queue-metrics" });

// Queue names to monitor
const MONITORED_QUEUES = [
  "audits",
  "keyword-ranking",
  "analytics",
  "voice-analysis",
  "pipeline-plan",
  "pipeline-phase",
] as const;

// Store active QueueEvents instances for cleanup
const queueEventsMap = new Map<string, QueueEvents>();

// Metrics counters (in production, these would be sent to a metrics backend)
const metrics = {
  jobsCompleted: new Map<string, number>(),
  jobsFailed: new Map<string, number>(),
  jobsStalled: new Map<string, number>(),
  processingTimeMs: new Map<string, number[]>(),
};

/**
 * Initialize queue monitoring for all key queues.
 * Creates QueueEvents instances and sets up event handlers.
 */
export async function initQueueMetrics(): Promise<void> {
  for (const queueName of MONITORED_QUEUES) {
    try {
      const queueEvents = new QueueEvents(queueName, {
        connection: getSharedBullMQConnection(`events:${queueName}`),
      });

      // Initialize metrics counters
      metrics.jobsCompleted.set(queueName, 0);
      metrics.jobsFailed.set(queueName, 0);
      metrics.jobsStalled.set(queueName, 0);
      metrics.processingTimeMs.set(queueName, []);

      // Set up event handlers
      queueEvents.on("completed", ({ jobId, returnvalue }) => {
        const count = (metrics.jobsCompleted.get(queueName) ?? 0) + 1;
        metrics.jobsCompleted.set(queueName, count);
        log.debug("Job completed", { queueName, jobId });
      });

      queueEvents.on("failed", ({ jobId, failedReason }) => {
        const count = (metrics.jobsFailed.get(queueName) ?? 0) + 1;
        metrics.jobsFailed.set(queueName, count);
        log.warn("Job failed", { queueName, jobId, reason: failedReason });
      });

      queueEvents.on("stalled", ({ jobId }) => {
        const count = (metrics.jobsStalled.get(queueName) ?? 0) + 1;
        metrics.jobsStalled.set(queueName, count);
        log.warn("Job stalled", { queueName, jobId });
      });

      queueEvents.on("progress", ({ jobId, data }) => {
        log.debug("Job progress", { queueName, jobId, progress: data });
      });

      queueEventsMap.set(queueName, queueEvents);
      log.info("Queue metrics initialized", { queueName });
    } catch (error) {
      log.error(
        "Failed to initialize queue metrics",
        error instanceof Error ? error : new Error(String(error)),
        { queueName }
      );
    }
  }

  log.info("Queue metrics system initialized", {
    monitoredQueues: MONITORED_QUEUES.length,
  });
}

/**
 * Get current metrics for all monitored queues.
 */
export function getQueueMetrics(): {
  [queueName: string]: {
    completed: number;
    failed: number;
    stalled: number;
    avgProcessingTimeMs: number | null;
  };
} {
  const result: {
    [queueName: string]: {
      completed: number;
      failed: number;
      stalled: number;
      avgProcessingTimeMs: number | null;
    };
  } = {};

  for (const queueName of MONITORED_QUEUES) {
    const processingTimes = metrics.processingTimeMs.get(queueName) ?? [];
    const avgProcessingTimeMs =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : null;

    result[queueName] = {
      completed: metrics.jobsCompleted.get(queueName) ?? 0,
      failed: metrics.jobsFailed.get(queueName) ?? 0,
      stalled: metrics.jobsStalled.get(queueName) ?? 0,
      avgProcessingTimeMs,
    };
  }

  return result;
}

/**
 * Stop all queue monitoring and clean up resources.
 */
export async function stopQueueMetrics(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [queueName, queueEvents] of queueEventsMap) {
    closePromises.push(
      queueEvents.close().catch((err) => {
        log.error(
          "Failed to close queue events",
          err instanceof Error ? err : new Error(String(err)),
          { queueName }
        );
      })
    );
  }

  await Promise.all(closePromises);
  queueEventsMap.clear();

  log.info("Queue metrics system stopped");
}
