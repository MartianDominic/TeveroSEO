/**
 * Authentication Module
 *
 * Re-exports all authentication utilities for API routes and server actions.
 */

// API Route Authentication
export {
  requireAuth,
  requireUser,
  requireClientAccess,
  withAuth,
  withClientAuth,
  withAuthParams,
  withClientAuthParams,
  extractClientId,
  AuthError,
  type AuthContext,
  type UserAuthContext,
} from './api-auth';

// Server Action Authentication
export {
  requireActionAuth,
  requireActionAuthStrict,
  validateClientOwnership,
  createAuthenticatedAction,
  createClientAuthenticatedAction,
  withActionErrorHandler,
  ActionAuthError,
  type ActionAuthContext,
  type ActionResult,
} from './action-auth';

// Authorization Errors
export {
  AuthorizationError,
  ClientOwnershipError,
  ResourceNotFoundError,
  InsufficientPermissionsError,
  AuthServiceUnavailableError,
  AuthErrorCode,
  isAuthorizationError,
  isClientOwnershipError,
  isResourceNotFoundError,
  toSafeErrorResponse,
} from './errors';

// Client Ownership Validation (with caching)
export {
  checkClientOwnership,
  invalidateOwnershipCache,
  invalidateClientCaches,
  invalidateUserCaches,
  batchCheckOwnership,
  type OwnershipCheckResult,
} from './client-ownership';

// Beacon Token Validation
export {
  generateBeaconToken,
  verifyBeaconToken,
  safeVerifyBeaconToken,
  isSignedBeaconToken,
  BeaconTokenError,
  type BeaconTokenData,
} from './beacon-tokens';

// Signed URL Generation and Validation (HIGH-01 fix: replaces query token auth)
export {
  generateSignedUrlToken,
  generateSignedUrl,
  verifySignedUrlToken,
  verifySignedUrlParams,
  safeVerifySignedUrlToken,
  SignedUrlError,
  type SignedUrlData,
} from './signed-urls';
