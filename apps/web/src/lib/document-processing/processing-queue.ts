/**
 * Document Processing Queue
 * Phase 102-07: Task 3 - Document processing queue
 *
 * Uses in-memory queue with setInterval processing (same pattern as analytics-sync-worker.ts)
 * because apps/web doesn't have BullMQ. Exposes BullMQ-like interface for future migration.
 *
 * Queue processes jobs with retry logic and progress tracking.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedDocuments } from "@/db/schema/document-builder";
import { logger } from "@/lib/logger";

// =============================================================================
// Types
// =============================================================================

export interface ProcessingJob {
  documentId: string;
}

export interface JobOptions {
  jobId?: string;
  attempts?: number;
  backoff?: { type: string; delay: number };
}

interface QueuedJob {
  name: string;
  data: ProcessingJob;
  options: JobOptions;
  attempts: number;
  nextAttemptAt: number;
}

// =============================================================================
// In-Memory Queue
// =============================================================================

const jobQueue: QueuedJob[] = [];
let processingInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

const QUEUE_NAME = "document-processing";
const PROCESS_INTERVAL_MS = 1000; // Check queue every second
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY = 5000;

// =============================================================================
// Queue Interface (BullMQ-like)
// =============================================================================

/**
 * Document processing queue.
 * Uses in-memory queue with setInterval for apps/web.
 * Exposes BullMQ-like interface for future migration.
 */
export const documentProcessingQueue = {
  /**
   * Add a job to the processing queue.
   */
  async add(
    name: string,
    data: ProcessingJob,
    options?: JobOptions
  ): Promise<void> {
    const job: QueuedJob = {
      name,
      data,
      options: options || {},
      attempts: 0,
      nextAttemptAt: Date.now(),
    };

    jobQueue.push(job);

    logger.info("[processing-queue] Job queued", {
      name,
      documentId: data.documentId,
      jobId: options?.jobId,
      queueLength: jobQueue.length,
    });

    // Auto-start worker if not running
    startWorker();
  },

  /**
   * Get queue length (for monitoring).
   */
  getLength(): number {
    return jobQueue.length;
  },
};

// =============================================================================
// Worker Implementation
// =============================================================================

/**
 * Process a single job.
 */
async function processJob(job: QueuedJob): Promise<boolean> {
  const { documentId } = job.data;
  const maxAttempts = job.options.attempts || DEFAULT_ATTEMPTS;

  job.attempts++;

  logger.info("[processing-queue] Processing job", {
    documentId,
    attempt: job.attempts,
    maxAttempts,
  });

  // Update status to processing
  await db.update(uploadedDocuments)
    .set({
      status: "processing",
      processingStartedAt: new Date(),
    })
    .where(eq(uploadedDocuments.id, documentId));

  try {
    // Update progress helper
    const updateProgress = async (progress: number) => {
      await db.update(uploadedDocuments)
        .set({ processingProgress: progress })
        .where(eq(uploadedDocuments.id, documentId));
    };

    // Placeholder: actual parsing + OCR implemented in 102-08 and 102-09
    // For now, simulate processing steps
    await updateProgress(10);
    await updateProgress(50);
    await updateProgress(100);

    // Mark complete
    await db.update(uploadedDocuments)
      .set({
        status: "completed",
        processingCompletedAt: new Date(),
      })
      .where(eq(uploadedDocuments.id, documentId));

    logger.info("[processing-queue] Job completed", { documentId });
    return true;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error("[processing-queue] Job failed", {
      documentId,
      attempt: job.attempts,
      error: errorMsg,
    });

    // Check if we should retry
    if (job.attempts < maxAttempts) {
      // Calculate backoff delay
      const backoffDelay = job.options.backoff?.delay || DEFAULT_BACKOFF_DELAY;
      const multiplier = job.options.backoff?.type === "exponential"
        ? Math.pow(2, job.attempts - 1)
        : 1;

      job.nextAttemptAt = Date.now() + (backoffDelay * multiplier);
      jobQueue.push(job); // Re-queue for retry

      logger.info("[processing-queue] Job scheduled for retry", {
        documentId,
        nextAttempt: job.attempts + 1,
        retryIn: backoffDelay * multiplier,
      });
    } else {
      // Max attempts reached - mark as failed
      await db.update(uploadedDocuments)
        .set({
          status: "failed",
          processingError: errorMsg,
        })
        .where(eq(uploadedDocuments.id, documentId));

      logger.error("[processing-queue] Job permanently failed", {
        documentId,
        attempts: job.attempts,
      });
    }

    return false;
  }
}

/**
 * Worker loop that processes jobs from the queue.
 */
async function processQueue(): Promise<void> {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    const now = Date.now();

    // Find jobs ready to process (not waiting for backoff)
    const readyIndex = jobQueue.findIndex(
      (job) => job.nextAttemptAt <= now
    );

    if (readyIndex === -1) {
      return;
    }

    // Remove job from queue and process
    const [job] = jobQueue.splice(readyIndex, 1);
    await processJob(job);

  } catch (error) {
    logger.error("[processing-queue] Queue processing error", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isProcessing = false;
  }
}

// =============================================================================
// Worker Management
// =============================================================================

/**
 * Start the worker if not already running.
 */
function startWorker(): void {
  if (processingInterval) {
    return;
  }

  logger.info("[processing-queue] Starting worker", {
    intervalMs: PROCESS_INTERVAL_MS,
  });

  processingInterval = setInterval(processQueue, PROCESS_INTERVAL_MS);
}

/**
 * Stop the worker.
 */
function stopWorker(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    logger.info("[processing-queue] Worker stopped");
  }
}

/**
 * Create a document processing worker.
 * Returns control functions for the worker.
 */
export function createDocumentProcessingWorker() {
  return {
    start: startWorker,
    stop: stopWorker,
    isRunning: () => processingInterval !== null,
    getQueueLength: () => jobQueue.length,
  };
}

// =============================================================================
// Exports for testing
// =============================================================================

export { startWorker, stopWorker };
