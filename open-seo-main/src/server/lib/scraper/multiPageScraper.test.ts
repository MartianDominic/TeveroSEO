/**
 * Tests for scrapeProspectSite function.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { scrapeProspectSite } from "./multiPageScraper";
import * as dataforseoScraper from "./dataforseoScraper";
import type { PageAnalysis } from "@/server/lib/audit/types";

// Mock dataforseoScraper
vi.mock("./dataforseoScraper");

describe("scrapeProspectSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockPage = (
    url: string,
    internalLinks: string[] = [],
  ): PageAnalysis => ({
    url,
    statusCode: 200,
    redirectUrl: null,
    responseTimeMs: 100,
    title: `Page ${url}`,
    metaDescription: "Description",
    canonical: null,
    robotsMeta: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    h1s: ["Heading 1"],
    headingOrder: [1],
    wordCount: 500,
    images: [],
    internalLinks,
    externalLinks: [],
    hasStructuredData: false,
    hreflangTags: [],
  });

  it("scrapes homepage and detects business links", async () => {
    const homepageLinks = [
      "/",
      "/products",
      "/about",
      "/contact",
      "/blog",
    ];

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", homepageLinks),
      costCents: 2,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com/products"),
      costCents: 2,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com/about"),
      costCents: 2,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com/contact"),
      costCents: 2,
    });

    const result = await scrapeProspectSite("example.com");

    expect(result.homepage.url).toBe("https://example.com");
    expect(result.businessLinks.products).toBe("https://example.com/products");
    expect(result.businessLinks.about).toBe("https://example.com/about");
    expect(result.businessLinks.contact).toBe("https://example.com/contact");
    expect(result.additionalPages).toHaveLength(3);
    expect(result.totalCostCents).toBe(8); // 4 pages * 2 cents
    expect(result.errors).toEqual([]);
  });

  it("limits to 4 total pages", async () => {
    const homepageLinks = [
      "/",
      "/products",
      "/about",
      "/contact",
      "/services",
      "/category/a",
      "/category/b",
    ];

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", homepageLinks),
      costCents: 2,
    });

    // Mock 3 additional successful scrapes
    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValue({
      success: true,
      page: createMockPage("https://example.com/products"),
      costCents: 2,
    });

    const result = await scrapeProspectSite("example.com");

    // Should scrape homepage + 3 more = 4 total
    expect(vi.mocked(dataforseoScraper.scrapeProspectPage)).toHaveBeenCalledTimes(4);
    expect(result.additionalPages).toHaveLength(3);
  });

  it("aggregates cost across all pages", async () => {
    const homepageLinks = ["/products", "/about"];

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", homepageLinks),
      costCents: 2.5,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com/products"),
      costCents: 2.0,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com/about"),
      costCents: 2.2,
    });

    const result = await scrapeProspectSite("example.com");

    expect(result.totalCostCents).toBe(6.7);
  });

  it("handles errors on individual pages", async () => {
    const homepageLinks = ["/products", "/about"];

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", homepageLinks),
      costCents: 2,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: false,
      error: "Page not found",
      costCents: 0,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com/about"),
      costCents: 2,
    });

    const result = await scrapeProspectSite("example.com");

    expect(result.additionalPages).toHaveLength(1); // Only /about succeeded
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      url: "https://example.com/products",
      error: "Page not found",
    });
    expect(result.totalCostCents).toBe(4); // Homepage + /about
  });

  it("normalizes domain to https:// URL", async () => {
    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", []),
      costCents: 2,
    });

    await scrapeProspectSite("example.com");

    expect(vi.mocked(dataforseoScraper.scrapeProspectPage)).toHaveBeenCalledWith(
      "https://example.com",
    );
  });

  it("handles domain with https:// already", async () => {
    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", []),
      costCents: 2,
    });

    await scrapeProspectSite("https://example.com");

    expect(vi.mocked(dataforseoScraper.scrapeProspectPage)).toHaveBeenCalledWith(
      "https://example.com",
    );
  });

  it("handles homepage scrape failure", async () => {
    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: false,
      error: "Connection timeout",
      costCents: 0,
    });

    await expect(scrapeProspectSite("example.com")).rejects.toThrow(
      "Failed to scrape homepage",
    );
  });

  it("scrapes no additional pages if no business links found", async () => {
    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", ["/"]), // Only homepage link
      costCents: 2,
    });

    const result = await scrapeProspectSite("example.com");

    expect(vi.mocked(dataforseoScraper.scrapeProspectPage)).toHaveBeenCalledTimes(1);
    expect(result.additionalPages).toHaveLength(0);
    expect(result.businessLinks.products).toBeNull();
    expect(result.businessLinks.about).toBeNull();
  });

  it("includes category pages in additional scrapes", async () => {
    const homepageLinks = ["/category/electronics", "/category/clothing"];

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValueOnce({
      success: true,
      page: createMockPage("https://example.com", homepageLinks),
      costCents: 2,
    });

    vi.mocked(dataforseoScraper.scrapeProspectPage).mockResolvedValue({
      success: true,
      page: createMockPage("https://example.com/category/electronics"),
      costCents: 2,
    });

    const result = await scrapeProspectSite("example.com");

    expect(result.businessLinks.categories).toHaveLength(2);
    // Should scrape first category
    expect(result.additionalPages.length).toBeGreaterThan(0);
  });
});
