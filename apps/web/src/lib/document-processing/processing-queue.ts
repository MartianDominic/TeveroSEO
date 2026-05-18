/**
 * Document Processing Queue
 * Phase 102-07: Task 3 - Document processing queue
 * Phase 102-08: Task 5 - Parser integration
 *
 * Uses in-memory queue with setInterval processing (same pattern as analytics-sync-worker.ts)
 * because apps/web doesn't have BullMQ. Exposes BullMQ-like interface for future migration.
 *
 * Queue processes jobs with retry logic and progress tracking.
 *
 * LIMITATION: In-memory queue is NOT persistent across server restarts.
 * Jobs in the queue will be lost on restart, but jobs with status "processing"
 * will be recovered via recoverStaleJobs() on next startup.
 *
 * TODO: Migrate to Redis-backed queue (BullMQ) for:
 * - Persistence across restarts
 * - Multi-instance support (horizontal scaling)
 * - Better job visibility and monitoring
 * See: https://docs.bullmq.io/
 */

import { eq, and, lt } from "drizzle-orm";
import { db } from "@/db";
import { uploadedDocuments, detectedStructures, type DetectedVariable } from "@/db/schema/document-builder";
import { logger } from "@/lib/logger";
import { parseDocument } from "./parser-client";
import { detectStructure } from "./structure-detector";
import { detectVariables } from "./variable-detector";
import { extractTheme } from "./theme-extractor";

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
let staleCheckInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;
let shutdownRequested = false;

const PROCESS_INTERVAL_MS = 1000; // Check queue every second
const STALE_CHECK_INTERVAL_MS = 60 * 1000; // Check for stale jobs every minute
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY = 5000;
const MAX_QUEUE_SIZE = 100;
const STALE_JOB_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

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
    // Check queue depth limit
    if (jobQueue.length >= MAX_QUEUE_SIZE) {
      throw new Error(`Queue full: maximum ${MAX_QUEUE_SIZE} jobs allowed`);
    }

    // Generate jobId if not provided (for deduplication)
    const jobId = options?.jobId ?? data.documentId;

    // Check for duplicate job
    const existingJob = jobQueue.find(
      (j) => j.options.jobId === jobId || j.data.documentId === data.documentId
    );
    if (existingJob) {
      logger.info("[processing-queue] Job already queued, skipping", {
        name,
        documentId: data.documentId,
        jobId,
      });
      return;
    }

    const job: QueuedJob = {
      name,
      data,
      options: { ...options, jobId },
      attempts: 0,
      nextAttemptAt: Date.now(),
    };

    jobQueue.push(job);

    logger.info("[processing-queue] Job queued", {
      name,
      documentId: data.documentId,
      jobId,
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

  // Optimistic locking: Only claim the job if status is still "pending"
  // This prevents race conditions when multiple workers try to process the same document
  const updateResult = await db.update(uploadedDocuments)
    .set({
      status: "processing",
      processingStartedAt: new Date(),
    })
    .where(and(
      eq(uploadedDocuments.id, documentId),
      eq(uploadedDocuments.status, "pending")
    ))
    .returning({ id: uploadedDocuments.id });

  // If no rows were updated, another worker already claimed this job
  if (updateResult.length === 0) {
    logger.info("[processing-queue] Job already claimed by another worker, skipping", {
      documentId,
    });
    return true; // Return true since job is being handled elsewhere
  }

  try {
    // Get document details for parsing
    const doc = await db.query.uploadedDocuments.findFirst({
      where: eq(uploadedDocuments.id, documentId),
    });

    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Update progress helper
    const updateProgress = async (progress: number) => {
      await db.update(uploadedDocuments)
        .set({ processingProgress: progress })
        .where(eq(uploadedDocuments.id, documentId));
    };

    // Step 1: Parse document (10-40%)
    await updateProgress(10);

    const parseResult = await parseDocument(
      doc.r2Key,
      doc.fileType as "pdf" | "docx"
    );

    if (!parseResult.success) {
      throw new Error(parseResult.error || "Parsing failed");
    }

    await updateProgress(40);

    // Store extracted text and metadata
    await db.update(uploadedDocuments)
      .set({
        extractedText: {
          text: parseResult.text,
          pageCount: parseResult.pageCount,
        },
        extractedMetadata: {
          fonts: parseResult.fonts,
          colors: parseResult.colors,
          hasImages: parseResult.hasImages,
          metadata: parseResult.metadata,
        },
      })
      .where(eq(uploadedDocuments.id, documentId));

    // Step 2: OCR if needed (40-70%)
    // OCR is handled automatically by the parser service via tiered extraction
    if (parseResult.needsOcr) {
      await updateProgress(45);
      logger.info("[processing-queue] OCR was processed by parser service", {
        documentId,
      });
      await updateProgress(70);
    } else {
      await updateProgress(70);
    }

    // Step 3: Structure detection (70-90%) - implemented in 102-10
    await updateProgress(75);

    const extractedText = parseResult.text;
    if (extractedText && extractedText.length > 10) {
      try {
        // Detect persuasion blocks
        const structureResult = await detectStructure(extractedText);

        // Save detected structures to database (batch insert to avoid N+1)
        if (structureResult.blocks.length > 0) {
          const structureValues = structureResult.blocks.map((block) => {
            // Detect variables within each block
            const blockVariables = detectVariables(block.content);
            const mapVariable = (v: typeof blockVariables.explicit[number]): DetectedVariable => ({
              id: v.id,
              originalText: v.originalText,
              suggestedVariable: v.suggestedVariable,
              // Map contact_email to custom (not in schema type)
              variableType: v.variableType === "contact_email" ? "custom" : v.variableType,
              confidence: v.confidence,
              occurrences: v.occurrences,
              positions: v.positions.map((p) => ({ start: p.start, end: p.end })),
            });
            const allVariables: DetectedVariable[] = [
              ...blockVariables.explicit.map(mapVariable),
              ...blockVariables.implicit.map(mapVariable),
            ];

            return {
              documentId,
              workspaceId: doc.workspaceId,
              blockType: block.type,
              position: block.position ?? 0,
              confidence: block.confidence,
              originalText: block.content,
              suggestedContent: null, // AI can suggest improved content later
              detectedVariables: allVariables,
              reasoning: block.reasoning ?? null,
              verified: "pending" as const,
            };
          });

          await db.insert(detectedStructures).values(structureValues);
        }

        logger.info("[processing-queue] Structure detection complete", {
          documentId,
          blocksDetected: structureResult.blocks.length,
          language: structureResult.metadata.language,
        });
      } catch (structureError) {
        // Structure detection failure is non-blocking
        logger.warn("[processing-queue] Structure detection failed", {
          documentId,
          error: structureError instanceof Error ? structureError.message : String(structureError),
        });
      }
    }

    await updateProgress(90);

    // Step 4: Theme extraction (90-100%)
    await updateProgress(95);

    try {
      await extractTheme(documentId);
      logger.info("[processing-queue] Theme extraction complete", {
        documentId,
      });
    } catch (themeError) {
      // Theme extraction failure is non-blocking
      logger.warn("[processing-queue] Theme extraction failed", {
        documentId,
        error: themeError instanceof Error ? themeError.message : String(themeError),
      });
    }

    await updateProgress(100);

    // Mark complete
    await db.update(uploadedDocuments)
      .set({
        status: "completed",
        processingCompletedAt: new Date(),
      })
      .where(eq(uploadedDocuments.id, documentId));

    logger.info("[processing-queue] Job completed", {
      documentId,
      pages: parseResult.pageCount,
      textLength: parseResult.text.length,
      needsOcr: parseResult.needsOcr,
    });
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
  // Don't process new jobs if shutdown requested
  if (isProcessing || shutdownRequested) {
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
 * Recover stale jobs that were stuck in "processing" status.
 * Call this on startup to handle jobs orphaned by crashes.
 */
async function recoverStaleJobs(): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

  const staleDocuments = await db.query.uploadedDocuments.findMany({
    where: and(
      eq(uploadedDocuments.status, "processing"),
      lt(uploadedDocuments.processingStartedAt, staleThreshold)
    ),
    columns: {
      id: true,
      processingStartedAt: true,
    },
  });

  if (staleDocuments.length === 0) {
    return 0;
  }

  logger.info("[processing-queue] Recovering stale jobs", {
    count: staleDocuments.length,
    documentIds: staleDocuments.map((d) => d.id),
  });

  for (const doc of staleDocuments) {
    // Reset status to pending and requeue
    await db.update(uploadedDocuments)
      .set({
        status: "pending",
        processingStartedAt: null,
        processingProgress: 0,
      })
      .where(eq(uploadedDocuments.id, doc.id));

    // Add back to queue
    await documentProcessingQueue.add(
      "process-document",
      { documentId: doc.id },
      { jobId: doc.id }
    );
  }

  logger.info("[processing-queue] Stale jobs recovered", {
    count: staleDocuments.length,
  });

  return staleDocuments.length;
}

/**
 * Start the worker if not already running.
 * Also starts periodic stale job recovery.
 */
function startWorker(): void {
  if (processingInterval) {
    return;
  }

  shutdownRequested = false;

  logger.info("[processing-queue] Starting worker", {
    intervalMs: PROCESS_INTERVAL_MS,
    staleCheckIntervalMs: STALE_CHECK_INTERVAL_MS,
  });

  processingInterval = setInterval(processQueue, PROCESS_INTERVAL_MS);

  // Start periodic stale job recovery
  if (!staleCheckInterval) {
    // Run initial recovery on startup
    recoverStaleJobs().catch((err) => {
      logger.error("[processing-queue] Initial stale job recovery failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Then check periodically
    staleCheckInterval = setInterval(() => {
      recoverStaleJobs().catch((err) => {
        logger.error("[processing-queue] Periodic stale job recovery failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, STALE_CHECK_INTERVAL_MS);
  }
}

/**
 * Stop the worker gracefully.
 * Waits for in-flight job to complete before stopping.
 */
async function stopWorker(): Promise<void> {
  if (!processingInterval && !staleCheckInterval) {
    return;
  }

  logger.info("[processing-queue] Shutdown requested, draining queue...");
  shutdownRequested = true;

  // Stop accepting new stale job recoveries
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
  }

  // Wait for in-flight job to complete (max 60 seconds)
  const maxWaitMs = 60000;
  const checkIntervalMs = 100;
  let waited = 0;

  while (isProcessing && waited < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    waited += checkIntervalMs;
  }

  if (isProcessing) {
    logger.warn("[processing-queue] Shutdown timeout, job still processing", {
      waitedMs: waited,
    });
  }

  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
  shutdownRequested = false;

  // Log remaining jobs that will be lost (they'll be recovered on next startup)
  if (jobQueue.length > 0) {
    logger.warn("[processing-queue] Worker stopped with jobs in queue", {
      remainingJobs: jobQueue.length,
      documentIds: jobQueue.map((j) => j.data.documentId),
      note: "Jobs with status 'processing' will be recovered on next startup",
    });
  } else {
    logger.info("[processing-queue] Worker stopped gracefully");
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
    recoverStaleJobs,
    registerSignalHandlers,
    isRunning: () => processingInterval !== null,
    isShuttingDown: () => shutdownRequested,
    getQueueLength: () => jobQueue.length,
  };
}

// =============================================================================
// Process Signal Handlers (Graceful Shutdown)
// =============================================================================

let signalHandlersRegistered = false;

/**
 * Register process signal handlers for graceful shutdown.
 * Call this once when starting the worker in a long-running process.
 */
function registerSignalHandlers(): void {
  if (signalHandlersRegistered || typeof process === "undefined") {
    return;
  }

  const handleShutdown = async (signal: string) => {
    logger.info("[processing-queue] Received shutdown signal", { signal });
    await stopWorker();
    // Don't call process.exit() - let the caller handle that
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));

  signalHandlersRegistered = true;
  logger.info("[processing-queue] Signal handlers registered");
}

// =============================================================================
// Exports for testing
// =============================================================================

export { startWorker, stopWorker, recoverStaleJobs, registerSignalHandlers };
