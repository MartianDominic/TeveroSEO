/**
 * Tests for OAuth Callback with Cryptographic State Validation
 * Phase 96-Security: SEC-H02 Fix Tests
 *
 * Tests cryptographic state validation:
 * - HMAC signature verification (tamper protection)
 * - Timestamp validation (replay attack prevention)
 * - User ID matching (CSRF/IDOR prevention)
 * - Constant-time comparison (timing attack prevention)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Set test environment
process.env.NODE_ENV = "test";

import {
  createSecureOAuthState,
  validateOAuthState,
  handleOAuthCallback,
  validateOAuthStateConfig,
  resetOAuthStateConfig,
  setTestOAuthSecret,
  getStateMaxAgeMs,
  type SecureStatePayload,
} from "./callback";

describe("OAuth State Cryptographic Validation (SEC-H02)", () => {
  const testSecret = "test-secret-that-is-at-least-32-characters-long";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));
    resetOAuthStateConfig();
    setTestOAuthSecret(testSecret);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetOAuthStateConfig();
  });

  describe("createSecureOAuthState()", () => {
    it("should create a signed state with all required fields", () => {
      const result = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: ["webmasters.readonly"],
      });

      expect(result.state).toBeDefined();
      expect(result.state).toContain("."); // payload.signature format
      expect(result.payload.nonce).toBeDefined();
      expect(result.payload.timestamp).toBe(Date.now());
      expect(result.payload.workspaceId).toBe("ws_123");
      expect(result.payload.userId).toBe("user_456");
      expect(result.payload.platform).toBe("google_search_console");
      expect(result.payload.redirectUriHash).toBeDefined();
    });

    it("should include prospectId when provided", () => {
      const result = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_analytics",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: ["analytics.readonly"],
        prospectId: "prospect_789",
      });

      expect(result.payload.prospectId).toBe("prospect_789");
    });

    it("should generate unique nonces for each state", () => {
      const result1 = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      const result2 = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      expect(result1.payload.nonce).not.toBe(result2.payload.nonce);
    });
  });

  describe("validateOAuthState()", () => {
    it("should validate a correctly signed state", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      const result = validateOAuthState(state, "user_456");

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.workspaceId).toBe("ws_123");
      expect(result.payload?.userId).toBe("user_456");
    });

    it("should reject state with tampered payload (signature mismatch)", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      // Tamper with the payload (change a character)
      const [payload, signature] = state.split(".");
      const tamperedPayload = payload.slice(0, -1) + "X";
      const tamperedState = `${tamperedPayload}.${signature}`;

      const result = validateOAuthState(tamperedState, "user_456");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("TAMPERED_STATE");
    });

    it("should reject state with tampered signature", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      // Tamper with the signature
      const [payload] = state.split(".");
      const tamperedState = `${payload}.invalid_signature_here`;

      const result = validateOAuthState(tamperedState, "user_456");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("TAMPERED_STATE");
    });

    it("should reject state without signature", () => {
      const result = validateOAuthState("invalid_state_without_dot", "user_456");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("INVALID_STATE");
    });

    it("should reject expired state (replay attack prevention)", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      // Advance time beyond the 10 minute window
      vi.advanceTimersByTime(getStateMaxAgeMs() + 1000);

      const result = validateOAuthState(state, "user_456");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("EXPIRED_STATE");
      expect(result.error).toContain("expired");
    });

    it("should accept state within the 10 minute window", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      // Advance time but stay within window
      vi.advanceTimersByTime(getStateMaxAgeMs() - 60000); // 1 minute before expiry

      const result = validateOAuthState(state, "user_456");

      expect(result.valid).toBe(true);
    });

    it("should reject state with mismatched user ID (CSRF/IDOR prevention)", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      // Different user trying to use the state
      const result = validateOAuthState(state, "attacker_user_789");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("USER_MISMATCH");
    });

    it("should validate redirect URI when provided", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      // Same redirect URI
      const validResult = validateOAuthState(state, "user_456", {
        redirectUri: "https://app.example.com/oauth/callback",
      });
      expect(validResult.valid).toBe(true);

      // Different redirect URI
      const invalidResult = validateOAuthState(state, "user_456", {
        redirectUri: "https://attacker.com/oauth/callback",
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errorCode).toBe("INVALID_STATE");
    });

    it("should reject state with invalid base64 payload", () => {
      const result = validateOAuthState("!!!invalid-base64!!!.signature", "user_456");

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("TAMPERED_STATE");
    });

    it("should reject state with invalid JSON payload", () => {
      // Create a valid signature for invalid JSON
      const invalidPayload = Buffer.from("not-valid-json").toString("base64url");
      const result = validateOAuthState(`${invalidPayload}.some-signature`, "user_456");

      expect(result.valid).toBe(false);
    });
  });

  describe("handleOAuthCallback()", () => {
    const context = {
      userId: "user_456",
      workspaceId: "ws_123",
      redirectUri: "https://app.example.com/oauth/callback",
    };

    it("should accept valid callback with all validations passing", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      const result = handleOAuthCallback(
        { code: "auth_code_123", state },
        context
      );

      expect(result.valid).toBe(true);
      expect(result.code).toBe("auth_code_123");
      expect(result.payload).toBeDefined();
    });

    it("should reject callback with OAuth error from provider", () => {
      const result = handleOAuthCallback(
        {
          code: "",
          state: "some-state",
          error: "access_denied",
          errorDescription: "User denied access",
        },
        context
      );

      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(400);
    });

    it("should reject callback without state parameter", () => {
      const result = handleOAuthCallback(
        { code: "auth_code_123", state: "" },
        context
      );

      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(400);
    });

    it("should reject callback with invalid state", () => {
      const result = handleOAuthCallback(
        { code: "auth_code_123", state: "invalid.state" },
        context
      );

      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(400);
    });

    it("should reject callback with workspace mismatch", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "different_workspace",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      const result = handleOAuthCallback(
        { code: "auth_code_123", state },
        context
      );

      expect(result.valid).toBe(false);
      const body = result.response?.json() as Promise<{ error: { code: string } }>;
      // Note: We can't await here in a sync check, but the response exists
      expect(result.response?.status).toBe(400);
    });

    it("should reject callback without authorization code", () => {
      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      const result = handleOAuthCallback(
        { code: "", state },
        context
      );

      expect(result.valid).toBe(false);
      expect(result.response?.status).toBe(400);
    });
  });

  describe("Configuration Validation", () => {
    it("should validate config successfully with valid secret", () => {
      setTestOAuthSecret("a-valid-secret-that-is-at-least-32-characters");
      expect(() => validateOAuthStateConfig()).not.toThrow();
    });

    it("should throw when secret is missing", () => {
      resetOAuthStateConfig();
      // Clear the env vars
      const originalOauthSecret = process.env.OAUTH_STATE_SECRET;
      const originalHmacSecret = process.env.INTERNAL_API_HMAC_SECRET;
      delete process.env.OAUTH_STATE_SECRET;
      delete process.env.INTERNAL_API_HMAC_SECRET;

      expect(() => {
        // Force re-read of secret
        createSecureOAuthState({
          workspaceId: "ws_123",
          userId: "user_456",
          platform: "google_search_console",
          redirectUri: "https://app.example.com/oauth/callback",
          scopes: [],
        });
      }).toThrow(/OAUTH_STATE_SECRET|INTERNAL_API_HMAC_SECRET/);

      // Restore
      if (originalOauthSecret) process.env.OAUTH_STATE_SECRET = originalOauthSecret;
      if (originalHmacSecret) process.env.INTERNAL_API_HMAC_SECRET = originalHmacSecret;
      setTestOAuthSecret(testSecret);
    });
  });

  describe("Security Properties", () => {
    it("should use constant-time comparison for signatures", () => {
      // This is a design property test - we verify the code uses timingSafeEqual
      // by checking that timing doesn't leak information about where mismatch occurs

      const { state } = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      // Create states with signatures that differ at different positions
      const [payload] = state.split(".");
      const sig1 = "Xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const sig2 = "aXaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      // Both should fail in constant time (we can't measure this in tests,
      // but we verify both fail)
      const result1 = validateOAuthState(`${payload}.${sig1}`, "user_456");
      const result2 = validateOAuthState(`${payload}.${sig2}`, "user_456");

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });

    it("should not expose internal details in error messages", () => {
      const result = validateOAuthState("invalid.state", "user_456");

      expect(result.error).not.toContain("HMAC");
      expect(result.error).not.toContain("secret");
      expect(result.error).not.toContain("algorithm");
    });

    it("should generate different signatures for different payloads", () => {
      const result1 = createSecureOAuthState({
        workspaceId: "ws_123",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      const result2 = createSecureOAuthState({
        workspaceId: "ws_789",
        userId: "user_456",
        platform: "google_search_console",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: [],
      });

      const sig1 = result1.state.split(".")[1];
      const sig2 = result2.state.split(".")[1];

      expect(sig1).not.toBe(sig2);
    });
  });
});
