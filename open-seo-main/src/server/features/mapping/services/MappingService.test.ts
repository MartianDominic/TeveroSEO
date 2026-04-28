import { describe, it, expect } from "vitest";
import {
  mapKeywordToPage,
  mapKeywordsToPages,
  type KeywordData,
} from "./MappingService";
import type { PageContent } from "./relevance";

const samplePages: PageContent[] = [
  {
    url: "https://example.com/barrel-sauna",
    title: "Barrel Sauna Prices and Reviews",
    h1: "Complete Barrel Sauna Guide",
    content:
      "Looking for a barrel sauna? Our selection includes premium barrel sauna models from top brands.",
    wordCount: 500,
  },
  {
    url: "https://example.com/cabin-sauna",
    title: "Cabin Sauna Collection",
    h1: "Indoor Cabin Saunas",
    content:
      "Explore our cabin sauna selection. Perfect for indoor installation.",
    wordCount: 300,
  },
  {
    url: "https://example.com/blog/health",
    title: "Health Benefits of Sauna Use",
    h1: "Why Saunas Are Good For You",
    content:
      "Regular sauna use has many health benefits including improved circulation.",
    wordCount: 800,
  },
];

describe("mapKeywordToPage", () => {
  it("returns optimize with current URL when already ranking", () => {
    const keyword: KeywordData = {
      keyword: "barrel sauna",
      currentPosition: 8,
      currentUrl: "https://example.com/barrel-sauna",
    };

    const result = mapKeywordToPage(keyword, samplePages);

    expect(result.action).toBe("optimize");
    expect(result.targetUrl).toBe("https://example.com/barrel-sauna");
    expect(result.reason).toBe("Already position 8");
    expect(result.relevanceScore).toBeNull();
  });

  it("returns optimize with best match when not ranking but good match exists", () => {
    const keyword: KeywordData = {
      keyword: "barrel sauna",
      currentPosition: null,
      currentUrl: null,
    };

    const result = mapKeywordToPage(keyword, samplePages);

    expect(result.action).toBe("optimize");
    expect(result.targetUrl).toBe("https://example.com/barrel-sauna");
    expect(result.relevanceScore).toBeGreaterThanOrEqual(60);
    expect(result.reason).toContain("Best match");
  });

  it("returns create when no good match exists", () => {
    const keyword: KeywordData = {
      keyword: "electric sauna heater 9kw",
      currentPosition: null,
      currentUrl: null,
    };

    const result = mapKeywordToPage(keyword, samplePages);

    expect(result.action).toBe("create");
    expect(result.targetUrl).toBeNull();
    expect(result.reason).toContain("No existing page matches");
  });

  it("returns create when no pages in inventory", () => {
    const keyword: KeywordData = {
      keyword: "any keyword",
      currentPosition: null,
      currentUrl: null,
    };

    const result = mapKeywordToPage(keyword, []);

    expect(result.action).toBe("create");
    expect(result.reason).toBe("No pages in inventory");
  });

  it("selects highest relevance page when multiple match", () => {
    const keyword: KeywordData = {
      keyword: "sauna", // Generic term matches multiple pages
      currentPosition: null,
      currentUrl: null,
    };

    const result = mapKeywordToPage(keyword, samplePages);

    // Should pick a page based on highest score
    expect(result.action).toBe("optimize");
    expect(result.targetUrl).toBeTruthy();
    expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
  });

  it("ignores ranking position > 20", () => {
    const keyword: KeywordData = {
      keyword: "barrel sauna",
      currentPosition: 45, // Too low to consider "already ranking"
      currentUrl: "https://example.com/old-page",
    };

    const result = mapKeywordToPage(keyword, samplePages);

    // Should NOT use currentUrl, should find best match instead
    expect(result.action).toBe("optimize");
    expect(result.targetUrl).toBe("https://example.com/barrel-sauna");
    expect(result.reason).toContain("Best match");
  });

  it("enforces 60% relevance threshold", () => {
    // Create pages with low relevance
    const lowRelevancePages: PageContent[] = [
      {
        url: "https://example.com/contact",
        title: "Contact Us",
        content: "Get in touch with our team",
        wordCount: 50,
      },
    ];

    const keyword: KeywordData = {
      keyword: "premium barrel sauna installation",
      currentPosition: null,
      currentUrl: null,
    };

    const result = mapKeywordToPage(keyword, lowRelevancePages);

    expect(result.action).toBe("create");
    expect(result.relevanceScore).toBeLessThan(60);
  });
});

describe("mapKeywordsToPages", () => {
  it("maps multiple keywords in batch", () => {
    const keywords: KeywordData[] = [
      { keyword: "barrel sauna", currentPosition: null, currentUrl: null },
      { keyword: "cabin sauna", currentPosition: null, currentUrl: null },
      { keyword: "electric heater", currentPosition: null, currentUrl: null },
    ];

    const results = mapKeywordsToPages(keywords, samplePages);

    expect(results).toHaveLength(3);
    expect(results[0].action).toBe("optimize"); // barrel-sauna page
    expect(results[1].action).toBe("optimize"); // cabin-sauna page
    expect(results[2].action).toBe("create"); // no match
  });

  it("handles empty keywords array", () => {
    const results = mapKeywordsToPages([], samplePages);
    expect(results).toHaveLength(0);
  });
});
