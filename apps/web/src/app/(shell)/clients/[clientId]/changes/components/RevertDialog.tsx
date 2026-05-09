/**
 * Revert Dialog Component
 * Phase 33: Auto-Fix System
 *
 * Confirmation dialog for reverting changes with preview.
 */
'use client';

import { useState, useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

import type { Change, RevertPreview } from '@/actions/changes';
import { previewRevert, executeRevert } from '@/actions/changes';

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

interface RevertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  change: Change;
  connectionId: string;
  onRevertStart?: () => void;
  onRevertSuccess?: () => void;
  onRevertError?: (error: string) => void;
}

type CascadeMode = 'warn' | 'cascade' | 'force';

export function RevertDialog({ isOpen, onClose, change, connectionId, onRevertStart, onRevertSuccess, onRevertError }: RevertDialogProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<RevertPreview | null>(null);
  const [cascadeMode, setCascadeMode] = useState<CascadeMode>('warn');
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && change) {
      fetchPreview();
    }
  }, [isOpen, change, cascadeMode]);

  const fetchPreview = async () => {
    setIsLoading(true);
    setError(null);

    const result = await previewRevert({ type: 'single', changeId: change.id }, cascadeMode);

    if (result.success && result.data) {
      setPreview(result.data);
    } else {
      setError(result.error ?? 'Failed to preview revert');
    }

    setIsLoading(false);
  };

  const handleRevert = async () => {
    setIsReverting(true);
    setError(null);

    // Notify parent of revert start for optimistic update (HIGH-STATE-001)
    onRevertStart?.();

    const result = await executeRevert(
      { type: 'single', changeId: change.id, clientId: change.clientId },
      connectionId,
      cascadeMode
    );

    if (result.success && result.data) {
      setSuccess(true);
      // Notify parent of successful revert (HIGH-STATE-001)
      onRevertSuccess?.();
      setTimeout(() => {
        router.refresh();
        onClose();
      }, 1500);
    } else {
      const errorMessage = result.error ?? 'Failed to execute revert';
      setError(errorMessage);
      // Rollback optimistic update on error (HIGH-STATE-001)
      onRevertError?.(errorMessage);
    }

    setIsReverting(false);
  };

  const handleClose = () => {
    setPreview(null);
    setCascadeMode('warn');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Revert Change</DialogTitle>
          <DialogDescription>
            This will restore the previous value for {change.field} on {change.resourceUrl}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Change Details */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Field:</span>
              <code className="bg-background px-1 rounded">{change.field}</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current value:</span>
              <span className="truncate max-w-[200px]">{change.afterValue || '(empty)'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Will restore to:</span>
              <span className="truncate max-w-[200px] text-green-600">
                {change.beforeValue || '(empty)'}
              </span>
            </div>
          </div>

          {/* Preview Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Checking dependencies...</span>
            </div>
          )}

          {/* Dependency Warnings */}
          {preview?.hasOrphanedDependencies && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Dependent changes detected</p>
                  <p className="text-sm text-red-700 mt-1">
                    Later changes reference this value. Choose how to handle them:
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preview Warnings */}
          {preview?.warnings && preview.warnings.length > 0 && (
            <div className="text-sm text-muted-foreground space-y-1">
              {preview.warnings.map((warning: string, i: number) => (
                <p key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  {warning}
                </p>
              ))}
            </div>
          )}

          {/* Cascade Mode Selection */}
          {preview?.hasOrphanedDependencies && (
            <div className="space-y-3">
              <Label>How should we handle dependent changes?</Label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cascadeMode"
                    value="warn"
                    checked={cascadeMode === 'warn'}
                    onChange={(e) => setCascadeMode(e.target.value as CascadeMode)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Cancel - I&apos;ll review dependencies first</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cascadeMode"
                    value="cascade"
                    checked={cascadeMode === 'cascade'}
                    onChange={(e) => setCascadeMode(e.target.value as CascadeMode)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Cascade - Revert dependent changes too</span>
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
                  <span className="text-sm">Force - Revert only this change (may cause issues)</span>
                </label>
              </div>
            </div>
          )}

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
                <span>Change reverted successfully! Refreshing...</span>
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
            disabled={isLoading || isReverting || success || (!preview?.canProceed && cascadeMode === 'warn')}
          >
            {isReverting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reverting...
              </>
            ) : (
              'Confirm Revert'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
