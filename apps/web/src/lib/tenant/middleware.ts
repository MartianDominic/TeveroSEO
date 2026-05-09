/**
 * Tenant Middleware Module
 * Request-level tenant isolation for API routes and server actions.
 *
 * Provides:
 * 1. Middleware wrappers that inject tenant context
 * 2. Client ID extraction from various request sources
 * 3. Tenant validation with ownership verification
 *
 * SECURITY: All protected routes MUST use these wrappers to ensure
 * tenant isolation is enforced consistently.
 */

import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";

import {
  TenantContext,
  TenantContextError,
  extractTenantFromAuth,
  withTenantContext,
} from "./context";
import { verifyClientOwnership } from "./ownership";

// --- Types ---

/**
 * Handler type for tenant-scoped API routes.
 */
type TenantHandler<T = unknown> = (
  req: NextRequest,
  tenant: TenantContext
) => Promise<T>;

/**
 * Handler type for client-scoped API routes.
 */
type ClientHandler<T = unknown> = (
  req: NextRequest,
  tenant: TenantContext & { clientId: string }
) => Promise<T>;

/**
 * Handler type for routes with URL params.
 */
type TenantHandlerWithParams<T, P = Record<string, string>> = (
  req: NextRequest,
  tenant: TenantContext,
  params: P
) => Promise<T>;

// --- Client ID Extraction ---

/**
 * Extract client ID from various request sources.
 * Order of precedence:
 * 1. URL path parameter (e.g., /clients/[clientId]/...)
 * 2. Query parameter (?clientId=...)
 * 3. Request header (X-Client-ID)
 * 4. Request body (for POST/PUT requests)
 */
export const extractClientId = {
  /**
   * Extract from URL path parameter.
   */
  fromPath: (pathname: string): string | null => {
    // Match /clients/[uuid]/... pattern
    const match = pathname.match(
      /\/clients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    return match?.[1] ?? null;
  },

  /**
   * Extract from query parameter.
   */
  fromQuery: (req: NextRequest): string | null => {
    return (
      req.nextUrl.searchParams.get("clientId") ??
      req.nextUrl.searchParams.get("client_id")
    );
  },

  /**
   * Extract from request header.
   */
  fromHeader: (req: NextRequest): string | null => {
    return (
      req.headers.get("x-client-id") ?? req.headers.get("X-Client-ID")
    );
  },

  /**
   * Extract from request body (for POST/PUT).
   * Note: This clones the request to preserve the body.
   */
  fromBody: async (req: NextRequest): Promise<string | null> => {
    try {
      if (req.method === "GET" || req.method === "HEAD") {
        return null;
      }
      const body = await req.clone().json();
      return body.clientId ?? body.client_id ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Extract from all sources in priority order.
   */
  fromRequest: async (req: NextRequest): Promise<string | null> => {
    // 1. Path parameter (highest priority)
    const fromPath = extractClientId.fromPath(req.nextUrl.pathname);
    if (fromPath) return fromPath;

    // 2. Query parameter
    const fromQuery = extractClientId.fromQuery(req);
    if (fromQuery) return fromQuery;

    // 3. Header
    const fromHeader = extractClientId.fromHeader(req);
    if (fromHeader) return fromHeader;

    // 4. Request body (lowest priority)
    const fromBody = await extractClientId.fromBody(req);
    return fromBody;
  },
};

// --- UUID Validation ---

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format.
 */
function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

// --- Middleware Wrappers ---

/**
 * Wrap an API route with tenant context injection.
 * Requires authentication and workspace membership.
 *
 * @example
 * ```ts
 * export const GET = withTenant(async (req, tenant) => {
 *   const data = await fetchWorkspaceData(tenant.workspaceId);
 *   return data;
 * });
 * ```
 */
export function withTenant<T>(
  handler: TenantHandler<T>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Extract tenant context from auth
      const tenant = await extractTenantFromAuth();

      if (!tenant) {
        return NextResponse.json(
          { error: "Unauthorized: Authentication required" },
          { status: 401 }
        );
      }

      // Run handler within tenant context
      const result = await withTenantContext(tenant, () => handler(req, tenant));

      return NextResponse.json(result);
    } catch (error) {
      return handleTenantError(error);
    }
  };
}

/**
 * Wrap an API route with client-scoped tenant context.
 * Extracts client ID from request and verifies ownership.
 *
 * @param clientIdExtractor - Optional custom extractor for client ID
 *
 * @example
 * ```ts
 * export const GET = withClientTenant(async (req, tenant) => {
 *   const data = await fetchClientData(tenant.clientId);
 *   return data;
 * });
 * ```
 */
export function withClientTenant<T>(
  handler: ClientHandler<T>,
  clientIdExtractor?: (req: NextRequest) => Promise<string | null>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Extract client ID
      const clientId = clientIdExtractor
        ? await clientIdExtractor(req)
        : await extractClientId.fromRequest(req);

      if (!clientId) {
        return NextResponse.json(
          { error: "Bad Request: Client ID required" },
          { status: 400 }
        );
      }

      // Validate UUID format
      if (!isValidUUID(clientId)) {
        return NextResponse.json(
          { error: "Bad Request: Invalid client ID format" },
          { status: 400 }
        );
      }

      // Extract tenant context with client scope
      const tenant = await extractTenantFromAuth(clientId);

      if (!tenant) {
        return NextResponse.json(
          { error: "Unauthorized: Authentication required" },
          { status: 401 }
        );
      }

      // Verify client ownership
      const hasAccess = await verifyClientOwnership(
        tenant.workspaceId,
        clientId
      );

      if (!hasAccess) {
        logger.warn("[tenant] Client access denied", {
          workspaceId: tenant.workspaceId,
          clientId,
          userId: tenant.userId,
        });
        return NextResponse.json(
          { error: "Forbidden: Access denied to this client" },
          { status: 403 }
        );
      }

      // Type assertion safe here after verification
      const clientTenant = tenant as TenantContext & { clientId: string };

      // Run handler within tenant context
      const result = await withTenantContext(clientTenant, () =>
        handler(req, clientTenant)
      );

      return NextResponse.json(result);
    } catch (error) {
      return handleTenantError(error);
    }
  };
}

/**
 * Wrap a dynamic API route with tenant context.
 * Handles routes with URL params like /api/clients/[clientId].
 *
 * @example
 * ```ts
 * export const GET = withTenantParams<Client, { clientId: string }>(
 *   async (req, tenant, params) => {
 *     return await getClient(params.clientId, tenant.workspaceId);
 *   }
 * );
 * ```
 */
export function withTenantParams<
  T,
  P extends Record<string, string> = Record<string, string>
>(
  handler: TenantHandlerWithParams<T, P>
): (
  req: NextRequest,
  context: { params: Promise<P> }
) => Promise<NextResponse> {
  return async (
    req: NextRequest,
    context: { params: Promise<P> }
  ): Promise<NextResponse> => {
    try {
      const params = await context.params;

      // Extract tenant context
      const tenant = await extractTenantFromAuth();

      if (!tenant) {
        return NextResponse.json(
          { error: "Unauthorized: Authentication required" },
          { status: 401 }
        );
      }

      // Run handler within tenant context
      const result = await withTenantContext(tenant, () =>
        handler(req, tenant, params)
      );

      return NextResponse.json(result);
    } catch (error) {
      return handleTenantError(error);
    }
  };
}

/**
 * Wrap a dynamic API route with client-scoped tenant context.
 * Automatically extracts client ID from URL params and verifies ownership.
 *
 * @param clientIdParam - Name of the URL param containing client ID (default: 'clientId')
 *
 * @example
 * ```ts
 * export const GET = withClientTenantParams<Schedule[], { clientId: string }>(
 *   'clientId',
 *   async (req, tenant, params) => {
 *     return await getSchedules(tenant.clientId);
 *   }
 * );
 * ```
 */
export function withClientTenantParams<
  T,
  P extends Record<string, string> = Record<string, string>
>(
  clientIdParam: keyof P,
  handler: TenantHandlerWithParams<T, P>
): (
  req: NextRequest,
  context: { params: Promise<P> }
) => Promise<NextResponse> {
  return async (
    req: NextRequest,
    context: { params: Promise<P> }
  ): Promise<NextResponse> => {
    try {
      const params = await context.params;
      const clientId = params[clientIdParam] as string;

      if (!clientId) {
        return NextResponse.json(
          { error: "Bad Request: Client ID required" },
          { status: 400 }
        );
      }

      if (!isValidUUID(clientId)) {
        return NextResponse.json(
          { error: "Bad Request: Invalid client ID format" },
          { status: 400 }
        );
      }

      // Extract tenant context with client scope
      const tenant = await extractTenantFromAuth(clientId);

      if (!tenant) {
        return NextResponse.json(
          { error: "Unauthorized: Authentication required" },
          { status: 401 }
        );
      }

      // Verify client ownership
      const hasAccess = await verifyClientOwnership(
        tenant.workspaceId,
        clientId
      );

      if (!hasAccess) {
        logger.warn("[tenant] Client access denied", {
          workspaceId: tenant.workspaceId,
          clientId,
          userId: tenant.userId,
        });
        return NextResponse.json(
          { error: "Forbidden: Access denied to this client" },
          { status: 403 }
        );
      }

      // Run handler within tenant context
      const result = await withTenantContext(tenant, () =>
        handler(req, tenant, params)
      );

      return NextResponse.json(result);
    } catch (error) {
      return handleTenantError(error);
    }
  };
}

// --- Error Handling ---

/**
 * Handle tenant-related errors and return appropriate HTTP responses.
 */
function handleTenantError(error: unknown): NextResponse {
  if (error instanceof TenantContextError) {
    const statusMap: Record<TenantContextError["code"], number> = {
      MISSING_WORKSPACE: 401,
      MISSING_USER: 401,
      MISSING_CLIENT: 400,
      INVALID_CLIENT: 400,
      UNAUTHORIZED: 403,
    };

    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: statusMap[error.code] }
    );
  }

  logger.error(
    "[tenant] Unexpected error in tenant middleware",
    error instanceof Error ? error : { error: String(error) }
  );

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// --- Server Action Support ---

/**
 * Establish tenant context for a server action.
 * Use at the beginning of server actions that need tenant isolation.
 *
 * @param clientId - Optional client ID for client-scoped actions
 * @returns Tenant context
 * @throws TenantContextError if authentication fails
 *
 * @example
 * ```ts
 * export async function createArticle(data: FormData) {
 *   'use server';
 *   const tenant = await establishTenantContext(clientId);
 *   // tenant.workspaceId and tenant.clientId are now available
 * }
 * ```
 */
export async function establishTenantContext(
  clientId?: string
): Promise<TenantContext> {
  const tenant = await extractTenantFromAuth(clientId);

  if (!tenant) {
    throw new TenantContextError(
      "Authentication required",
      "MISSING_WORKSPACE"
    );
  }

  // Verify client ownership if client ID provided
  if (clientId) {
    if (!isValidUUID(clientId)) {
      throw new TenantContextError("Invalid client ID format", "INVALID_CLIENT");
    }

    const hasAccess = await verifyClientOwnership(tenant.workspaceId, clientId);
    if (!hasAccess) {
      throw new TenantContextError(
        "Access denied to this client",
        "UNAUTHORIZED"
      );
    }
  }

  return tenant;
}

/**
 * Run a server action within tenant context.
 * Combines context establishment with AsyncLocalStorage.
 *
 * @example
 * ```ts
 * export async function fetchClientData(clientId: string) {
 *   'use server';
 *   return await runWithTenant(clientId, async (tenant) => {
 *     // All code here has access to tenant context
 *     return await db.query.clients.findFirst({
 *       where: eq(clients.id, tenant.clientId)
 *     });
 *   });
 * }
 * ```
 */
export async function runWithTenant<T>(
  clientId: string | undefined,
  fn: (tenant: TenantContext) => Promise<T>
): Promise<T> {
  const tenant = await establishTenantContext(clientId);
  return withTenantContext(tenant, () => fn(tenant));
}
