"use client";

import * as React from "react";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingSkeleton } from "./loading-skeleton";

/**
 * DataStateWrapper - Convenience wrapper for handling loading, error, empty, and data states
 *
 * Priority order: isLoading > isError > isEmpty > children(data)
 */

export interface DataStateWrapperProps<T> {
  /** The data to render when available */
  data: T | undefined | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether an error occurred */
  isError: boolean;
  /** The error message or Error object */
  error?: Error | string;
  /** Custom function to determine if data is "empty" */
  isEmpty?: (data: T) => boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Custom empty state component */
  emptyComponent?: React.ReactNode;
  /** Render function for when data is available */
  children: (data: T) => React.ReactNode;
  /** Optional retry handler for error state */
  onRetry?: () => void;
  /** Optional className for wrapper */
  className?: string;
}

function defaultIsEmpty<T>(data: T): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data).length === 0;
  return !data;
}

function DataStateWrapper<T>({
  data,
  isLoading,
  isError,
  error,
  isEmpty = defaultIsEmpty,
  loadingComponent,
  errorComponent,
  emptyComponent,
  children,
  onRetry,
  className,
}: DataStateWrapperProps<T>): React.ReactElement | null {
  // Priority 1: Loading state
  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className={className}>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  // Priority 2: Error state
  if (isError) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "An unexpected error occurred";

    return (
      <div className={className}>
        <ErrorState variant="card" message={errorMessage} onRetry={onRetry} />
      </div>
    );
  }

  // Priority 3: Empty state (data is null/undefined or passes isEmpty check)
  if (data === null || data === undefined || isEmpty(data)) {
    if (emptyComponent) {
      return <>{emptyComponent}</>;
    }
    return (
      <div className={className}>
        <EmptyState title="No data" description="There is no data to display." />
      </div>
    );
  }

  // Priority 4: Render children with data
  return <>{children(data)}</>;
}

export { DataStateWrapper };
