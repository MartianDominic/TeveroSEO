/**
 * Analytics Job Orchestrator
 * Phase 96-Queue: Job coordination between GSC sync and annotation import
 *
 * Uses BullMQ FlowProducer to create dependency chains:
 * - GSC sync runs first (3 AM UTC)
 * - Annotation import runs after GSC sync completes (depends on parent)
 *
 * Features:
 * - Job dependency management via FlowProducer
 * - Dead letter queue integration
 * - Completion/failure event logging
 * - Health monitoring
 */

import { FlowProducer, type FlowJob, type JobNode } from 'bullmq';
import { getSharedBullMQConnection } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/logger';
import { moveToDeadLetter } from '@/server/lib/dead-letter-queue';
import type { GscSyncJobData, GscSyncJobResult } from './gsc-sync.job';
import { gscSyncQueue } from './gsc-sync.job';
import { annotationsImportQueue, annotationsImportWorker } from './annotations-import.job';
import { gscSyncWorker } from './gsc-sync.worker';

const log = createLogger({ module: 'analytics-orchestrator' });

// =============================================================================
// Flow Producer for Job Dependencies
// =============================================================================

/**
 * FlowProducer for creating dependent job flows.
 * Ensures annotation import only runs after GSC sync completes.
 */
export const analyticsFlowProducer = new FlowProducer({
  connection: getSharedBullMQConnection('flow:analytics'),
});

// =============================================================================
// Job Flow Types
// =============================================================================

export interface AnalyticsFlowData {
  workspaceId: string;
  triggeredBy: 'schedule' | 'manual';
  triggeredAt: string;
}

export interface AnalyticsFlowResult {
  gscSync: GscSyncJobResult | null;
  annotationsImport: { imported: number; skipped: number } | null;
  flowDurationMs: number;
}

// =============================================================================
// Orchestration Functions
// =============================================================================

/**
 * Schedule the daily analytics flow for a workspace.
 *
 * Creates a flow where:
 * 1. GSC sync runs first (parent job)
 * 2. Annotation import runs after GSC sync completes (child job)
 *
 * The flow uses BullMQ's dependency system - child jobs wait for parent completion.
 *
 * @param workspaceId - Workspace to run analytics for
 * @param opts - Options for triggering (schedule or manual)
 */
export async function scheduleAnalyticsFlow(
  workspaceId: string,
  opts: { triggeredBy: 'schedule' | 'manual' } = { triggeredBy: 'schedule' }
): Promise<{ flowJobId: string }> {
  const triggeredAt = new Date().toISOString();

  // Create flow: GSC sync as parent, annotation import as child
  // Child only runs when parent completes successfully
  const flow = await analyticsFlowProducer.add({
    name: 'gsc-sync',
    queueName: 'gsc-sync',
    data: {
      syncType: 'full' as const,
    } satisfies GscSyncJobData,
    opts: {
      jobId: `analytics-flow-gsc-${workspaceId}-${Date.now()}`,
    },
    children: [
      {
        name: 'daily-import',
        queueName: 'annotations-import',
        data: {
          workspaceId,
        },
        opts: {
          jobId: `analytics-flow-annotations-${workspaceId}-${Date.now()}`,
          // If parent fails, don't mark this as failed, just don't run it
          failParentOnFailure: false,
        },
      },
    ],
  });

  log.info('Analytics flow scheduled', {
    flowJobId: flow.job.id,
    workspaceId,
    triggeredBy: opts.triggeredBy,
    triggeredAt,
  });

  return { flowJobId: flow.job.id! };
}

/**
 * Get the status of an analytics flow.
 */
export async function getAnalyticsFlowStatus(flowJobId: string): Promise<{
  status: 'pending' | 'running' | 'completed' | 'failed' | 'unknown';
  gscSyncStatus: string | null;
  annotationsStatus: string | null;
}> {
  try {
    // Get the parent job (GSC sync)
    const gscJob = await gscSyncQueue.getJob(flowJobId);

    if (!gscJob) {
      return {
        status: 'unknown',
        gscSyncStatus: null,
        annotationsStatus: null,
      };
    }

    const gscState = await gscJob.getState();

    // Determine overall flow status
    let status: 'pending' | 'running' | 'completed' | 'failed' | 'unknown' = 'unknown';
    if (gscState === 'waiting' || gscState === 'delayed') {
      status = 'pending';
    } else if (gscState === 'active') {
      status = 'running';
    } else if (gscState === 'completed') {
      status = 'completed';
    } else if (gscState === 'failed') {
      status = 'failed';
    }

    return {
      status,
      gscSyncStatus: gscState,
      annotationsStatus: null, // Would need to track child job separately
    };
  } catch (error) {
    log.error('Failed to get flow status', error instanceof Error ? error : new Error(String(error)));
    return {
      status: 'unknown',
      gscSyncStatus: null,
      annotationsStatus: null,
    };
  }
}

// =============================================================================
// Dead Letter Queue Integration
// =============================================================================

/**
 * Attach DLQ handlers to the GSC sync worker.
 * Moves failed jobs to the dead letter queue after max attempts.
 */
export function attachGscSyncDLQHandler(): void {
  gscSyncWorker.on('failed', async (job, error) => {
    if (!job) return;

    // Only move to DLQ after exhausting retries
    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      try {
        await moveToDeadLetter({
          jobId: job.id ?? 'unknown',
          queue: 'gsc-sync',
          jobName: job.name,
          data: job.data,
          error: error.message,
          stackTrace: error.stack,
          retryCount: job.attemptsMade,
          metadata: {
            lastAttemptAt: new Date().toISOString(),
            processingDurationMs: job.finishedOn
              ? job.finishedOn - job.processedOn!
              : undefined,
            originalTimestamp: new Date(job.timestamp).toISOString(),
          },
        });

        log.warn('GSC sync job moved to DLQ', {
          jobId: job.id,
          attempts: job.attemptsMade,
          error: error.message,
        });
      } catch (dlqError) {
        log.error(
          'Failed to move GSC sync job to DLQ',
          dlqError instanceof Error ? dlqError : new Error(String(dlqError)),
          { jobId: job.id }
        );
      }
    }
  });
}

/**
 * Attach DLQ handlers to the annotations import worker.
 * Moves failed jobs to the dead letter queue after max attempts.
 */
export function attachAnnotationsImportDLQHandler(): void {
  annotationsImportWorker.on('failed', async (job, error) => {
    if (!job) return;

    // Only move to DLQ after exhausting retries
    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      try {
        await moveToDeadLetter({
          jobId: job.id ?? 'unknown',
          queue: 'annotations-import',
          jobName: job.name,
          data: job.data,
          error: error.message,
          stackTrace: error.stack,
          retryCount: job.attemptsMade,
          metadata: {
            lastAttemptAt: new Date().toISOString(),
            processingDurationMs: job.finishedOn
              ? job.finishedOn - job.processedOn!
              : undefined,
            originalTimestamp: new Date(job.timestamp).toISOString(),
          },
        });

        log.warn('Annotations import job moved to DLQ', {
          jobId: job.id,
          attempts: job.attemptsMade,
          workspaceId: job.data.workspaceId,
          error: error.message,
        });
      } catch (dlqError) {
        log.error(
          'Failed to move annotations job to DLQ',
          dlqError instanceof Error ? dlqError : new Error(String(dlqError)),
          { jobId: job.id }
        );
      }
    }
  });
}

// =============================================================================
// Enhanced Event Logging
// =============================================================================

/**
 * Attach enhanced event logging to the GSC sync worker.
 */
export function attachGscSyncEventLogging(): void {
  gscSyncWorker.on('completed', (job, result) => {
    const duration = job.finishedOn && job.processedOn
      ? job.finishedOn - job.processedOn
      : 0;

    log.info('[Analytics] GSC sync job completed', {
      jobId: job.id,
      name: job.name,
      sitesProcessed: result.sitesProcessed,
      totalRows: result.totalRowsInserted,
      errorCount: result.errors.length,
      duration,
      durationFormatted: formatDuration(duration),
    });
  });

  gscSyncWorker.on('failed', (job, error) => {
    log.error('[Analytics] GSC sync job failed', error, {
      jobId: job?.id,
      name: job?.name,
      attempts: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      data: job?.data,
    });
  });

  gscSyncWorker.on('progress', (job, progress) => {
    log.debug('[Analytics] GSC sync progress', {
      jobId: job.id,
      progress: typeof progress === 'number' ? `${progress.toFixed(1)}%` : progress,
    });
  });
}

/**
 * Attach enhanced event logging to the annotations import worker.
 */
export function attachAnnotationsImportEventLogging(): void {
  annotationsImportWorker.on('completed', (job, result) => {
    const duration = job.finishedOn && job.processedOn
      ? job.finishedOn - job.processedOn
      : 0;

    log.info('[Analytics] Annotations import job completed', {
      jobId: job.id,
      workspaceId: job.data.workspaceId,
      imported: result.imported,
      skipped: result.skipped,
      duration,
      durationFormatted: formatDuration(duration),
    });
  });

  annotationsImportWorker.on('failed', (job, error) => {
    log.error('[Analytics] Annotations import job failed', error, {
      jobId: job?.id,
      workspaceId: job?.data?.workspaceId,
      attempts: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
    });
  });
}

// =============================================================================
// Health Monitoring
// =============================================================================

export interface AnalyticsHealthStats {
  gscSync: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  annotationsImport: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  lastFlowStatus: {
    gscSyncCompleted: number | null;
    annotationsCompleted: number | null;
  };
  averageJobDuration: {
    gscSyncMs: number | null;
    annotationsMs: number | null;
  };
}

/**
 * Get comprehensive analytics health statistics.
 */
export async function getAnalyticsHealthStats(): Promise<AnalyticsHealthStats> {
  // Get queue stats in parallel
  const [
    gscWaiting,
    gscActive,
    gscCompleted,
    gscFailed,
    gscDelayed,
    annWaiting,
    annActive,
    annCompleted,
    annFailed,
    annDelayed,
  ] = await Promise.all([
    gscSyncQueue.getWaitingCount(),
    gscSyncQueue.getActiveCount(),
    gscSyncQueue.getCompletedCount(),
    gscSyncQueue.getFailedCount(),
    gscSyncQueue.getDelayedCount(),
    annotationsImportQueue.getWaitingCount(),
    annotationsImportQueue.getActiveCount(),
    annotationsImportQueue.getCompletedCount(),
    annotationsImportQueue.getFailedCount(),
    annotationsImportQueue.getDelayedCount(),
  ]);

  // Get last completed jobs for timing
  const [gscJobs, annJobs] = await Promise.all([
    gscSyncQueue.getCompleted(0, 10),
    annotationsImportQueue.getCompleted(0, 10),
  ]);

  // Calculate average durations
  const gscDurations = gscJobs
    .filter((j) => j.finishedOn && j.processedOn)
    .map((j) => j.finishedOn! - j.processedOn!);
  const annDurations = annJobs
    .filter((j) => j.finishedOn && j.processedOn)
    .map((j) => j.finishedOn! - j.processedOn!);

  const avgGscDuration =
    gscDurations.length > 0
      ? Math.round(gscDurations.reduce((a, b) => a + b, 0) / gscDurations.length)
      : null;
  const avgAnnDuration =
    annDurations.length > 0
      ? Math.round(annDurations.reduce((a, b) => a + b, 0) / annDurations.length)
      : null;

  return {
    gscSync: {
      waiting: gscWaiting,
      active: gscActive,
      completed: gscCompleted,
      failed: gscFailed,
      delayed: gscDelayed,
    },
    annotationsImport: {
      waiting: annWaiting,
      active: annActive,
      completed: annCompleted,
      failed: annFailed,
      delayed: annDelayed,
    },
    lastFlowStatus: {
      gscSyncCompleted: gscJobs[0]?.finishedOn ?? null,
      annotationsCompleted: annJobs[0]?.finishedOn ?? null,
    },
    averageJobDuration: {
      gscSyncMs: avgGscDuration,
      annotationsMs: avgAnnDuration,
    },
  };
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the analytics orchestrator with all handlers.
 * Call this at application startup.
 */
export function initializeAnalyticsOrchestrator(): void {
  // Attach DLQ handlers
  attachGscSyncDLQHandler();
  attachAnnotationsImportDLQHandler();

  // Attach enhanced event logging
  attachGscSyncEventLogging();
  attachAnnotationsImportEventLogging();

  log.info('Analytics orchestrator initialized', {
    features: [
      'flow-producer',
      'dlq-integration',
      'event-logging',
      'health-monitoring',
    ],
  });
}

/**
 * Gracefully shutdown the orchestrator.
 */
export async function shutdownAnalyticsOrchestrator(): Promise<void> {
  await analyticsFlowProducer.close();
  log.info('Analytics orchestrator shutdown complete');
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format duration in milliseconds to human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
