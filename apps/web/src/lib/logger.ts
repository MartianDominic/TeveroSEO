/**
 * Centralized Logger for apps/web
 *
 * Provides structured logging with:
 * - Consistent format across the application
 * - JSON output in production for log aggregation
 * - Readable format in development
 * - Correlation ID support for request tracing
 * - Context propagation for user/workspace tracking
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  clientId?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  meta?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Extracts error details for structured logging
 */
function extractErrorDetails(
  error: unknown
): LogEntry["error"] | undefined {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  if (error !== null && error !== undefined) {
    return { message: String(error) };
  }
  return undefined;
}

/**
 * Logger class with context support
 */
class Logger {
  private context: LogContext = {};
  private minLevel: LogLevel;

  constructor() {
    // Default to 'debug' in development, 'info' in production
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    this.minLevel =
      envLevel || (process.env.NODE_ENV === "production" ? "info" : "debug");
  }

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  /**
   * Set persistent context that will be included in all log entries
   */
  setContext(ctx: LogContext): void {
    this.context = { ...this.context, ...ctx };
  }

  /**
   * Clear all context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(ctx: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.context = { ...this.context, ...ctx };
    childLogger.minLevel = this.minLevel;
    return childLogger;
  }

  private formatEntry(entry: LogEntry): string {
    if (process.env.NODE_ENV === "production") {
      // Structured JSON for production log aggregation (CloudWatch, Datadog, etc.)
      return JSON.stringify(entry);
    }

    // Readable format for development
    const levelColors: Record<LogLevel, string> = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m", // green
      warn: "\x1b[33m", // yellow
      error: "\x1b[31m", // red
    };
    const reset = "\x1b[0m";
    const color = levelColors[entry.level];
    const level = entry.level.toUpperCase().padEnd(5);

    let output = `${color}[${level}]${reset} ${entry.message}`;

    // Add context if present
    const contextParts: string[] = [];
    if (entry.context?.correlationId) {
      contextParts.push(`cid=${entry.context.correlationId}`);
    }
    if (entry.context?.userId) {
      contextParts.push(`uid=${entry.context.userId}`);
    }
    if (entry.context?.requestId) {
      contextParts.push(`rid=${entry.context.requestId}`);
    }
    if (contextParts.length > 0) {
      output += ` (${contextParts.join(", ")})`;
    }

    // Add metadata if present
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      output += ` ${JSON.stringify(entry.meta)}`;
    }

    // Add error details if present
    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack && process.env.NODE_ENV === "development") {
        output += `\n  ${entry.error.stack}`;
      }
    }

    return output;
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
    error?: unknown
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: Object.keys(this.context).length > 0 ? this.context : undefined,
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
      error: extractErrorDetails(error),
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  /**
   * Log debug message (not shown in production by default)
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  /**
   * Log error message with optional error object
   */
  error(
    message: string,
    meta?: Record<string, unknown> | Error,
    error?: unknown
  ): void {
    // Handle both error(msg, error) and error(msg, meta, error) signatures
    if (meta instanceof Error) {
      this.log("error", message, undefined, meta);
    } else {
      this.log("error", message, meta, error);
    }
  }
}

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(
  correlationId: string,
  ctx?: Partial<LogContext>
): Logger {
  return logger.child({
    correlationId,
    ...ctx,
  });
}

// Export singleton instance
export const logger = new Logger();

// Re-export for convenience
export { Logger };
