/**
 * Document Processing Queue
 * Phase 102-07: Task 3 - BullMQ queue for document processing
 *
 * Stub implementation - will be fully implemented in Task 3.
 * This provides the queue interface that upload-service depends on.
 */

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

// =============================================================================
// Queue Stub (to be replaced in Task 3)
// =============================================================================

/**
 * Document processing queue.
 * Stub implementation using in-memory queue for now.
 * Will be replaced with proper BullMQ in Task 3.
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
    logger.info("[processing-queue] Job queued", {
      name,
      documentId: data.documentId,
      jobId: options?.jobId,
    });
    // Stub - actual implementation in Task 3
  },
};
