/**
 * ShopifyOAuthProvider Tests
 * Phase 61-03: Platform Integration Excellence
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShopifyOAuthProvider, SHOPIFY_SCOPES } from "./ShopifyOAuthProvider";

// Mock environment variables
vi.mock("@/server/lib/runtime-env", () => ({
  getRequiredEnvValueSync: vi.fn((key: string) => {
    const values: Record<string, string> = {
      SHOPIFY_CLIENT_ID: "test-client-id",
      SHOPIFY_CLIENT_SECRET: "test-client-secret",
    };
    return values[key] || "";
  }),
}));

describe("ShopifyOAuthProvider", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("validates and normalizes shop domain with .myshopify.com", () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop.myshopify.com",
        "https://example.com/callback"
      );
      expect(provider.getShop()).toBe("test-shop.myshopify.com");
    });

    it("appends .myshopify.com to shop name", () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );
      expect(provider.getShop()).toBe("test-shop.myshopify.com");
    });

    it("throws on invalid shop domain format", () => {
      expect(() => {
        new ShopifyOAuthProvider(
          "invalid_shop!",
          "https://example.com/callback"
        );
      }).toThrow("Invalid Shopify shop name format");
    });
  });

  describe("getAuthorizationUrl", () => {
    it("builds shop-specific authorization URL", () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );
      const url = provider.getAuthorizationUrl("test-state");

      expect(url).toContain("https://test-shop.myshopify.com/admin/oauth/authorize");
    });

    it("includes client_id in URL", () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );
      const url = provider.getAuthorizationUrl("test-state");

      expect(url).toContain("client_id=test-client-id");
    });

    it("includes all required scopes", () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );
      const url = provider.getAuthorizationUrl("test-state");

      expect(url).toContain("read_products");
      expect(url).toContain("read_content");
      expect(url).toContain("read_themes");
    });

    it("includes redirect_uri and state", () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );
      const url = provider.getAuthorizationUrl("csrf-state-123");

      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("state=csrf-state-123");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("POSTs to shop-specific token endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "shpat_test_token",
          scope: "read_products,read_content",
        }),
      });

      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );
      await provider.exchangeCodeForTokens("auth-code");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test-shop.myshopify.com/admin/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("returns TokenSet with MAX_SAFE_INTEGER for expiresIn", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "shpat_test_token",
          scope: "read_products,read_content",
        }),
      });

      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );
      const tokens = await provider.exchangeCodeForTokens("auth-code");

      expect(tokens.accessToken).toBe("shpat_test_token");
      expect(tokens.expiresIn).toBe(Number.MAX_SAFE_INTEGER);
      expect(tokens.tokenType).toBe("Bearer");
      expect(tokens.scope).toBe("read_products,read_content");
    });

    it("throws on failed token exchange", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid code",
      });

      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );

      await expect(
        provider.exchangeCodeForTokens("invalid-code")
      ).rejects.toThrow("Shopify token exchange failed");
    });
  });

  describe("refreshAccessToken", () => {
    it("throws error because Shopify tokens do not expire", async () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );

      await expect(provider.refreshAccessToken("token")).rejects.toThrow(
        "Shopify tokens do not expire and cannot be refreshed"
      );
    });
  });

  describe("revokeToken", () => {
    it("throws error because Shopify requires app uninstall", async () => {
      const provider = new ShopifyOAuthProvider(
        "test-shop",
        "https://example.com/callback"
      );

      await expect(provider.revokeToken("token")).rejects.toThrow(
        "Shopify token revocation requires app uninstall"
      );
    });
  });

  describe("SHOPIFY_SCOPES", () => {
    it("includes all required scopes", () => {
      expect(SHOPIFY_SCOPES).toContain("read_products");
      expect(SHOPIFY_SCOPES).toContain("read_content");
      expect(SHOPIFY_SCOPES).toContain("read_themes");
      expect(SHOPIFY_SCOPES).toContain("read_online_store_pages");
      expect(SHOPIFY_SCOPES).toContain("read_publications");
    });
  });
});
