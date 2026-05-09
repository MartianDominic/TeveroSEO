/**
 * API Route Authentication Middleware
 *
 * Provides authentication utilities for Next.js API routes.
 * All API routes should use these wrappers to ensure proper authentication.
 */
import { NextRequest, NextResponse } from 'next/server';

import { auth, currentUser } from '@clerk/nextjs/server';

import { logger } from '@/lib/logger';
/**
 * Authentication context returned by requireAuth.
 */
export interface AuthContext {
  userId: string;
  orgId?: string;
  sessionId: string;
}

/**
 * Extended auth context with user details.
 */
export interface UserAuthContext extends AuthContext {
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>;
}

/**
 * Custom error class for authentication failures.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Require authentication for API routes.
 * Throws AuthError if not authenticated.
 *
 * @returns AuthContext with userId, orgId, and sessionId
 * @throws AuthError if user is not authenticated
 *
 * @example
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const authCtx = await requireAuth();
 *   // authCtx.userId is guaranteed to exist
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthContext> {
  const { userId, orgId, sessionId } = await auth();

  if (!userId || !sessionId) {
    throw new AuthError('Unauthorized: Valid session required', 401);
  }

  return {
    userId,
    orgId: orgId ?? undefined,
    sessionId
  };
}

/**
 * Require authentication and return full user details.
 * Use this when you need user profile information (name, email, etc.).
 *
 * @returns UserAuthContext with auth info and full user object
 * @throws AuthError if user is not authenticated
 */
export async function requireUser(): Promise<UserAuthContext> {
  const authContext = await requireAuth();
  const user = await currentUser();

  if (!user) {
    throw new AuthError('User not found', 401);
  }

  return { ...authContext, user };
}

/**
 * Check if the current user has access to a specific client.
 * Validates ownership through the backend API.
 *
 * @param clientId - The client ID to check access for
 * @returns AuthContext if access is granted
 * @throws AuthError with 403 if access is denied
 */
export async function requireClientAccess(clientId: string): Promise<AuthContext> {
  const authContext = await requireAuth();

  const hasAccess = await verifyClientAccess(authContext.userId, clientId, authContext.orgId);

  if (!hasAccess) {
    throw new AuthError('Forbidden: No access to this client', 403);
  }

  return authContext;
}

/**
 * Get the session token for backend API authentication.
 * This token should be passed as Authorization: Bearer header to backend services.
 *
 * @returns The session token or null if not authenticated
 */
async function getSessionToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}

/**
 * Verify client access through the backend API.
 * The backend handles the actual ownership verification against the database.
 */
async function verifyClientAccess(
  userId: string,
  clientId: string,
  orgId?: string
): Promise<boolean> {
  // Get backend URL from centralized env (validated at startup)
  // Import inline to avoid circular dependency with env.ts
  const { getAiWriterUrl } = await import('@/lib/env');
  const backendUrl = getAiWriterUrl();

  // Get session token for backend authentication
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    logger.error(`[Auth] No session token available for client access verification: client=${clientId}, user=${userId}`);
    return false;
  }

  try {
    // Verify ownership through the backend
    const response = await fetch(
      `${backendUrl}/api/clients/${clientId}/verify-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ userId, orgId }),
      }
    );

    if (!response.ok) {
      // If 404, client doesn't exist
      // If 403, no access
      return false;
    }

    const result = await response.json() as { hasAccess: boolean };
    return result.hasAccess === true;
  } catch {
    // Network error or backend unavailable
    // Fail closed (deny access) for security
    logger.error(`[Auth] Failed to verify client access for client=${clientId}, user=${userId}`);
    return false;
  }
}

/**
 * Handler type for authenticated API routes.
 */
type AuthenticatedHandler<T> = (
  req: NextRequest,
  auth: AuthContext
) => Promise<T>;

/**
 * Handler type with params for dynamic routes.
 */
type AuthenticatedHandlerWithParams<T, P = Record<string, string>> = (
  req: NextRequest,
  auth: AuthContext,
  params: P
) => Promise<T>;

/**
 * Wrap an API handler with authentication.
 * Automatically handles auth errors and returns appropriate HTTP responses.
 *
 * @example
 * ```ts
 * export const GET = withAuth(async (req, auth) => {
 *   const data = await fetchUserData(auth.userId);
 *   return data;
 * });
 * ```
 */
export function withAuth<T>(
  handler: AuthenticatedHandler<T>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const authContext = await requireAuth();
      const result = await handler(req, authContext);
      return NextResponse.json(result);
    } catch (error) {
      return handleAuthError(error);
    }
  };
}

/**
 * Wrap an API handler with authentication and client access verification.
 * Use this for routes that access client-specific resources.
 *
 * @param clientIdExtractor - Function to extract clientId from request
 * @param handler - The authenticated handler function
 *
 * @example
 * ```ts
 * export const GET = withClientAuth(
 *   (req) => req.nextUrl.searchParams.get('clientId')!,
 *   async (req, auth) => {
 *     // User has verified access to the client
 *     return await fetchClientData(auth.userId);
 *   }
 * );
 * ```
 */
export function withClientAuth<T>(
  clientIdExtractor: (req: NextRequest) => string,
  handler: AuthenticatedHandler<T>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const clientId = clientIdExtractor(req);

      if (!clientId) {
        return NextResponse.json(
          { error: 'Client ID is required' },
          { status: 400 }
        );
      }

      const authContext = await requireClientAccess(clientId);
      const result = await handler(req, authContext);
      return NextResponse.json(result);
    } catch (error) {
      return handleAuthError(error);
    }
  };
}

/**
 * Wrap a dynamic route handler with authentication.
 * Handles routes with URL params like /api/clients/[clientId].
 *
 * @example
 * ```ts
 * export const GET = withAuthParams<Client, { clientId: string }>(
 *   async (req, auth, params) => {
 *     return await getClient(params.clientId, auth.userId);
 *   }
 * );
 * ```
 */
export function withAuthParams<T, P extends Record<string, string> = Record<string, string>>(
  handler: AuthenticatedHandlerWithParams<T, P>
): (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse> {
  return async (
    req: NextRequest,
    context: { params: Promise<P> }
  ): Promise<NextResponse> => {
    try {
      const authContext = await requireAuth();
      const params = await context.params;
      const result = await handler(req, authContext, params);
      return NextResponse.json(result);
    } catch (error) {
      return handleAuthError(error);
    }
  };
}

/**
 * Wrap a dynamic route handler with authentication and client access verification.
 * Use for routes like /api/clients/[clientId]/* that need ownership verification.
 *
 * @param clientIdParam - The name of the URL param containing the client ID (default: 'clientId')
 * @param handler - The authenticated handler function
 *
 * @example
 * ```ts
 * export const GET = withClientAuthParams<Schedule[], { clientId: string }>(
 *   'clientId',
 *   async (req, auth, params) => {
 *     return await getSchedules(params.clientId);
 *   }
 * );
 * ```
 */
export function withClientAuthParams<T, P extends Record<string, string> = Record<string, string>>(
  clientIdParam: keyof P,
  handler: AuthenticatedHandlerWithParams<T, P>
): (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse> {
  return async (
    req: NextRequest,
    context: { params: Promise<P> }
  ): Promise<NextResponse> => {
    try {
      const params = await context.params;
      const clientId = params[clientIdParam] as string;

      if (!clientId) {
        return NextResponse.json(
          { error: 'Client ID is required' },
          { status: 400 }
        );
      }

      const authContext = await requireClientAccess(clientId);
      const result = await handler(req, authContext, params);
      return NextResponse.json(result);
    } catch (error) {
      return handleAuthError(error);
    }
  };
}

/**
 * Handle authentication errors and return appropriate HTTP responses.
 */
function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  // Log unexpected errors for debugging
  logger.error('[Auth] Unexpected error', error instanceof Error ? error : { error: String(error) });

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Utility to extract client ID from various request sources.
 */
export const extractClientId = {
  fromQuery: (req: NextRequest): string | null => {
    return req.nextUrl.searchParams.get('clientId') ??
           req.nextUrl.searchParams.get('client_id');
  },
  fromBody: async (req: NextRequest): Promise<string | null> => {
    try {
      const body = await req.clone().json();
      return body.clientId ?? body.client_id ?? null;
    } catch {
      return null;
    }
  },
};

// UUID regex for client ID format validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate client ID format at the frontend layer.
 *
 * Phase 68-02: Client Context Security (HIGH-03 FIX)
 * Defense-in-depth validation before any backend calls.
 *
 * @param clientId - The client ID to validate (may be null/undefined)
 * @returns Validated client ID (trimmed)
 * @throws AuthError with 400 if missing/invalid format
 */
export function validateClientAccess(clientId: string | null | undefined): string {
  if (!clientId || clientId.trim() === '') {
    throw new AuthError('Client ID is required', 400);
  }

  const trimmed = clientId.trim();

  // Validate UUID format
  if (!UUID_RE.test(trimmed)) {
    throw new AuthError('Invalid client ID format', 400);
  }

  return trimmed;
}

/**
 * Pre-check client ownership before expensive backend calls.
 *
 * Phase 68-02: Client Context Security (HIGH-03 FIX)
 * This is an optimization that can short-circuit denied access
 * before making full API calls.
 *
 * Note: This uses a lightweight HEAD request to check access.
 * The actual operation still needs full backend authorization.
 *
 * @param clientId - The validated client ID
 * @param userId - The authenticated user ID
 * @returns true if user has access
 * @throws AuthError with 403 if access denied
 */
export async function checkClientOwnership(
  clientId: string,
  userId: string
): Promise<boolean> {
  // Pre-check ownership before expensive backend calls
  const response = await fetch(`/api/clients/${clientId}/access`, {
    method: 'HEAD',
    headers: { 'X-User-ID': userId },
    credentials: 'include',
  });

  if (response.status === 403) {
    throw new AuthError('Access denied to client', 403);
  }

  if (response.status === 404) {
    throw new AuthError('Client not found', 404);
  }

  return response.ok;
}
