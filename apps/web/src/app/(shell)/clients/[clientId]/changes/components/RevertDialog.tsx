/**
 * Revert Dialog Component
 * Phase 33: Auto-Fix System
 *
 * Confirmation dialog for reverting changes with preview.
 */
'use client';

import { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@tevero/ui';
import { RadioGroup, RadioGroupItem } from '@tevero/ui';
import { Label } from '@tevero/ui';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Change, RevertPreview } from '~/actions/changes';
import { previewRevert, executeRevert } from '~/actions/changes';

interface RevertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  change: Change;
  connectionId: string;
}

type CascadeMode = 'warn' | 'cascade' | 'force';

export function RevertDialog({ isOpen, onClose, change, connectionId }: RevertDialogProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<RevertPreview | null>(null);
  const [cascadeMode, setCascadeMode] = useState<CascadeMode>('warn');
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch preview when dialog opens
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

    const result = await executeRevert(
      { type: 'single', changeId: change.id },
      connectionId,
      cascadeMode
    );

    if (result.success && result.data) {
      setSuccess(true);
      // Refresh the page after a short delay
      setTimeout(() => {
        router.refresh();
        onClose();
      }, 1500);
    } else {
      setError(result.error ?? 'Failed to execute revert');
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
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Dependent changes detected</p>
                <p className="text-sm mt-1">
                  Later changes reference this value. Choose how to handle them:
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Warnings */}
          {preview?.warnings && preview.warnings.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {preview.warnings.map((warning, i) => (
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
              <RadioGroup value={cascadeMode} onValueChange={(v) => setCascadeMode(v as CascadeMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="warn" id="warn" />
                  <Label htmlFor="warn" className="font-normal">
                    Cancel - I'll review dependencies first
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cascade" id="cascade" />
                  <Label htmlFor="cascade" className="font-normal">
                    Cascade - Revert dependent changes too
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="force" id="force" />
                  <Label htmlFor="force" className="font-normal">
                    Force - Revert only this change (may cause issues)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Change reverted successfully! Refreshing...
              </AlertDescription>
            </Alert>
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
