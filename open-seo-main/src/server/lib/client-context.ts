import { alwrityPool } from "@/server/lib/alwrity-db";
import { AppError } from "@/server/lib/errors";
import { validateClientOwnership } from "@/lib/auth/client-ownership";
import { verifyClerkToken, extractBearerToken } from "@/server/lib/clerk-verify";

export const CLIENT_ID_HEADER = "x-client-id";
export const CLIENT_ID_QUERY_PARAM = "client_id";

/**
 * Header for internal service-to-service calls.
 * When present and valid, bypasses JWT validation.
 */
export const INTERNAL_SERVICE_TOKEN_HEADER = "x-internal-service-token";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolved client context with verified user identity.
 */
export interface ResolvedContext {
  /** Verified user ID from JWT claims */
  userId: string;
  /** Validated client ID */
  clientId: string;
  /** Organization ID from JWT claims (if using Clerk Organizations) */
  orgId?: string;
}

/**
 * Resolve the client context for a request.
 *
 * Contract (AUTH-HIGH-01, AUTH-HIGH-02):
 *  - JWT validation REQUIRED for all external requests
 *  - Forged X-User-Id without valid JWT is REJECTED with 401
 *  - Internal service token bypasses JWT check for service-to-service calls
 *  - Client ID validated and ownership verified against JWT user
 *
 * Security notes:
 *  - UUID regex rejects malformed input before any DB round-trip (T-06-01, T-06-04, T-07-01).
 *  - Parameterized query prevents SQL injection (T-06-02, T-07-02).
 *  - Only SELECT id — no name/email echoed back (T-06-03, T-07-02).
 *  - No cross-request caching; pool handles connection reuse.
 *  - Malformed URL string is treated as no-signal (returns null) rather than 500 (T-07-04).
 *  - client_id from URL still gated by JWT validation — does not elevate privilege (T-07-03).
 *  - AUTH-HIGH-01 FIX: JWT validation required before trusting any user identity.
 *  - AUTH-HIGH-02 FIX: User ownership verified via validateClientOwnership.
 *
 * @param request - The HTTP request. Must include Authorization: Bearer <jwt> header
 *                  for external requests, or X-Internal-Service-Token for service calls.
 * @returns ResolvedContext with verified userId and clientId
 * @throws AppError("UNAUTHENTICATED") if JWT is missing or invalid
 * @throws AppError("FORBIDDEN") if client_id is invalid or user lacks access
 */
export async function resolveClientContext(
  request: Request,
): Promise<ResolvedContext> {
  const headers = request.headers;
  const url = request.url;

  // 1. Check for internal service-to-service calls first
  const internalServiceToken = headers.get(INTERNAL_SERVICE_TOKEN_HEADER);
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (internalServiceToken && expectedToken) {
    // Verify internal service token using timing-safe comparison
    const { timingSafeEqual } = await import("crypto");
    const actualBuffer = Buffer.from(internalServiceToken, "utf8");
    const expectedBuffer = Buffer.from(expectedToken, "utf8");

    // HIGH-06 pattern: Perform dummy comparison on length mismatch to avoid timing leak
    if (actualBuffer.length !== expectedBuffer.length) {
      // Perform a dummy comparison to maintain constant time
      timingSafeEqual(expectedBuffer, expectedBuffer);
      throw new AppError("FORBIDDEN", "Invalid internal service token");
    }

    if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new AppError("FORBIDDEN", "Invalid internal service token");
    }

    // Valid internal service token - resolve client without JWT
    // Service-to-service calls must provide X-Client-ID
    const clientId = await resolveClientIdFromHeaders(headers, url);
    if (!clientId) {
      throw new AppError("FORBIDDEN", "X-Client-ID required for service calls");
    }

    // Return with service user ID placeholder
    return {
      userId: "service:internal",
      clientId,
      orgId: undefined,
    };
  }

  // 2. JWT validation REQUIRED for external requests
  const authHeader = headers.get("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Missing Authorization header. Provide Bearer <jwt> token."
    );
  }

  // Verify JWT and extract claims
  const claims = await verifyClerkToken(token);

  // 3. Resolve client ID from headers/URL
  const clientId = await resolveClientIdFromHeaders(headers, url);
  if (!clientId) {
    throw new AppError("FORBIDDEN", "Missing X-Client-ID header");
  }

  // 4. Verify user has permission to access this client
  try {
    await validateClientOwnership(claims.userId, clientId);
  } catch (err) {
    // Convert ownership error to AppError for consistent handling
    throw new AppError("FORBIDDEN", "No access to this client");
  }

  return {
    userId: claims.userId,
    clientId,
    orgId: claims.orgId,
  };
}

/**
 * Resolve client_id from headers or URL query param.
 * Internal helper - does NOT validate ownership.
 *
 * @param headers - Request headers (X-Client-ID takes precedence)
 * @param url - Optional request URL for query param fallback
 * @returns Validated client ID or null if not provided
 * @throws AppError("FORBIDDEN") if client_id is malformed or unknown
 */
async function resolveClientIdFromHeaders(
  headers: Headers,
  url?: string,
): Promise<string | null> {
  // Header takes precedence over URL query param.
  let raw = headers.get(CLIENT_ID_HEADER);

  // Fallback: read from URL query string if header is absent.
  if (!raw && url) {
    try {
      raw = new URL(url).searchParams.get(CLIENT_ID_QUERY_PARAM);
    } catch {
      // Malformed URL — treat as no client_id supplied (T-07-04).
      raw = null;
    }
  }

  if (!raw) return null;

  const candidate = raw.trim();
  if (!UUID_RE.test(candidate)) {
    throw new AppError("FORBIDDEN", "Invalid client_id");
  }

  const { rows } = await alwrityPool.query<{ id: string }>(
    "SELECT id FROM clients WHERE id = $1 AND is_archived = false LIMIT 1",
    [candidate],
  );

  if (rows.length === 0) {
    throw new AppError("FORBIDDEN", "Unknown or archived client_id");
  }

  return rows[0].id;
}

/**
 * Legacy function for backwards compatibility.
 * @deprecated Use resolveClientContext() instead for JWT validation.
 *
 * Resolve the client_id for a request.
 *
 * Contract (AUTH-03, SHELL-04):
 *  - Neither header nor URL param present
 *                      → returns null (not every route is client-scoped).
 *  - Header present + valid UUID + exists in alwrity.clients (not archived) + user has access
 *                      → returns the UUID string. Header takes precedence over URL param.
 *  - Header absent + URL has `?client_id=<uuid>` valid + exists in alwrity.clients + user has access
 *                      → returns the UUID string (cross-origin iframe fallback).
 *  - Header present + malformed OR unknown UUID OR archived client OR no access
 *                      → throws AppError("FORBIDDEN").
 *  - Header absent + URL has `?client_id=<malformed>` OR unknown UUID OR no access
 *                      → throws AppError("FORBIDDEN").
 *
 * Security notes:
 *  - UUID regex rejects malformed input before any DB round-trip (T-06-01, T-06-04, T-07-01).
 *  - Parameterized query prevents SQL injection (T-06-02, T-07-02).
 *  - Only SELECT id — no name/email echoed back (T-06-03, T-07-02).
 *  - No cross-request caching; pool handles connection reuse.
 *  - Malformed URL string is treated as no-signal (returns null) rather than 500 (T-07-04).
 *  - client_id from URL still gated by Clerk session upstream — does not elevate privilege (T-07-03).
 *  - AUTH-H01 FIX: Now verifies user has permission to access the client via ownership check.
 *
 * @param headers - Request headers (X-Client-ID takes precedence over query param).
 *                  Must include Authorization header with valid JWT.
 * @param url     - Optional fully-qualified request URL. When header is absent, the
 *                  `client_id` query param is read from this URL as a fallback.
 *                  Malformed URL strings are silently treated as absent.
 */
export async function resolveClientId(
  headers: Headers,
  url?: string,
): Promise<string | null> {
  // For internal service-to-service calls, check for the internal service token
  const internalServiceToken = headers.get(INTERNAL_SERVICE_TOKEN_HEADER);
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (internalServiceToken && expectedToken) {
    // Verify internal service token using timing-safe comparison
    const { timingSafeEqual } = await import("crypto");
    const actualBuffer = Buffer.from(internalServiceToken, "utf8");
    const expectedBuffer = Buffer.from(expectedToken, "utf8");

    // HIGH-06 pattern: Perform dummy comparison on length mismatch to avoid timing leak
    if (actualBuffer.length !== expectedBuffer.length) {
      // Perform a dummy comparison to maintain constant time
      timingSafeEqual(expectedBuffer, expectedBuffer);
      throw new AppError("FORBIDDEN", "Invalid internal service token");
    }

    if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new AppError("FORBIDDEN", "Invalid internal service token");
    }

    // Valid internal service token - resolve without JWT validation
    return resolveClientIdFromHeaders(headers, url);
  }

  // JWT validation REQUIRED for external requests (AUTH-HIGH-01 FIX)
  const authHeader = headers.get("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Missing Authorization header. Provide Bearer <jwt> token."
    );
  }

  // Verify JWT and extract user ID
  const claims = await verifyClerkToken(token);

  // Resolve client ID
  const clientId = await resolveClientIdFromHeaders(headers, url);
  if (!clientId) return null;

  // Verify user has permission to access this client
  try {
    await validateClientOwnership(claims.userId, clientId);
  } catch (err) {
    // Convert ownership error to AppError for consistent handling
    throw new AppError("FORBIDDEN", "No access to this client");
  }

  return clientId;
}
