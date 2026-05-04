/**
 * Authentication Constants
 * FIX M-AUTH-01: Standardized clock skew tolerance across services.
 *
 * Clock skew can occur due to:
 * - NTP synchronization delays between servers
 * - Docker container time drift
 * - Cloud provider time inconsistencies
 *
 * Different tolerances are used based on context:
 * - User-facing JWT validation: 30 seconds (security-sensitive)
 * - Service-to-service HMAC: 5 minutes (more lenient for internal calls)
 * - Webhook signature validation: 5 minutes (external systems may have drift)
 */

/**
 * Clock skew tolerance for user JWT validation (30 seconds).
 * More restrictive because user tokens are more security-sensitive.
 */
export const JWT_CLOCK_TOLERANCE_SECONDS = 30;

/**
 * Clock skew tolerance for internal service-to-service auth (5 minutes).
 * More lenient because internal services should be trusted and
 * occasional time drift shouldn't break service communication.
 */
export const INTERNAL_AUTH_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Clock skew tolerance for webhook signature validation (5 minutes).
 * External webhook providers (Stripe, Clerk, etc.) may have time drift.
 */
export const WEBHOOK_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Clock skew tolerance for payment webhook validation (30 seconds + 5 minute max age).
 * Payment webhooks are security-sensitive but allow minor drift.
 */
export const PAYMENT_WEBHOOK_CLOCK_TOLERANCE_SECONDS = 30;
export const PAYMENT_WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;
