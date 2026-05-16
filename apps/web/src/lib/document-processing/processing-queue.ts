/**
 * Document Processing Queue
 * Phase 102-07: Task 3 - Document processing queue
 * Phase 102-08: Task 5 - Parser integration
 *
 * Uses in-memory queue with setInterval processing (same pattern as analytics-sync-worker.ts)
 * because apps/web doesn't have BullMQ. Exposes BullMQ-like interface for future migration.
 *
 * Queue processes jobs with retry logic and progress tracking.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadedDocuments, detectedStructures } from "@/db/schema/document-builder";
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

    // Step 2: OCR if needed (40-70%) - implemented in 102-09
    if (parseResult.needsOcr) {
      await updateProgress(45);
      // TODO: Call OCR service (102-09)
      logger.info("[processing-queue] OCR needed, skipping for now", {
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

        // Save detected structures to database
        if (structureResult.blocks.length > 0) {
          for (const block of structureResult.blocks) {
            // Detect variables within each block
            const blockVariables = detectVariables(block.content);
            const allVariables = [
              ...blockVariables.explicit.map((v) => ({
                id: v.id,
                originalText: v.originalText,
                suggestedVariable: v.suggestedVariable,
                variableType: v.variableType,
                confidence: v.confidence,
                occurrences: v.occurrences,
                positions: v.positions,
              })),
              ...blockVariables.implicit.map((v) => ({
                id: v.id,
                originalText: v.originalText,
                suggestedVariable: v.suggestedVariable,
                variableType: v.variableType,
                confidence: v.confidence,
                occurrences: v.occurrences,
                positions: v.positions,
              })),
            ];

            await db.insert(detectedStructures).values({
              documentId,
              blockType: block.type,
              position: block.position ?? 0,
              confidence: block.confidence,
              originalText: block.content,
              suggestedContent: null, // AI can suggest improved content later
              detectedVariables: allVariables,
              reasoning: block.reasoning ?? null,
              verified: "pending",
            });
          }
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
