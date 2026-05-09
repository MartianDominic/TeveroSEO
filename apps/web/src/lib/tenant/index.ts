/**
 * Tenant Isolation Module
 * Unified exports for multi-tenant isolation in the SEO chat system.
 *
 * This module provides:
 * - Tenant context management (AsyncLocalStorage-based)
 * - Request middleware for API routes and server actions
 * - Client ownership verification
 * - Per-tenant rate limiting
 * - Per-tenant cost attribution
 * - GDPR data deletion (right-to-forget)
 */

// --- Context ---
export {
  // Types
  type TenantContext,
  type WorkspaceTenantContext,
  type ClientTenantContext,

  // Error types
  TenantContextError,

  // Context access
  getTenantContext,
  getTenantContextOrNull,
  getWorkspaceId,
  getClientId,
  getUserId,
  hasClientContext,

  // Context initialization
  extractTenantFromAuth,
  withTenantContext,
  withClientScope,

  // Audit support
  getAuditMetadata,

  // Type guards
  isClientContext,
  assertClientContext,
} from "./context";

// --- Middleware ---
export {
  // Client ID extraction
  extractClientId,

  // API route wrappers
  withTenant,
  withClientTenant,
  withTenantParams,
  withClientTenantParams,

  // Server action support
  establishTenantContext,
  runWithTenant,
} from "./middleware";

// --- Ownership ---
export {
  verifyClientOwnership,
  invalidateOwnershipCache,
  invalidateAllClientOwnership,
  batchVerifyClientOwnership,
} from "./ownership";

// --- Rate Limiting ---
export {
  // Types
  type TenantRateLimitConfig,
  type TenantRateLimitResult,
  type TenantRateLimitCategory,

  // Configuration
  DEFAULT_TENANT_LIMITS,

  // Core functions
  checkTenantRateLimit,
  checkContextRateLimit,
  enforceTenantRateLimit,

  // Usage tracking
  getTenantRateLimitUsage,
  getAllTenantRateLimitUsage,

  // Headers
  createTenantRateLimitHeaders,

  // Error
  TenantRateLimitError,

  // Admin
  resetTenantRateLimit,
} from "./rate-limit";

// --- Cost Tracking ---
export {
  // Types
  type CostOperationType,
  type CostEntry,
  type CostSummary,

  // Configuration
  COST_RATES_MICROS,

  // Recording
  recordCost,
  recordLLMCost,
  withCostTracking,

  // Retrieval
  getCostSummary,
  getCurrentTenantCostSummary,

  // Forecasting
  forecastMonthlyCost,

  // Billing
  getWorkspaceBillingData,
  persistCostToDatabase,
} from "./cost-tracking";

// --- GDPR ---
export {
  // Types
  type DataDeletionRequest,
  type DataDeletionResult,
  type PreDeletionReport,

  // Pre-deletion
  generatePreDeletionReport,

  // Deletion
  deleteClientData,
  deleteCurrentClientData,

  // Status
  getDeletionStatus,
  listDeletionRequests,

  // Data export
  exportClientData,
} from "./gdpr";
