/**
 * Admin Authentication Middleware
 * Phase 95-14: Security & Authentication
 *
 * Provides API key validation for admin endpoints with:
 * - Timing-safe comparison to prevent timing attacks
 * - Optional IP allowlist
 * - Admin context injection for audit logging
 *
 * Environment variables:
 * - SCRAPING_ADMIN_API_KEY: Required API key for admin endpoints
 * - SCRAPING_ADMIN_ALLOWED_IPS: Optional comma-separated IP allowlist
 */

// @ts-expect-error - express may not be installed yet
import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

// =============================================================================
// Types
// =============================================================================

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
}

/**
 * Extended request type with admin context.
 */
export interface AdminRequest extends Request {
  adminContext?: AdminContext;
}

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
  const allowedIps =
    process.env.SCRAPING_ADMIN_ALLOWED_IPS?.split(",").map((ip) =>
      ip.trim()
    ) ?? finalConfig.allowedIps;

  // Warn if API key not configured
  if (finalConfig.requireApiKey && !adminApiKey) {
    console.warn(
      "[SECURITY] SCRAPING_ADMIN_API_KEY not set - admin endpoints will reject all requests"
    );
  }

  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);

    // IP allowlist check (if configured)
    if (allowedIps && allowedIps.length > 0) {
      if (!allowedIps.includes(clientIp)) {
        console.warn(
          `[AdminAuth] IP ${clientIp} rejected - not in allowlist`
        );
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

      if (!adminApiKey) {
        return res.status(503).json({
          error: "Service Unavailable",
          message: "Admin authentication not configured",
          timestamp: new Date().toISOString(),
        });
      }

      // Timing-safe comparison to prevent timing attacks
      if (!timingSafeCompare(providedKey, adminApiKey)) {
        console.warn(
          `[AdminAuth] Invalid API key from ${clientIp}`
        );
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
      };
    } else {
      // No API key required - still attach context
      req.adminContext = {
        authenticatedAt: new Date().toISOString(),
        clientIp,
        userAgent: req.headers["user-agent"],
      };
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

/**
 * Extract client IP from request, handling proxies.
 */
function getClientIp(req: Request): string {
  // Check X-Forwarded-For header (nginx, load balancers)
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(",")[0];
    return ips.trim();
  }

  // Check X-Real-IP header (nginx)
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket remote address
  return req.ip || req.socket?.remoteAddress || "unknown";
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Pre-configured admin auth middleware with default settings.
 * Uses SCRAPING_ADMIN_API_KEY env var and X-Admin-API-Key header.
 */
export const requireAdminAuth = createAdminAuthMiddleware();
