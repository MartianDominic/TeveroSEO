/**
 * Utility to wrap mutation onError handlers with logging.
 *
 * Usage:
 * ```typescript
 * const mutation = useMutation({
 *   mutationFn: () => doSomething(),
 *   onSuccess: (data) => { ... },
 *   onError: withErrorLogging("Failed to do something", (error) => {
 *     // Optional: custom error handling
 *   }),
 * });
 * ```
 */
export function withErrorLogging<TError = Error>(
  context: string,
  handler?: (error: TError) => void
) {
  return (error: TError) => {
    console.error(
      `${context}:`,
      error instanceof Error ? error.message : "Unknown error",
      error
    );
    handler?.(error);
  };
}

/**
 * Creates a standard onError handler that logs the error.
 *
 * Usage:
 * ```typescript
 * const mutation = useMutation({
 *   mutationFn: () => doSomething(),
 *   onError: createErrorHandler("Save failed"),
 * });
 * ```
 */
export function createErrorHandler(context: string) {
  return (error: unknown) => {
    console.error(
      `${context}:`,
      error instanceof Error ? error.message : "Unknown error",
      error
    );
  };
}
