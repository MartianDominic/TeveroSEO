import { describe, it, expect } from "vitest";
import { calculateRelevance, isGoodMatch } from "./relevance";

describe("calculateRelevance", () => {
  it("returns high score when keyword in title early", () => {
    const result = calculateRelevance("barrel sauna", {
      url: "https://example.com/products",
      title: "Barrel Sauna | Best Prices",
      content: "Some content about saunas",
      wordCount: 50,
    });
    expect(result.score).toBeGreaterThanOrEqual(35);
    expect(result.breakdown.title).toBe(35);
  });

  it("returns lower title score when keyword appears late", () => {
    const result = calculateRelevance("barrel sauna", {
      url: "https://example.com/products",
      title: "The Complete Guide to Purchasing Your Very Own Barrel Sauna",
      content: "Some content",
      wordCount: 10,
    });
    expect(result.breakdown.title).toBe(25);
  });

  it("returns score for H1 match", () => {
    const result = calculateRelevance("outdoor sauna", {
      url: "https://example.com/page",
      title: "Products Page",
      h1: "Best Outdoor Sauna Guide",
      content: "Content here",
      wordCount: 20,
    });
    expect(result.breakdown.h1).toBe(25);
  });

  it("returns score for URL slug match", () => {
    const result = calculateRelevance("cabin sauna", {
      url: "https://example.com/products/cabin-sauna",
      title: "Products",
      content: "Content",
      wordCount: 10,
    });
    expect(result.breakdown.urlSlug).toBe(15);
  });

  it("returns score for URL slug with underscores", () => {
    const result = calculateRelevance("cabin sauna", {
      url: "https://example.com/products/cabin_sauna",
      title: "Products",
      content: "Content",
      wordCount: 10,
    });
    expect(result.breakdown.urlSlug).toBe(15);
  });

  it("returns score for first 100 words match", () => {
    const result = calculateRelevance("infrared sauna", {
      url: "https://example.com/page",
      title: "Page Title",
      content:
        "Welcome to our infrared sauna guide. This comprehensive resource covers everything you need to know.",
      wordCount: 20,
    });
    expect(result.breakdown.firstContent).toBe(15);
  });

  it("returns 0 for firstContent when keyword not in first 100 words", () => {
    // Generate 100 words before the keyword
    const filler = Array(100).fill("word").join(" ");
    const result = calculateRelevance("infrared sauna", {
      url: "https://example.com/page",
      title: "Page Title",
      content: filler + " infrared sauna appears after 100 words",
      wordCount: 110,
    });
    expect(result.breakdown.firstContent).toBe(0);
  });

  it("calculates body frequency score", () => {
    const result = calculateRelevance("sauna", {
      url: "https://example.com/page",
      title: "Page",
      content:
        "This sauna guide covers sauna types. A sauna is great for health. Learn about sauna benefits.",
      wordCount: 20,
    });
    expect(result.breakdown.bodyFrequency).toBeGreaterThan(0);
    expect(result.matchDetails).toEqual(
      expect.arrayContaining([expect.stringMatching(/occurrences/)]),
    );
  });

  it("returns combined score for multiple matches", () => {
    const result = calculateRelevance("barrel sauna", {
      url: "https://example.com/barrel-sauna",
      title: "Barrel Sauna Prices and Reviews",
      h1: "Complete Barrel Sauna Guide",
      content:
        "Looking for a barrel sauna? Our barrel sauna selection includes the best barrel sauna models.",
      wordCount: 20,
    });
    // Should have title (35) + h1 (25) + url (15) + first content (15) + frequency
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("returns 0 when no match", () => {
    const result = calculateRelevance("electric heater", {
      url: "https://example.com/products",
      title: "Barrel Sauna Guide",
      h1: "All About Saunas",
      content: "Learn about barrel saunas and cabin saunas",
      wordCount: 10,
    });
    expect(result.score).toBe(0);
    expect(result.matchDetails).toHaveLength(0);
  });

  it("caps score at 100", () => {
    const result = calculateRelevance("sauna", {
      url: "https://example.com/sauna",
      title: "Sauna Guide",
      h1: "Sauna Types",
      content: "Sauna sauna sauna sauna sauna sauna sauna sauna sauna sauna",
      wordCount: 10,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles null title gracefully", () => {
    const result = calculateRelevance("barrel sauna", {
      url: "https://example.com/products",
      title: null,
      content: "Content about barrel sauna",
      wordCount: 5,
    });
    expect(result.breakdown.title).toBe(0);
  });

  it("handles null h1 gracefully", () => {
    const result = calculateRelevance("barrel sauna", {
      url: "https://example.com/products",
      title: "Barrel Sauna",
      h1: null,
      content: "Content",
      wordCount: 5,
    });
    expect(result.breakdown.h1).toBe(0);
  });

  it("handles missing content gracefully", () => {
    const result = calculateRelevance("barrel sauna", {
      url: "https://example.com/barrel-sauna",
      title: "Barrel Sauna",
    });
    expect(result.breakdown.firstContent).toBe(0);
    expect(result.breakdown.bodyFrequency).toBe(0);
  });

  it("handles invalid URL gracefully", () => {
    const result = calculateRelevance("barrel sauna", {
      url: "not-a-valid-url",
      title: "Barrel Sauna",
    });
    expect(result.breakdown.urlSlug).toBe(0);
  });

  it("is case insensitive", () => {
    const result = calculateRelevance("BARREL SAUNA", {
      url: "https://example.com/products",
      title: "barrel sauna guide",
      content: "Content",
      wordCount: 5,
    });
    expect(result.breakdown.title).toBe(35);
  });

  it("handles multi-word keywords in URL", () => {
    const result = calculateRelevance("best barrel sauna", {
      url: "https://example.com/best-barrel-sauna-guide",
      title: "Guide",
      content: "Content",
      wordCount: 5,
    });
    expect(result.breakdown.urlSlug).toBe(15);
  });
});

describe("isGoodMatch", () => {
  it("returns true for score >= 60", () => {
    expect(isGoodMatch(60)).toBe(true);
    expect(isGoodMatch(80)).toBe(true);
    expect(isGoodMatch(100)).toBe(true);
  });

  it("returns false for score < 60", () => {
    expect(isGoodMatch(59)).toBe(false);
    expect(isGoodMatch(0)).toBe(false);
  });
});
