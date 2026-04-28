/**
 * Client Ownership Validation
 *
 * Provides utilities to verify that authenticated users have access to
 * specific clients. This is the core authorization layer that prevents
 * IDOR (Insecure Direct Object Reference) vulnerabilities.
 *
 * Authorization Chain:
 *   User (Clerk) -> Organization (Clerk) -> Client (AI-Writer DB)
 *
 * Caching Strategy:
 * - Ownership checks are cached in Redis for 5 minutes
 * - Cache key: ownership:{userId}:{clientId}
 * - Negative results are also cached to prevent repeated DB queries for denied access
 *
 * SECURITY:
 * - Fails closed: If authorization service is unavailable, access is denied
 * - All denials are logged for security audit
 * - Uses timing-safe comparison where applicable
 */
'use server';

import { redis, cacheGet, cacheSet, cacheInvalidate } from '@/lib/cache/redis-cache';
import { env } from '@/lib/env';
import {
  AuthorizationError,
  ClientOwnershipError,
  ResourceNotFoundError,
  AuthServiceUnavailableError,
  AuthErrorCode,
} from './errors';
import { z } from 'zod';

// Re-export errors for convenience
export {
  AuthorizationError,
  ClientOwnershipError,
  ResourceNotFoundError,
  AuthServiceUnavailableError,
  AuthErrorCode,
} from './errors';

/**
 * Cache TTL for ownership checks (5 minutes).
 * Balances performance with security - ownership changes are relatively rare.
 */
const OWNERSHIP_CACHE_TTL = 5 * 60; // 5 minutes in seconds

/**
 * Build cache key for ownership check.
 */
function buildOwnershipCacheKey(userId: string, clientId: string): string {
  return `ownership:${userId}:${clientId}`;
}

/**
 * Result of an ownership check, including organization context.
 */
export interface OwnershipCheckResult {
  hasAccess: boolean;
  orgId?: string;
  role?: string;
  reason?: 'client_not_found' | 'not_member' | 'backend_error' | 'cached';
}

/**
 * Schema for backend ownership verification response.
 */
const ownershipResponseSchema = z.object({
  hasAccess: z.boolean(),
  isMember: z.boolean().optional(),
  role: z.string().optional(),
});

/**
 * Validate that a user owns (has access to) a specific client.
 *
 * This is the primary authorization function used throughout the application.
 * It checks ownership through the AI-Writer backend API and caches results.
 *
 * @param userId - The authenticated user's ID (from Clerk)
 * @param clientId - The client ID to validate access for
 * @param orgId - Optional organization ID for org-level access checks
 * @throws ClientOwnershipError if user doesn't have access
 * @throws ResourceNotFoundError if client doesn't exist
 * @throws AuthServiceUnavailableError if backend is unavailable
 *
 * @example
 * ```ts
 * export async function getClientData(clientId: string) {
 *   const { userId } = await requireActionAuth();
 *   await validateClientOwnership(userId, clientId);
 *   // User has access, proceed with operation
 *   return fetchClientData(clientId);
 * }
 * ```
 */
export async function validateClientOwnership(
  userId: string,
  clientId: string,
  orgId?: string
): Promise<void> {
  const result = await checkClientOwnership(userId, clientId, orgId);

  if (!result.hasAccess) {
    // Log denial for security audit
    console.warn(
      `[client-ownership] Access denied: userId=${userId} clientId=${clientId} reason=${result.reason}`
    );

    if (result.reason === 'client_not_found') {
      throw new ResourceNotFoundError('Client', clientId);
    }

    throw new ClientOwnershipError(clientId, userId);
  }
}

/**
 * Check if a user has access to a client (non-throwing version).
 *
 * Use this when you want to handle the result yourself rather than
 * catching exceptions. Returns detailed result including reason for denial.
 *
 * @param userId - The authenticated user's ID
 * @param clientId - The client ID to check access for
 * @param orgId - Optional organization ID
 * @returns OwnershipCheckResult with hasAccess and details
 */
export async function checkClientOwnership(
  userId: string,
  clientId: string,
  orgId?: string
): Promise<OwnershipCheckResult> {
  const cacheKey = buildOwnershipCacheKey(userId, clientId);

  // Check cache first
  try {
    const cached = await cacheGet<OwnershipCheckResult>(cacheKey);
    if (cached !== null) {
      console.debug(
        `[client-ownership] Cache hit: userId=${userId} clientId=${clientId} hasAccess=${cached.hasAccess}`
      );
      return { ...cached, reason: 'cached' };
    }
  } catch (err) {
    // Cache read failure is non-fatal, continue with backend check
    console.warn('[client-ownership] Cache read failed, falling back to backend', err);
  }

  // Cache miss: verify with backend
  const result = await verifyWithBackend(userId, clientId, orgId);

  // Cache the result (both positive and negative)
  try {
    await cacheSet(cacheKey, result, { ttl: OWNERSHIP_CACHE_TTL });
  } catch (err) {
    // Cache write failure is non-fatal
    console.warn('[client-ownership] Cache write failed', err);
  }

  return result;
}

/**
 * Verify client ownership with the AI-Writer backend API.
 */
async function verifyWithBackend(
  userId: string,
  clientId: string,
  orgId?: string
): Promise<OwnershipCheckResult> {
  const backendUrl = env.AI_WRITER_URL;

  try {
    const response = await fetch(
      `${backendUrl}/api/clients/${encodeURIComponent(clientId)}/verify-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          orgId: orgId ?? null,
        }),
        // Short timeout to prevent hanging
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { hasAccess: false, reason: 'client_not_found' };
      }
      if (response.status === 403 || response.status === 401) {
        return { hasAccess: false, reason: 'not_member' };
      }

      console.error(
        `[client-ownership] Backend returned error: status=${response.status} clientId=${clientId}`
      );
      return { hasAccess: false, reason: 'backend_error' };
    }

    const json = await response.json();
    const parsed = ownershipResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[client-ownership] Invalid response shape from backend:', parsed.error);
      return { hasAccess: false, reason: 'backend_error' };
    }

    return {
      hasAccess: parsed.data.hasAccess,
      role: parsed.data.role,
    };
  } catch (err) {
    // Network error or timeout - fail closed for security
    console.error(
      `[client-ownership] Backend request failed: clientId=${clientId} error=${err instanceof Error ? err.message : String(err)}`
    );

    // For AbortError (timeout), still fail closed
    return { hasAccess: false, reason: 'backend_error' };
  }
}

/**
 * Invalidate ownership cache for a specific user-client pair.
 * Call this when ownership changes (e.g., user added/removed from client).
 *
 * @param userId - The user whose cache to invalidate
 * @param clientId - The client whose access cache to invalidate
 */
export async function invalidateOwnershipCache(
  userId: string,
  clientId: string
): Promise<void> {
  const cacheKey = buildOwnershipCacheKey(userId, clientId);
  try {
    await cacheInvalidate(cacheKey);
    console.debug(`[client-ownership] Invalidated cache: userId=${userId} clientId=${clientId}`);
  } catch (err) {
    console.warn('[client-ownership] Failed to invalidate cache', err);
  }
}

/**
 * Invalidate all ownership caches for a specific client.
 * Call this when a client is deleted or transferred.
 *
 * Uses Redis SCAN to find and delete matching keys.
 *
 * @param clientId - The client whose caches to invalidate
 */
export async function invalidateClientCaches(clientId: string): Promise<void> {
  const pattern = `ownership:*:${clientId}`;
  let cursor = '0';
  let deletedCount = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    console.info(`[client-ownership] Invalidated ${deletedCount} caches for client ${clientId}`);
  } catch (err) {
    console.warn(`[client-ownership] Failed to invalidate client caches: clientId=${clientId}`, err);
  }
}

/**
 * Invalidate all ownership caches for a specific user.
 * Call this when a user's memberships change.
 *
 * @param userId - The user whose caches to invalidate
 */
export async function invalidateUserCaches(userId: string): Promise<void> {
  const pattern = `ownership:${userId}:*`;
  let cursor = '0';
  let deletedCount = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    console.info(`[client-ownership] Invalidated ${deletedCount} caches for user ${userId}`);
  } catch (err) {
    console.warn(`[client-ownership] Failed to invalidate user caches: userId=${userId}`, err);
  }
}

/**
 * Batch check ownership for multiple clients.
 * Useful for list views where you need to filter accessible clients.
 *
 * @param userId - The authenticated user's ID
 * @param clientIds - Array of client IDs to check
 * @returns Map of clientId -> hasAccess
 */
export async function batchCheckOwnership(
  userId: string,
  clientIds: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Check cache for all clients first
  const uncached: string[] = [];
  for (const clientId of clientIds) {
    const cacheKey = buildOwnershipCacheKey(userId, clientId);
    try {
      const cached = await cacheGet<OwnershipCheckResult>(cacheKey);
      if (cached !== null) {
        results.set(clientId, cached.hasAccess);
      } else {
        uncached.push(clientId);
      }
    } catch {
      uncached.push(clientId);
    }
  }

  // Verify uncached clients with backend (in parallel, with limit)
  const BATCH_SIZE = 10;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (clientId) => {
      const result = await checkClientOwnership(userId, clientId);
      return { clientId, hasAccess: result.hasAccess };
    });

    const batchResults = await Promise.all(promises);
    for (const { clientId, hasAccess } of batchResults) {
      results.set(clientId, hasAccess);
    }
  }

  return results;
}
