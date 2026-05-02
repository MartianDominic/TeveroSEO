/**
 * WixOAuthProvider Tests
 * Phase 61-03: Platform Integration Excellence
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WixOAuthProvider, WIX_SCOPES } from "./WixOAuthProvider";

// Mock environment variables
vi.mock("@/server/lib/runtime-env", () => ({
  getRequiredEnvValueSync: vi.fn((key: string) => {
    const values: Record<string, string> = {
      WIX_CLIENT_ID: "test-wix-client-id",
      WIX_CLIENT_SECRET: "test-wix-client-secret",
    };
    return values[key] || "";
  }),
}));

describe("WixOAuthProvider", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("getAuthorizationUrl", () => {
    it("returns Wix OAuth URL with correct params", () => {
      const provider = new WixOAuthProvider("https://example.com/callback");
      const url = provider.getAuthorizationUrl("test-state");

      expect(url).toContain("https://www.wix.com/installer/install");
      expect(url).toContain("appId=test-wix-client-id");
      expect(url).toContain("redirectUrl=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("state=test-state");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("calls Wix token endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "wix-access-token",
          refresh_token: "wix-refresh-token",
          expires_in: 3600,
        }),
      });

      const provider = new WixOAuthProvider("https://example.com/callback");
      await provider.exchangeCodeForTokens("auth-code");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.wixapis.com/oauth/access",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("returns correct TokenSet", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "wix-access-token",
          refresh_token: "wix-refresh-token",
          expires_in: 7200,
        }),
      });

      const provider = new WixOAuthProvider("https://example.com/callback");
      const tokens = await provider.exchangeCodeForTokens("auth-code");

      expect(tokens.accessToken).toBe("wix-access-token");
      expect(tokens.refreshToken).toBe("wix-refresh-token");
      expect(tokens.expiresIn).toBe(7200);
      expect(tokens.tokenType).toBe("Bearer");
    });

    it("throws on failed token exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid code",
      });

      const provider = new WixOAuthProvider("https://example.com/callback");

      await expect(
        provider.exchangeCodeForTokens("invalid-code")
      ).rejects.toThrow("Wix token exchange failed");
    });
  });

  describe("refreshAccessToken", () => {
    it("calls Wix refresh endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        }),
      });

      const provider = new WixOAuthProvider("https://example.com/callback");
      await provider.refreshAccessToken("old-refresh-token");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.wixapis.com/oauth/access",
        expect.objectContaining({
          method: "POST",
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.grant_type).toBe("refresh_token");
      expect(body.refresh_token).toBe("old-refresh-token");
    });

    it("preserves original refresh token if not returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          expires_in: 3600,
        }),
      });

      const provider = new WixOAuthProvider("https://example.com/callback");
      const tokens = await provider.refreshAccessToken("original-refresh");

      expect(tokens.refreshToken).toBe("original-refresh");
    });
  });

  describe("WIX_SCOPES", () => {
    it("includes WIX.SITE.READ", () => {
      expect(WIX_SCOPES).toContain("WIX.SITE.READ");
    });

    it("includes WIX.CONTACTS.READ", () => {
      expect(WIX_SCOPES).toContain("WIX.CONTACTS.READ");
    });

    it("includes WIX.BLOG.READ", () => {
      expect(WIX_SCOPES).toContain("WIX.BLOG.READ");
    });
  });
});
