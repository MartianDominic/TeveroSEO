/**
 * Consumer Adapter Integration Tests
 * Phase 95-06: Consumer Migration Wiring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { routeRequest } from "../MigrationRouter";
import { serpContentAdapter } from "./SerpContentAdapter";
import { competitorSpyAdapter } from "./CompetitorSpyAdapter";
import { prospectAnalysisAdapter } from "./ProspectAnalysisAdapter";
import { contentBriefsAdapter } from "./ContentBriefsAdapter";
import * as flagsModule from "../../config/flags-loader";
import type { ScrapeResult } from "../../ScrapingService";

// Mock ScrapingService
vi.mock("../../ScrapingService", () => ({
  scrapingService: {
    scrape: vi.fn().mockResolvedValue({
      success: true,
      url: "https://example.com",
      html: "<html><head><title>Test</title></head><body><h1>Hello</h1><h2>Section 1</h2><p>Content here</p></body></html>",
      statusCode: 200,
      tierUsed: "direct",
      fromCache: false,
      responseTimeMs: 100,
      responseSizeBytes: 500,
      estimatedCostUsd: 0,
      parsedData: {
        title: "Test",
        h1: ["Hello"],
        h2: ["Section 1"],
        wordCount: 2,
        internalLinks: [],
        externalLinks: [],
      },
    }),
    recordFallback: vi.fn(),
    recordShadowMismatch: vi.fn(),
  },
}));

describe("SerpContentAdapter", () => {
  beforeEach(() => {
    vi.spyOn(flagsModule, "loadMigrationFlagsCached").mockReturnValue({
      siteAudits: "legacy",
      hybridCrawler: "legacy",
      prospectAnalysis: "legacy",
      serpContent: "shadow", // Enable shadow for this test
      competitorSpy: "legacy",
      contentBriefs: "legacy",
      volumeRefresh: "legacy",
      crawlWorkflow: "legacy",
      voiceAnalysis: "legacy",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should route through shadow mode and compare outputs", async () => {
    const legacyFn = vi.fn().mockResolvedValue({
      url: "https://example.com",
      html: "<html>...</html>",
      title: "Test",
      wordCount: 100,
      fetchedAt: new Date(),
    });

    const result = await routeRequest({
      feature: "serpContent",
      input: { url: "https://example.com", keyword: "test" },
      legacyFn,
      adapter: serpContentAdapter,
    });

    // Should return legacy result in shadow mode
    expect(result.title).toBe("Test");
    expect(legacyFn).toHaveBeenCalled();
  });

  it("should skip new implementation in legacy mode", async () => {
    vi.spyOn(flagsModule, "loadMigrationFlagsCached").mockReturnValue({
      siteAudits: "legacy",
      hybridCrawler: "legacy",
      prospectAnalysis: "legacy",
      serpContent: "legacy",
      competitorSpy: "legacy",
      contentBriefs: "legacy",
      volumeRefresh: "legacy",
      crawlWorkflow: "legacy",
      voiceAnalysis: "legacy",
    });

    const legacyFn = vi.fn().mockResolvedValue({
      url: "https://example.com",
      html: "<html>...</html>",
      fetchedAt: new Date(),
    });

    const result = await routeRequest({
      feature: "serpContent",
      input: { url: "https://example.com", keyword: "test" },
      legacyFn,
      adapter: serpContentAdapter,
    });

    expect(legacyFn).toHaveBeenCalled();
    expect(result.url).toBe("https://example.com");
  });
});

describe("CompetitorSpyAdapter", () => {
  it("should convert ScrapeResult to CompetitorPageOutput", () => {
    const scrapeResult: ScrapeResult = {
      success: true,
      url: "https://competitor.com/page",
      html: "<html>...</html>",
      statusCode: 200,
      tierUsed: "direct",
      fromCache: false,
      responseTimeMs: 100,
      responseSizeBytes: 500,
      estimatedCostUsd: 0,
      parsedData: {
        wordCount: 500,
        h1: ["Main Heading"],
        h2: ["Sub 1", "Sub 2"],
      },
    };

    const output = competitorSpyAdapter.toConsumerOutput(scrapeResult, {
      url: "https://competitor.com/page",
      competitorDomain: "competitor.com",
    });

    expect(output.wordCount).toBe(500);
    expect(output.headings?.h1).toEqual(["Main Heading"]);
    expect(output.headings?.h2.length).toBe(2);
  });

  it("should compare outputs with 10% tolerance", () => {
    const legacy = {
      url: "https://example.com",
      html: "<html>...</html>",
      wordCount: 1000,
      headings: { h1: ["Test"], h2: ["A", "B"] },
      fetchedAt: new Date(),
    };

    const adapted = {
      url: "https://example.com",
      html: "<html>...</html>",
      wordCount: 1050, // 5% difference - should match
      headings: { h1: ["Test"], h2: ["A", "B"] },
      fetchedAt: new Date(),
    };

    const comparison = competitorSpyAdapter.compareOutputs(legacy, adapted);
    expect(comparison.match).toBe(true);
  });
});

describe("ProspectAnalysisAdapter", () => {
  it("should extract HTML and word count", () => {
    const scrapeResult: ScrapeResult = {
      success: true,
      url: "https://prospect.com",
      html: "<html><body>Prospect content</body></html>",
      statusCode: 200,
      tierUsed: "direct",
      fromCache: false,
      responseTimeMs: 100,
      responseSizeBytes: 500,
      estimatedCostUsd: 0,
      parsedData: {
        wordCount: 250,
      },
    };

    const output = prospectAnalysisAdapter.toConsumerOutput(scrapeResult, {
      url: "https://prospect.com",
      prospectId: "123",
      pageType: "homepage",
    });

    expect(output.html).toContain("Prospect content");
    expect(output.wordCount).toBe(250);
  });
});

describe("ContentBriefsAdapter", () => {
  it("should extract h2s and links", () => {
    const scrapeResult: ScrapeResult = {
      success: true,
      url: "https://competitor.com",
      html: "<html>...</html>",
      statusCode: 200,
      tierUsed: "direct",
      fromCache: false,
      responseTimeMs: 100,
      responseSizeBytes: 500,
      estimatedCostUsd: 0,
      parsedData: {
        title: "Article Title",
        h1: ["Main Heading"],
        h2: ["Section 1", "Section 2", "Section 3"],
        wordCount: 1500,
        internalLinks: [{ url: "/page1", text: "Link 1" }],
        externalLinks: [{ url: "https://external.com", text: "External" }],
      },
    };

    const output = contentBriefsAdapter.toConsumerOutput(scrapeResult, {
      url: "https://competitor.com",
      keyword: "test keyword",
      serpRank: 1,
    });

    expect(output.title).toBe("Article Title");
    expect(output.h2s.length).toBe(3);
    expect(output.internalLinks).toBe(1);
    expect(output.externalLinks).toBe(1);
  });

  it("should compare h2 counts", () => {
    const legacy = {
      url: "https://example.com",
      html: "<html>...</html>",
      title: "Test",
      h1: "Heading",
      h2s: ["A", "B", "C"],
      wordCount: 1000,
      internalLinks: 5,
      externalLinks: 3,
      fetchedAt: new Date(),
    };

    const adapted = {
      url: "https://example.com",
      html: "<html>...</html>",
      title: "Test",
      h1: "Heading",
      h2s: ["A", "B"], // Different count
      wordCount: 1000,
      internalLinks: 5,
      externalLinks: 3,
      fetchedAt: new Date(),
    };

    const comparison = contentBriefsAdapter.compareOutputs(legacy, adapted);
    expect(comparison.match).toBe(false);
    expect(comparison.differences.length).toBe(1);
    expect(comparison.differences[0].field).toBe("h2Count");
  });
});
