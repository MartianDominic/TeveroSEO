/**
 * Wix Adapter Tests
 * Phase 31-03: Platform Adapters
 *
 * Tests Wix Headless API integration with mocked fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WixAdapter } from "./WixAdapter";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("WixAdapter", () => {
  const config = {
    siteId: "site-123-abc",
    accessToken: "IST.xxxxxxxxxxxxx",
  };

  let adapter: WixAdapter;

  beforeEach(() => {
    adapter = new WixAdapter(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set platform to wix", () => {
      expect(adapter.platform).toBe("wix");
    });

    it("should construct siteUrl from siteId", () => {
      expect(adapter.siteUrl).toBe(`https://www.wix.com/dashboard/${config.siteId}`);
    });
  });

  describe("verifyConnection", () => {
    it("should return connected=true when site properties query succeeds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {
            siteName: "My Wix Site",
          },
        }),
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(true);
      expect(result.capabilities).toEqual({
        canReadPosts: true,
        canWritePosts: true,
        canReadPages: true,
        canWritePages: true,
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
      expect(result.error).toContain("Invalid or expired credentials");
    });

    it("should return connected=false for forbidden access (403)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain("Invalid or expired credentials");
    });

    it("should return connected=false for API errors (500)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toContain("API error 500");
    });

    it("should use correct headers with Bearer token and wix-site-id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {},
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.wixapis.com/site-properties/v4/properties",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${config.accessToken}`,
            "wix-site-id": config.siteId,
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("testWritePermission", () => {
    it("should return true when connection is valid and has write capability", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {},
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

  describe("API endpoint", () => {
    it("should call correct Wix API base URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: {},
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://www.wixapis.com"),
        expect.any(Object)
      );
    });
  });
});
