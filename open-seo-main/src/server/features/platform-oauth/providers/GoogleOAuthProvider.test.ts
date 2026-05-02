/**
 * GoogleOAuthProvider Tests
 * Phase 61-02: Google OAuth Implementation
 *
 * TDD tests for Google OAuth provider covering GSC, GA, and GBP.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GoogleOAuthProvider,
  GOOGLE_SCOPES,
  type GoogleService,
} from "./GoogleOAuthProvider";

// Mock environment variables
vi.mock("@/server/lib/runtime-env", () => ({
  getRequiredEnvValueSync: vi.fn((key: string) => {
    const mockEnv: Record<string, string> = {
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    };
    if (!mockEnv[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return mockEnv[key];
  }),
}));

describe("GoogleOAuthProvider", () => {
  const TEST_REDIRECT_URI = "https://example.com/api/oauth/google/callback";
  let provider: GoogleOAuthProvider;

  beforeEach(() => {
    provider = new GoogleOAuthProvider(TEST_REDIRECT_URI);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(provider.name).toBe("Google");
      expect(provider.platform).toBe("google_search_console");
    });
  });

  describe("getAuthorizationUrl", () => {
    it("should return URL with client_id, redirect_uri, scope, state, access_type=offline, prompt=consent", () => {
      const state = "test-state-123";
      const url = provider.getAuthorizationUrl(state);

      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth?");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain(`redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain("access_type=offline");
      expect(url).toContain("prompt=consent");
      expect(url).toContain("response_type=code");
    });

    it("should include webmasters.readonly scope when services=['searchConsole']", () => {
      const state = "test-state-456";
      const url = provider.getAuthorizationUrl(state, { services: ["searchConsole"] });

      expect(url).toContain(encodeURIComponent(GOOGLE_SCOPES.searchConsole));
      // Should not include other scopes
      expect(url).not.toContain(encodeURIComponent(GOOGLE_SCOPES.analytics));
      expect(url).not.toContain(encodeURIComponent(GOOGLE_SCOPES.businessProfile));
    });

    it("should include both scopes when services=['searchConsole','analytics']", () => {
      const state = "test-state-789";
      const url = provider.getAuthorizationUrl(state, { services: ["searchConsole", "analytics"] });

      expect(url).toContain(encodeURIComponent(GOOGLE_SCOPES.searchConsole));
      expect(url).toContain(encodeURIComponent(GOOGLE_SCOPES.analytics));
      expect(url).not.toContain(encodeURIComponent(GOOGLE_SCOPES.businessProfile));
    });

    it("should include all scopes by default when no services specified", () => {
      const state = "test-state-default";
      const url = provider.getAuthorizationUrl(state);

      expect(url).toContain(encodeURIComponent(GOOGLE_SCOPES.searchConsole));
      expect(url).toContain(encodeURIComponent(GOOGLE_SCOPES.analytics));
      expect(url).toContain(encodeURIComponent(GOOGLE_SCOPES.businessProfile));
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("should call Google token endpoint with correct params", async () => {
      const mockResponse = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/webmasters.readonly",
      };

      // Mock global fetch
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", fetchMock);

      const code = "test-auth-code";
      const result = await provider.exchangeCodeForTokens(code);

      // Verify fetch was called with correct endpoint
      expect(fetchMock).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );

      // Verify body params
      const callBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(callBody.get("client_id")).toBe("test-client-id");
      expect(callBody.get("client_secret")).toBe("test-client-secret");
      expect(callBody.get("code")).toBe(code);
      expect(callBody.get("grant_type")).toBe("authorization_code");
      expect(callBody.get("redirect_uri")).toBe(TEST_REDIRECT_URI);

      // Verify returned TokenSet
      expect(result).toEqual({
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        expiresIn: 3600,
        tokenType: "Bearer",
        scope: "https://www.googleapis.com/auth/webmasters.readonly",
      });

      vi.unstubAllGlobals();
    });

    it("should throw error when token exchange fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid grant"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(provider.exchangeCodeForTokens("bad-code")).rejects.toThrow(
        "Token exchange failed: Invalid grant"
      );

      vi.unstubAllGlobals();
    });
  });

  describe("refreshAccessToken", () => {
    it("should call token endpoint with grant_type=refresh_token", async () => {
      const mockResponse = {
        access_token: "new-access-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/webmasters.readonly",
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", fetchMock);

      const refreshToken = "original-refresh-token";
      const result = await provider.refreshAccessToken(refreshToken);

      // Verify fetch was called
      expect(fetchMock).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          method: "POST",
        })
      );

      // Verify body params
      const callBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(callBody.get("grant_type")).toBe("refresh_token");
      expect(callBody.get("refresh_token")).toBe(refreshToken);
      expect(callBody.get("client_id")).toBe("test-client-id");
      expect(callBody.get("client_secret")).toBe("test-client-secret");

      // When no new refresh token returned, should use original
      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe(refreshToken); // Falls back to original

      vi.unstubAllGlobals();
    });

    it("should throw error when refresh fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Token expired"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(provider.refreshAccessToken("expired-token")).rejects.toThrow(
        "Token refresh failed: Token expired"
      );

      vi.unstubAllGlobals();
    });
  });

  describe("revokeToken", () => {
    it("should call revoke endpoint with token param", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
      });
      vi.stubGlobal("fetch", fetchMock);

      const token = "token-to-revoke";
      await provider.revokeToken(token);

      expect(fetchMock).toHaveBeenCalledWith(
        `https://oauth2.googleapis.com/revoke?token=${token}`,
        { method: "POST" }
      );

      vi.unstubAllGlobals();
    });

    it("should throw error when revocation fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid token"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(provider.revokeToken("bad-token")).rejects.toThrow(
        "Token revocation failed: Invalid token"
      );

      vi.unstubAllGlobals();
    });
  });

  describe("GOOGLE_SCOPES", () => {
    it("should export correct scope URLs", () => {
      expect(GOOGLE_SCOPES.searchConsole).toBe(
        "https://www.googleapis.com/auth/webmasters.readonly"
      );
      expect(GOOGLE_SCOPES.analytics).toBe(
        "https://www.googleapis.com/auth/analytics.readonly"
      );
      expect(GOOGLE_SCOPES.businessProfile).toBe(
        "https://www.googleapis.com/auth/business.manage"
      );
    });
  });
});
