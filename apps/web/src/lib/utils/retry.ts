/**
 * Retry utility for database and external API operations.
 *
 * Implements exponential backoff with jitter for resilient operations.
 * Fixes HIGH-CONN-001: No connection retry logic.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Minimum timeout between retries in ms (default: 100) */
  minTimeout?: number;
  /** Maximum timeout between retries in ms (default: 2000) */
  maxTimeout?: number;
  /** Exponential backoff factor (default: 2) */
  factor?: number;
  /** Add randomness to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Callback fired on each retry attempt */
  onRetry?: (error: Error, attempt: number) => void;
  /** Function to determine if error is retryable (default: all errors) */
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry" | "shouldRetry">> =
  {
    retries: 3,
    minTimeout: 100,
    maxTimeout: 2000,
    factor: 2,
    jitter: true,
  };

/**
 * Calculate delay for a given attempt with exponential backoff.
 */
function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, "onRetry" | "shouldRetry">>
): number {
  const { minTimeout, maxTimeout, factor, jitter } = options;

  // Exponential backoff: minTimeout * factor^attempt
  let delay = minTimeout * Math.pow(factor, attempt);

  // Cap at maxTimeout
  delay = Math.min(delay, maxTimeout);

  // Add jitter (0-25% randomness) to prevent thundering herd
  if (jitter) {
    const jitterAmount = delay * 0.25 * Math.random();
    delay = delay + jitterAmount;
  }

  return Math.floor(delay);
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default function to determine if an error should trigger a retry.
 * Retries on connection errors, timeouts, and transient failures.
 */
function defaultShouldRetry(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Connection errors
  if (
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("connection") ||
    message.includes("network")
  ) {
    return true;
  }

  // Database-specific transient errors
  if (
    message.includes("deadlock") ||
    message.includes("lock wait timeout") ||
    message.includes("too many connections") ||
    message.includes("connection pool")
  ) {
    return true;
  }

  // HTTP transient errors (if error has status code)
  const statusCode = (error as Error & { statusCode?: number }).statusCode;
  if (statusCode && [408, 429, 500, 502, 503, 504].includes(statusCode)) {
    return true;
  }

  return false;
}

/**
 * Execute an operation with retry logic and exponential backoff.
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => db.query.users.findMany(),
 *   {
 *     retries: 3,
 *     onRetry: (err, attempt) => console.warn(`Retry ${attempt}:`, err.message)
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt < opts.retries && shouldRetry(lastError)) {
        const delay = calculateDelay(attempt, opts);

        // Call onRetry callback if provided
        if (options.onRetry) {
          options.onRetry(lastError, attempt + 1);
        }

        await sleep(delay);
        continue;
      }

      // No more retries or error not retryable
      throw lastError;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error("Retry failed");
}

/**
 * Create a retryable version of any async function.
 *
 * @example
 * ```typescript
 * const retryableFetch = createRetryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { retries: 3 }
 * );
 *
 * const data = await retryableFetch('/api/data');
 * ```
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry decorator for class methods.
 * Use with TypeScript experimental decorators.
 *
 * @example
 * ```typescript
 * class DatabaseService {
 *   @Retryable({ retries: 3 })
 *   async findUser(id: string) {
 *     return db.query.users.findFirst({ where: eq(users.id, id) });
 *   }
 * }
 * ```
 */
export function Retryable(options: RetryOptions = {}) {
  return function <T>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
