/**
 * Hybrid Crawler Tests
 *
 * Tests for HTTP-first crawling with Playwright fallback.
 * Mocks fetch and Playwright to verify behavior without network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HybridCrawler, crawlSite } from "./hybrid-crawler";

// Mock the sitemap-parser module
vi.mock("./sitemap-parser", () => ({
  fetchAllSitemapUrls: vi.fn(),
  filterByLastmod: vi.fn(),
}));

// Mock the extraction-pipeline validatePage
vi.mock("@/server/lib/lightrag/extraction-pipeline", () => ({
  validatePage: vi.fn(),
}));

// Get mock functions
import { fetchAllSitemapUrls, filterByLastmod } from "./sitemap-parser";
import { validatePage } from "@/server/lib/lightrag/extraction-pipeline";

const mockFetchAllSitemapUrls = vi.mocked(fetchAllSitemapUrls);
const mockFilterByLastmod = vi.mocked(filterByLastmod);
const mockValidatePage = vi.mocked(validatePage);

// Store original fetch
const originalFetch = global.fetch;

describe("HybridCrawler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for validatePage - pages are valid
    mockValidatePage.mockReturnValue({ valid: true, reason: "ok" });

    // Default mock for filterByLastmod - return all as unknown (must check)
    mockFilterByLastmod.mockImplementation((urls) => ({
      unchanged: [],
      changed: [],
      unknown: urls,
    }));
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe("crawlSite", () => {
    it("returns pages from sitemap", async () => {
      // Setup
      const sitemapUrls = [
        { loc: "https://example.com/page1", lastmod: null, changefreq: null, priority: null },
        { loc: "https://example.com/page2", lastmod: null, changefreq: null, priority: null },
      ];
      mockFetchAllSitemapUrls.mockResolvedValue(sitemapUrls);

      // Mock fetch to return HTML
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Test content with enough text to pass validation</body></html>"),
      } as Response);

      const crawler = new HybridCrawler({ playwrightFallback: false });
      const { results, summary } = await crawler.crawlSite("tenant-1", "https://example.com/sitemap.xml");

      expect(results).toHaveLength(2);
      expect(summary.crawled).toBe(2);
      expect(summary.totalUrls).toBe(2);
    });

    it("HTTP fetch is used by default (not Playwright)", async () => {
      // Setup
      mockFetchAllSitemapUrls.mockResolvedValue([
        { loc: "https://example.com/page1", lastmod: null, changefreq: null, priority: null },
      ]);

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Test content with enough text</body></html>"),
      } as Response);

      const crawler = new HybridCrawler({ playwrightFallback: false });
      const { results } = await crawler.crawlSite("tenant-1", "https://example.com/sitemap.xml");

      expect(results[0]?.fetchMethod).toBe("http");
      expect(global.fetch).toHaveBeenCalled();
    });

    it("Playwright fallback triggered for JS-heavy pages (small content)", async () => {
      // Setup
      mockFetchAllSitemapUrls.mockResolvedValue([
        { loc: "https://example.com/spa", lastmod: null, changefreq: null, priority: null },
      ]);

      // Mock fetch to return small HTML (triggers Playwright)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html></html>"), // Too small
      } as Response);

      // Since Playwright is not installed, we expect an error
      const crawler = new HybridCrawler({ playwrightFallback: true });
      const { summary } = await crawler.crawlSite("tenant-1", "https://example.com/sitemap.xml");

      // Should fail because Playwright is not installed
      expect(summary.failed).toBe(1);
    });

    it("Consent pages trigger retry with Playwright", async () => {
      // Setup
      mockFetchAllSitemapUrls.mockResolvedValue([
        { loc: "https://example.com/blocked", lastmod: null, changefreq: null, priority: null },
      ]);

      // Mock validatePage to return invalid (consent page)
      mockValidatePage.mockReturnValue({ valid: false, reason: "consent_or_challenge:cookiebot" });

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Cookiebot consent</body></html>"),
      } as Response);

      const crawler = new HybridCrawler({ playwrightFallback: true });
      const { summary } = await crawler.crawlSite("tenant-1", "https://example.com/sitemap.xml");

      // Playwright fallback attempted but fails (not installed)
      expect(summary.failed).toBe(1);
      expect(mockValidatePage).toHaveBeenCalled();
    });

    it("Concurrency respects limit (default 50)", async () => {
      // Setup - create many URLs
      const urls = Array.from({ length: 100 }, (_, i) => ({
        loc: `https://example.com/page${i}`,
        lastmod: null,
        changefreq: null,
        priority: null,
      }));
      mockFetchAllSitemapUrls.mockResolvedValue(urls);

      // Track concurrent fetches
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

        // Simulate network delay
        await new Promise((r) => setTimeout(r, 10));

        currentConcurrent--;

        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve("<html><body>Content</body></html>"),
        } as Response;
      });

      const crawler = new HybridCrawler({
        concurrency: 50,
        playwrightFallback: false,
      });
      await crawler.crawlSite("tenant-1", "https://example.com/sitemap.xml");

      // Concurrency should be limited
      expect(maxConcurrent).toBeLessThanOrEqual(50);
    });

    it("500 pages complete in < 2 minutes (simulated)", async () => {
      // Setup - 500 URLs
      const urls = Array.from({ length: 500 }, (_, i) => ({
        loc: `https://example.com/page${i}`,
        lastmod: null,
        changefreq: null,
        priority: null,
      }));
      mockFetchAllSitemapUrls.mockResolvedValue(urls);

      // Fast mock fetch (simulate ~1ms per page)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Content</body></html>"),
      } as Response);

      const crawler = new HybridCrawler({
        concurrency: 50,
        playwrightFallback: false,
      });

      const startTime = Date.now();
      const { summary } = await crawler.crawlSite("tenant-1", "https://example.com/sitemap.xml");
      const duration = Date.now() - startTime;

      // Should complete in under 2 minutes (120000ms)
      expect(duration).toBeLessThan(120000);
      expect(summary.crawled).toBe(500);
    });

    it("Delta sync integration skips unchanged pages", async () => {
      // Setup
      const allUrls = [
        { loc: "https://example.com/changed", lastmod: new Date(), changefreq: null, priority: null },
        { loc: "https://example.com/unchanged", lastmod: new Date("2020-01-01"), changefreq: null, priority: null },
      ];
      mockFetchAllSitemapUrls.mockResolvedValue(allUrls);

      // Mock filterByLastmod to skip one URL
      mockFilterByLastmod.mockReturnValue({
        unchanged: [allUrls[1]!],
        changed: [allUrls[0]!],
        unknown: [],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Content</body></html>"),
      } as Response);

      const crawler = new HybridCrawler({
        enableDeltaSync: true,
        lastCrawlDate: new Date("2023-01-01"),
        playwrightFallback: false,
      });
      const { summary } = await crawler.crawlSite("tenant-1", "https://example.com/sitemap.xml");

      // Should skip 1, crawl 1
      expect(summary.skipped).toBe(1);
      expect(summary.crawled).toBe(1);
    });
  });

  describe("fetchPage", () => {
    it("returns HTTP result for valid page", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Valid content</body></html>"),
      } as Response);

      const crawler = new HybridCrawler({ playwrightFallback: false });
      const result = await crawler.fetchPage("https://example.com/page");

      expect(result.fetchMethod).toBe("http");
      expect(result.statusCode).toBe(200);
      expect(result.html).toContain("Valid content");
    });

    it("includes fetch time in result", async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve("<html><body>Content</body></html>"),
        } as Response;
      });

      const crawler = new HybridCrawler({ playwrightFallback: false });
      const result = await crawler.fetchPage("https://example.com/page");

      expect(result.fetchTimeMs).toBeGreaterThanOrEqual(50);
    });

    it("throws error when HTTP fails and no Playwright fallback", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const crawler = new HybridCrawler({ playwrightFallback: false });

      await expect(crawler.fetchPage("https://example.com/page")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("crawlSite convenience function", () => {
    it("creates crawler and returns results", async () => {
      mockFetchAllSitemapUrls.mockResolvedValue([
        { loc: "https://example.com/page1", lastmod: null, changefreq: null, priority: null },
      ]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("<html><body>Content</body></html>"),
      } as Response);

      const { results, summary } = await crawlSite(
        "tenant-1",
        "https://example.com/sitemap.xml",
        { playwrightFallback: false }
      );

      expect(results).toHaveLength(1);
      expect(summary.totalUrls).toBe(1);
    });
  });
});
