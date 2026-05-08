/**
 * Scraping Middleware
 * Phase 95-14: Security & Authentication
 */

export {
  createAdminAuthMiddleware,
  requireAdminAuth,
  requireAdmin,
  requireReadonly,
  requireRole,
  validateAdminApiKey,
  type AdminAuthConfig,
  type AdminContext,
  type AdminRequest,
  type AdminRole,
  type AdminAuthResult,
  type AdminAuthFailure,
  type AdminAuthResponse,
} from "./adminAuth";
