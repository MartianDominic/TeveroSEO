/**
 * Tenant Isolation Helper
 * Phase 72-01: Multi-Tenancy Verification
 *
 * Central assertion utility for verifying tenant access across all data operations.
 * Prevents cross-tenant data access by validating workspace ownership.
 *
 * Security guarantees (TENANT-01, TENANT-02):
 *  - All tenant-scoped data access must pass through assertTenantAccess
 *  - Cross-tenant access attempts return 403 FORBIDDEN
 *  - Admin-only global queries bypass tenant checks with explicit flag
 */
import { AppError } from "@/server/lib/errors";

/**
 * Context representing the current request's tenant scope.
 */
export interface TenantContext {
  /** The workspace ID from the authenticated session */
  workspaceId: string;
  /** Optional user ID for audit logging */
  userId?: string;
}

/**
 * Entity with workspace ownership - generic interface for tenant-scoped records.
 */
export interface WorkspaceOwned {
  workspaceId: string;
}

/**
 * Assert that the requesting user has access to the given workspace-owned entity.
 *
 * Use this function in service methods before returning data to ensure
 * cross-tenant data leaks are impossible.
 *
 * @param context - The tenant context from the authenticated request
 * @param entity - The entity being accessed (must have workspaceId)
 * @param entityType - Human-readable entity type for error messages (e.g., "contract", "proposal")
 * @throws AppError("FORBIDDEN") if the entity belongs to a different workspace
 *
 * @example
 * ```ts
 * const contract = await ContractRepository.getContractById(contractId);
 * if (!contract) throw new AppError("NOT_FOUND", "Contract not found");
 * assertTenantAccess(ctx, contract, "contract");
 * return contract;
 * ```
 */
export function assertTenantAccess(
  context: TenantContext,
  entity: WorkspaceOwned,
  entityType: string = "resource"
): void {
  if (entity.workspaceId !== context.workspaceId) {
    throw new AppError(
      "FORBIDDEN",
      `Access denied: ${entityType} belongs to a different workspace`
    );
  }
}

/**
 * Assert that the requesting user has access to the given workspace-owned entity.
 * Returns the entity if access is granted, enabling fluent chaining.
 *
 * @param context - The tenant context from the authenticated request
 * @param entity - The entity being accessed (must have workspaceId), or null/undefined
 * @param entityType - Human-readable entity type for error messages
 * @returns The entity if access is granted
 * @throws AppError("NOT_FOUND") if entity is null/undefined
 * @throws AppError("FORBIDDEN") if the entity belongs to a different workspace
 *
 * @example
 * ```ts
 * const contract = assertTenantAccessOrThrow(
 *   ctx,
 *   await ContractRepository.getContractById(contractId),
 *   "contract"
 * );
 * // contract is guaranteed to exist and belong to ctx.workspaceId
 * ```
 */
export function assertTenantAccessOrThrow<T extends WorkspaceOwned>(
  context: TenantContext,
  entity: T | null | undefined,
  entityType: string = "resource"
): T {
  if (!entity) {
    throw new AppError("NOT_FOUND", `${entityType} not found`);
  }
  assertTenantAccess(context, entity, entityType);
  return entity;
}

/**
 * Filter an array of entities to only those belonging to the current workspace.
 * Use this for bulk operations where some entities may belong to other workspaces.
 *
 * @param context - The tenant context from the authenticated request
 * @param entities - Array of workspace-owned entities
 * @returns Entities belonging to the current workspace
 *
 * @example
 * ```ts
 * const allContracts = await db.query.contracts.findMany();
 * const myContracts = filterByTenant(ctx, allContracts);
 * ```
 */
export function filterByTenant<T extends WorkspaceOwned>(
  context: TenantContext,
  entities: T[]
): T[] {
  return entities.filter((entity) => entity.workspaceId === context.workspaceId);
}

/**
 * Validate that a workspace ID in a request matches the authenticated context.
 * Use this when workspaceId is provided as a request parameter.
 *
 * @param context - The tenant context from the authenticated request
 * @param requestedWorkspaceId - The workspace ID provided in the request
 * @throws AppError("FORBIDDEN") if workspace IDs don't match
 *
 * @example
 * ```ts
 * // In API handler:
 * const { workspaceId } = await parseInput(request);
 * assertWorkspaceMatch(ctx, workspaceId);
 * ```
 */
export function assertWorkspaceMatch(
  context: TenantContext,
  requestedWorkspaceId: string
): void {
  if (requestedWorkspaceId !== context.workspaceId) {
    throw new AppError(
      "FORBIDDEN",
      "Cannot access data from another workspace"
    );
  }
}

/**
 * Create a tenant context from resolved client context.
 * Convenience function for extracting tenant scope from auth middleware.
 *
 * @param resolvedContext - Context from resolveClientContext()
 * @returns TenantContext for use with assertion functions
 *
 * @example
 * ```ts
 * const resolved = await resolveClientContext(request);
 * const tenant = createTenantContext(resolved.orgId ?? resolved.clientId, resolved.userId);
 * assertTenantAccess(tenant, contract, "contract");
 * ```
 */
export function createTenantContext(
  workspaceId: string,
  userId?: string
): TenantContext {
  return { workspaceId, userId };
}
