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
 *
 * Protocol:
 * - Primary: HMAC-SHA256 signature with timestamp (X-Internal-Signature + X-Internal-Timestamp)
 * - Fallback: Legacy plain API key (X-Internal-Api-Key) for backward compatibility
 *
 * Signature format: HMAC-SHA256(timestamp.payload, INTERNAL_API_KEY)
 */
import { createHmac, timingSafeEqual } from "crypto";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "internal-auth" });

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/**
 * Maximum allowed timestamp drift in milliseconds (5 minutes).
 * Prevents replay attacks while allowing for clock skew between services.
 */
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

/**
 * Result of internal auth verification.
 */
export interface InternalAuthResult {
  verified: boolean;
  /** Authentication method used */
  method?: "hmac" | "legacy_key";
  /** Error message if verification failed */
  error?: string;
}

/**
 * Verify HMAC signature for service-to-service authentication.
 *
 * SECURITY:
 * - Uses timing-safe comparison to prevent timing attacks
 * - Validates timestamp to prevent replay attacks
 * - Fails closed if any validation step fails
 *
 * @param request - The incoming HTTP request
 * @param payload - The request body as string (empty string for GET requests)
 * @returns InternalAuthResult indicating verification status
 */
export async function verifyInternalAuth(
  request: Request,
  payload: string = ""
): Promise<InternalAuthResult> {
  if (!INTERNAL_API_KEY) {
    log.error("INTERNAL_API_KEY not configured");
    return { verified: false, error: "Internal API key not configured" };
  }

  // Try HMAC-based auth first (new protocol from apps/web)
  const signature = request.headers.get("X-Internal-Signature");
  const timestampStr = request.headers.get("X-Internal-Timestamp");

  if (signature && timestampStr) {
    return verifyHmacSignature(signature, timestampStr, payload);
  }

  // Fallback: legacy X-Internal-Api-Key header (for backward compatibility)
  const apiKey = request.headers.get("X-Internal-Api-Key");
  if (apiKey) {
    return verifyLegacyApiKey(apiKey);
  }

  log.warn("No internal auth credentials provided", {
    path: new URL(request.url).pathname,
  });
  return { verified: false, error: "Internal authentication required" };
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

/**
 * Verify legacy plain API key.
 */
function verifyLegacyApiKey(apiKey: string): InternalAuthResult {
  // SECURITY: Use timing-safe comparison (CRIT-003 fix)
  if (!secureCompareString(apiKey, INTERNAL_API_KEY!)) {
    log.warn("Legacy API key verification failed");
    return { verified: false, error: "Invalid API key" };
  }

  log.debug("Legacy API key verified successfully");
  return { verified: true, method: "legacy_key" };
}

/**
 * Timing-safe comparison for hex-encoded strings.
 * Prevents timing attacks by ensuring comparison time is constant.
 */
function secureCompareHex(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
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
 */
function secureCompareString(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (actualBuffer.length !== expectedBuffer.length) {
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
