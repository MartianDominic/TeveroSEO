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
