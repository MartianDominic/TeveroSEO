import { z } from "zod";

const ERROR_CODES = [
  "UNAUTHENTICATED",
  "AUTH_CONFIG_MISSING",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "GONE",
  "AUDIT_CAPACITY_REACHED",
  "VALIDATION_ERROR",
  "CRAWL_TARGET_BLOCKED",
  "BACKLINKS_NOT_ENABLED",
  "BACKLINKS_BILLING_ISSUE",
  "RATE_LIMITED",
  "CONFLICT",
  "EXTERNAL_SERVICE_ERROR",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE", // Queue backpressure or service overload
  // Database operation errors
  "ALERT_CREATE_FAILED",
  "ALERT_RULE_CREATE_FAILED",
  "DROP_EVENT_FAILED",
  "WEBHOOK_DELETE_FAILED",
  // External API errors
  "GSC_API_ERROR",
  "DOKOBIT_API_ERROR",
  // Contract state machine errors
  "CONTRACT_INVALID_STATE",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

const NON_REPORTABLE_ERROR_CODES = new Set<ErrorCode>([
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "PAYMENT_REQUIRED",
  "VALIDATION_ERROR",
]);

export function isErrorCode(value: string): value is ErrorCode {
  return errorCodeSchema.safeParse(value).success;
}

export function shouldCaptureAppErrorCode(
  code: ErrorCode | null | undefined,
): boolean {
  return code == null || !NON_REPORTABLE_ERROR_CODES.has(code);
}
