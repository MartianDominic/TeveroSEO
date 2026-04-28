/**
 * Shared middleware for SEO REST API routes.
 * Phase 40: Validates auth context for API calls using unified authentication.
 *
 * Supports:
 * 1. API key authentication (oseo_ prefix)
 * 2. Clerk JWT authentication (Bearer token)
 * 3. X-Client-ID header for client scoping
 */
import { AppError } from "@/server/lib/errors";
import { authenticateRequest, type AuthContext } from "@/server/middleware/auth";
import { verifyClerkJWT } from "@/server/lib/clerk-jwt";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "seo-middleware" });

export interface ApiAuthContext {
  userId: string;
  userEmail?: string;
  organizationId: string;
  clientId?: string;
  scopes?: string[];
}

/**
 * Extract and validate auth context from request headers.
 * Uses unified authentication supporting both API keys and JWTs.
 *
 * Authentication methods (in order of precedence):
 * 1. API key via Authorization: Bearer oseo_xxx or x-api-key header
 * 2. Clerk JWT via Authorization: Bearer <jwt>
 *
 * @param request - The incoming HTTP request
 * @returns Validated auth context
 * @throws AppError("UNAUTHENTICATED") if authentication fails
 */
export async function requireApiAuth(request: Request): Promise<ApiAuthContext> {
  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("x-api-key");
  const clientIdHeader = request.headers.get("X-Client-ID");

  // No auth credentials provided
  if (!authHeader && !apiKeyHeader) {
    log.warn("No authentication credentials provided", {
      path: new URL(request.url).pathname,
      method: request.method,
    });
    throw new AppError(
      "UNAUTHENTICATED",
      "Authentication required. Provide API key or Bearer token.",
    );
  }

  // Use unified authentication
  const authResult = await authenticateRequest(request);

  if (!authResult.success) {
    log.warn("Authentication failed", {
      error: authResult.error,
      path: new URL(request.url).pathname,
    });
    throw new AppError("UNAUTHENTICATED", authResult.error);
  }

  const context = authResult.context;

  // Build API auth context
  const apiAuthContext: ApiAuthContext = {
    userId: context.userId,
    organizationId: context.organizationId,
    clientId: context.clientId ?? clientIdHeader ?? undefined,
    scopes: context.scopes,
  };

  // For JWT auth, try to get email from the token
  if (context.authMethod === "jwt" && authHeader) {
    try {
      const token = authHeader.split(" ")[1];
      const { email } = await verifyClerkJWT(token);
      apiAuthContext.userEmail = email;
    } catch {
      // Email extraction failed, continue without it
    }
  }

  log.debug("API authentication successful", {
    userId: apiAuthContext.userId,
    organizationId: apiAuthContext.organizationId,
    clientId: apiAuthContext.clientId,
    authMethod: context.authMethod,
  });

  return apiAuthContext;
}

/**
 * Require specific permission scope in addition to authentication.
 *
 * @param request - The incoming HTTP request
 * @param requiredScope - Required permission scope (e.g., "write:briefs")
 * @returns Validated auth context
 * @throws AppError("UNAUTHENTICATED") if authentication fails
 * @throws AppError("FORBIDDEN") if scope is not granted
 */
export async function requireApiAuthWithScope(
  request: Request,
  requiredScope: string,
): Promise<ApiAuthContext> {
  const authContext = await requireApiAuth(request);

  // Check if user has required scope
  const scopes = authContext.scopes ?? [];
  const hasScope = scopes.includes("*") || scopes.includes(requiredScope);

  if (!hasScope) {
    log.warn("Insufficient permissions", {
      userId: authContext.userId,
      requiredScope,
      grantedScopes: scopes,
      path: new URL(request.url).pathname,
    });
    throw new AppError(
      "FORBIDDEN",
      `Insufficient permissions. Required scope: ${requiredScope}`,
    );
  }

  return authContext;
}
