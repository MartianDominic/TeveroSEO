/**
 * DirectFetcher Tests
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Tests for T0 direct fetch implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DirectFetcher,
  createDirectFetcher,
  clearRateLimiter,
} from "./DirectFetcher";
import { TIER_TO_NUMBER } from "./types";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock headers
function createMockHeaders(entries: [string, string][] = []) {
  const map = new Map(entries);
  return {
    get: (key: string) => map.get(key) ?? null,
    forEach: (callback: (value: string, key: string) => void) => {
      map.forEach((value, key) => callback(value, key));
    },
  };
}

describe("DirectFetcher", () => {
  let fetcher: DirectFetcher;

  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimiter();
    fetcher = createDirectFetcher({ timeoutMs: 5000, maxRetries: 0 });
  });

  afterEach(() => {
    clearRateLimiter();
  });

  describe("fetch()", () => {
    it("should return success for 200 response", async () => {
      const mockHtml = "<html><body><h1>Hello World</h1><p>Content here with enough words to pass the minimum length check for valid pages</p></body></html>";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
        headers: createMockHeaders([["content-type", "text/html"]]),
      });

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(true);
      expect(result.tier).toBe(TIER_TO_NUMBER.direct);
      expect(result.html).toBe(mockHtml);
      expect(result.statusCode).toBe(200);
      // latencyMs can be 0 in mocked environment due to instant resolution
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.bytesTransferred).toBeGreaterThan(0);
    });

    it("should return failure for 4xx response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "Forbidden",
        headers: createMockHeaders(),
      });

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.errorType).toBe("ip_blocked");
    });

    it("should detect rate limiting (429)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Too Many Requests",
        headers: createMockHeaders(),
      });

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.errorType).toBe("rate_limited");
    });

    it("should detect Cloudflare protection", async () => {
      const cfHtml = `
        <html>
        <body>
          <h1>Checking your browser</h1>
          <p>Just a moment...</p>
          <script data-cf-beacon></script>
        </body>
        </html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => cfHtml,
        headers: createMockHeaders([["cf-ray", "abc123"]]),
      });

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("dc_detected");
    });

    it("should detect CAPTCHA page", async () => {
      const captchaHtml = `
        <html>
        <body>
          <div class="g-recaptcha"></div>
        </body>
        </html>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => captchaHtml,
        headers: createMockHeaders(),
      });

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("captcha");
    });

    it("should detect empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "<html></html>",
        headers: createMockHeaders(),
      });

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("empty_response");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("connection_reset");
    });

    it("should handle timeout", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await fetcher.fetch({ url: "https://example.com" });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("timeout");
    });

    it("should handle DNS errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));

      const result = await fetcher.fetch({ url: "https://nonexistent.test" });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("dns_error");
    });

    it("should use custom headers", async () => {
      const mockHtml = "<html><body><p>Content with enough words to pass validation check for the minimum length requirement</p></body></html>";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHtml,
        headers: createMockHeaders(),
      });

      await fetcher.fetch({
        url: "https://example.com",
        headers: { "X-Custom": "value" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom": "value",
          }),
        })
      );
    });
  });

  describe("rate limiting", () => {
    it("should delay requests to same domain", async () => {
      const mockHtml = "<html><body><p>Content with enough words to pass validation check for the minimum length requirement</p></body></html>";
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
        headers: createMockHeaders(),
      });

      const start = Date.now();

      await fetcher.fetch({ url: "https://example.com/page1" });
      await fetcher.fetch({ url: "https://example.com/page2" });

      const elapsed = Date.now() - start;

      // Second request should be delayed by at least 900ms (rate limit - some tolerance)
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });

    it("should allow parallel requests to different domains", async () => {
      const mockHtml = "<html><body><p>Content with enough words to pass validation check for the minimum length requirement</p></body></html>";
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
        headers: createMockHeaders(),
      });

      const start = Date.now();

      await Promise.all([
        fetcher.fetch({ url: "https://example1.com" }),
        fetcher.fetch({ url: "https://example2.com" }),
      ]);

      const elapsed = Date.now() - start;

      // Parallel requests should complete faster than sequential
      expect(elapsed).toBeLessThan(1500);
    });
  });

  describe("testConnection()", () => {
    it("should return success with IP", async () => {
      // testConnection uses httpbin.org which returns more than 100 chars
      const jsonResponse = JSON.stringify({ origin: "1.2.3.4" });
      // Pad to be > 100 chars
      const paddedResponse = jsonResponse.padEnd(150, " ");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => paddedResponse,
        headers: createMockHeaders(),
      });

      const result = await fetcher.testConnection();

      expect(result.success).toBe(true);
      expect(result.ip).toBe("1.2.3.4");
      // latencyMs can be 0 in mocked environment due to instant resolution
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should return failure on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetcher.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });
});
