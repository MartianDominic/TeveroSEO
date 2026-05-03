/**
 * API authentication middleware for REST API endpoints.
 * Phase 40: Validates API keys and extracts client identity.
 *
 * Supports multiple authentication methods:
 * 1. Authorization: Bearer <api_key> header (API key)
 * 2. x-api-key: <api_key> header (API key)
 * 3. Authorization: Bearer <jwt> header (Clerk JWT session)
 * 4. Session cookie (browser sessions)
 *
 * API keys are validated against the database and must be:
 * - Enabled
 * - Not expired
 * - Scoped appropriately for the requested resource
 *
 * JWT tokens are validated against Clerk's JWKS.
 */
import { createHash, timingSafeEqual } from "crypto";
import { eq, and, isNull, or, gt } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/api-key-schema";
import { createLogger } from "@/server/lib/logger";
import { verifyClerkJWT } from "@/server/lib/clerk-jwt";
import { createFireAndForget } from "@/server/workers/utils/error-handler";
import { auditAuthFailure, auditPermissionDenied } from "@/server/lib/security-audit";

const log = createLogger({ module: "auth-middleware" });
const bgTask = createFireAndForget(log);

/**
 * Result of API key validation.
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  /** Organization ID the key belongs to */
  organizationId?: string;
  /** Client ID if the key is client-scoped */
  clientId?: string;
  /** User ID who created the key (for audit trail) */
  userId?: string;
  /** Permission scopes granted to this key */
  scopes?: string[];
  /** Error message if validation failed */
  error?: string;
}

/**
 * Context returned from successful authentication.
 */
export interface AuthContext {
  organizationId: string;
  clientId?: string;
  userId: string;
  scopes: string[];
  /** Authentication method used */
  authMethod: "api_key" | "jwt" | "session";
  /** API key ID if authenticated via API key */
  apiKeyId?: string;
}

/**
 * Hash an API key using SHA-256.
 * We never store raw keys, only their hashes.
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Extract API key from request headers.
 * Checks both Authorization: Bearer <key> and x-api-key headers.
 */
function extractApiKey(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
  }

  // Fall back to x-api-key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Validate an API key against the database.
 *
 * @param request - The incoming HTTP request
 * @returns Validation result with client/user context or error
 *
 * @example
 * const auth = await validateApiKey(request);
 * if (!auth.valid) {
 *   return Response.json({ error: auth.error }, { status: 401 });
 * }
 * // Use auth.clientId, auth.organizationId, etc.
 */
export async function validateApiKey(
  request: Request,
): Promise<ApiKeyValidationResult> {
  const key = extractApiKey(request);

  if (!key) {
    log.warn("API key missing", {
      path: new URL(request.url).pathname,
      method: request.method,
    });
    auditAuthFailure(request, "API key missing");
    return {
      valid: false,
      error: "API key required. Provide via Authorization: Bearer <key> or x-api-key header.",
    };
  }

  // Validate key format (should start with oseo_ prefix)
  if (!key.startsWith("oseo_")) {
    log.warn("Invalid API key format", {
      keyPrefix: key.substring(0, 8),
      path: new URL(request.url).pathname,
    });
    auditAuthFailure(request, "Invalid API key format", {
      keyPrefix: key.substring(0, 8),
    });
    return {
      valid: false,
      error: "Invalid API key format.",
    };
  }

  const keyHash = hashApiKey(key);
  const now = new Date();

  try {
    // Look up the key by hash
    const results = await db
      .select({
        id: apiKeys.id,
        organizationId: apiKeys.organizationId,
        clientId: apiKeys.clientId,
        createdBy: apiKeys.createdBy,
        scopes: apiKeys.scopes,
        enabled: apiKeys.enabled,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.enabled, true),
          // Not expired: either no expiry or expiry in future
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
        ),
      )
      .limit(1);

    if (results.length === 0) {
      log.warn("API key not found or disabled", {
        keyPrefix: key.substring(0, 12),
        path: new URL(request.url).pathname,
      });
      auditAuthFailure(request, "API key not found or disabled", {
        keyPrefix: key.substring(0, 12),
      });
      return {
        valid: false,
        error: "Invalid or expired API key.",
      };
    }

    const apiKeyRecord = results[0];

    // Update last used timestamp (fire and forget with proper error handling)
    bgTask(
      `update-api-key-last-used-${apiKeyRecord.id}`,
      db
        .update(apiKeys)
        .set({ lastUsedAt: now })
        .where(eq(apiKeys.id, apiKeyRecord.id)),
    );

    // Parse scopes
    let scopes: string[];
    try {
      scopes = JSON.parse(apiKeyRecord.scopes) as string[];
    } catch {
      scopes = ["*"];
    }

    log.debug("API key validated", {
      keyId: apiKeyRecord.id,
      organizationId: apiKeyRecord.organizationId,
      clientId: apiKeyRecord.clientId,
      path: new URL(request.url).pathname,
    });

    return {
      valid: true,
      organizationId: apiKeyRecord.organizationId,
      clientId: apiKeyRecord.clientId ?? undefined,
      userId: apiKeyRecord.createdBy,
      scopes,
    };
  } catch (error) {
    log.error(
      "API key validation error",
      error instanceof Error ? error : new Error(String(error)),
      { path: new URL(request.url).pathname },
    );
    return {
      valid: false,
      error: "Authentication service error.",
    };
  }
}

/**
 * Check if the auth context has the required scope.
 *
 * @param scopes - Scopes from the API key
 * @param required - Required scope (e.g., "read:audits")
 * @returns true if scope is granted
 */
export function hasScope(scopes: string[], required: string): boolean {
  // Wildcard grants all permissions
  if (scopes.includes("*")) {
    return true;
  }
  return scopes.includes(required);
}

/**
 * Wrapper for route handlers that require authentication.
 * Returns 401 response on invalid auth, otherwise calls the handler.
 *
 * @param request - The incoming HTTP request
 * @param handler - Route handler function that receives auth context
 * @returns Response from handler or 401 error response
 *
 * @example
 * export async function GET({ request }) {
 *   return requireAuth(request, async (auth) => {
 *     // auth.organizationId, auth.clientId, auth.userId available
 *     const data = await fetchData(auth.organizationId);
 *     return Response.json(data);
 *   });
 * }
 */
export async function requireAuth(
  request: Request,
  handler: (auth: AuthContext) => Promise<Response>,
): Promise<Response> {
  const result = await validateApiKey(request);

  if (!result.valid) {
    return Response.json(
      {
        error: result.error ?? "Unauthorized",
        code: "UNAUTHENTICATED",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="API"',
        },
      },
    );
  }

  const auth: AuthContext = {
    organizationId: result.organizationId!,
    clientId: result.clientId,
    userId: result.userId!,
    scopes: result.scopes ?? ["*"],
    authMethod: "api_key",
  };

  return handler(auth);
}

/**
 * Wrapper that also checks for a specific scope.
 *
 * @param request - The incoming HTTP request
 * @param scope - Required permission scope
 * @param handler - Route handler function
 * @returns Response from handler or 401/403 error response
 *
 * @example
 * export async function POST({ request }) {
 *   return requireAuthWithScope(request, "write:audits", async (auth) => {
 *     // User has write:audits permission
 *     await startAudit(auth.organizationId);
 *     return Response.json({ success: true });
 *   });
 * }
 */
export async function requireAuthWithScope(
  request: Request,
  scope: string,
  handler: (auth: AuthContext) => Promise<Response>,
): Promise<Response> {
  const result = await validateApiKey(request);

  if (!result.valid) {
    return Response.json(
      {
        error: result.error ?? "Unauthorized",
        code: "UNAUTHENTICATED",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="API"',
        },
      },
    );
  }

  if (!hasScope(result.scopes ?? [], scope)) {
    log.warn("Insufficient scope", {
      required: scope,
      granted: result.scopes,
      organizationId: result.organizationId,
      path: new URL(request.url).pathname,
    });
    auditPermissionDenied(
      request,
      result.userId!,
      result.organizationId!,
      `Insufficient scope: required ${scope}`,
      { required: scope, granted: result.scopes },
    );
    return Response.json(
      {
        error: `Insufficient permissions. Required scope: ${scope}`,
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  const auth: AuthContext = {
    organizationId: result.organizationId!,
    clientId: result.clientId,
    userId: result.userId!,
    scopes: result.scopes ?? ["*"],
    authMethod: "api_key",
  };

  return handler(auth);
}

/**
 * Generate a new API key.
 * Returns the raw key (only shown once) and the hash for storage.
 *
 * @returns Object with raw key and hash
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  // Generate 32 random bytes, encode as hex
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const key = `oseo_${randomHex}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 12); // "oseo_xxxxxxx"

  return { key, hash, prefix };
}

/**
 * Hash an API key for secure storage.
 * CRITICAL: Never store raw API keys - always store the hash.
 *
 * @param key - Raw API key to hash
 * @returns SHA-256 hash of the key
 */
export function hashApiKeyForStorage(key: string): string {
  return hashApiKey(key);
}

/**
 * Unified authentication that supports both API keys and JWT sessions.
 * Tries API key first (for M2M auth), then falls back to JWT (for user sessions).
 *
 * @param request - The incoming HTTP request
 * @returns Auth context or null if authentication failed
 *
 * @example
 * const auth = await authenticateRequest(request);
 * if (!auth.success) {
 *   return Response.json({ error: auth.error }, { status: 401 });
 * }
 * // Use auth.context.userId, auth.context.organizationId, etc.
 */
export async function authenticateRequest(
  request: Request,
): Promise<{ success: true; context: AuthContext } | { success: false; error: string }> {
  const authHeader = request.headers.get("Authorization");

  // Try API key authentication first (oseo_ prefix)
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      const token = parts[1];

      // Check if it's an API key (oseo_ prefix)
      if (token.startsWith("oseo_")) {
        const result = await validateApiKey(request);
        if (result.valid) {
          return {
            success: true,
            context: {
              organizationId: result.organizationId!,
              clientId: result.clientId,
              userId: result.userId!,
              scopes: result.scopes ?? ["*"],
              authMethod: "api_key",
            },
          };
        }
        return { success: false, error: result.error ?? "Invalid API key" };
      }

      // Otherwise, try JWT authentication
      try {
        const { userId: clerkUserId, email } = await verifyClerkJWT(token);

        /**
         * MED-02 DESIGN DOCUMENTATION: JWT Auth vs ensureUser Middleware
         *
         * INTENTIONAL DESIGN: JWT authentication does NOT perform a database user lookup.
         *
         * Rationale:
         * 1. Performance: JWT validation is stateless and fast (JWKS verification only)
         * 2. Separation of Concerns: Auth (identity verification) vs Authorization (permissions)
         * 3. Consistency: The ensureUser middleware handles user record creation/lookup
         *    for routes that need it, while pure API routes can be lightweight
         *
         * When to use each:
         * - JWT auth alone: Read-only APIs, health checks, public data endpoints
         * - JWT auth + ensureUser: User profile, settings, any user-record-dependent operation
         *
         * The clerkUserId from JWT is the canonical user identifier. Routes needing
         * the full user record should call ensureUser middleware after auth.
         *
         * Security Note: Resource authorization (client access, org membership) is
         * handled separately by validateClientOwnership and similar utilities.
         */
        return {
          success: true,
          context: {
            organizationId: clerkUserId, // Default org = user ID for single-user
            userId: clerkUserId,
            scopes: ["*"], // JWT users have full access to their resources
            authMethod: "jwt",
          },
        };
      } catch (jwtError) {
        log.warn("JWT authentication failed", {
          error: jwtError instanceof Error ? jwtError.message : String(jwtError),
          path: new URL(request.url).pathname,
        });
        auditAuthFailure(request, "JWT authentication failed", {
          error: jwtError instanceof Error ? jwtError.message : String(jwtError),
        });
        return { success: false, error: "Invalid or expired token" };
      }
    }
  }

  // Try x-api-key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    const result = await validateApiKey(request);
    if (result.valid) {
      return {
        success: true,
        context: {
          organizationId: result.organizationId!,
          clientId: result.clientId,
          userId: result.userId!,
          scopes: result.scopes ?? ["*"],
          authMethod: "api_key",
        },
      };
    }
    return { success: false, error: result.error ?? "Invalid API key" };
  }

  return {
    success: false,
    error: "Authentication required. Provide API key or Bearer token.",
  };
}

/**
 * Unified auth wrapper that supports both API keys and JWT sessions.
 * Use this for routes that accept both M2M and user authentication.
 *
 * @param request - The incoming HTTP request
 * @param handler - Route handler function that receives auth context
 * @returns Response from handler or 401 error response
 *
 * @example
 * export async function GET({ request }) {
 *   return requireUnifiedAuth(request, async (auth) => {
 *     // Works with both API keys and JWT tokens
 *     const data = await fetchData(auth.organizationId);
 *     return Response.json(data);
 *   });
 * }
 */
export async function requireUnifiedAuth(
  request: Request,
  handler: (auth: AuthContext) => Promise<Response>,
): Promise<Response> {
  const result = await authenticateRequest(request);

  if (!result.success) {
    return Response.json(
      {
        error: result.error,
        code: "UNAUTHENTICATED",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="API"',
        },
      },
    );
  }

  return handler(result.context);
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Use this when comparing secrets, tokens, or signatures.
 *
 * HIGH-06 FIX: Ensures constant-time comparison even when lengths differ.
 * Performs a dummy comparison when lengths don't match to avoid leaking
 * length information through timing differences.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  // HIGH-06 FIX: Always perform a timing-safe comparison to avoid
  // leaking length information through timing differences
  if (aBuffer.length !== bBuffer.length) {
    // Perform a dummy comparison to maintain constant time
    timingSafeEqual(bBuffer, bBuffer);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}
