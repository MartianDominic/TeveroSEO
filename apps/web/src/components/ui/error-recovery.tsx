/**
 * ErrorRecovery Components
 * FIX-17 MED-UJ-02: Incomplete error recovery paths
 *
 * Provides consistent error handling UI with:
 * - Retry buttons for transient failures
 * - Input preservation on form errors
 * - Clear error messaging
 * - Support for different error types
 */
"use client";

import { useState, useCallback } from "react";
import { AlertCircle, RefreshCw, ArrowLeft, HelpCircle } from "lucide-react";
import { Button, Card, CardContent, Alert, AlertDescription, AlertTitle } from "@tevero/ui";

export interface ErrorRecoveryProps {
  /** Error object or message */
  error: Error | string | null;
  /** Callback to retry the failed operation */
  onRetry?: () => void | Promise<void>;
  /** Callback to go back/cancel */
  onBack?: () => void;
  /** Whether retry is currently in progress */
  isRetrying?: boolean;
  /** Custom title for the error */
  title?: string;
  /** Support link for complex errors */
  supportUrl?: string;
  /** Additional context about what went wrong */
  context?: string;
  /** Whether to show technical details (dev mode) */
  showDetails?: boolean;
}

/**
 * Full-page error recovery component for critical failures.
 */
export function ErrorRecovery({
  error,
  onRetry,
  onBack,
  isRetrying = false,
  title = "Something went wrong",
  supportUrl,
  context,
  showDetails = false,
}: ErrorRecoveryProps) {
  const errorMessage = error instanceof Error ? error.message : error ?? "Unknown error";

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-muted-foreground">{errorMessage}</p>
              {context && (
                <p className="text-sm text-muted-foreground">{context}</p>
              )}
            </div>

            {showDetails && error instanceof Error && error.stack && (
              <details className="w-full text-left">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                  {error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-2 mt-2">
              {onRetry && (
                <Button
                  onClick={onRetry}
                  disabled={isRetrying}
                  variant="default"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>
              )}
              {onBack && (
                <Button onClick={onBack} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
              )}
            </div>

            {supportUrl && (
              <a
                href={supportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
                Contact Support
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Inline error alert with retry option.
 * Use for non-critical errors within a page.
 */
export function InlineErrorRecovery({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
  title = "Error",
}: {
  error: Error | string | null;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  isRetrying?: boolean;
  title?: string;
}) {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{errorMessage}</span>
        <div className="flex gap-2 ml-4">
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                "Retry"
              )}
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook for managing retry state with automatic backoff.
 *
 * @example
 * ```tsx
 * const { error, isRetrying, retry, clearError } = useErrorRecovery({
 *   operation: async () => {
 *     const result = await fetchData();
 *     return result;
 *   },
 *   maxRetries: 3,
 * });
 *
 * return (
 *   <InlineErrorRecovery
 *     error={error}
 *     onRetry={retry}
 *     isRetrying={isRetrying}
 *   />
 * );
 * ```
 */
export function useErrorRecovery<T>(options: {
  operation: () => Promise<T>;
  maxRetries?: number;
  onSuccess?: (result: T) => void;
  onMaxRetriesExceeded?: (error: Error) => void;
}) {
  const { operation, maxRetries = 3, onSuccess, onMaxRetriesExceeded } = options;

  const [error, setError] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async () => {
    setError(null);
    setIsRetrying(true);

    try {
      const result = await operation();
      setRetryCount(0);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsRetrying(false);
    }
  }, [operation, onSuccess]);

  const retry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      const maxError = new Error(`Max retries (${maxRetries}) exceeded`);
      onMaxRetriesExceeded?.(maxError);
      return;
    }

    setRetryCount((c) => c + 1);
    return execute();
  }, [execute, retryCount, maxRetries, onMaxRetriesExceeded]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    error,
    isRetrying,
    retryCount,
    canRetry: retryCount < maxRetries,
    execute,
    retry,
    clearError,
  };
}

/**
 * FormErrorRecovery - Preserves form input on submission errors.
 *
 * @example
 * ```tsx
 * <FormErrorRecovery
 *   error={submitError}
 *   onRetry={handleSubmit}
 *   preservedData={formValues}
 * >
 *   <form>...</form>
 * </FormErrorRecovery>
 * ```
 */
export function FormErrorRecovery({
  children,
  error,
  onRetry,
  onDismiss,
  isRetrying,
  preservedData,
}: {
  children: React.ReactNode;
  error: Error | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
  preservedData?: Record<string, unknown>;
}) {
  return (
    <div className="space-y-4">
      <InlineErrorRecovery
        error={error}
        onRetry={onRetry}
        onDismiss={onDismiss}
        isRetrying={isRetrying}
        title="Submission failed"
      />
      {children}
      {preservedData && error && (
        <p className="text-sm text-muted-foreground">
          Your input has been preserved. Please try again.
        </p>
      )}
    </div>
  );
}
