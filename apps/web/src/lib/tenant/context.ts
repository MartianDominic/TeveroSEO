/**
 * Tenant Context Module
 * Multi-tenant isolation for the SEO chat system.
 *
 * Provides:
 * 1. Tenant extraction from requests (Clerk session, headers, params)
 * 2. Thread-local tenant context via AsyncLocalStorage
 * 3. Type-safe tenant context access throughout the request lifecycle
 *
 * SECURITY: All database queries MUST use the tenant context to prevent
 * cross-client data access. Missing tenant context throws an error.
 */

import { AsyncLocalStorage } from "async_hooks";

import { auth } from "@clerk/nextjs/server";

import { logger } from "@/lib/logger";

// --- Types ---

/**
 * Tenant context representing the current client/workspace scope.
 */
export interface TenantContext {
  /** Workspace/organization ID (Clerk org ID) */
  workspaceId: string;
  /** Optional client ID within the workspace */
  clientId?: string;
  /** Authenticated user ID */
  userId: string;
  /** Session ID for audit trails */
  sessionId: string;
  /** User's role within the organization */
  role?: "admin" | "member" | "viewer";
  /** Request correlation ID for tracing */
  correlationId: string;
}

/**
 * Minimal tenant context for operations that only need workspace scope.
 */
export interface WorkspaceTenantContext {
  workspaceId: string;
  userId: string;
  correlationId: string;
}

/**
 * Full tenant context including client ID (required for client-scoped operations).
 */
export interface ClientTenantContext extends TenantContext {
  clientId: string;
}

// --- AsyncLocalStorage for Thread-Local Tenant Context ---

/**
 * AsyncLocalStorage instance for storing tenant context per request.
 * This ensures tenant context is automatically propagated through
 * async operations within the same request lifecycle.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

// --- Error Types ---

/**
 * Error thrown when tenant context is missing or invalid.
 */
export class TenantContextError extends Error {
  constructor(
    message: string,
    public code:
      | "MISSING_WORKSPACE"
      | "MISSING_CLIENT"
      | "MISSING_USER"
      | "INVALID_CLIENT"
      | "UNAUTHORIZED" = "MISSING_WORKSPACE"
  ) {
    super(message);
    this.name = "TenantContextError";
  }
}

// --- Context Access Functions ---

/**
 * Get the current tenant context.
 * Throws if no tenant context is set (e.g., called outside of a request).
 *
 * @throws TenantContextError if context is not available
 */
export function getTenantContext(): TenantContext {
  const context = tenantStorage.getStore();
  if (!context) {
    throw new TenantContextError(
      "Tenant context not available. Ensure this is called within a tenant-scoped request.",
      "MISSING_WORKSPACE"
    );
  }
  return context;
}

/**
 * Get the current tenant context or null if not available.
 * Safe version for conditional logic.
 */
export function getTenantContextOrNull(): TenantContext | null {
  return tenantStorage.getStore() ?? null;
}

/**
 * Get the workspace ID from the current tenant context.
 * Convenience function for the most common access pattern.
 *
 * @throws TenantContextError if context is not available
 */
export function getWorkspaceId(): string {
  return getTenantContext().workspaceId;
}

/**
 * Get the client ID from the current tenant context.
 * Throws if client ID is not set (workspace-only context).
 *
 * @throws TenantContextError if client context is not available
 */
export function getClientId(): string {
  const context = getTenantContext();
  if (!context.clientId) {
    throw new TenantContextError(
      "Client context required but not available. Use a client-scoped endpoint.",
      "MISSING_CLIENT"
    );
  }
  return context.clientId;
}

/**
 * Get the user ID from the current tenant context.
 *
 * @throws TenantContextError if context is not available
 */
export function getUserId(): string {
  return getTenantContext().userId;
}

/**
 * Check if the current context has client scope.
 */
export function hasClientContext(): boolean {
  const context = getTenantContextOrNull();
  return context?.clientId !== undefined;
}

// --- Context Initialization ---

/**
 * Generate a correlation ID for request tracing.
 */
function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract tenant context from Clerk authentication.
 * This is the primary method for establishing tenant context.
 *
 * @param clientId - Optional client ID to scope the context
 * @returns Tenant context or null if not authenticated
 */
export async function extractTenantFromAuth(
  clientId?: string
): Promise<TenantContext | null> {
  try {
    const { userId, orgId, sessionId, orgRole } = await auth();

    if (!userId || !sessionId) {
      return null;
    }

    // Require organization context for multi-tenant operations
    if (!orgId) {
      logger.warn("[tenant] User authenticated but no organization context", {
        userId,
      });
      return null;
    }

    return {
      workspaceId: orgId,
      clientId,
      userId,
      sessionId,
      role: mapClerkRole(orgRole),
      correlationId: generateCorrelationId(),
    };
  } catch (error) {
    logger.error(
      "[tenant] Failed to extract tenant from auth",
      error instanceof Error ? error : { error: String(error) }
    );
    return null;
  }
}

/**
 * Map Clerk organization role to our internal role type.
 */
function mapClerkRole(
  clerkRole: string | null | undefined
): "admin" | "member" | "viewer" | undefined {
  if (!clerkRole) return undefined;

  const roleMap: Record<string, "admin" | "member" | "viewer"> = {
    org_admin: "admin",
    admin: "admin",
    org_member: "member",
    member: "member",
    viewer: "viewer",
  };

  return roleMap[clerkRole.toLowerCase()];
}

/**
 * Run a function within a tenant context.
 * All async operations within the callback will have access to the tenant context.
 *
 * @param context - Tenant context to set
 * @param fn - Function to run within the context
 * @returns Result of the function
 *
 * @example
 * ```ts
 * const result = await withTenantContext(context, async () => {
 *   const workspaceId = getWorkspaceId(); // Works!
 *   return await fetchData(workspaceId);
 * });
 * ```
 */
export function withTenantContext<T>(
  context: TenantContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return tenantStorage.run(context, fn);
}

/**
 * Run a function with a new client scope within the existing tenant context.
 * Useful for switching client context mid-request.
 *
 * @param clientId - Client ID to scope to
 * @param fn - Function to run within the client context
 * @throws TenantContextError if no workspace context exists
 */
export function withClientScope<T>(
  clientId: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const currentContext = getTenantContext();
  const clientContext: TenantContext = {
    ...currentContext,
    clientId,
  };
  return tenantStorage.run(clientContext, fn);
}

// --- Audit Trail Support ---

/**
 * Get audit metadata from the current tenant context.
 * Used for logging and audit trail generation.
 */
export function getAuditMetadata(): {
  workspaceId: string;
  userId: string;
  clientId?: string;
  sessionId: string;
  correlationId: string;
  timestamp: string;
} {
  const context = getTenantContext();
  return {
    workspaceId: context.workspaceId,
    userId: context.userId,
    clientId: context.clientId,
    sessionId: context.sessionId,
    correlationId: context.correlationId,
    timestamp: new Date().toISOString(),
  };
}

// --- Type Guards ---

/**
 * Type guard to check if context has client scope.
 */
export function isClientContext(
  context: TenantContext
): context is ClientTenantContext {
  return context.clientId !== undefined;
}

/**
 * Assert that the current context has client scope.
 * Returns the context with clientId guaranteed to be defined.
 *
 * @throws TenantContextError if client context is not available
 */
export function assertClientContext(): ClientTenantContext {
  const context = getTenantContext();
  if (!context.clientId) {
    throw new TenantContextError(
      "Client context required for this operation",
      "MISSING_CLIENT"
    );
  }
  return context as ClientTenantContext;
}
