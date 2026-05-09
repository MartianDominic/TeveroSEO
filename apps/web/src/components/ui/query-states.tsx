/**
 * Standard Loading and Error State Components
 *
 * MED-STATE-05 FIX: Provides consistent loading/error UI patterns across the app.
 * Use these components for all async data fetching to ensure UX consistency.
 */
"use client";

import { ReactNode } from "react";

import { AlertCircle, RefreshCw, Loader2, WifiOff, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Loading States
// ----------------------------------------------------------------------------

export interface LoadingStateProps {
  /** Optional message to display */
  message?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
  /** Show full-page centered loading */
  fullPage?: boolean;
}

/**
 * Standard loading spinner with optional message.
 *
 * @example
 * ```tsx
 * if (isLoading) return <LoadingState message="Loading clients..." />;
 * ```
 */
export function LoadingState({
  message = "Loading...",
  size = "md",
  className,
  fullPage = false,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullPage ? "min-h-[50vh]" : "py-8",
        className
      )}
    >
      <Loader2
        className={cn("animate-spin text-muted-foreground", sizeClasses[size])}
      />
      {message && (
        <p className={cn("text-muted-foreground", textSizes[size])}>{message}</p>
      )}
    </div>
  );

  return content;
}

/**
 * Inline loading spinner for use within content.
 */
export function InlineLoader({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("inline h-4 w-4 animate-spin", className)} />
  );
}

/**
 * Skeleton loading placeholder.
 */
export function LoadingSkeleton({
  className,
  count = 1,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 animate-pulse rounded bg-muted",
            className
          )}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Error States
// ----------------------------------------------------------------------------

export type ErrorCode =
  | "FETCH_ERROR"
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "UNKNOWN";

export interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message to display */
  message?: string;
  /** Error code for showing appropriate icon */
  code?: ErrorCode;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Additional actions */
  actions?: ReactNode;
  /** Additional className */
  className?: string;
  /** Show full-page centered error */
  fullPage?: boolean;
}

/**
 * Standard error state with optional retry action.
 *
 * @example
 * ```tsx
 * if (error) {
 *   return (
 *     <ErrorState
 *       title="Failed to load data"
 *       message={error.message}
 *       code="FETCH_ERROR"
 *       onRetry={refetch}
 *     />
 *   );
 * }
 * ```
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  code = "UNKNOWN",
  onRetry,
  isRetrying = false,
  actions,
  className,
  fullPage = false,
}: ErrorStateProps) {
  const icons: Record<ErrorCode, typeof AlertCircle> = {
    FETCH_ERROR: AlertCircle,
    NETWORK_ERROR: WifiOff,
    AUTH_ERROR: ShieldAlert,
    NOT_FOUND: AlertCircle,
    PERMISSION_DENIED: ShieldAlert,
    UNKNOWN: AlertCircle,
  };

  const Icon = icons[code] || AlertCircle;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 text-center",
        fullPage ? "min-h-[50vh]" : "py-8",
        className
      )}
      role="alert"
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <Icon className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </>
            )}
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}

/**
 * Inline error message for form fields or small sections.
 */
export function InlineError({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-destructive flex items-center gap-1", className)}>
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
}

// ----------------------------------------------------------------------------
// Query State Wrapper
// ----------------------------------------------------------------------------

export interface QueryStateProps {
  /** Is the query loading */
  isLoading: boolean;
  /** Is the query in error state */
  isError: boolean;
  /** Error object or message */
  error?: Error | string | null;
  /** Retry function */
  onRetry?: () => void;
  /** Is retry in progress */
  isRetrying?: boolean;
  /** Loading message */
  loadingMessage?: string;
  /** Error title */
  errorTitle?: string;
  /** Children to render when data is ready */
  children: ReactNode;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom error component */
  errorComponent?: ReactNode;
  /** Additional className for wrapper */
  className?: string;
}

/**
 * Wrapper component that handles loading/error states automatically.
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError, error, refetch } = useQuery(...);
 *
 * return (
 *   <QueryState
 *     isLoading={isLoading}
 *     isError={isError}
 *     error={error}
 *     onRetry={refetch}
 *     loadingMessage="Loading clients..."
 *   >
 *     <ClientList clients={data} />
 *   </QueryState>
 * );
 * ```
 */
export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying,
  loadingMessage,
  errorTitle,
  children,
  loadingComponent,
  errorComponent,
  className,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className={className}>
        {loadingComponent ?? <LoadingState message={loadingMessage} />}
      </div>
    );
  }

  if (isError) {
    const errorMessage =
      typeof error === "string"
        ? error
        : error?.message ?? "An unexpected error occurred.";

    return (
      <div className={className}>
        {errorComponent ?? (
          <ErrorState
            title={errorTitle}
            message={errorMessage}
            onRetry={onRetry}
            isRetrying={isRetrying}
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
}

// ----------------------------------------------------------------------------
// Empty State
// ----------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Action button or other content */
  action?: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Empty state component for when no data is available.
 *
 * @example
 * ```tsx
 * if (clients.length === 0) {
 *   return (
 *     <EmptyState
 *       title="No clients yet"
 *       description="Add your first client to get started."
 *       action={<Button onClick={onAdd}>Add Client</Button>}
 *     />
 *   );
 * }
 * ```
 */
export function EmptyStateSimple({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 text-center",
        className
      )}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
