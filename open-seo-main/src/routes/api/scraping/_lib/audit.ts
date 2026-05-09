/**
 * Audit utilities for TanStack Start routes
 * Phase 95: Shared audit helper for API routes
 */

/**
 * Create audit actor context from a standard Request object.
 * Used for audit logging in TanStack Start API routes.
 */
export function createAuditActor(request: Request): {
  ip: string;
  userAgent?: string;
  apiKeyPrefix?: string;
} {
  const apiKey = request.headers.get('x-admin-api-key');
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown',
    userAgent: request.headers.get('user-agent') ?? undefined,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) : undefined,
  };
}
