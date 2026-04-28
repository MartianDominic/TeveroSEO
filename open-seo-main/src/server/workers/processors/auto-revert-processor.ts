/**
 * Sandboxed BullMQ processor for auto-revert jobs.
 * Phase 33: Auto-Fix System
 *
 * Runs in a child process to isolate revert operations from main event loop.
 * This prevents crashes in revert logic from affecting other workers.
 */
import type { Job } from 'bullmq';
import { createLogger } from '@/server/lib/logger';
import {
  evaluateTrigger,
  getEnabledTriggers,
  updateTriggerTimestamps,
} from '@/server/features/changes/services/TriggerService';
import { revertByScope } from '@/server/features/changes/services/RevertService';
import { connectionService } from '@/server/features/connections/services/ConnectionService';
import { isWriteAdapter } from '@/server/features/connections/adapters/BaseAdapter';
import { db } from '@/db';
import { siteConnections } from '@/db/connection-schema';
import { eq, and } from 'drizzle-orm';

const log = createLogger({ module: 'auto-revert-processor' });

/**
 * Job data for auto-revert check.
 */
interface AutoRevertJobData {
  type: 'check_all_triggers' | 'check_client_triggers';
  clientId?: string;
}

/**
 * Result of processing auto-revert job.
 */
interface AutoRevertJobResult {
  triggersChecked: number;
  triggersFired: number;
  revertsExecuted: number;
  errors: string[];
}

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processAutoRevertJob(
  job: Job<AutoRevertJobData>,
): Promise<AutoRevertJobResult> {
  const { type, clientId } = job.data;

  await job.log(`Starting auto-revert check: ${type}${clientId ? ` for client ${clientId}` : ''}`);

  // Get enabled triggers
  const triggers = await getEnabledTriggers(clientId);
  await job.log(`Found ${triggers.length} enabled triggers`);

  const result: AutoRevertJobResult = {
    triggersChecked: triggers.length,
    triggersFired: 0,
    revertsExecuted: 0,
    errors: [],
  };

  // Update progress as we process triggers
  const totalTriggers = triggers.length;
  let processedTriggers = 0;

  for (const trigger of triggers) {
    try {
      await job.log(`Evaluating trigger ${trigger.id} (${trigger.triggerType})`);

      // Evaluate the trigger
      const evaluation = await evaluateTrigger(trigger);

      // Update last check timestamp
      await updateTriggerTimestamps(trigger.id, evaluation.shouldFire);

      if (!evaluation.shouldFire) {
        await job.log(`Trigger ${trigger.id}: ${evaluation.reason}`);
        processedTriggers++;
        await job.updateProgress(Math.floor((processedTriggers / totalTriggers) * 100));
        continue;
      }

      result.triggersFired++;
      await job.log(`Trigger ${trigger.id} FIRED: ${evaluation.reason}`);

      // Get connection for this client to get adapter
      const [connection] = await db
        .select()
        .from(siteConnections)
        .where(
          and(
            eq(siteConnections.clientId, trigger.clientId),
            eq(siteConnections.status, 'active')
          )
        )
        .limit(1);

      if (!connection) {
        result.errors.push(`No active connection for client ${trigger.clientId}`);
        await job.log(`No active connection for client ${trigger.clientId}`);
        processedTriggers++;
        await job.updateProgress(Math.floor((processedTriggers / totalTriggers) * 100));
        continue;
      }

      // Get adapter
      const adapter = await connectionService.getConnectionWithAdapter(connection.id);
      if (!adapter || !isWriteAdapter(adapter)) {
        result.errors.push(`No write adapter for connection ${connection.id}`);
        await job.log(`No write adapter for connection ${connection.id}`);
        processedTriggers++;
        await job.updateProgress(Math.floor((processedTriggers / totalTriggers) * 100));
        continue;
      }

      // Execute revert
      if (evaluation.scope) {
        await job.log(`Executing revert with scope: ${JSON.stringify(evaluation.scope)}`);

        const revertResult = await revertByScope(adapter, evaluation.scope, 'cascade');

        if (revertResult.success) {
          result.revertsExecuted++;
          await job.log(
            `Revert successful: ${revertResult.revertedCount} changes reverted (batch: ${revertResult.revertBatchId})`
          );
        } else {
          result.errors.push(`Revert failed: ${revertResult.errors.map((e) => e.error).join(', ')}`);
          await job.log(`Revert failed: ${JSON.stringify(revertResult.errors)}`);
        }
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      result.errors.push(`Trigger ${trigger.id}: ${errorMessage}`);
      await job.log(`Error processing trigger ${trigger.id}: ${errorMessage}`);
      log.error(`Error processing trigger ${trigger.id}`, error as Error);
    }

    processedTriggers++;
    await job.updateProgress(Math.floor((processedTriggers / totalTriggers) * 100));
  }

  await job.log(
    `Auto-revert check complete: ${result.triggersChecked} checked, ${result.triggersFired} fired, ${result.revertsExecuted} executed, ${result.errors.length} errors`
  );

  return result;
}
