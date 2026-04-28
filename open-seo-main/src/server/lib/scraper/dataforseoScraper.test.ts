/**
 * Tests for DataForSEO scraper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRawHtml, scrapeProspectPage, validateScrapableUrl } from "./dataforseoScraper";
import * as pageAnalyzer from "@/server/lib/audit/page-analyzer";

// Mock the page analyzer
vi.mock("@/server/lib/audit/page-analyzer", () => ({
  analyzeHtml: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("fetchRawHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATAFORSEO_API_KEY = "test-api-key";
  });

  it("should trigger content_parsing/live with JS enabled and store_raw_html", async () => {
    // Mock content_parsing/live response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              path: ["v3", "on_page", "content_parsing", "live"],
              cost: 0.02,
              result_count: 1,
              result: [
                {
                  items: [
                    {
                      id: "task-123",
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    // Mock raw_html response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              path: ["v3", "on_page", "raw_html"],
              cost: 0.0,
              result_count: 1,
              result: [
                {
                  items: [
                    {
                      html: "<html><body>Test</body></html>",
                      status_code: 200,
                      page_timing: {
                        time_to_interactive: 1500,
                      },
                      redirect_url: null,
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    const result = await fetchRawHtml("https://example.com");

    // Verify content_parsing/live was called with correct params
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://api.dataforseo.com/v3/on_page/content_parsing/live",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([
          {
            url: "https://example.com",
            enable_javascript: true,
            store_raw_html: true,
          },
        ]),
      }),
    );

    // Verify raw_html was called with task ID
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.dataforseo.com/v3/on_page/raw_html",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([
          {
            id: "task-123",
          },
        ]),
      }),
    );

    expect(result.data.html).toBe("<html><body>Test</body></html>");
    expect(result.data.statusCode).toBe(200);
    expect(result.data.responseTimeMs).toBe(1500);
    expect(result.data.redirectUrl).toBe(null);
    expect(result.billing.costUsd).toBe(0.02);
  });

  it("should handle redirect URLs", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              path: ["v3", "on_page", "content_parsing", "live"],
              cost: 0.02,
              result_count: 1,
              result: [{ items: [{ id: "task-456" }] }],
            },
          ],
        }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              path: ["v3", "on_page", "raw_html"],
              cost: 0.0,
              result_count: 1,
              result: [
                {
                  items: [
                    {
                      html: "<html></html>",
                      status_code: 301,
                      page_timing: { time_to_interactive: 500 },
                      redirect_url: "https://example.com/new-page",
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    const result = await fetchRawHtml("https://example.com/old-page");

    expect(result.data.statusCode).toBe(301);
    expect(result.data.redirectUrl).toBe("https://example.com/new-page");
  });

  it("should handle API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          status_code: 40000,
          status_message: "Invalid URL format",
          tasks: [],
        }),
    });

    await expect(fetchRawHtml("invalid-url")).rejects.toThrow(
      "Invalid URL format",
    );
  });

  it("should handle HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(fetchRawHtml("https://example.com")).rejects.toThrow();
  });
});

describe("validateScrapableUrl (SSRF protection)", () => {
  it("should allow valid public URLs", () => {
    expect(() => validateScrapableUrl("https://example.com")).not.toThrow();
    expect(() => validateScrapableUrl("http://example.com")).not.toThrow();
    expect(() => validateScrapableUrl("https://subdomain.example.com/path")).not.toThrow();
  });

  it("should reject localhost addresses", () => {
    expect(() => validateScrapableUrl("http://localhost")).toThrow("Cannot scrape localhost");
    expect(() => validateScrapableUrl("http://localhost:3000")).toThrow("Cannot scrape localhost");
    expect(() => validateScrapableUrl("http://127.0.0.1")).toThrow("Cannot scrape localhost");
    expect(() => validateScrapableUrl("http://127.0.0.1:8080")).toThrow("Cannot scrape localhost");
  });

  it("should reject loopback range (127.x.x.x)", () => {
    expect(() => validateScrapableUrl("http://127.0.0.2")).toThrow("loopback");
    expect(() => validateScrapableUrl("http://127.255.255.255")).toThrow("loopback");
  });

  it("should reject private IP 10.x.x.x range", () => {
    expect(() => validateScrapableUrl("http://10.0.0.1")).toThrow("private IP");
    expect(() => validateScrapableUrl("http://10.255.255.255")).toThrow("private IP");
  });

  it("should reject private IP 172.16-31.x.x range", () => {
    expect(() => validateScrapableUrl("http://172.16.0.1")).toThrow("private IP");
    expect(() => validateScrapableUrl("http://172.31.255.255")).toThrow("private IP");
    // 172.15.x.x and 172.32.x.x should be allowed (not in private range)
    expect(() => validateScrapableUrl("http://172.15.0.1")).not.toThrow();
    expect(() => validateScrapableUrl("http://172.32.0.1")).not.toThrow();
  });

  it("should reject private IP 192.168.x.x range", () => {
    expect(() => validateScrapableUrl("http://192.168.0.1")).toThrow("private IP");
    expect(() => validateScrapableUrl("http://192.168.255.255")).toThrow("private IP");
  });

  it("should reject AWS metadata endpoint (169.254.169.254)", () => {
    expect(() => validateScrapableUrl("http://169.254.169.254")).toThrow("link-local or metadata");
    expect(() => validateScrapableUrl("http://169.254.169.254/latest/meta-data/")).toThrow("link-local or metadata");
  });

  it("should reject link-local range (169.254.x.x)", () => {
    expect(() => validateScrapableUrl("http://169.254.0.1")).toThrow("link-local or metadata");
    expect(() => validateScrapableUrl("http://169.254.255.255")).toThrow("link-local or metadata");
  });

  it("should reject non-HTTP(S) schemes", () => {
    expect(() => validateScrapableUrl("ftp://example.com")).toThrow("Invalid URL scheme");
    expect(() => validateScrapableUrl("file:///etc/passwd")).toThrow("Invalid URL scheme");
    expect(() => validateScrapableUrl("javascript:alert(1)")).toThrow("Invalid URL scheme");
    expect(() => validateScrapableUrl("data:text/html,<script>")).toThrow("Invalid URL scheme");
  });

  it("should reject invalid URL format", () => {
    expect(() => validateScrapableUrl("not-a-url")).toThrow("Invalid URL format");
    expect(() => validateScrapableUrl("")).toThrow("Invalid URL format");
  });

  it("should reject IPv6 localhost", () => {
    expect(() => validateScrapableUrl("http://[::1]")).toThrow("localhost");
    expect(() => validateScrapableUrl("http://[::1]:8080")).toThrow("localhost");
  });
});

describe("fetchRawHtml SSRF protection", () => {
  it("should reject private IPs before making API calls", async () => {
    await expect(fetchRawHtml("http://10.0.0.1")).rejects.toThrow("private IP");
    await expect(fetchRawHtml("http://169.254.169.254")).rejects.toThrow("link-local or metadata");
    await expect(fetchRawHtml("http://localhost")).rejects.toThrow("localhost");
    // Verify fetch was never called (SSRF blocked before API call)
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("scrapeProspectPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATAFORSEO_API_KEY = "test-api-key";
  });

  it("should return PageAnalysis from raw HTML", async () => {
    // Mock fetchRawHtml by mocking fetch responses
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              path: ["v3", "on_page", "content_parsing", "live"],
              cost: 0.025,
              result_count: 1,
              result: [{ items: [{ id: "task-789" }] }],
            },
          ],
        }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              path: ["v3", "on_page", "raw_html"],
              cost: 0.0,
              result_count: 1,
              result: [
                {
                  items: [
                    {
                      html: "<html><head><title>Test Page</title></head><body><h1>Hello</h1></body></html>",
                      status_code: 200,
                      page_timing: { time_to_interactive: 1200 },
                      redirect_url: null,
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    // Mock analyzeHtml
    const mockPageAnalysis = {
      url: "https://example.com",
      statusCode: 200,
      redirectUrl: null,
      responseTimeMs: 1200,
      title: "Test Page",
      metaDescription: "",
      canonical: null,
      robotsMeta: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      h1s: ["Hello"],
      headingOrder: [1],
      wordCount: 1,
      images: [],
      internalLinks: [],
      externalLinks: [],
      hasStructuredData: false,
      hreflangTags: [],
    };
    vi.mocked(pageAnalyzer.analyzeHtml).mockReturnValue(mockPageAnalysis);

    const result = await scrapeProspectPage("https://example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.page).toEqual(mockPageAnalysis);
      expect(result.costCents).toBe(2.5); // 0.025 * 100
    }

    // Verify analyzeHtml was called correctly
    expect(pageAnalyzer.analyzeHtml).toHaveBeenCalledWith(
      "<html><head><title>Test Page</title></head><body><h1>Hello</h1></body></html>",
      "https://example.com",
      200,
      1200,
      null,
    );
  });

  it("should handle errors and return ScrapeError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          status_code: 40000,
          status_message: "URL not accessible",
          tasks: [
            {
              status_code: 40000,
              status_message: "URL not accessible",
              path: ["v3", "on_page", "content_parsing", "live"],
              cost: 0.01,
              result_count: null,
            },
          ],
        }),
    });

    const result = await scrapeProspectPage("https://blocked-site.com");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("URL not accessible");
      expect(result.costCents).toBe(0); // Failed requests don't charge
    }
  });
});
