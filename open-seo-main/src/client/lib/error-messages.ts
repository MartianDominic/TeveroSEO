import { isErrorCode, type ErrorCode } from "@/shared/error-codes";

/**
 * Client-facing error messages for all error codes.
 * Uses Partial<Record> to allow graceful fallback for new codes.
 */
const STANDARD_MESSAGES: Partial<Record<ErrorCode, string>> = {
  // Authentication/Authorization
  UNAUTHENTICATED: "Please sign in and try again.",
  AUTH_CONFIG_MISSING:
    "OpenSEO auth is not configured. Follow the README setup steps for Cloudflare Access.",
  UNAUTHORIZED: "Please sign in and try again.",
  FORBIDDEN: "You do not have access to this resource.",
  PERMISSION_DENIED: "You do not have permission to access this resource.",

  // Client errors
  BAD_REQUEST: "Invalid request. Please check your input.",
  NOT_FOUND: "The requested resource was not found.",
  GONE: "This resource is no longer available.",
  CONFLICT: "This request conflicts with existing data.",
  VALIDATION_ERROR: "Please check your input and try again.",
  RATE_LIMITED: "Too many requests. Please wait and try again.",
  RATE_LIMIT: "Too many requests. Please wait and try again.",

  // Payment/Subscription
  PAYMENT_REQUIRED:
    "An active hosted subscription is required before you can use OpenSEO.",
  SUBSCRIPTION_REQUIRED:
    "A subscription is required to access this feature.",
  QUOTA_EXCEEDED:
    "You have exceeded your quota. Please upgrade your plan.",

  // Resource state
  RESOURCE_LOCKED: "This resource is currently locked. Please try again later.",
  DUPLICATE_ENTRY: "This entry already exists.",
  INVALID_STATE: "Invalid operation for current state.",

  // Server errors
  INTERNAL_ERROR:
    "An unexpected error occurred. Please check server logs and try again.",
  BAD_GATEWAY: "Failed to connect to external service. Please try again.",
  SERVICE_UNAVAILABLE:
    "The service is temporarily at capacity. Please try again in a few minutes.",
  GATEWAY_TIMEOUT: "Request timed out. Please try again.",
  DEPENDENCY_FAILED: "A dependent service failed. Please try again.",

  // Domain-specific: Audit
  AUDIT_CAPACITY_REACHED:
    "You've reached audit capacity for your account. Delete old audits from your projects to start a new one.",
  CRAWL_TARGET_BLOCKED: "This crawl target is blocked by security policy.",

  // Domain-specific: Backlinks
  BACKLINKS_NOT_ENABLED:
    "Backlinks is not enabled for the connected DataForSEO account yet.",
  BACKLINKS_BILLING_ISSUE:
    "The connected DataForSEO account has a billing or balance issue.",

  // Domain-specific: Database operations
  ALERT_CREATE_FAILED: "Failed to create alert. Please try again.",
  ALERT_RULE_CREATE_FAILED: "Failed to create alert rule. Please try again.",
  DROP_EVENT_FAILED: "Failed to record ranking drop event. Please try again.",
  WEBHOOK_DELETE_FAILED: "Failed to delete webhook. Please try again.",

  // Domain-specific: External APIs
  EXTERNAL_SERVICE_ERROR:
    "An external service returned an error. Please try again later.",
  GSC_API_ERROR: "Failed to connect to Google Search Console. Please try again.",
  DOKOBIT_API_ERROR: "Failed to connect to e-signature service. Please try again.",

  // Domain-specific: Contracts
  CONTRACT_INVALID_STATE: "Invalid contract state transition. Please check contract status.",

  // Domain-specific: Prospects
  CONFIG_ERROR: "A configuration error occurred. Please check system settings.",
  EXTRACTION_ERROR: "Failed to extract information from the provided content.",

  // Legacy/Unknown
  LEGACY_ERROR: "An error occurred. Please try again.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
};

const DEFAULT_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

export function getStandardErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_ERROR_MESSAGE,
): string {
  if (!(error instanceof Error)) return fallback;
  if (isErrorCode(error.message)) {
    return STANDARD_MESSAGES[error.message] ?? DEFAULT_ERROR_MESSAGE;
  }
  if (error.message) return error.message;
  return fallback;
}

export function getErrorCode(error: unknown): ErrorCode | null {
  if (!(error instanceof Error)) return null;
  return isErrorCode(error.message) ? error.message : null;
}
