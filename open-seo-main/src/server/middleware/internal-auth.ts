/**
 * Internal API Authentication Middleware
 *
 * Provides HMAC-based authentication for service-to-service communication.
 * This middleware standardizes the internal auth protocol between:
 * - apps/web -> open-seo-main
 * - AI-Writer -> open-seo-main
 *
 * SECURITY FIXES:
 * - CRIT-002: Standardized HMAC-based signing protocol
 * - CRIT-003: Uses timing-safe comparison to prevent timing attacks
 * - CSI-001/CSI-002: Removed legacy X-Internal-Api-Key fallback
 *
 * Protocol:
 * - HMAC-SHA256 signature with timestamp (X-Internal-Signature + X-Internal-Timestamp)
 * - Legacy API key auth (X-Internal-Api-Key) has been REMOVED - use HMAC signing
 *
 * Signature format: HMAC-SHA256(timestamp.payload, INTERNAL_API_KEY)
 */
import { createHmac, timingSafeEqual } from "crypto";
import { createLogger } from "@/server/lib/logger";
import { INTERNAL_AUTH_CLOCK_TOLERANCE_MS } from "@/server/lib/auth-constants";

const log = createLogger({ module: "internal-auth" });

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/**
 * Maximum allowed timestamp drift in milliseconds.
 * FIX M-AUTH-01: Uses shared constant from auth-constants.ts for consistency.
 * Prevents replay attacks while allowing for clock skew between services.
 */
const MAX_TIMESTAMP_DRIFT_MS = INTERNAL_AUTH_CLOCK_TOLERANCE_MS;

/**
 * Result of internal auth verification.
 */
export interface InternalAuthResult {
  verified: boolean;
  /** Authentication method used */
  method?: "hmac" | "legacy_key";
  /** Error message if verification failed */
  error?: string;
  /** Request path for audit logging */
  path?: string;
  /** Source service identifier if provided */
  sourceService?: string;
}

/**
 * Verify HMAC signature for service-to-service authentication.
 *
 * SECURITY:
 * - Uses timing-safe comparison to prevent timing attacks
 * - Validates timestamp to prevent replay attacks
 * - Fails closed if any validation step fails
 *
 * HIGH-AUTH-04 FIX: Added comprehensive audit logging for all internal auth
 * attempts to enable security monitoring and incident investigation.
 *
 * @param request - The incoming HTTP request
 * @param payload - The request body as string (empty string for GET requests)
 * @returns InternalAuthResult indicating verification status
 */
export async function verifyInternalAuth(
  request: Request,
  payload: string = ""
): Promise<InternalAuthResult> {
  const path = new URL(request.url).pathname;
  const method = request.method;
  const sourceService = request.headers.get("X-Source-Service") || "unknown";
  const requestId = request.headers.get("X-Request-Id") || "none";

  if (!INTERNAL_API_KEY) {
    log.error("INTERNAL_API_KEY not configured");
    // HIGH-AUTH-04: Audit log for configuration error
    log.warn("AUDIT: Internal auth failed - API key not configured", {
      path,
      method,
      sourceService,
      requestId,
      reason: "config_missing",
    });
    return { verified: false, error: "Internal API key not configured", path, sourceService };
  }

  // H-SEC-03 FIX: Only allow HMAC-based auth (removed legacy API key fallback)
  // Legacy API key auth has been removed to reduce attack surface.
  // All internal services must use HMAC-SHA256 signed requests.
  const signature = request.headers.get("X-Internal-Signature");
  const timestampStr = request.headers.get("X-Internal-Timestamp");

  if (signature && timestampStr) {
    const result = verifyHmacSignature(signature, timestampStr, payload);
    // HIGH-AUTH-04: Audit log for HMAC auth attempts
    if (result.verified) {
      log.info("AUDIT: Internal auth SUCCESS via HMAC", {
        path,
        method,
        sourceService,
        requestId,
        authMethod: "hmac",
      });
    } else {
      log.warn("AUDIT: Internal auth FAILED via HMAC", {
        path,
        method,
        sourceService,
        requestId,
        authMethod: "hmac",
        reason: result.error,
      });
    }
    return { ...result, path, sourceService };
  }

  // H-SEC-03: Log if legacy API key header is present (it will be rejected)
  const legacyApiKey = request.headers.get("X-Internal-Api-Key");
  if (legacyApiKey) {
    log.warn("AUDIT: Internal auth REJECTED - legacy API key auth disabled", {
      path,
      method,
      sourceService,
      requestId,
      reason: "legacy_key_disabled",
      migration: "Use HMAC-SHA256 signature (X-Internal-Signature + X-Internal-Timestamp)",
    });
    return {
      verified: false,
      error: "Legacy API key auth disabled. Use HMAC-SHA256 signature.",
      path,
      sourceService,
    };
  }

  // HIGH-AUTH-04: Audit log for missing credentials
  log.warn("AUDIT: Internal auth FAILED - no credentials provided", {
    path,
    method,
    sourceService,
    requestId,
    reason: "no_credentials",
  });
  return { verified: false, error: "Internal authentication required", path, sourceService };
}

/**
 * Verify HMAC signature with timestamp.
 */
function verifyHmacSignature(
  signature: string,
  timestampStr: string,
  payload: string
): InternalAuthResult {
  const timestamp = parseInt(timestampStr, 10);

  // Validate timestamp format
  if (isNaN(timestamp)) {
    log.warn("Invalid timestamp format in internal auth");
    return { verified: false, error: "Invalid timestamp format" };
  }

  // Validate timestamp to prevent replay attacks
  const now = Date.now();
  const drift = Math.abs(now - timestamp);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    log.warn("Timestamp drift exceeded in internal auth", {
      drift,
      maxDrift: MAX_TIMESTAMP_DRIFT_MS,
    });
    return { verified: false, error: "Request timestamp too old" };
  }

  // Compute expected signature
  const message = `${timestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", INTERNAL_API_KEY!)
    .update(message)
    .digest("hex");

  // SECURITY: Use timing-safe comparison (CRIT-003 fix)
  if (!secureCompareHex(signature, expectedSignature)) {
    log.warn("HMAC signature verification failed");
    return { verified: false, error: "Invalid signature" };
  }

  log.debug("HMAC signature verified successfully");
  return { verified: true, method: "hmac" };
}

// H-SEC-03: verifyLegacyApiKey function removed - legacy API key auth disabled
// All internal services must migrate to HMAC-SHA256 signed requests.

/**
 * Timing-safe comparison for hex-encoded strings.
 * Prevents timing attacks by ensuring comparison time is constant.
 *
 * HIGH-06 FIX: Ensures constant-time comparison even when lengths differ.
 */
function secureCompareHex(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    // HIGH-06 FIX: Always perform a timing-safe comparison to avoid
    // leaking length information through timing differences
    if (actualBuffer.length !== expectedBuffer.length) {
      // Perform a dummy comparison to maintain constant time
      timingSafeEqual(expectedBuffer, expectedBuffer);
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    // Any error in comparison should fail closed
    return false;
  }
}

/**
 * Timing-safe comparison for plain strings.
 * Prevents timing attacks by ensuring comparison time is constant.
 *
 * HIGH-06 FIX: Ensures constant-time comparison even when lengths differ.
 */
function secureCompareString(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    // HIGH-06 FIX: Always perform a timing-safe comparison to avoid
    // leaking length information through timing differences
    if (actualBuffer.length !== expectedBuffer.length) {
      // Perform a dummy comparison to maintain constant time
      timingSafeEqual(expectedBuffer, expectedBuffer);
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    // Any error in comparison should fail closed
    return false;
  }
}

/**
 * Middleware wrapper for internal API routes.
 *
 * Usage:
 * ```typescript
 * export const Route = createFileRoute("/api/internal/my-endpoint")({
 *   server: {
 *     handlers: {
 *       POST: async ({ request }) => {
 *         // Get body for signature verification
 *         const body = await request.clone().text();
 *
 *         const authResult = await requireInternalAuth(request, body);
 *         if (authResult) return authResult; // Returns 401 on failure
 *
 *         // Process request...
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * @param request - The incoming HTTP request
 * @param payload - The request body as string (empty for GET)
 * @returns Response if auth failed, null if successful
 */
export async function requireInternalAuth(
  request: Request,
  payload: string = ""
): Promise<Response | null> {
  const result = await verifyInternalAuth(request, payload);

  if (!result.verified) {
    return Response.json(
      { error: result.error ?? "Unauthorized" },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return null; // Auth successful, continue to handler
}

/**
 * Get the max timestamp drift for testing purposes.
 */
export function getMaxTimestampDrift(): number {
  return MAX_TIMESTAMP_DRIFT_MS;
}
