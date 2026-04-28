/**
 * Server Actions for Changes
 * Phase 33: Auto-Fix System
 *
 * Server actions for fetching changes and executing reverts.
 */
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  requireActionAuth,
  validateClientOwnership,
} from '@/lib/auth/action-auth';
import { getOpenSeo, postOpenSeo } from '@/lib/server-fetch';

// Validation schemas
const clientIdSchema = z.string().uuid('Invalid client ID format');
const changeIdSchema = z.string().uuid('Invalid change ID format');
const batchIdSchema = z.string().uuid('Invalid batch ID format');
const connectionIdSchema = z.string().uuid('Invalid connection ID format');

const cascadeModeSchema = z.enum(['warn', 'cascade', 'force'], {
  errorMap: () => ({ message: 'Cascade mode must be warn, cascade, or force' }),
});

const changeFiltersSchema = z.object({
  status: z.enum(['pending', 'applied', 'verified', 'reverted', 'failed']).optional(),
  category: z.enum(['meta_tags', 'headings', 'images', 'technical', 'content', 'schema', 'links']).optional(),
  resourceType: z.string().max(50).optional(),
  triggeredBy: z.string().max(100).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

// Revert scope schemas - type discriminated union
const singleRevertScopeSchema = z.object({
  type: z.literal('single'),
  changeId: changeIdSchema,
  clientId: clientIdSchema,
});

const batchRevertScopeSchema = z.object({
  type: z.literal('batch'),
  batchId: batchIdSchema,
  clientId: clientIdSchema,
});

const dateRangeRevertScopeSchema = z.object({
  type: z.literal('date_range'),
  from: z.string().datetime('Invalid from date format'),
  to: z.string().datetime('Invalid to date format'),
  clientId: clientIdSchema,
});

const revertScopeSchema = z.discriminatedUnion('type', [
  singleRevertScopeSchema,
  batchRevertScopeSchema,
  dateRangeRevertScopeSchema,
]);

/**
 * Change record from the API.
 */
export interface Change {
  id: string;
  clientId: string;
  connectionId: string;
  changeType: string;
  category: string;
  resourceType: string;
  resourceId: string;
  resourceUrl: string;
  field: string;
  beforeValue: string | null;
  afterValue: string | null;
  triggeredBy: string;
  auditId: string | null;
  findingId: string | null;
  status: string;
  appliedAt: string | null;
  verifiedAt: string | null;
  revertedAt: string | null;
  revertedByChangeId: string | null;
  batchId: string | null;
  createdAt: string;
}

/**
 * Filters for fetching changes.
 */
export interface ChangeFilters {
  status?: string;
  category?: string;
  resourceType?: string;
  triggeredBy?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Revert preview result.
 */
export interface RevertPreview {
  scope: Record<string, unknown>;
  changes: Change[];
  changeCount: number;
  hasOrphanedDependencies: boolean;
  warnings: string[];
  canProceed: boolean;
}

/**
 * Revert execution result.
 */
export interface RevertResult {
  success: boolean;
  revertedCount: number;
  revertChangeIds: string[];
  errors: Array<{ changeId: string; error: string }>;
  revertBatchId: string;
}

/**
 * Fetch changes for a client with optional filters.
 */
export async function getChanges(
  clientId: string,
  filters: ChangeFilters = {}
): Promise<{ success: boolean; data?: Change[]; error?: string }> {
  try {
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedFilters = changeFiltersSchema.parse(filters);

    const auth = await requireActionAuth();
    await validateClientOwnership(validatedClientId, auth);

    const params = new URLSearchParams();
    params.set('clientId', validatedClientId);
    if (validatedFilters.status) params.set('status', validatedFilters.status);
    if (validatedFilters.category) params.set('category', validatedFilters.category);
    if (validatedFilters.resourceType) params.set('resourceType', validatedFilters.resourceType);
    if (validatedFilters.triggeredBy) params.set('triggeredBy', validatedFilters.triggeredBy);
    if (validatedFilters.dateFrom) params.set('dateFrom', validatedFilters.dateFrom);
    if (validatedFilters.dateTo) params.set('dateTo', validatedFilters.dateTo);
    if (validatedFilters.limit) params.set('limit', String(validatedFilters.limit));
    if (validatedFilters.offset) params.set('offset', String(validatedFilters.offset));

    const queryString = params.toString();
    const url = `/api/changes${queryString ? `?${queryString}` : ''}`;

    const response = await getOpenSeo<{ success: boolean; data: Change[] }>(url);

    if (!response.success) {
      return { success: false, error: 'Failed to fetch changes' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Invalid input' };
    }
    // SECURITY: Log full error server-side, return sanitized message to client
    console.error('[getChanges]', error);
    return { success: false, error: 'Failed to fetch changes. Please try again.' };
  }
}

/**
 * Get a single change by ID.
 * Validates client ownership after fetching the change.
 */
export async function getChange(
  changeId: string
): Promise<{ success: boolean; data?: Change; error?: string }> {
  try {
    const validatedChangeId = changeIdSchema.parse(changeId);
    const auth = await requireActionAuth();

    const response = await getOpenSeo<{ success: boolean; data: Change }>(
      `/api/changes/${validatedChangeId}`
    );

    if (!response.success || !response.data) {
      return { success: false, error: 'Change not found' };
    }

    // Validate ownership of the client associated with this change
    await validateClientOwnership(response.data.clientId, auth);

    return { success: true, data: response.data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Invalid input' };
    }
    // SECURITY: Log full error server-side, return sanitized message to client
    console.error('[getChange]', error);
    return { success: false, error: 'Failed to fetch change. Please try again.' };
  }
}

/**
 * Preview a revert operation.
 * Validates client ownership from scope before proceeding.
 */
export async function previewRevert(
  scope: Record<string, unknown>,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertPreview; error?: string }> {
  try {
    const validatedScope = revertScopeSchema.parse(scope);
    const validatedCascadeMode = cascadeModeSchema.parse(cascadeMode);

    const auth = await requireActionAuth();
    await validateClientOwnership(validatedScope.clientId, auth);

    const response = await postOpenSeo<{ success: boolean; data: RevertPreview }>(
      '/api/reverts/preview',
      { scope: validatedScope, cascadeMode: validatedCascadeMode }
    );

    if (!response.success) {
      return { success: false, error: 'Failed to preview revert' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Invalid input' };
    }
    // SECURITY: Log full error server-side, return sanitized message to client
    console.error('[previewRevert]', error);
    return { success: false, error: 'Failed to preview revert. Please try again.' };
  }
}

/**
 * Execute a revert operation.
 * Validates client ownership from scope before proceeding.
 */
export async function executeRevert(
  scope: Record<string, unknown>,
  connectionId: string,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertResult; error?: string }> {
  try {
    const validatedScope = revertScopeSchema.parse(scope);
    const validatedConnectionId = connectionIdSchema.parse(connectionId);
    const validatedCascadeMode = cascadeModeSchema.parse(cascadeMode);

    const auth = await requireActionAuth();
    await validateClientOwnership(validatedScope.clientId, auth);

    const response = await postOpenSeo<{ success: boolean; data: RevertResult }>(
      '/api/reverts/execute',
      { scope: validatedScope, connectionId: validatedConnectionId, cascadeMode: validatedCascadeMode }
    );

    // Revalidate changes pages
    revalidatePath('/clients/[clientId]/changes', 'page');

    if (!response.success) {
      return { success: false, error: 'Failed to execute revert' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Invalid input' };
    }
    // SECURITY: Log full error server-side, return sanitized message to client
    console.error('[executeRevert]', error);
    return { success: false, error: 'Failed to execute revert. Please try again.' };
  }
}

/**
 * Revert a single change.
 * Requires clientId for ownership validation.
 */
export async function revertSingleChange(
  changeId: string,
  clientId: string,
  connectionId: string,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertResult; error?: string }> {
  // Validation happens in executeRevert via revertScopeSchema
  return executeRevert({ type: 'single', changeId, clientId }, connectionId, cascadeMode);
}

/**
 * Revert all changes in a batch.
 * Requires clientId for ownership validation.
 */
export async function revertBatch(
  batchId: string,
  clientId: string,
  connectionId: string,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertResult; error?: string }> {
  // Validation happens in executeRevert via revertScopeSchema
  return executeRevert({ type: 'batch', batchId, clientId }, connectionId, cascadeMode);
}

/**
 * Revert changes in a date range.
 */
export async function revertDateRange(
  clientId: string,
  from: string,
  to: string,
  connectionId: string,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertResult; error?: string }> {
  // Validation happens in executeRevert via revertScopeSchema
  return executeRevert({ type: 'date_range', from, to, clientId }, connectionId, cascadeMode);
}

/**
 * Get change categories for filters.
 */
export async function getChangeCategories(): Promise<string[]> {
  return [
    'meta_tags',
    'headings',
    'images',
    'technical',
    'content',
    'schema',
    'links',
  ];
}

/**
 * Get change statuses for filters.
 */
export async function getChangeStatuses(): Promise<string[]> {
  return ['pending', 'applied', 'verified', 'reverted', 'failed'];
}
