/**
 * User-friendly error templates for keyword analysis.
 *
 * Maps technical errors to actionable messages for end users.
 *
 * @module client/features/keywords/lib/error-templates
 */

export type ErrorCode =
  | "NETWORK_ERROR"
  | "API_TIMEOUT"
  | "RATE_LIMITED"
  | "INVALID_INPUT"
  | "EMBEDDING_FAILED"
  | "EMBEDDING_UNAVAILABLE"
  | "LLM_ERROR"
  | "INTERNAL_ERROR";

export interface ErrorTemplate {
  code: ErrorCode;
  title: string;
  message: string;
  action: string;
  retryable: boolean;
}

const ERROR_TEMPLATES: Record<ErrorCode, ErrorTemplate> = {
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    title: "Connection Lost",
    message: "Unable to connect to the server. Check your internet connection.",
    action: "Retry",
    retryable: true,
  },
  API_TIMEOUT: {
    code: "API_TIMEOUT",
    title: "Request Timeout",
    message: "The analysis is taking longer than expected. This may happen with large keyword sets.",
    action: "Retry with fewer keywords",
    retryable: true,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    title: "Rate Limited",
    message: "Too many requests. Please wait a moment before trying again.",
    action: "Wait 60 seconds",
    retryable: true,
  },
  INVALID_INPUT: {
    code: "INVALID_INPUT",
    title: "Invalid Input",
    message: "Some keywords could not be processed. Check for special characters or duplicates.",
    action: "Fix input",
    retryable: false,
  },
  EMBEDDING_FAILED: {
    code: "EMBEDDING_FAILED",
    title: "Embedding Error",
    message: "Failed to generate keyword embeddings. The service will retry automatically.",
    action: "Retry",
    retryable: true,
  },
  EMBEDDING_UNAVAILABLE: {
    code: "EMBEDDING_UNAVAILABLE",
    title: "Service Temporarily Unavailable",
    message: "The embedding service is currently unavailable. Your analysis will be queued and retried automatically.",
    action: "Wait for retry",
    retryable: true,
  },
  LLM_ERROR: {
    code: "LLM_ERROR",
    title: "AI Classification Error",
    message: "The AI classification service is temporarily unavailable. Using pattern-based fallback.",
    action: "Continue with patterns",
    retryable: false,
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    title: "Something Went Wrong",
    message: "An unexpected error occurred. Our team has been notified.",
    action: "Report issue",
    retryable: false,
  },
};

export function getErrorTemplate(code: ErrorCode): ErrorTemplate {
  return ERROR_TEMPLATES[code] ?? ERROR_TEMPLATES.INTERNAL_ERROR;
}

export function classifyError(error: Error): ErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes("network") || message.includes("fetch") || message.includes("failed to fetch")) {
    return "NETWORK_ERROR";
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("aborted")) {
    return "API_TIMEOUT";
  }
  if (message.includes("429") || message.includes("rate limit") || message.includes("too many requests")) {
    return "RATE_LIMITED";
  }
  if (message.includes("invalid") || message.includes("validation") || message.includes("malformed")) {
    return "INVALID_INPUT";
  }
  if (message.includes("embeddingunavailable") || message.includes("embedding backends unavailable")) {
    return "EMBEDDING_UNAVAILABLE";
  }
  if (message.includes("embedding") || message.includes("jina") || message.includes("vector")) {
    return "EMBEDDING_FAILED";
  }
  if (message.includes("groq") || message.includes("llm") || message.includes("grok") || message.includes("classification")) {
    return "LLM_ERROR";
  }

  return "INTERNAL_ERROR";
}

export function isRetryableError(code: ErrorCode): boolean {
  return ERROR_TEMPLATES[code]?.retryable ?? false;
}
