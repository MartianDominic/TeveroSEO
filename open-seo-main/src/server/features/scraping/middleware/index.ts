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
  type AdminAuthConfig,
  type AdminContext,
  type AdminRequest,
  type AdminRole,
} from "./adminAuth";
