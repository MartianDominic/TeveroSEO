/**
 * Webflow Adapter Tests
 * Phase 31-03: Platform Adapters
 *
 * Tests Webflow CMS API v2 integration with mocked fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebflowAdapter } from "./WebflowAdapter";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("WebflowAdapter", () => {
  const config = {
    siteId: "site-123-abc",
    accessToken: "wf_xxxxxxxxxxxxx",
  };

  let adapter: WebflowAdapter;

  beforeEach(() => {
    adapter = new WebflowAdapter(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set platform to webflow", () => {
      expect(adapter.platform).toBe("webflow");
    });

    it("should construct siteUrl from siteId", () => {
      expect(adapter.siteUrl).toBe(`https://webflow.com/dashboard/sites/${config.siteId}`);
    });
  });

  describe("verifyConnection", () => {
    it("should return connected=true when site query succeeds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: config.siteId,
          displayName: "My Webflow Site",
          shortName: "my-site",
          previewUrl: "https://my-site.webflow.io",
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

    it("should use correct headers with Bearer token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: config.siteId,
          displayName: "Test Site",
          shortName: "test",
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.webflow.com/v2/sites/${config.siteId}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("testWritePermission", () => {
    it("should return true when connection is valid (Webflow tokens have write access)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: config.siteId,
          displayName: "Test Site",
          shortName: "test",
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
    it("should call correct Webflow API v2 base URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: config.siteId,
          displayName: "Test Site",
          shortName: "test",
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.webflow.com/v2"),
        expect.any(Object)
      );
    });

    it("should use sites/{siteId} endpoint for verification", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: config.siteId,
          displayName: "Test Site",
          shortName: "test",
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.webflow.com/v2/sites/${config.siteId}`,
        expect.any(Object)
      );
    });
  });
});
