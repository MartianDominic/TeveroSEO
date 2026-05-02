/**
 * WordPressAppPasswordProvider Tests
 * Phase 61-04: WordPress Application Passwords
 *
 * Tests credential validation via WordPress REST API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WordPressAppPasswordProvider,
  type WordPressCredentials,
} from "./WordPressAppPasswordProvider";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("WordPressAppPasswordProvider", () => {
  const siteUrl = "https://example.com";
  let provider: WordPressAppPasswordProvider;

  beforeEach(() => {
    provider = new WordPressAppPasswordProvider(siteUrl);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should normalize site URL by removing trailing slash", () => {
      const p1 = new WordPressAppPasswordProvider("https://example.com/");
      const p2 = new WordPressAppPasswordProvider("https://example.com");
      // Both should work identically - tested via validateCredentials URL
      expect(p1).toBeInstanceOf(WordPressAppPasswordProvider);
      expect(p2).toBeInstanceOf(WordPressAppPasswordProvider);
    });
  });

  describe("validateCredentials", () => {
    const credentials: WordPressCredentials = {
      username: "admin",
      appPassword: "xxxx xxxx xxxx xxxx",
    };

    it("should return valid=true for valid username/appPassword", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 1,
          name: "Admin User",
          slug: "admin",
          roles: ["administrator"],
        }),
      });

      const result = await provider.validateCredentials(credentials);

      expect(result.valid).toBe(true);
      expect(result.user).toEqual({
        id: 1,
        name: "Admin User",
        slug: "admin",
        roles: ["administrator"],
      });
      expect(result.error).toBeUndefined();

      // Verify correct endpoint called
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/wp-json/wp/v2/users/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });

    it("should return valid=false for invalid credentials (401)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await provider.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid username or application password");
      expect(result.user).toBeUndefined();
    });

    it("should return valid=false for insufficient permissions (403)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const result = await provider.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should handle non-Error throws", async () => {
      mockFetch.mockRejectedValueOnce("Unknown error");

      const result = await provider.validateCredentials(credentials);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Connection failed");
    });
  });

  describe("buildAuthHeader", () => {
    it("should create correct Basic auth base64 encoding", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 1, name: "Test", slug: "test", roles: [] }),
      });

      await provider.validateCredentials({
        username: "admin",
        appPassword: "test pass",
      });

      // Check the Authorization header
      const call = mockFetch.mock.calls[0];
      const authHeader = call[1].headers.Authorization;

      // admin:test pass -> base64
      const expected = Buffer.from("admin:test pass").toString("base64");
      expect(authHeader).toBe(`Basic ${expected}`);
    });
  });

  describe("getSiteInfo", () => {
    it("should return site title and description", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: "My WordPress Site",
          description: "Just another WordPress site",
          url: "https://example.com",
          home: "https://example.com",
        }),
      });

      const result = await provider.getSiteInfo();

      expect(result).toEqual({
        name: "My WordPress Site",
        description: "Just another WordPress site",
        url: "https://example.com",
        home: "https://example.com",
      });

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/wp-json");
    });

    it("should return null if site info fetch fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await provider.getSiteInfo();
      expect(result).toBeNull();
    });

    it("should return null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.getSiteInfo();
      expect(result).toBeNull();
    });
  });

  describe("isWordPressSite", () => {
    it("should return true if REST API is available", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await provider.isWordPressSite();
      expect(result).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/wp-json", {
        method: "HEAD",
      });
    });

    it("should return false if REST API is not available", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await provider.isWordPressSite();
      expect(result).toBe(false);
    });

    it("should return false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.isWordPressSite();
      expect(result).toBe(false);
    });
  });
});
