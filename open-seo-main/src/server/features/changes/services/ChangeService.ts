/**
 * Change Service
 * Phase 33: Auto-Fix System
 *
 * Orchestrates auto-fix operations with before/after tracking.
 * Uses edit recipes to execute changes via platform adapters.
 *
 * Transaction Safety:
 * - All multi-step operations wrapped in transactions
 * - Idempotency keys prevent duplicate applications
 * - Automatic rollback on any error
 * - Retry with backoff for transient database errors
 */
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { siteChanges } from '@/db/change-schema';
import { eq } from 'drizzle-orm';
import type { SiteChangeInsert, SiteChangeSelect } from '@/db/change-schema';
import type { PlatformWriteAdapter } from '@/server/features/connections/adapters/BaseAdapter';
import {
  resolveRecipe,
  isRecipeSafe,
  getRecipeInfo,
  type RecipeContext,
  type RecipeResult
} from '@/lib/edit-recipes';
import {
  ChangeRepository,
  insertChange,
  markChangeVerified,
  markChangeFailed
} from '../repositories/ChangeRepository';
import {
  withTransaction,
  withIdempotency,
  withRetry,
} from '@/lib/db/transaction';

/**
 * Input for applying a single change.
 */
export interface ApplyChangeInput {
  clientId: string;
  connectionId: string;
  recipeId: string;
  context: RecipeContext;
  triggeredBy: 'audit' | 'manual' | 'scheduled' | 'ai_suggestion';
  auditId?: string;
  findingId?: string;
  userId?: string;
  batchId?: string;
  batchSequence?: number;
}

/**
 * Result of applying a change.
 */
export interface ApplyChangeResult {
  success: boolean;
  changeId: string | null;
  error?: string;
  recipeResult?: RecipeResult;
}

/**
 * Result of batch change operation.
 */
export interface BatchChangeResult {
  batchId: string;
  total: number;
  succeeded: string[];
  failed: Array<{ findingId?: string; error: string }>;
}

/**
 * Apply a single change using an edit recipe.
 * Captures before state, executes change, verifies after state.
 *
 * Uses idempotency keys to prevent duplicate applications and
 * wraps the entire operation in a transaction with retry logic.
 */
export async function applyChange(
  adapter: PlatformWriteAdapter,
  input: ApplyChangeInput
): Promise<ApplyChangeResult> {
  const { recipeId, context, clientId, connectionId, triggeredBy, auditId, findingId, userId, batchId, batchSequence } = input;

  // 1. Validate recipe exists
  const recipeInfo = getRecipeInfo(recipeId);
  if (!recipeInfo) {
    return { success: false, changeId: null, error: `Unknown recipe: ${recipeId}` };
  }

  // 2. Check if recipe is safe for auto-application
  if (triggeredBy === 'audit' && !isRecipeSafe(recipeId)) {
    return {
      success: false,
      changeId: null,
      error: `Recipe ${recipeId} requires human review`
    };
  }

  // 3. Resolve recipe handler
  const handler = resolveRecipe(recipeId);
  if (!handler) {
    return { success: false, changeId: null, error: `No handler for recipe: ${recipeId}` };
  }

  // 4. Generate change ID upfront for idempotency key
  const changeId = nanoid();

  // 5. Use idempotency to prevent duplicate applications
  // Key includes resource + recipe + suggested value to be unique per operation
  const idempotencyKey = `change:apply:${clientId}:${context.resourceId}:${recipeId}:${context.suggestedValue ?? 'auto'}`;

  try {
    const { result, cached } = await withIdempotency(
      idempotencyKey,
      () => _applyChangeInternal(adapter, input, changeId, recipeInfo, handler),
      86400 // 24 hour TTL
    );

    if (cached) {
      console.log(`[ChangeService] Change already applied (idempotent): ${idempotencyKey}`);
    }

    return result;
  } catch (error) {
    // Error already logged in _applyChangeInternal
    return {
      success: false,
      changeId,
      error: (error as Error).message
    };
  }
}

/**
 * Internal implementation of applyChange wrapped in transaction.
 * All database operations are atomic - either all succeed or all fail.
 */
async function _applyChangeInternal(
  adapter: PlatformWriteAdapter,
  input: ApplyChangeInput,
  changeId: string,
  recipeInfo: ReturnType<typeof getRecipeInfo>,
  handler: ReturnType<typeof resolveRecipe>
): Promise<ApplyChangeResult> {
  const { context, clientId, connectionId, triggeredBy, auditId, findingId, userId, batchId, batchSequence } = input;

  // Wrap ENTIRE operation in transaction with retry for transient errors
  return withRetry(() => withTransaction(async (tx) => {
    // 1. Create pending change record
    const changeRecord: SiteChangeInsert = {
      id: changeId,
      clientId,
      connectionId,
      changeType: recipeInfo!.field,
      category: recipeInfo!.category,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      resourceUrl: context.resourceUrl,
      field: recipeInfo!.field,
      beforeValue: context.currentValue ?? null,
      afterValue: null,
      triggeredBy,
      auditId: auditId ?? null,
      findingId: findingId ?? null,
      userId: userId ?? null,
      status: 'pending',
      batchId: batchId ?? null,
      batchSequence: batchSequence ?? null,
    };

    // 2. Insert pending record within transaction
    await tx.insert(siteChanges).values(changeRecord);

    // 3. Execute recipe handler
    let recipeResult: RecipeResult;
    try {
      recipeResult = await handler!(adapter, context);
    } catch (error) {
      // Mark as failed within transaction (will be rolled back if outer fails)
      await tx.update(siteChanges)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(siteChanges.id, changeId));

      throw error; // Will trigger transaction rollback
    }

    if (!recipeResult.success) {
      // Mark change as failed within transaction
      await tx.update(siteChanges)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(siteChanges.id, changeId));

      return {
        success: false,
        changeId,
        error: recipeResult.error,
        recipeResult
      };
    }

    // 4. Update change record with results within same transaction
    await tx.update(siteChanges)
      .set({
        beforeValue: recipeResult.beforeValue,
        afterValue: recipeResult.afterValue,
        status: recipeResult.verified ? 'verified' : 'applied',
        appliedAt: new Date(),
        verifiedAt: recipeResult.verified ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(siteChanges.id, changeId));

    return { success: true, changeId, recipeResult };
  }), {
    maxRetries: 3,
    baseDelayMs: 100,
    retryableErrors: ['SERIALIZATION_FAILURE', 'DEADLOCK_DETECTED', '40001', '40P01'],
  });
}

/**
 * Apply multiple changes as a batch.
 * Each change is executed in sequence with idempotency protection.
 * The batch itself has an idempotency key to prevent duplicate batch executions.
 */
export async function applyBatchChanges(
  adapter: PlatformWriteAdapter,
  inputs: Omit<ApplyChangeInput, 'batchId' | 'batchSequence'>[]
): Promise<BatchChangeResult> {
  if (inputs.length === 0) {
    return {
      batchId: nanoid(),
      total: 0,
      succeeded: [],
      failed: [],
    };
  }

  const batchId = nanoid();

  // Create idempotency key for the entire batch based on its contents
  const batchFingerprint = inputs
    .map(i => `${i.clientId}:${i.context.resourceId}:${i.recipeId}`)
    .join('|');
  const batchIdempotencyKey = `batch:apply:${batchFingerprint}`;

  const { result, cached } = await withIdempotency(
    batchIdempotencyKey,
    async () => {
      const succeeded: string[] = [];
      const failed: Array<{ findingId?: string; error: string }> = [];

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const result = await applyChange(adapter, {
          ...input,
          batchId,
          batchSequence: i,
        });

        if (result.success && result.changeId) {
          succeeded.push(result.changeId);
        } else {
          failed.push({
            findingId: input.findingId,
            error: result.error || 'Unknown error',
          });
        }
      }

      return {
        batchId,
        total: inputs.length,
        succeeded,
        failed,
      };
    },
    86400 // 24 hour TTL
  );

  if (cached) {
    console.log(`[ChangeService] Batch already applied (idempotent): ${batchIdempotencyKey}`);
  }

  return result;
}

/**
 * Preview what a change would do without applying it.
 * Reads current value to show before state.
 */
export async function previewChange(
  adapter: PlatformWriteAdapter,
  recipeId: string,
  context: RecipeContext
): Promise<{
  recipeId: string;
  recipeName: string;
  field: string;
  currentValue: string | null;
  newValue: string | null;
  isSafe: boolean;
}> {
  const recipeInfo = getRecipeInfo(recipeId);
  if (!recipeInfo) {
    throw new Error(`Unknown recipe: ${recipeId}`);
  }

  // Read current value if not provided
  const currentValue = context.currentValue ??
    await adapter.readField(context.resourceId, recipeInfo.field);

  return {
    recipeId,
    recipeName: recipeInfo.name,
    field: recipeInfo.field,
    currentValue,
    newValue: context.suggestedValue ?? null,
    isSafe: isRecipeSafe(recipeId),
  };
}

/**
 * Get change history for a resource.
 */
export async function getChangeHistory(
  resourceId: string,
  resourceType?: string
): Promise<SiteChangeSelect[]> {
  return ChangeRepository.getChangesByResource(resourceId, resourceType);
}

export const ChangeService = {
  applyChange,
  applyBatchChanges,
  previewChange,
  getChangeHistory,
};
