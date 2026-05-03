import { alwrityPool } from "@/server/lib/alwrity-db";
import { AppError } from "@/server/lib/errors";
import { validateClientOwnership } from "@/lib/auth/client-ownership";

export const CLIENT_ID_HEADER = "x-client-id";
export const CLIENT_ID_QUERY_PARAM = "client_id";

/**
 * Header for passing the authenticated user ID from middleware.
 * Set by auth middleware after JWT/session validation.
 */
export const USER_ID_HEADER = "x-user-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
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
 *                  Must include X-User-ID header for ownership verification.
 * @param url     - Optional fully-qualified request URL. When header is absent, the
 *                  `client_id` query param is read from this URL as a fallback.
 *                  Malformed URL strings are silently treated as absent.
 */
export async function resolveClientId(
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

  const clientId = rows[0].id;

  // CRIT-05 FIX: Changed from fail-open to fail-closed
  // The userId MUST be set by auth middleware after JWT/session validation
  const userId = headers.get(USER_ID_HEADER);

  // For internal service-to-service calls, check for the internal service token
  const internalServiceToken = headers.get("x-internal-service-token");
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

    // Valid internal service token - allow access without user ownership check
    return clientId;
  }

  // No internal service token - userId is required (fail-closed)
  if (!userId) {
    throw new AppError(
      "FORBIDDEN",
      "User authentication required for client access. Set x-user-id header after auth validation, or provide x-internal-service-token for service-to-service calls."
    );
  }

  // Verify user has permission to access this client
  // This throws ClientOwnershipError if access is denied
  try {
    await validateClientOwnership(userId, clientId);
  } catch (err) {
    // Convert ownership error to AppError for consistent handling
    throw new AppError("FORBIDDEN", "No access to this client");
  }

  return clientId;
}
