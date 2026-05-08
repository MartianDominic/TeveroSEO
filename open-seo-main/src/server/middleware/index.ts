/**
 * Server middleware exports.
 * Phase 40: Authentication and authorization middleware.
 */
export {
  validateApiKey,
  requireAuth,
  requireAuthWithScope,
  requireUnifiedAuth,
  authenticateRequest,
  hasScope,
  generateApiKey,
  hashApiKeyForStorage,
  secureCompare,
  type ApiKeyValidationResult,
  type AuthContext,
} from "./auth";

/**
 * Authorization middleware.
 * Verifies user access to specific resources.
 */
export {
  checkClientAccess,
  checkClientAccessWithReason,
  requireClientAccess,
  invalidateClientAccessCache,
  invalidateAllClientAccessCaches,
  invalidateUserAccessCaches,
  AuthorizationError,
  type AuthzResult,
} from "./authz";

/**
 * Webhook signature verification middleware.
 * Validates HMAC signatures from external webhook providers.
 */
export {
  verifyWebhookSignature,
  createWebhookAuthMiddleware,
  registerWebhookProvider,
  getRegisteredWebhookProviders,
  type WebhookVerificationResult,
} from "./webhook-auth";

/**
 * Internal API authentication middleware.
 * HMAC-based authentication for service-to-service communication.
 * CRIT-002 fix: Standardized auth protocol between apps/web and open-seo-main.
 */
export {
  verifyInternalAuth,
  requireInternalAuth,
  getMaxTimestampDrift,
  type InternalAuthResult,
} from "./internal-auth";

/**
 * Security headers middleware.
 * Adds OWASP recommended security headers to all responses.
 */
export {
  withSecurityHeaders,
  buildCSP,
  getSecurityHeaders,
  isSensitiveEndpoint,
} from "./security-headers";

/**
 * Request ID middleware.
 * Extracts or generates request IDs for distributed tracing.
 */
export {
  withRequestId,
  getRequestId,
  getClientIP,
} from "./request-id";

/**
 * Rate limiting middleware.
 * Protects endpoints from abuse with sliding window rate limits.
 */
export {
  // Core functions
  rateLimit,
  withRateLimit,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  extractClientIdFromRequest,
  createEndpointRateLimiter,

  // SEO endpoint rate limiters
  auditRunChecksRateLimiter,
  contentValidateRateLimiter,
  linkSuggestionsRateLimiter,

  // Authentication rate limiters
  authRateLimiter,
  passwordResetRateLimiter,
  signupRateLimiter,

  // AI/Content rate limiters
  contentGenerateRateLimiter,
  briefGenerateRateLimiter,
  keywordEnrichRateLimiter,
  serpAnalyzeRateLimiter,

  // Admin rate limiter (72-03)
  adminRateLimiter,

  // Testing utilities
  resetRateLimit,
  getRateLimitStatus,

  // Configuration
  RATE_LIMITS,

  // Types
  type RateLimitOptions,
  type RateLimitResult,
  type RateLimitOptionsWithKeyFn,
  type RouteHandler,
} from "./rate-limit";

/**
 * Portal authentication middleware.
 * Phase 96-05: Bridges portal token auth with P96 analytics routes.
 * Resolves: portal token -> clientId -> workspaceId
 */
export {
  validatePortalAuth,
  verifyClientIdMatch,
  hasPortalPermission,
  requirePortalPermission,
  portalAuthErrorResponse,
  portalUnauthorizedResponse,
  portalForbiddenResponse,
  type PortalAuthResult,
  type PortalAuthSuccess,
  type PortalAuthFailure,
  type PortalAuthData,
  type PortalPermissions,
} from "./portal-auth";
