/**
 * Security audit logging service.
 * Phase 40: Observability improvements.
 *
 * Provides helpers for logging security events to the audit table.
 * Use fire-and-forget pattern to avoid blocking request handling.
 */

import { db } from "@/db";
import {
  securityAuditLog,
  type SecurityEventType,
} from "@/db/security-audit-schema";
import { createLogger, getCurrentRequestId } from "@/server/lib/logger";
import { getClientIP } from "@/server/middleware/request-id";

const log = createLogger({ module: "security-audit" });

/**
 * Security event parameters.
 */
export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  organizationId?: string;
  reason: string;
  path?: string;
  method?: string;
  details?: Record<string, unknown>;
}

/**
 * Log a security audit event.
 * Uses fire-and-forget to avoid blocking the request.
 *
 * @param request - The HTTP request (for extracting IP, user agent, etc.)
 * @param event - The security event to log
 *
 * @example
 * await auditSecurityEvent(request, {
 *   type: "auth_failure",
 *   reason: "Invalid API key format",
 *   path: "/api/audits",
 * });
 */
export async function auditSecurityEvent(
  request: Request,
  event: SecurityEvent,
): Promise<void> {
  try {
    const url = new URL(request.url);
    const requestId = getCurrentRequestId();

    await db.insert(securityAuditLog).values({
      eventType: event.type,
      userId: event.userId,
      organizationId: event.organizationId,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get("User-Agent") ?? undefined,
      path: event.path ?? url.pathname,
      method: event.method ?? request.method,
      requestId,
      details: {
        reason: event.reason,
        ...event.details,
      },
    });

    log.debug("Security event logged", {
      eventType: event.type,
      reason: event.reason,
    });
  } catch (error) {
    // Don't let audit logging failures affect request handling
    log.error(
      "Failed to log security event",
      error instanceof Error ? error : new Error(String(error)),
      { eventType: event.type },
    );
  }
}

/**
 * Fire-and-forget security audit logging.
 * Does not block the calling code.
 *
 * @param request - The HTTP request
 * @param event - The security event to log
 */
export function auditSecurityEventAsync(
  request: Request,
  event: SecurityEvent,
): void {
  // Fire and forget - don't await
  auditSecurityEvent(request, event).catch((error) => {
    log.error(
      "Async security audit failed",
      error instanceof Error ? error : new Error(String(error)),
      { eventType: event.type },
    );
  });
}

/**
 * Log an authentication failure event.
 *
 * @param request - The HTTP request
 * @param reason - Why authentication failed
 * @param details - Additional context
 */
export function auditAuthFailure(
  request: Request,
  reason: string,
  details?: Record<string, unknown>,
): void {
  auditSecurityEventAsync(request, {
    type: "auth_failure",
    reason,
    details,
  });
}

/**
 * Log a permission denied event.
 *
 * @param request - The HTTP request
 * @param userId - The authenticated user ID
 * @param organizationId - The organization ID
 * @param reason - Why permission was denied
 * @param details - Additional context
 */
export function auditPermissionDenied(
  request: Request,
  userId: string,
  organizationId: string,
  reason: string,
  details?: Record<string, unknown>,
): void {
  auditSecurityEventAsync(request, {
    type: "permission_denied",
    userId,
    organizationId,
    reason,
    details,
  });
}

/**
 * Log a rate limit exceeded event.
 *
 * @param request - The HTTP request
 * @param identifier - The rate limit identifier (IP, user ID, etc.)
 * @param limit - The rate limit that was exceeded
 */
export function auditRateLimitExceeded(
  request: Request,
  identifier: string,
  limit: number,
): void {
  auditSecurityEventAsync(request, {
    type: "rate_limit_exceeded",
    reason: `Rate limit of ${limit} exceeded`,
    details: { identifier, limit },
  });
}

/**
 * Log a webhook verification failure.
 *
 * @param request - The HTTP request
 * @param provider - The webhook provider
 * @param reason - Why verification failed
 */
export function auditWebhookVerificationFailed(
  request: Request,
  provider: string,
  reason: string,
): void {
  auditSecurityEventAsync(request, {
    type: "webhook_verification_failed",
    reason,
    details: { provider },
  });
}
