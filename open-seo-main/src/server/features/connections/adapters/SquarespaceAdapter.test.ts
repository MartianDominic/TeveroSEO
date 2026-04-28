/**
 * Squarespace Adapter Tests
 * Phase 31-03: Platform Adapters
 *
 * Tests Squarespace REST API integration with mocked fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SquarespaceAdapter } from "./SquarespaceAdapter";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("SquarespaceAdapter", () => {
  const config = {
    siteId: "site-123-abc",
    apiKey: "sqsp_xxxxxxxxxxxxx",
  };

  let adapter: SquarespaceAdapter;

  beforeEach(() => {
    adapter = new SquarespaceAdapter(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should set platform to squarespace", () => {
      expect(adapter.platform).toBe("squarespace");
    });

    it("should construct siteUrl from siteId", () => {
      expect(adapter.siteUrl).toBe(`https://www.squarespace.com/config/${config.siteId}`);
    });
  });

  describe("verifyConnection", () => {
    it("should return connected=true when inventory query succeeds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          inventory: [],
        }),
      });

      const result = await adapter.verifyConnection();

      expect(result.connected).toBe(true);
      // Squarespace has limited write capabilities for third-party apps
      expect(result.capabilities).toEqual({
        canReadPosts: true,
        canWritePosts: false,
        canReadPages: true,
        canWritePages: false,
        canReadSeo: true,
        canWriteSeo: false,
      });
    });

    it("should return connected=false for invalid API key (401)", async () => {
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
          inventory: [],
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.squarespace.com/1.0/commerce/inventory",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("testWritePermission", () => {
    it("should return false even when connection succeeds (read-only API)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          inventory: [],
        }),
      });

      const result = await adapter.testWritePermission();

      // Squarespace API is read-heavy for third-party apps
      expect(result).toBe(false);
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
    it("should call correct Squarespace API base URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          inventory: [],
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.squarespace.com/1.0"),
        expect.any(Object)
      );
    });

    it("should use commerce/inventory endpoint for verification", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          inventory: [],
        }),
      });

      await adapter.verifyConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.squarespace.com/1.0/commerce/inventory",
        expect.any(Object)
      );
    });
  });
});
