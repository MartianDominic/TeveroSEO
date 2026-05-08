/**
 * Annotations Import BullMQ Job
 * Phase 96-03: Daily Google algorithm update import
 * Phase 96-Queue: Enhanced with DLQ integration and event logging
 *
 * Runs daily at 4 AM UTC for all active workspaces.
 * When used with analytics-orchestrator, runs after GSC sync completes.
 */
import { Queue, Worker, type Job } from 'bullmq';
import { getSharedBullMQConnection } from '@/server/lib/redis';
import { importGoogleUpdates } from '../services/AnnotationImportService';
import { createLogger } from '@/server/lib/logger';

const log = createLogger({ module: 'annotations-import-job' });

export interface AnnotationsImportJobData {
  workspaceId: string;
}

export interface AnnotationsImportJobResult {
  imported: number;
  skipped: number;
}

export const annotationsImportQueue = new Queue<AnnotationsImportJobData, AnnotationsImportJobResult>(
  'annotations-import',
  {
    connection: getSharedBullMQConnection('queue:annotations-import'),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 }, // 1 min backoff
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 604800, count: 50 },
    },
  }
);

export const annotationsImportWorker = new Worker<AnnotationsImportJobData, AnnotationsImportJobResult>(
  'annotations-import',
  async (job: Job<AnnotationsImportJobData, AnnotationsImportJobResult>) => {
    const { workspaceId } = job.data;

    log.info('Starting annotations import', { workspaceId, jobId: job.id });

    const result = await importGoogleUpdates(workspaceId);

    log.info('Annotations import complete', { workspaceId, ...result });
    return result;
  },
  {
    connection: getSharedBullMQConnection('worker:annotations-import'),
    concurrency: 1, // Sequential to avoid rate limiting
  }
);

/**
 * Schedule daily import for a workspace.
 */
export async function scheduleAnnotationsImport(workspaceId: string): Promise<void> {
  await annotationsImportQueue.add(
    'daily-import',
    { workspaceId },
    {
      repeat: { pattern: '0 4 * * *', tz: 'UTC' }, // 4 AM UTC daily
      jobId: `annotations-import-${workspaceId}`,
    }
  );
}

/**
 * Trigger immediate import for a workspace.
 */
export async function triggerAnnotationsImport(workspaceId: string): Promise<string> {
  const job = await annotationsImportQueue.add(
    'manual-import',
    { workspaceId },
    { priority: 1 } // High priority for manual triggers
  );
  return job.id!;
}
