/**
 * Batch Revert Dialog Component
 * Phase 33: Auto-Fix System
 *
 * Confirmation dialog for reverting multiple changes at once.
 * Supports: batch of selected changes, by category, by date range.
 */
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tevero/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tevero/ui';
import { Label } from '@tevero/ui';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Change } from '@/actions/changes';
import { executeRevert, revertDateRange, revertSingleChange } from '@/actions/changes';

interface BatchRevertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  changes: Change[];
  connectionId: string;
  clientId: string;
}

type RevertMode = 'selected' | 'category' | 'date_range';
type CascadeMode = 'warn' | 'cascade' | 'force';

export function BatchRevertDialog({
  isOpen,
  onClose,
  changes,
  connectionId,
  clientId,
}: BatchRevertDialogProps) {
  const router = useRouter();
  const [revertMode, setRevertMode] = useState<RevertMode>('selected');
  const [cascadeMode, setCascadeMode] = useState<CascadeMode>('cascade');
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(changes.map((c) => c.category));
    return Array.from(cats);
  }, [changes]);

  const dateRange = useMemo(() => {
    if (changes.length === 0) return null;
    const dates = changes.map((c) => new Date(c.appliedAt ?? c.createdAt).getTime());
    return {
      from: new Date(Math.min(...dates)),
      to: new Date(Math.max(...dates)),
    };
  }, [changes]);

  const batchIds = useMemo(() => {
    const ids = new Set(changes.filter((c) => c.batchId).map((c) => c.batchId!));
    return Array.from(ids);
  }, [changes]);

  const handleRevert = async () => {
    setIsReverting(true);
    setError(null);

    try {
      if (revertMode === 'selected') {
        const results = await Promise.all(
          changes.map((c) => revertSingleChange(c.id, connectionId, cascadeMode))
        );
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          setError(`${failed.length} of ${changes.length} reverts failed`);
          setIsReverting(false);
          return;
        }
      } else if (revertMode === 'category' && categories.length === 1) {
        const result = await executeRevert(
          { type: 'category', category: categories[0], clientId },
          connectionId,
          cascadeMode
        );
        if (!result.success) {
          setError(result.error ?? 'Failed to execute category revert');
          setIsReverting(false);
          return;
        }
      } else if (revertMode === 'date_range' && dateRange) {
        const result = await revertDateRange(
          clientId,
          dateRange.from.toISOString(),
          dateRange.to.toISOString(),
          connectionId,
          cascadeMode
        );
        if (!result.success) {
          setError(result.error ?? 'Failed to execute date range revert');
          setIsReverting(false);
          return;
        }
      } else {
        setError('Invalid revert configuration');
        setIsReverting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.refresh();
        onClose();
      }, 1500);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to execute batch revert');
    }

    setIsReverting(false);
  };

  const handleClose = () => {
    setRevertMode('selected');
    setCascadeMode('cascade');
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (changes.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch Revert Changes</DialogTitle>
          <DialogDescription>
            Revert {changes.length} selected change{changes.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Changes selected:</span>
              <span className="font-medium">{changes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categories:</span>
              <span>{categories.join(', ')}</span>
            </div>
            {batchIds.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batches:</span>
                <span>{batchIds.length}</span>
              </div>
            )}
            {dateRange && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date range:</span>
                <span>
                  {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Revert Mode Selection */}
          <div className="space-y-3">
            <Label>Revert scope</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="revertMode"
                  value="selected"
                  checked={revertMode === 'selected'}
                  onChange={(e) => setRevertMode(e.target.value as RevertMode)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Selected changes only ({changes.length})</span>
              </label>
              {categories.length === 1 && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="revertMode"
                    value="category"
                    checked={revertMode === 'category'}
                    onChange={(e) => setRevertMode(e.target.value as RevertMode)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">All changes in category: {categories[0]}</span>
                </label>
              )}
              {dateRange && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="revertMode"
                    value="date_range"
                    checked={revertMode === 'date_range'}
                    onChange={(e) => setRevertMode(e.target.value as RevertMode)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    All changes from {dateRange.from.toLocaleDateString()} to{' '}
                    {dateRange.to.toLocaleDateString()}
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Cascade Mode */}
          <div className="space-y-3">
            <Label>Dependency handling</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="cascadeMode"
                  value="cascade"
                  checked={cascadeMode === 'cascade'}
                  onChange={(e) => setCascadeMode(e.target.value as CascadeMode)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Include dependent changes (recommended)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="cascadeMode"
                  value="force"
                  checked={cascadeMode === 'force'}
                  onChange={(e) => setCascadeMode(e.target.value as CascadeMode)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Force - ignore dependencies</span>
              </label>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">
                This will restore {changes.length} field{changes.length > 1 ? 's' : ''} to their
                previous values. This action cannot be undone.
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span>Changes reverted successfully! Refreshing...</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isReverting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevert}
            disabled={isReverting || success}
          >
            {isReverting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reverting...
              </>
            ) : (
              `Revert ${changes.length} Change${changes.length > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
