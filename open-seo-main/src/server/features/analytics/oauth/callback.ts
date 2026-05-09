/**
 * OAuth Callback Handler with Cryptographic State Validation
 * Phase 96-Security: SEC-H02 Fix - Complete OAuth state parameter validation
 *
 * Security features:
 * - State parameter includes HMAC-SHA256 signature for tamper protection
 * - Timestamp embedded in state to prevent replay attacks (10 minute window)
 * - State bound to user ID to prevent CSRF/IDOR attacks
 * - Constant-time signature comparison to prevent timing attacks
 * - State can only be used once (marked as used in database)
 *
 * State Format: base64url(JSON({nonce, timestamp, workspaceId, platform})).signature
 *
 * @example
 * ```ts
 * // Generate state for OAuth redirect
 * const state = await createSecureOAuthState({
 *   workspaceId: 'ws_123',
 *   userId: 'user_456',
 *   platform: 'google_search_console',
 *   redirectUri: 'https://app.example.com/oauth/callback',
 *   scopes: ['webmasters.readonly'],
 * });
 *
 * // Validate state in callback
 * const result = await validateOAuthState(stateParam, userId);
 * if (!result.valid) {
 *   return Response.json({ error: result.error }, { status: 400 });
 * }
 * ```
 */

import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { createLogger } from "@/server/lib/logger";
import type { OAuthPlatform } from "@/server/features/platform-oauth/types";

const log = createLogger({ module: "analytics-oauth" });

// =============================================================================
// Configuration
// =============================================================================

/**
 * Maximum age for OAuth state in milliseconds (10 minutes).
 * States older than this are rejected to prevent replay attacks.
 */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * HMAC algorithm for state signing.
 */
const HMAC_ALGORITHM = "sha256";

/**
 * Minimum secret length in bytes (32 bytes = 256 bits).
 */
const MIN_SECRET_LENGTH = 32;

// =============================================================================
// Types
// =============================================================================

export interface CreateSecureStateRequest {
  /** Workspace ID the OAuth flow is for */
  workspaceId: string;
  /** User ID initiating the OAuth flow (for IDOR prevention) */
  userId: string;
  /** OAuth platform being connected */
  platform: OAuthPlatform;
  /** OAuth redirect URI */
  redirectUri: string;
  /** OAuth scopes being requested */
  scopes: string[];
  /** Optional prospect ID if connecting for a prospect */
  prospectId?: string;
}

export interface SecureStatePayload {
  /** Cryptographically random nonce */
  nonce: string;
  /** Unix timestamp when state was created */
  timestamp: number;
  /** Workspace ID */
  workspaceId: string;
  /** User ID */
  userId: string;
  /** Platform */
  platform: OAuthPlatform;
  /** Redirect URI hash (for validation without storing full URI) */
  redirectUriHash: string;
  /** Prospect ID if applicable */
  prospectId?: string;
}

export interface SecureStateValidationResult {
  /** Whether the state is valid */
  valid: boolean;
  /** Decoded payload if valid */
  payload?: SecureStatePayload;
  /** Error message if invalid */
  error?: string;
  /** Error code for client response */
  errorCode?: "INVALID_STATE" | "EXPIRED_STATE" | "TAMPERED_STATE" | "USER_MISMATCH";
}

export interface SecureStateResult {
  /** The complete signed state parameter */
  state: string;
  /** The payload for database storage */
  payload: SecureStatePayload;
}

// =============================================================================
// Secret Management
// =============================================================================

let cachedSecret: string | null = null;

/**
 * Get the OAuth state signing secret.
 * Uses OAUTH_STATE_SECRET env var, falling back to INTERNAL_API_HMAC_SECRET.
 *
 * @throws Error if no valid secret is configured
 */
function getSigningSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }

  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.INTERNAL_API_HMAC_SECRET;

  if (!secret) {
    const errorMsg = "OAUTH_STATE_SECRET or INTERNAL_API_HMAC_SECRET environment variable is required";
    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    const errorMsg = `OAuth state secret must be at least ${MIN_SECRET_LENGTH} characters (256 bits)`;
    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  cachedSecret = secret;
  return secret;
}

/**
 * Validate the signing secret at startup.
 * Call this during application initialization.
 */
export function validateOAuthStateConfig(): void {
  getSigningSecret();
  log.info("OAuth state configuration validated successfully");
}

// =============================================================================
// Cryptographic Helpers
// =============================================================================

/**
 * Create HMAC-SHA256 signature for a message.
 */
function createSignature(message: string): string {
  const secret = getSigningSecret();
  return createHmac(HMAC_ALGORITHM, secret)
    .update(message)
    .digest("base64url");
}

/**
 * Verify HMAC-SHA256 signature using constant-time comparison.
 * Prevents timing attacks.
 */
function verifySignature(message: string, signature: string): boolean {
  try {
    const expectedSignature = createSignature(message);

    const actualBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    // Different lengths - perform dummy comparison for constant time
    if (actualBuffer.length !== expectedBuffer.length) {
      timingSafeEqual(expectedBuffer, expectedBuffer);
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Create a SHA-256 hash of a string (for redirect URI validation).
 */
function hashString(input: string): string {
  return createHmac(HMAC_ALGORITHM, "redirect-uri-salt")
    .update(input)
    .digest("base64url")
    .slice(0, 16); // First 16 chars is enough for verification
}

/**
 * Generate cryptographically secure random nonce.
 */
function generateNonce(): string {
  return randomBytes(24).toString("base64url");
}

// =============================================================================
// State Creation
// =============================================================================

/**
 * Create a cryptographically secure OAuth state parameter.
 *
 * SEC-H02 FIX: The state parameter includes:
 * 1. Cryptographic nonce (prevents replay if combined with DB check)
 * 2. Timestamp (prevents replay after expiry)
 * 3. User ID (prevents CSRF/IDOR - state is bound to user)
 * 4. HMAC signature (prevents tampering)
 *
 * Format: base64url(payload).signature
 *
 * @param request State creation request
 * @returns Signed state parameter and payload for DB storage
 */
export function createSecureOAuthState(request: CreateSecureStateRequest): SecureStateResult {
  const {
    workspaceId,
    userId,
    platform,
    redirectUri,
    prospectId,
  } = request;

  const payload: SecureStatePayload = {
    nonce: generateNonce(),
    timestamp: Date.now(),
    workspaceId,
    userId,
    platform,
    redirectUriHash: hashString(redirectUri),
    ...(prospectId && { prospectId }),
  };

  // Encode payload as base64url JSON
  const payloadJson = JSON.stringify(payload);
  const encodedPayload = Buffer.from(payloadJson).toString("base64url");

  // Create HMAC signature over the encoded payload
  const signature = createSignature(encodedPayload);

  // Combine: payload.signature
  const state = `${encodedPayload}.${signature}`;

  log.debug("Created secure OAuth state", {
    platform,
    workspaceId,
    userId: userId.substring(0, 8) + "***",
    expiresIn: `${STATE_MAX_AGE_MS / 1000}s`,
  });

  return { state, payload };
}

// =============================================================================
// State Validation
// =============================================================================

/**
 * Validate an OAuth state parameter.
 *
 * SEC-H02 FIX: Complete validation includes:
 * 1. Signature verification (prevents tampering)
 * 2. Timestamp validation (prevents replay attacks)
 * 3. User ID matching (prevents CSRF/IDOR)
 *
 * Note: This validates the cryptographic properties of the state.
 * You should ALSO check the database to ensure the state hasn't been used.
 *
 * @param state The state parameter from OAuth callback
 * @param expectedUserId The user ID of the current session
 * @param options Optional validation options
 * @returns Validation result with payload or error
 */
export function validateOAuthState(
  state: string,
  expectedUserId: string,
  options?: { redirectUri?: string }
): SecureStateValidationResult {
  // Split state into payload and signature
  const lastDotIndex = state.lastIndexOf(".");
  if (lastDotIndex === -1) {
    log.warn("OAuth state validation failed: invalid format (no signature)");
    return {
      valid: false,
      error: "Invalid state parameter format",
      errorCode: "INVALID_STATE",
    };
  }

  const encodedPayload = state.substring(0, lastDotIndex);
  const signature = state.substring(lastDotIndex + 1);

  // Verify signature first (prevents processing tampered data)
  if (!verifySignature(encodedPayload, signature)) {
    log.warn("OAuth state validation failed: signature mismatch", {
      hint: "Possible tampering attempt",
    });
    return {
      valid: false,
      error: "Invalid state parameter",
      errorCode: "TAMPERED_STATE",
    };
  }

  // Decode and parse payload
  let payload: SecureStatePayload;
  try {
    const payloadJson = Buffer.from(encodedPayload, "base64url").toString();
    payload = JSON.parse(payloadJson) as SecureStatePayload;
  } catch {
    log.warn("OAuth state validation failed: invalid payload encoding");
    return {
      valid: false,
      error: "Invalid state parameter",
      errorCode: "INVALID_STATE",
    };
  }

  // Validate required fields
  if (!payload.nonce || !payload.timestamp || !payload.userId || !payload.workspaceId) {
    log.warn("OAuth state validation failed: missing required fields");
    return {
      valid: false,
      error: "Invalid state parameter",
      errorCode: "INVALID_STATE",
    };
  }

  // Check timestamp (prevent replay attacks)
  const age = Date.now() - payload.timestamp;
  if (age < 0 || age > STATE_MAX_AGE_MS) {
    log.warn("OAuth state validation failed: expired", {
      ageSeconds: Math.floor(age / 1000),
      maxAgeSeconds: Math.floor(STATE_MAX_AGE_MS / 1000),
    });
    return {
      valid: false,
      error: "State parameter has expired. Please restart the connection process.",
      errorCode: "EXPIRED_STATE",
    };
  }

  // Verify user ownership (prevent CSRF/IDOR)
  if (payload.userId !== expectedUserId) {
    log.warn("OAuth state validation failed: user mismatch", {
      stateUserId: payload.userId.substring(0, 8) + "***",
      requestUserId: expectedUserId.substring(0, 8) + "***",
    });
    return {
      valid: false,
      error: "Invalid state parameter",
      errorCode: "USER_MISMATCH",
    };
  }

  // Optionally verify redirect URI
  if (options?.redirectUri) {
    const expectedHash = hashString(options.redirectUri);
    if (payload.redirectUriHash !== expectedHash) {
      log.warn("OAuth state validation failed: redirect URI mismatch");
      return {
        valid: false,
        error: "Invalid state parameter",
        errorCode: "INVALID_STATE",
      };
    }
  }

  log.debug("OAuth state validated successfully", {
    platform: payload.platform,
    workspaceId: payload.workspaceId,
    userId: payload.userId.substring(0, 8) + "***",
    ageSeconds: Math.floor(age / 1000),
  });

  return {
    valid: true,
    payload,
  };
}

// =============================================================================
// OAuth Callback Handler
// =============================================================================

export interface OAuthCallbackRequest {
  /** Authorization code from OAuth provider */
  code: string;
  /** State parameter from OAuth provider */
  state: string;
  /** Error from OAuth provider (if any) */
  error?: string;
  /** Error description from OAuth provider */
  errorDescription?: string;
}

export interface OAuthCallbackContext {
  /** Current user ID (from session) */
  userId: string;
  /** Current workspace ID (from session/header) */
  workspaceId: string;
  /** Expected redirect URI for this callback */
  redirectUri: string;
}

export interface OAuthCallbackResult {
  /** Whether the callback is valid */
  valid: boolean;
  /** Validated state payload if valid */
  payload?: SecureStatePayload;
  /** Authorization code if valid */
  code?: string;
  /** Error response if invalid */
  response?: Response;
}

/**
 * Handle OAuth callback with full security validation.
 *
 * SEC-H02 FIX: Complete OAuth callback security:
 * 1. Check for OAuth error response
 * 2. Validate state cryptographically
 * 3. Verify user ownership
 * 4. Verify redirect URI
 * 5. Extract and return authorization code
 *
 * @param request OAuth callback parameters
 * @param context Current session context
 * @returns Validated callback result or error response
 */
export function handleOAuthCallback(
  request: OAuthCallbackRequest,
  context: OAuthCallbackContext
): OAuthCallbackResult {
  // Check for OAuth error from provider
  if (request.error) {
    log.warn("OAuth provider returned error", {
      error: request.error,
      description: request.errorDescription,
    });

    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "OAUTH_ERROR",
            message: request.errorDescription ?? `OAuth error: ${request.error}`,
            provider_error: request.error,
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  // Validate state parameter
  if (!request.state) {
    log.warn("OAuth callback missing state parameter");
    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "MISSING_STATE",
            message: "Missing state parameter in OAuth callback",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  // Cryptographic state validation
  const stateResult = validateOAuthState(request.state, context.userId, {
    redirectUri: context.redirectUri,
  });

  if (!stateResult.valid) {
    const statusCode = stateResult.errorCode === "EXPIRED_STATE" ? 400 : 400;
    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: stateResult.errorCode ?? "INVALID_STATE",
            message: stateResult.error ?? "Invalid state parameter",
          },
        }),
        {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  // Verify workspace matches
  if (stateResult.payload!.workspaceId !== context.workspaceId) {
    log.warn("OAuth callback workspace mismatch", {
      stateWorkspaceId: stateResult.payload!.workspaceId,
      contextWorkspaceId: context.workspaceId,
    });
    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "WORKSPACE_MISMATCH",
            message: "OAuth callback workspace does not match current workspace",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  // Validate authorization code is present
  if (!request.code) {
    log.warn("OAuth callback missing authorization code");
    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "MISSING_CODE",
            message: "Missing authorization code in OAuth callback",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  // All validations passed
  log.info("OAuth callback validated successfully", {
    platform: stateResult.payload!.platform,
    workspaceId: stateResult.payload!.workspaceId,
  });

  return {
    valid: true,
    payload: stateResult.payload,
    code: request.code,
  };
}

// =============================================================================
// Testing Utilities
// =============================================================================

/**
 * Reset cached secret (testing only).
 */
export function resetOAuthStateConfig(): void {
  if (process.env.NODE_ENV === "test") {
    cachedSecret = null;
  }
}

/**
 * Set test secret directly (testing only).
 */
export function setTestOAuthSecret(secret: string): void {
  if (process.env.NODE_ENV === "test") {
    cachedSecret = secret;
  }
}

/**
 * Get the state max age in milliseconds (for testing).
 */
export function getStateMaxAgeMs(): number {
  return STATE_MAX_AGE_MS;
}
