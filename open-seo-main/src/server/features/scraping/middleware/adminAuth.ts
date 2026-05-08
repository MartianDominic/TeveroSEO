/**
 * Admin Authentication Middleware
 * Phase 95-14: Security & Authentication
 *
 * Provides API key validation for admin endpoints with:
 * - Timing-safe comparison to prevent timing attacks
 * - Optional IP allowlist
 * - Admin context injection for audit logging
 * - Role-based access control (admin vs readonly)
 *
 * Environment variables:
 * - SCRAPING_ADMIN_API_KEY: Full admin access (read + write)
 * - SCRAPING_ADMIN_READONLY_KEY: Read-only access (monitoring only)
 * - SCRAPING_ADMIN_ALLOWED_IPS: Optional comma-separated IP allowlist
 */

// @ts-expect-error - express may not be installed yet
import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { alertLogger } from "../logging";
// DUP-003 FIX: Use consolidated IP extractor
import { getClientIp } from "@/server/lib/ip-extractor";

// =============================================================================
// Types
// =============================================================================

/**
 * Admin role types for access control.
 * - 'admin': Full access (read + write operations)
 * - 'readonly': Read-only access (monitoring, status, metrics)
 */
export type AdminRole = 'admin' | 'readonly';

/**
 * Configuration options for admin authentication middleware.
 */
export interface AdminAuthConfig {
  /** Header name for API key (default: x-admin-api-key) */
  apiKeyHeader: string;
  /** Optional list of allowed IP addresses */
  allowedIps?: string[];
  /** Whether to require API key (default: true) */
  requireApiKey: boolean;
}

/**
 * Admin context attached to authenticated requests.
 */
export interface AdminContext {
  /** Timestamp when request was authenticated */
  authenticatedAt: string;
  /** Client IP address */
  clientIp: string;
  /** User agent string */
  userAgent?: string;
  /** First 8 characters of API key for identification */
  apiKeyPrefix?: string;
  /** Role determined by which API key was used */
  role: AdminRole;
}

/**
 * Extended request type with admin context.
 * Note: We use 'any' here because express Request type conflicts
 * with the @ts-expect-error directive at the import level.
 */
export type AdminRequest = Request & {
  adminContext?: AdminContext;
};

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: AdminAuthConfig = {
  apiKeyHeader: "x-admin-api-key",
  requireApiKey: true,
};

// =============================================================================
// Middleware Factory
// =============================================================================

/**
 * Create admin authentication middleware with custom configuration.
 *
 * @example
 * ```typescript
 * import { createAdminAuthMiddleware } from './middleware/adminAuth';
 *
 * // Basic usage
 * router.use(createAdminAuthMiddleware());
 *
 * // Custom config
 * router.use(createAdminAuthMiddleware({
 *   apiKeyHeader: 'x-custom-key',
 *   allowedIps: ['10.0.0.1', '10.0.0.2'],
 * }));
 * ```
 */
export function createAdminAuthMiddleware(
  config: Partial<AdminAuthConfig> = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const adminApiKey = process.env.SCRAPING_ADMIN_API_KEY;
  const readonlyApiKey = process.env.SCRAPING_ADMIN_READONLY_KEY;
  const allowedIps =
    process.env.SCRAPING_ADMIN_ALLOWED_IPS?.split(",").map((ip) =>
      ip.trim()
    ) ?? finalConfig.allowedIps;

  // Warn if API keys not configured
  if (finalConfig.requireApiKey && !adminApiKey && !readonlyApiKey) {
    alertLogger.warn('Neither SCRAPING_ADMIN_API_KEY nor SCRAPING_ADMIN_READONLY_KEY set - admin endpoints will reject all requests');
  }

  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);

    // IP allowlist check (if configured)
    if (allowedIps && allowedIps.length > 0) {
      if (!allowedIps.includes(clientIp)) {
        alertLogger.warn({ clientIp }, 'Admin request rejected - IP not in allowlist');
        return res.status(403).json({
          error: "Forbidden",
          message: "IP not in allowlist",
          timestamp: new Date().toISOString(),
        });
      }
    }

    // API key validation
    if (finalConfig.requireApiKey) {
      const providedKey = req.headers[finalConfig.apiKeyHeader] as
        | string
        | undefined;

      if (!providedKey) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Missing admin API key",
          timestamp: new Date().toISOString(),
        });
      }

      // Determine role by checking which key matches
      let role: AdminRole | null = null;

      // Check admin key first (has full access)
      if (adminApiKey && timingSafeCompare(providedKey, adminApiKey)) {
        role = 'admin';
      }
      // Check readonly key
      else if (readonlyApiKey && timingSafeCompare(providedKey, readonlyApiKey)) {
        role = 'readonly';
      }

      if (!role) {
        alertLogger.warn({ clientIp }, 'Admin request rejected - invalid API key');
        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid admin API key",
          timestamp: new Date().toISOString(),
        });
      }

      // Attach admin context for audit logging
      req.adminContext = {
        authenticatedAt: new Date().toISOString(),
        clientIp,
        userAgent: req.headers["user-agent"],
        apiKeyPrefix: providedKey.substring(0, 8),
        role,
      };
    } else {
      // No API key required - still attach context with admin role
      req.adminContext = {
        authenticatedAt: new Date().toISOString(),
        clientIp,
        userAgent: req.headers["user-agent"],
        role: 'admin',
      };
    }

    next();
  };
}

/**
 * Create role-checking middleware that requires a specific role level.
 * Use after authentication middleware to enforce role requirements.
 *
 * @example
 * ```typescript
 * // Require admin role for write operations
 * router.post('/emergency-stop', requireAdminAuth, requireRole('admin'), handler);
 *
 * // Allow readonly role for monitoring
 * router.get('/status', requireAdminAuth, requireRole('readonly'), handler);
 * ```
 */
export function requireRole(requiredRole: AdminRole) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const context = req.adminContext;

    if (!context) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Admin authentication required",
        timestamp: new Date().toISOString(),
      });
    }

    // Admin role has full access, readonly can only access readonly endpoints
    if (requiredRole === 'admin' && context.role === 'readonly') {
      alertLogger.warn(
        { clientIp: context.clientIp, requiredRole, actualRole: context.role },
        'Admin request rejected - insufficient permissions'
      );
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions - admin access required",
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Perform timing-safe string comparison.
 * Prevents timing attacks by ensuring comparison takes constant time.
 */
function timingSafeCompare(provided: string, expected: string): boolean {
  // If lengths differ, pad the shorter one to make comparison take same time
  const maxLength = Math.max(provided.length, expected.length);
  const paddedProvided = provided.padEnd(maxLength, "\0");
  const paddedExpected = expected.padEnd(maxLength, "\0");

  const providedBuffer = Buffer.from(paddedProvided, "utf-8");
  const expectedBuffer = Buffer.from(paddedExpected, "utf-8");

  // timingSafeEqual requires same length buffers
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  // Constant-time comparison + length check
  return (
    timingSafeEqual(providedBuffer, expectedBuffer) &&
    provided.length === expected.length
  );
}

// DUP-003 FIX: getClientIp function moved to @/server/lib/ip-extractor.ts
// Import is at the top of the file

// =============================================================================
// Singleton Exports
// =============================================================================

/**
 * Pre-configured admin auth middleware with default settings.
 * Uses SCRAPING_ADMIN_API_KEY and SCRAPING_ADMIN_READONLY_KEY env vars.
 * Accepts X-Admin-API-Key header.
 */
export const requireAdminAuth = createAdminAuthMiddleware();

/**
 * Middleware that requires admin role (full access).
 * Use for write operations: emergency stop, cache invalidate, migration advance.
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware that allows readonly role (monitoring access).
 * Use for read operations: status, metrics, health checks.
 */
export const requireReadonly = requireRole('readonly');

// =============================================================================
// TanStack Start / Fetch API Compatible Auth Helper
// =============================================================================

/**
 * Result of admin API key authentication for TanStack routes.
 */
export interface AdminAuthResult {
  success: true;
  role: AdminRole;
  apiKeyPrefix?: string;
}

/**
 * Failure result for admin API key authentication.
 */
export interface AdminAuthFailure {
  success: false;
  error: string;
  statusCode: 401 | 403;
}

/**
 * Union type for admin auth result.
 */
export type AdminAuthResponse = AdminAuthResult | AdminAuthFailure;

/**
 * Validate admin API key from a standard Request object.
 * Use this for TanStack Start routes and other non-Express handlers.
 *
 * @example
 * ```typescript
 * // In a TanStack Start route handler
 * const auth = validateAdminApiKey(request);
 * if (!auth.success) {
 *   return Response.json({ error: auth.error }, { status: auth.statusCode });
 * }
 * // auth.role is 'admin' or 'readonly'
 * ```
 */
export function validateAdminApiKey(
  request: Request,
  options: { requireAdmin?: boolean } = {}
): AdminAuthResponse {
  const adminApiKey = process.env.SCRAPING_ADMIN_API_KEY;
  const readonlyApiKey = process.env.SCRAPING_ADMIN_READONLY_KEY;

  // Check if any API keys are configured
  if (!adminApiKey && !readonlyApiKey) {
    alertLogger.warn('No admin API keys configured - rejecting request');
    return {
      success: false,
      error: 'Admin API authentication not configured',
      statusCode: 401,
    };
  }

  // Get API key from header
  const providedKey = request.headers.get('x-admin-api-key');

  if (!providedKey) {
    return {
      success: false,
      error: 'Missing admin API key',
      statusCode: 401,
    };
  }

  // Check which key matches
  let role: AdminRole | null = null;

  if (adminApiKey && timingSafeCompare(providedKey, adminApiKey)) {
    role = 'admin';
  } else if (readonlyApiKey && timingSafeCompare(providedKey, readonlyApiKey)) {
    role = 'readonly';
  }

  if (!role) {
    alertLogger.warn('Invalid admin API key attempted');
    return {
      success: false,
      error: 'Invalid admin API key',
      statusCode: 401,
    };
  }

  // Check if admin role is required
  if (options.requireAdmin && role === 'readonly') {
    alertLogger.warn('Readonly key used for admin-only endpoint');
    return {
      success: false,
      error: 'Insufficient permissions - admin access required',
      statusCode: 403,
    };
  }

  return {
    success: true,
    role,
    apiKeyPrefix: providedKey.substring(0, 8),
  };
}
