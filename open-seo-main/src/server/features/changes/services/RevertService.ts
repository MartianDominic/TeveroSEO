/**
 * Revert Service
 * Phase 33: Auto-Fix System
 *
 * Orchestrates revert operations at various scope levels.
 * Handles dependency detection, preview mode, and actual revert execution.
 */
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { siteChanges, type SiteChangeSelect, type SiteChangeInsert } from '@/db/change-schema';
import { and, eq, gte, lte, desc, inArray } from 'drizzle-orm';
import type { PlatformWriteAdapter, WriteResult } from '@/server/features/connections/adapters/BaseAdapter';
import {
  ChangeRepository,
  insertChange,
  markChangeReverted,
  getChangeById,
  getChangesByBatch,
  getChangesByResource,
} from '../repositories/ChangeRepository';
import {
  DependencyResolver,
  detectDependencies,
  checkRevertSafety,
  getRevertOrder,
  type DependencyResult,
} from './DependencyResolver';

/**
 * Revert scope types supported by the system.
 */
export type RevertScope =
  | { type: 'single'; changeId: string }
  | { type: 'field'; resourceId: string; field: string; clientId: string }
  | { type: 'resource'; resourceId: string; clientId: string }
  | { type: 'category'; category: string; clientId: string }
  | { type: 'batch'; batchId: string }
  | { type: 'date_range'; from: Date; to: Date; clientId: string }
  | { type: 'audit'; auditId: string }
  | { type: 'full'; clientId: string };

/**
 * Cascade mode for handling dependent changes.
 */
export type CascadeMode = 'warn' | 'cascade' | 'force';

/**
 * Result of a revert preview.
 */
export interface RevertPreview {
  /** Scope being reverted */
  scope: RevertScope;
  /** Changes that would be reverted */
  changes: SiteChangeSelect[];
  /** Count of changes */
  changeCount: number;
  /** Dependency information for each change */
  dependencies: DependencyResult[];
  /** Whether there are dependent changes not being reverted */
  hasOrphanedDependencies: boolean;
  /** Warnings about the revert operation */
  warnings: string[];
  /** Whether the revert can proceed safely */
  canProceed: boolean;
}

/**
 * Result of a revert operation.
 */
export interface RevertResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Number of changes reverted */
  revertedCount: number;
  /** IDs of new revert change records created */
  revertChangeIds: string[];
  /** Errors encountered during revert */
  errors: Array<{ changeId: string; error: string }>;
  /** Batch ID grouping all reverts */
  revertBatchId: string;
}

/**
 * Resolve a scope to a list of change IDs.
 */
async function resolveScope(scope: RevertScope): Promise<string[]> {
  switch (scope.type) {
    case 'single':
      return [scope.changeId];

    case 'field': {
      const changes = await db
        .select()
        .from(siteChanges)
        .where(
          and(
            eq(siteChanges.resourceId, scope.resourceId),
            eq(siteChanges.field, scope.field),
            eq(siteChanges.clientId, scope.clientId),
            eq(siteChanges.status, 'verified')
          )
        )
        .orderBy(desc(siteChanges.createdAt));
      return changes.map((c) => c.id);
    }

    case 'resource': {
      const changes = await getChangesByResource(scope.resourceId);
      return changes
        .filter((c) => c.clientId === scope.clientId && c.status === 'verified')
        .map((c) => c.id);
    }

    case 'category': {
      const changes = await db
        .select()
        .from(siteChanges)
        .where(
          and(
            eq(siteChanges.category, scope.category),
            eq(siteChanges.clientId, scope.clientId),
            eq(siteChanges.status, 'verified')
          )
        )
        .orderBy(desc(siteChanges.createdAt));
      return changes.map((c) => c.id);
    }

    case 'batch': {
      const changes = await getChangesByBatch(scope.batchId);
      return changes.filter((c) => c.status === 'verified').map((c) => c.id);
    }

    case 'date_range': {
      const changes = await db
        .select()
        .from(siteChanges)
        .where(
          and(
            eq(siteChanges.clientId, scope.clientId),
            gte(siteChanges.createdAt, scope.from),
            lte(siteChanges.createdAt, scope.to),
            eq(siteChanges.status, 'verified')
          )
        )
        .orderBy(desc(siteChanges.createdAt));
      return changes.map((c) => c.id);
    }

    case 'audit': {
      const changes = await db
        .select()
        .from(siteChanges)
        .where(
          and(
            eq(siteChanges.auditId, scope.auditId),
            eq(siteChanges.status, 'verified')
          )
        )
        .orderBy(desc(siteChanges.createdAt));
      return changes.map((c) => c.id);
    }

    case 'full': {
      const changes = await db
        .select()
        .from(siteChanges)
        .where(
          and(
            eq(siteChanges.clientId, scope.clientId),
            eq(siteChanges.status, 'verified')
          )
        )
        .orderBy(desc(siteChanges.createdAt));
      return changes.map((c) => c.id);
    }

    default:
      return [];
  }
}

/**
 * Preview a revert operation without executing it.
 * Shows what would be reverted and any dependency warnings.
 */
export async function previewRevert(
  scope: RevertScope,
  cascadeMode: CascadeMode = 'warn'
): Promise<RevertPreview> {
  // Resolve scope to change IDs
  const changeIds = await resolveScope(scope);

  if (changeIds.length === 0) {
    return {
      scope,
      changes: [],
      changeCount: 0,
      dependencies: [],
      hasOrphanedDependencies: false,
      warnings: ['No changes found for the specified scope'],
      canProceed: false,
    };
  }

  // Get full change records
  const changes = await db
    .select()
    .from(siteChanges)
    .where(inArray(siteChanges.id, changeIds))
    .orderBy(desc(siteChanges.createdAt));

  // Detect dependencies for each change
  const dependencies: DependencyResult[] = [];
  for (const change of changes) {
    const deps = await detectDependencies(change.id);
    dependencies.push(deps);
  }

  // Check for orphaned dependencies
  const safetyCheck = await checkRevertSafety(changeIds);

  // Determine if cascade mode adds more changes
  let finalChangeIds = changeIds;
  const warnings = [...safetyCheck.warnings];

  if (cascadeMode === 'cascade' && safetyCheck.orphanedChanges.length > 0) {
    // Add orphaned changes to the revert set
    const cascadeIds = safetyCheck.orphanedChanges.map((c) => c.id);
    finalChangeIds = [...new Set([...changeIds, ...cascadeIds])];
    warnings.push(`Cascade mode: adding ${cascadeIds.length} dependent changes to revert`);
  }

  return {
    scope,
    changes,
    changeCount: changes.length,
    dependencies,
    hasOrphanedDependencies: !safetyCheck.safe && cascadeMode === 'warn',
    warnings,
    canProceed: cascadeMode === 'force' || safetyCheck.safe || cascadeMode === 'cascade',
  };
}

/**
 * Revert a single change by writing its beforeValue back.
 */
async function revertSingleChange(
  adapter: PlatformWriteAdapter,
  change: SiteChangeSelect,
  revertBatchId: string,
  revertBatchSequence: number
): Promise<{ success: boolean; revertChangeId: string | null; error?: string }> {
  // Cannot revert if no beforeValue
  if (change.beforeValue === null) {
    return {
      success: false,
      revertChangeId: null,
      error: 'No beforeValue available for revert'
    };
  }

  // Read current value
  const currentValue = await adapter.readField(change.resourceId, change.field);

  // Write the beforeValue back
  const result = await adapter.writeField(change.resourceId, change.field, change.beforeValue);

  if (!result.success) {
    return { success: false, revertChangeId: null, error: result.error };
  }

  // Verify the revert
  const verifiedValue = await adapter.readField(change.resourceId, change.field);
  const verified = verifiedValue === change.beforeValue;

  // Create revert change record
  const revertChangeId = nanoid();
  const revertRecord: SiteChangeInsert = {
    id: revertChangeId,
    clientId: change.clientId,
    connectionId: change.connectionId,
    changeType: change.changeType,
    category: change.category,
    resourceType: change.resourceType,
    resourceId: change.resourceId,
    resourceUrl: change.resourceUrl,
    field: change.field,
    beforeValue: currentValue,
    afterValue: change.beforeValue,
    triggeredBy: 'revert',
    auditId: change.auditId,
    findingId: change.findingId,
    status: verified ? 'verified' : 'applied',
    appliedAt: new Date(),
    verifiedAt: verified ? new Date() : null,
    batchId: revertBatchId,
    batchSequence: revertBatchSequence,
  };

  await insertChange(revertRecord);

  // Mark original change as reverted
  await markChangeReverted(change.id, revertChangeId);

  return { success: true, revertChangeId };
}

/**
 * Execute a revert operation.
 */
export async function revertByScope(
  adapter: PlatformWriteAdapter,
  scope: RevertScope,
  cascadeMode: CascadeMode = 'warn',
  userId?: string
): Promise<RevertResult> {
  // Preview first to validate
  const preview = await previewRevert(scope, cascadeMode);

  if (!preview.canProceed) {
    return {
      success: false,
      revertedCount: 0,
      revertChangeIds: [],
      errors: [{ changeId: '', error: 'Revert cannot proceed: ' + preview.warnings.join(', ') }],
      revertBatchId: '',
    };
  }

  // Get changes in revert order (reverse chronological)
  let changeIds = preview.changes.map((c) => c.id);

  // If cascade mode, include dependent changes
  if (cascadeMode === 'cascade') {
    const safetyCheck = await checkRevertSafety(changeIds);
    if (safetyCheck.orphanedChanges.length > 0) {
      changeIds = [...new Set([
        ...changeIds,
        ...safetyCheck.orphanedChanges.map((c) => c.id),
      ])];
    }
  }

  // Order for revert (newest first)
  const orderedIds = await getRevertOrder(changeIds);

  // Get full change records
  const changes = await db
    .select()
    .from(siteChanges)
    .where(inArray(siteChanges.id, orderedIds));

  // Create change ID to record map for ordering
  const changeMap = new Map(changes.map((c) => [c.id, c]));

  // Execute reverts
  const revertBatchId = nanoid();
  const revertChangeIds: string[] = [];
  const errors: Array<{ changeId: string; error: string }> = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const changeId = orderedIds[i];
    const change = changeMap.get(changeId);

    if (!change) {
      errors.push({ changeId, error: 'Change not found' });
      continue;
    }

    const result = await revertSingleChange(adapter, change, revertBatchId, i);

    if (result.success && result.revertChangeId) {
      revertChangeIds.push(result.revertChangeId);
    } else {
      errors.push({ changeId, error: result.error || 'Unknown error' });
    }
  }

  return {
    success: errors.length === 0,
    revertedCount: revertChangeIds.length,
    revertChangeIds,
    errors,
    revertBatchId,
  };
}

/**
 * Revert a single change by ID.
 * Convenience wrapper around revertByScope with 'single' scope.
 */
export async function revertChange(
  adapter: PlatformWriteAdapter,
  changeId: string,
  cascadeMode: CascadeMode = 'warn'
): Promise<RevertResult> {
  return revertByScope(adapter, { type: 'single', changeId }, cascadeMode);
}

/**
 * Revert all changes for a resource (page/product).
 */
export async function revertResource(
  adapter: PlatformWriteAdapter,
  resourceId: string,
  clientId: string,
  cascadeMode: CascadeMode = 'warn'
): Promise<RevertResult> {
  return revertByScope(adapter, { type: 'resource', resourceId, clientId }, cascadeMode);
}

/**
 * Revert all changes in a category.
 */
export async function revertCategory(
  adapter: PlatformWriteAdapter,
  category: string,
  clientId: string,
  cascadeMode: CascadeMode = 'warn'
): Promise<RevertResult> {
  return revertByScope(adapter, { type: 'category', category, clientId }, cascadeMode);
}

/**
 * Revert all changes in a batch.
 */
export async function revertBatch(
  adapter: PlatformWriteAdapter,
  batchId: string,
  cascadeMode: CascadeMode = 'warn'
): Promise<RevertResult> {
  return revertByScope(adapter, { type: 'batch', batchId }, cascadeMode);
}

/**
 * Revert all changes in a date range.
 */
export async function revertDateRange(
  adapter: PlatformWriteAdapter,
  from: Date,
  to: Date,
  clientId: string,
  cascadeMode: CascadeMode = 'warn'
): Promise<RevertResult> {
  return revertByScope(adapter, { type: 'date_range', from, to, clientId }, cascadeMode);
}

export const RevertService = {
  previewRevert,
  revertByScope,
  revertChange,
  revertResource,
  revertCategory,
  revertBatch,
  revertDateRange,
};
