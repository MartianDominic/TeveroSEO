/**
 * User-Friendly Error Message Mapping
 *
 * Phase 65: UX Fix - MED-27
 *
 * Maps technical error codes and messages to user-friendly descriptions
 * with actionable guidance. These messages are safe to display in the UI.
 */

import { ErrorCode, ApplicationError } from "./types";

// ---------------------------------------------------------------------------
// User-friendly message configuration
// ---------------------------------------------------------------------------

interface UserMessage {
  /** Short title for the error */
  title: string;
  /** Detailed description safe for users */
  description: string;
  /** Optional action the user can take */
  action?: string;
}

/**
 * Mapping of error codes to user-friendly messages.
 */
const ERROR_CODE_MESSAGES: Record<ErrorCode, UserMessage> = {
  // Authentication (1xxx)
  [ErrorCode.UNAUTHORIZED]: {
    title: "Sign In Required",
    description: "Please sign in to access this feature.",
    action: "Sign in to continue",
  },
  [ErrorCode.SESSION_EXPIRED]: {
    title: "Session Expired",
    description: "Your session has expired for security reasons.",
    action: "Please sign in again",
  },
  [ErrorCode.INVALID_TOKEN]: {
    title: "Invalid Link",
    description: "This link is invalid or has already been used.",
    action: "Request a new link",
  },

  // Authorization (2xxx)
  [ErrorCode.FORBIDDEN]: {
    title: "Access Denied",
    description: "You do not have permission to access this resource.",
    action: "Contact your administrator for access",
  },
  [ErrorCode.CLIENT_NOT_OWNED]: {
    title: "Client Not Found",
    description: "This client does not exist or you do not have access to it.",
    action: "Select a different client",
  },
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
    title: "Permission Required",
    description: "You need additional permissions to perform this action.",
    action: "Contact your administrator",
  },

  // Validation (3xxx)
  [ErrorCode.VALIDATION_ERROR]: {
    title: "Invalid Input",
    description: "Please check your input and try again.",
    action: "Review the highlighted fields",
  },
  [ErrorCode.INVALID_INPUT]: {
    title: "Invalid Data",
    description: "The information provided is not valid.",
    action: "Please correct the errors and try again",
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    title: "Missing Information",
    description: "Some required information is missing.",
    action: "Fill in all required fields",
  },

  // Resource (4xxx)
  [ErrorCode.NOT_FOUND]: {
    title: "Not Found",
    description: "The requested item could not be found.",
    action: "Check the URL or go back to the previous page",
  },
  [ErrorCode.ALREADY_EXISTS]: {
    title: "Already Exists",
    description: "This item already exists in the system.",
    action: "Use a different name or update the existing item",
  },
  [ErrorCode.CONFLICT]: {
    title: "Conflict Detected",
    description: "This action conflicts with existing data.",
    action: "Refresh and try again",
  },

  // External Services (5xxx)
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    title: "Service Temporarily Unavailable",
    description: "We are experiencing technical difficulties. Our team has been notified.",
    action: "Please try again in a few minutes",
  },
  [ErrorCode.EXTERNAL_API_ERROR]: {
    title: "Connection Error",
    description: "Unable to connect to an external service.",
    action: "Check your internet connection and try again",
  },
  [ErrorCode.TIMEOUT]: {
    title: "Request Timed Out",
    description: "The operation took too long to complete.",
    action: "Please try again",
  },

  // Rate Limiting (6xxx)
  [ErrorCode.RATE_LIMITED]: {
    title: "Too Many Requests",
    description: "You have made too many requests. Please wait before trying again.",
    action: "Wait a moment and try again",
  },
  [ErrorCode.QUOTA_EXCEEDED]: {
    title: "Quota Exceeded",
    description: "You have reached your usage limit.",
    action: "Upgrade your plan or wait for the limit to reset",
  },

  // Internal (9xxx)
  [ErrorCode.INTERNAL_ERROR]: {
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Our team has been notified.",
    action: "Please try again later",
  },
  [ErrorCode.DATABASE_ERROR]: {
    title: "Service Error",
    description: "We encountered a problem saving your data.",
    action: "Please try again in a moment",
  },
};

// ---------------------------------------------------------------------------
// Common technical error patterns to user-friendly messages
// ---------------------------------------------------------------------------

interface ErrorPattern {
  /** Regex or string to match against error message */
  pattern: RegExp | string;
  /** User-friendly message to show */
  message: UserMessage;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Network errors
  {
    pattern: /fetch failed|network error|failed to fetch/i,
    message: {
      title: "Connection Error",
      description: "Unable to connect to the server. Please check your internet connection.",
      action: "Check your connection and try again",
    },
  },
  {
    pattern: /timeout|timed out|ETIMEDOUT/i,
    message: {
      title: "Request Timed Out",
      description: "The server took too long to respond.",
      action: "Please try again",
    },
  },
  // Auth errors
  {
    pattern: /jwt|token.*expired|unauthorized/i,
    message: {
      title: "Session Expired",
      description: "Your session has expired.",
      action: "Please sign in again",
    },
  },
  // Database errors
  {
    pattern: /unique.*constraint|duplicate.*key/i,
    message: {
      title: "Duplicate Entry",
      description: "This item already exists.",
      action: "Use a different name",
    },
  },
  {
    pattern: /foreign.*key|constraint.*violated/i,
    message: {
      title: "Cannot Delete",
      description: "This item is being used elsewhere and cannot be deleted.",
      action: "Remove related items first",
    },
  },
  // File/upload errors
  {
    pattern: /file.*too.*large|payload.*too.*large/i,
    message: {
      title: "File Too Large",
      description: "The file you are trying to upload exceeds the size limit.",
      action: "Choose a smaller file",
    },
  },
  {
    pattern: /invalid.*file.*type|unsupported.*format/i,
    message: {
      title: "Unsupported File Type",
      description: "This file format is not supported.",
      action: "Upload a different file format",
    },
  },
  // Generic server errors
  {
    pattern: /500|internal server error/i,
    message: {
      title: "Server Error",
      description: "Something went wrong on our end. Our team has been notified.",
      action: "Please try again later",
    },
  },
  {
    pattern: /503|service unavailable/i,
    message: {
      title: "Service Unavailable",
      description: "The service is temporarily unavailable.",
      action: "Please try again in a few minutes",
    },
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a user-friendly error message from any error type.
 * Safe for displaying in UI - no sensitive information.
 */
export function getUserFriendlyError(error: unknown): UserMessage {
  // Handle ApplicationError with known error codes
  if (error instanceof ApplicationError) {
    const codeMessage = ERROR_CODE_MESSAGES[error.code];
    if (codeMessage) {
      return codeMessage;
    }
  }

  // Try to match against known error patterns
  const errorString = error instanceof Error ? error.message : String(error);

  for (const { pattern, message } of ERROR_PATTERNS) {
    const matches =
      typeof pattern === "string"
        ? errorString.toLowerCase().includes(pattern.toLowerCase())
        : pattern.test(errorString);

    if (matches) {
      return message;
    }
  }

  // Default fallback message
  return {
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again.",
    action: "If the problem persists, contact support",
  };
}

/**
 * Get just the user-friendly title for an error.
 */
export function getErrorTitle(error: unknown): string {
  return getUserFriendlyError(error).title;
}

/**
 * Get just the user-friendly description for an error.
 */
export function getErrorDescription(error: unknown): string {
  return getUserFriendlyError(error).description;
}

/**
 * Get the suggested action for an error.
 */
export function getErrorAction(error: unknown): string | undefined {
  return getUserFriendlyError(error).action;
}

/**
 * Format error for display in a toast or alert.
 * Returns a single string combining title and description.
 */
export function formatErrorForToast(error: unknown): string {
  const { title, description } = getUserFriendlyError(error);
  return `${title}: ${description}`;
}
