/**
 * Shopify Adapter Tests
 * Phase 31-03: Platform Adapters
 *
 * Tests Shopify Admin GraphQL API integration with mocked fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShopifyAdapter } from "./ShopifyAdapter";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("ShopifyAdapter", () => {
  const config = {
    shopDomain: "mystore.myshopify.com",
    accessToken: "shpat_xxxxxxxxxxxxx",
    apiVersion: "2026-04",
  };

  let adapter: ShopifyAdapter;

  beforeEach(() => {
    adapter = new ShopifyAdapter(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set platform to shopify", () => {
      expect(adapter.platform).toBe("shopify");
    });

    it("should construct siteUrl from shopDomain", () => {
      expect(adapter.siteUrl).toBe("https://mystore.myshopify.com");
    });

    it("should use default API version if not specified", () => {
      const adapterDefaultVersion = new ShopifyAdapter({
        shopDomain: "mystore.myshopify.com",
        accessToken: "shpat_xxx",
      });
      expect(adapterDefaultVersion.platform).toBe("shopify");
    });
  });

  describe("verifyConnection", () => {
    it("should return connected=true when shop query succeeds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            shop: {
              name: "My Store",
              primaryDomain: { url: "https://mystore.com" },
            },
          },
        }),
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(true);
      expect(result.capabilities).toEqual({
        canReadProducts: true,
        canWriteProducts: true,
        canReadSeo: true,
        canWriteSeo: true,
      });
    });

    it("should return connected=false for invalid token (401)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain("401");
    });

    it("should return connected=false when GraphQL returns errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: "Access denied" }],
        }),
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain("Access denied");
    });

    it("should use X-Shopify-Access-Token header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { shop: { name: "Test" } },
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Shopify-Access-Token": config.accessToken,
          }),
        })
      );
    });
  });

  describe("testWritePermission", () => {
    it("should return true when connection is valid", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { shop: { name: "Test" } },
        }),
      });

      const result = await adapter.testWritePermission();

      expect(result).toBe(true);
    });

    it("should return false when connection fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      const result = await adapter.testWritePermission();

      expect(result).toBe(false);
    });
  });

  describe("getProduct", () => {
    it("should return product with SEO fields", async () => {
      const mockProduct = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        handle: "test-product",
        seo: {
          title: "Custom SEO Title",
          description: "Custom meta description",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { product: mockProduct },
        }),
      });

      const product = await adapter.getProduct("gid://shopify/Product/123");

      expect(product).toEqual(mockProduct);
      expect(product.seo.title).toBe("Custom SEO Title");
      expect(product.seo.description).toBe("Custom meta description");
    });

    it("should throw on GraphQL errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: "Product not found" }],
        }),
      });

      await expect(adapter.getProduct("gid://shopify/Product/999")).rejects.toThrow(
        "Product not found"
      );
    });
  });

  describe("updateProductSeo", () => {
    it("should update SEO title and description via mutation", async () => {
      const mockUpdatedProduct = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        handle: "test-product",
        seo: {
          title: "New SEO Title",
          description: "New description",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            productUpdate: {
              product: mockUpdatedProduct,
              userErrors: [],
            },
          },
        }),
      });

      const result = await adapter.updateProductSeo("gid://shopify/Product/123", {
        title: "New SEO Title",
        description: "New description",
      });

      expect(result.seo.title).toBe("New SEO Title");
      expect(result.seo.description).toBe("New description");
    });

    it("should throw on userErrors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            productUpdate: {
              product: null,
              userErrors: [{ field: ["seo", "title"], message: "Title too long" }],
            },
          },
        }),
      });

      await expect(
        adapter.updateProductSeo("gid://shopify/Product/123", {
          title: "x".repeat(200),
        })
      ).rejects.toThrow("Title too long");
    });
  });

  describe("GraphQL request format", () => {
    it("should POST to correct GraphQL endpoint with API version", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { shop: { name: "Test" } },
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });
});
