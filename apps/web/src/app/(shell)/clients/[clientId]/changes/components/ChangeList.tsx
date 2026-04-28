/**
 * Change List Component
 * Phase 33: Auto-Fix System
 *
 * Displays a list of site changes with revert actions and batch selection.
 * Fixed: HIGH-STATE-001 (optimistic updates with rollback), HIGH-STATE-004 (loading states)
 */
'use client';

import { useState, useMemo, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@tevero/ui';
import { Badge } from '@tevero/ui';
import { Checkbox } from '@tevero/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tevero/ui';
import { Undo2, ExternalLink, Loader2 } from 'lucide-react';
import type { Change } from '@/actions/changes';
import { RevertDialog } from './RevertDialog';
import { BatchRevertDialog } from './BatchRevertDialog';
import { safeGetPathname } from '@/lib/utils/safe-parse';

interface ChangeListProps {
  changes: Change[];
  connectionId: string | null;
  clientId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  applied: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
  reverted: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  meta_tags: 'Meta Tags',
  headings: 'Headings',
  images: 'Images',
  technical: 'Technical',
  content: 'Content',
  schema: 'Schema',
  links: 'Links',
};

export function ChangeList({ changes, connectionId, clientId }: ChangeListProps) {
  const [selectedChange, setSelectedChange] = useState<Change | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

  // Optimistic state for tracking pending reverts (HIGH-STATE-001)
  const [pendingRevertIds, setPendingRevertIds] = useState<Set<string>>(new Set());
  const [optimisticReverts, setOptimisticReverts] = useState<Set<string>>(new Set());

  // Mark a change as pending revert (optimistic update)
  const markAsPendingRevert = useCallback((changeId: string) => {
    setPendingRevertIds(prev => new Set([...prev, changeId]));
  }, []);

  // Complete optimistic revert (success case)
  const completeOptimisticRevert = useCallback((changeId: string) => {
    setPendingRevertIds(prev => {
      const next = new Set(prev);
      next.delete(changeId);
      return next;
    });
    setOptimisticReverts(prev => new Set([...prev, changeId]));
  }, []);

  // Rollback optimistic revert (error case - HIGH-STATE-001)
  const rollbackOptimisticRevert = useCallback((changeId: string, errorMessage: string) => {
    setPendingRevertIds(prev => {
      const next = new Set(prev);
      next.delete(changeId);
      return next;
    });
    setRevertError(errorMessage);
    // Auto-clear error after 5 seconds
    setTimeout(() => setRevertError(null), 5000);
  }, []);

  // Check if a change is in a pending/optimistic state
  const isChangePending = useCallback((changeId: string) => {
    return pendingRevertIds.has(changeId);
  }, [pendingRevertIds]);

  const isChangeOptimisticallyReverted = useCallback((changeId: string) => {
    return optimisticReverts.has(changeId);
  }, [optimisticReverts]);

  const revertableChanges = useMemo(
    () => changes.filter((c) => c.status === 'verified' && !c.revertedAt),
    [changes]
  );

  const selectedChanges = useMemo(
    () => changes.filter((c) => selectedIds.has(c.id)),
    [changes, selectedIds]
  );

  const handleRevertClick = (change: Change) => {
    setSelectedChange(change);
    setIsRevertDialogOpen(true);
  };

  const canRevert = (change: Change) => {
    return connectionId !== null && change.status === 'verified' && !change.revertedAt;
  };

  const isRevertable = (change: Change) => {
    return change.status === 'verified' && !change.revertedAt;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(revertableChanges.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (changeId: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(changeId);
    } else {
      newSet.delete(changeId);
    }
    setSelectedIds(newSet);
  };

  const allRevertableSelected =
    revertableChanges.length > 0 &&
    revertableChanges.every((c) => selectedIds.has(c.id));

  const someSelected = selectedIds.size > 0;

  if (changes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No changes found.</p>
        <p className="text-sm mt-2">Changes will appear here when SEO fixes are applied.</p>
      </div>
    );
  }

  return (
    <>
      {/* Error banner for revert failures (HIGH-STATE-001 rollback notification) */}
      {revertError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-destructive">Revert failed: {revertError}</span>
          <Button variant="ghost" size="sm" onClick={() => setRevertError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Batch Actions Toolbar */}
      {someSelected && connectionId && (
        <div className="bg-muted rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} change{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsBatchDialogOpen(true)}
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Revert Selected
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {connectionId && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allRevertableSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all revertable changes"
                />
              </TableHead>
            )}
            <TableHead>Resource</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Before / After</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Applied</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((change) => (
            <TableRow key={change.id}>
              {/* Checkbox */}
              {connectionId && (
                <TableCell>
                  {isRevertable(change) && (
                    <Checkbox
                      checked={selectedIds.has(change.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(change.id, checked === true)
                      }
                      aria-label={`Select change ${change.id}`}
                    />
                  )}
                </TableCell>
              )}

              {/* Resource */}
              <TableCell className="max-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium" title={change.resourceUrl}>
                    {safeGetPathname(change.resourceUrl)}
                  </span>
                  <a
                    href={change.resourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <span className="text-xs text-muted-foreground">{change.resourceType}</span>
              </TableCell>

              {/* Field */}
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {change.field}
                </code>
              </TableCell>

              {/* Category */}
              <TableCell>
                <Badge variant="outline">
                  {CATEGORY_LABELS[change.category] ?? change.category}
                </Badge>
              </TableCell>

              {/* Before / After */}
              <TableCell className="max-w-[300px]">
                <div className="space-y-1">
                  <div
                    className="text-xs text-muted-foreground truncate"
                    title={change.beforeValue ?? undefined}
                  >
                    <span className="font-medium">Before:</span>{' '}
                    {change.beforeValue ? (
                      <span className="line-through">{truncateValue(change.beforeValue)}</span>
                    ) : (
                      <span className="italic">(empty)</span>
                    )}
                  </div>
                  <div
                    className="text-xs text-foreground truncate"
                    title={change.afterValue ?? undefined}
                  >
                    <span className="font-medium">After:</span>{' '}
                    {change.afterValue ? (
                      <span className="text-green-600">{truncateValue(change.afterValue)}</span>
                    ) : (
                      <span className="italic">(empty)</span>
                    )}
                  </div>
                </div>
              </TableCell>

              {/* Source */}
              <TableCell>
                <span className="text-sm capitalize">{change.triggeredBy}</span>
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge className={STATUS_COLORS[change.status] ?? ''}>
                  {change.status}
                </Badge>
              </TableCell>

              {/* Applied */}
              <TableCell>
                {change.appliedAt ? (
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(change.appliedAt), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right">
                {/* Loading state for pending revert (HIGH-STATE-004) */}
                {isChangePending(change.id) && (
                  <span className="inline-flex items-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Reverting...
                  </span>
                )}
                {/* Optimistically reverted (HIGH-STATE-001) */}
                {!isChangePending(change.id) && isChangeOptimisticallyReverted(change.id) && (
                  <span className="text-xs text-green-600">
                    Reverted
                  </span>
                )}
                {/* Normal revert button */}
                {!isChangePending(change.id) && !isChangeOptimisticallyReverted(change.id) && canRevert(change) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevertClick(change)}
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Revert
                  </Button>
                )}
                {!isChangePending(change.id) && !isChangeOptimisticallyReverted(change.id) && !connectionId && isRevertable(change) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    title="Connect a site to enable revert"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Revert
                  </Button>
                )}
                {!isChangePending(change.id) && !isChangeOptimisticallyReverted(change.id) && change.revertedAt && (
                  <span className="text-xs text-muted-foreground">
                    Reverted
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Single Revert Dialog */}
      {selectedChange && connectionId && (
        <RevertDialog
          isOpen={isRevertDialogOpen}
          onClose={() => {
            setIsRevertDialogOpen(false);
            setSelectedChange(null);
          }}
          change={selectedChange}
          connectionId={connectionId}
          onRevertStart={() => markAsPendingRevert(selectedChange.id)}
          onRevertSuccess={() => completeOptimisticRevert(selectedChange.id)}
          onRevertError={(error) => rollbackOptimisticRevert(selectedChange.id, error)}
        />
      )}

      {/* Batch Revert Dialog */}
      {connectionId && (
        <BatchRevertDialog
          isOpen={isBatchDialogOpen}
          onClose={() => {
            setIsBatchDialogOpen(false);
            setSelectedIds(new Set());
          }}
          changes={selectedChanges}
          connectionId={connectionId}
          clientId={clientId}
        />
      )}
    </>
  );
}

function truncateValue(value: string, maxLength: number = 50): string {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + '...';
}
