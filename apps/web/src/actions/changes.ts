/**
 * Server Actions for Changes
 * Phase 33: Auto-Fix System
 *
 * Server actions for fetching changes and executing reverts.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { openSeoFetch } from '~/lib/api/open-seo';

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
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.category) params.set('category', filters.category);
    if (filters.resourceType) params.set('resourceType', filters.resourceType);
    if (filters.triggeredBy) params.set('triggeredBy', filters.triggeredBy);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));

    const queryString = params.toString();
    const url = `/api/changes/${clientId}${queryString ? `?${queryString}` : ''}`;

    const response = await openSeoFetch<{ success: boolean; data: Change[] }>(url);

    if (!response.success) {
      return { success: false, error: 'Failed to fetch changes' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get a single change by ID.
 */
export async function getChange(
  changeId: string
): Promise<{ success: boolean; data?: Change; error?: string }> {
  try {
    const response = await openSeoFetch<{ success: boolean; data: Change }>(
      `/api/changes/single/${changeId}`
    );

    if (!response.success) {
      return { success: false, error: 'Change not found' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Preview a revert operation.
 */
export async function previewRevert(
  scope: Record<string, unknown>,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertPreview; error?: string }> {
  try {
    const response = await openSeoFetch<{ success: boolean; data: RevertPreview }>(
      '/api/reverts/preview',
      {
        method: 'POST',
        body: JSON.stringify({ scope, cascadeMode }),
      }
    );

    if (!response.success) {
      return { success: false, error: 'Failed to preview revert' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Execute a revert operation.
 */
export async function executeRevert(
  scope: Record<string, unknown>,
  connectionId: string,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertResult; error?: string }> {
  try {
    const response = await openSeoFetch<{ success: boolean; data: RevertResult }>(
      '/api/reverts/execute',
      {
        method: 'POST',
        body: JSON.stringify({ scope, connectionId, cascadeMode }),
      }
    );

    // Revalidate changes pages
    revalidatePath('/clients/[clientId]/changes', 'page');

    if (!response.success) {
      return { success: false, error: 'Failed to execute revert' };
    }

    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Revert a single change.
 */
export async function revertSingleChange(
  changeId: string,
  connectionId: string,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertResult; error?: string }> {
  return executeRevert({ type: 'single', changeId }, connectionId, cascadeMode);
}

/**
 * Revert all changes in a batch.
 */
export async function revertBatch(
  batchId: string,
  connectionId: string,
  cascadeMode: 'warn' | 'cascade' | 'force' = 'warn'
): Promise<{ success: boolean; data?: RevertResult; error?: string }> {
  return executeRevert({ type: 'batch', batchId }, connectionId, cascadeMode);
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
