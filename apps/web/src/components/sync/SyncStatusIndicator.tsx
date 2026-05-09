"use client";

/**
 * Sync Status Indicator - FIX-08: H-SYNC-04
 *
 * Visual feedback component for cross-service sync operations.
 * Shows progress spinner, retry status, and error messages.
 */

import React from "react";

import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { SyncStatus, type SyncProgress } from "@/hooks/use-sync-status";
import { cn } from "@/lib/utils";

interface SyncStatusIndicatorProps {
  /** Current sync progress state */
  progress: SyncProgress;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show detailed information */
  showDetails?: boolean;
}

/**
 * Get icon for current sync status.
 */
function StatusIcon({ status }: { status: SyncStatus }) {
  switch (status) {
    case SyncStatus.SYNCING:
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case SyncStatus.SUCCESS:
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case SyncStatus.FAILED:
      return <XCircle className="h-4 w-4 text-destructive" />;
    case SyncStatus.TIMEOUT:
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return null;
  }
}

/**
 * Get background color class for status.
 */
function getStatusBgClass(status: SyncStatus): string {
  switch (status) {
    case SyncStatus.SYNCING:
      return "bg-primary/10 border-primary/20";
    case SyncStatus.SUCCESS:
      return "bg-green-500/10 border-green-500/20";
    case SyncStatus.FAILED:
      return "bg-destructive/10 border-destructive/20";
    case SyncStatus.TIMEOUT:
      return "bg-amber-500/10 border-amber-500/20";
    default:
      return "bg-muted border-border";
  }
}

/**
 * Sync Status Indicator Component.
 *
 * Displays the current sync status with appropriate visual feedback.
 *
 * @example
 * ```tsx
 * const { progress, isSyncing } = useSyncStatus();
 *
 * return (
 *   <div>
 *     {isSyncing && <SyncStatusIndicator progress={progress} />}
 *   </div>
 * );
 * ```
 */
export function SyncStatusIndicator({
  progress,
  className,
  showDetails = false,
}: SyncStatusIndicatorProps) {
  // Don't render if idle
  if (progress.status === SyncStatus.IDLE) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        getStatusBgClass(progress.status),
        className
      )}
      role="status"
      aria-live="polite"
    >
      <StatusIcon status={progress.status} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {progress.message}
        </p>

        {showDetails && progress.status === SyncStatus.SYNCING && (
          <p className="text-xs-safe text-muted-foreground mt-0.5">
            Attempt {progress.attempt} of {progress.maxAttempts}
          </p>
        )}

        {progress.error && (
          <p className="text-xs-safe text-destructive mt-0.5 truncate">
            {progress.error}
          </p>
        )}
      </div>

      {showDetails && progress.durationMs > 0 && (
        <span className="text-xs-safe text-muted-foreground whitespace-nowrap">
          {(progress.durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

/**
 * Inline sync status for compact display.
 */
export function SyncStatusInline({
  progress,
  className,
}: Pick<SyncStatusIndicatorProps, "progress" | "className">) {
  if (progress.status === SyncStatus.IDLE) {
    return null;
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm", className)}
      role="status"
      aria-live="polite"
    >
      <StatusIcon status={progress.status} />
      <span className="text-muted-foreground">{progress.message}</span>
    </span>
  );
}

/**
 * Full-page sync overlay for blocking operations.
 */
export function SyncOverlay({
  progress,
  title = "Syncing",
}: {
  progress: SyncProgress;
  title?: string;
}) {
  if (progress.status !== SyncStatus.SYNCING) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-overlay-title"
    >
      <div className="bg-card border border-border rounded-lg p-6 shadow-[var(--shadow-modal)] max-w-sm w-full mx-4">
        <div className="flex flex-col items-center text-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />

          <div>
            <h2
              id="sync-overlay-title"
              className="text-lg font-semibold text-foreground"
            >
              {title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {progress.message}
            </p>
          </div>

          {progress.attempt > 1 && (
            <p className="text-xs-safe text-amber-600 dark:text-amber-400">
              Retrying... (attempt {progress.attempt} of {progress.maxAttempts})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
