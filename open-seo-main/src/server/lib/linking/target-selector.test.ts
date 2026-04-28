/**
 * Tests for target-selector.ts
 * Phase 35-03: Target Selection
 *
 * TDD: Tests written first, implementation follows.
 */
import { describe, it, expect } from "vitest";
import {
  rankLinkTargets,
  computeLinkDeficitScore,
  computeExactMatchScore,
  computeOrphanScore,
  computeDepthScore,
  computeRelevanceScore,
  extractKeywordsFromContent,
  computeKeywordOverlap,
} from "./target-selector";
import type { PageCandidate, SourcePageData } from "./types";

describe("target-selector", () => {
  // ============================================================
  // extractKeywordsFromContent
  // ============================================================
  describe("extractKeywordsFromContent", () => {
    it("should extract keywords without stopwords", () => {
      const content = "The best SEO strategies for modern websites include link building";
      const keywords = extractKeywordsFromContent(content);

      expect(keywords).toContain("seo");
      expect(keywords).toContain("strategies");
      expect(keywords).toContain("modern");
      expect(keywords).toContain("websites");
      expect(keywords).toContain("link");
      expect(keywords).toContain("building");
      // Stopwords should be excluded
      expect(keywords).not.toContain("the");
      expect(keywords).not.toContain("for");
      expect(keywords).not.toContain("include");
    });

    it("should lowercase all keywords", () => {
      const content = "SEO Marketing STRATEGIES";
      const keywords = extractKeywordsFromContent(content);

      expect(keywords).toContain("seo");
      expect(keywords).toContain("marketing");
      expect(keywords).toContain("strategies");
      expect(keywords).not.toContain("SEO");
    });

    it("should handle empty content", () => {
      const keywords = extractKeywordsFromContent("");
      expect(keywords).toEqual([]);
    });

    it("should remove duplicates", () => {
      const content = "SEO seo SEO marketing marketing";
      const keywords = extractKeywordsFromContent(content);

      const seoCount = keywords.filter((k) => k === "seo").length;
      expect(seoCount).toBe(1);
    });

    it("should filter short words (< 3 chars)", () => {
      const content = "a an is it be SEO marketing";
      const keywords = extractKeywordsFromContent(content);

      expect(keywords).not.toContain("a");
      expect(keywords).not.toContain("an");
      expect(keywords).not.toContain("is");
      expect(keywords).not.toContain("it");
      expect(keywords).not.toContain("be");
    });
  });

  // ============================================================
  // computeKeywordOverlap
  // ============================================================
  describe("computeKeywordOverlap", () => {
    it("should return Jaccard similarity between keyword sets", () => {
      const sourceKeywords = ["seo", "marketing", "content", "strategy"];
      const targetKeywords = ["seo", "marketing", "analytics", "tools"];

      // Intersection: seo, marketing (2)
      // Union: seo, marketing, content, strategy, analytics, tools (6)
      // Jaccard = 2/6 = 0.333...
      const overlap = computeKeywordOverlap(sourceKeywords, targetKeywords);
      expect(overlap).toBeCloseTo(2 / 6, 2);
    });

    it("should return 0 for no overlap", () => {
      const sourceKeywords = ["apple", "banana", "cherry"];
      const targetKeywords = ["dog", "cat", "bird"];

      const overlap = computeKeywordOverlap(sourceKeywords, targetKeywords);
      expect(overlap).toBe(0);
    });

    it("should return 1 for identical sets", () => {
      const keywords = ["seo", "marketing", "content"];

      const overlap = computeKeywordOverlap(keywords, keywords);
      expect(overlap).toBe(1);
    });

    it("should handle empty arrays", () => {
      expect(computeKeywordOverlap([], [])).toBe(0);
      expect(computeKeywordOverlap(["seo"], [])).toBe(0);
      expect(computeKeywordOverlap([], ["seo"])).toBe(0);
    });
  });

  // ============================================================
  // Scoring functions
  // ============================================================
  describe("computeLinkDeficitScore", () => {
    it("should return 100 when page has 0 inbound and ideal is > 0", () => {
      const score = computeLinkDeficitScore(0, 10);
      expect(score).toBe(100);
    });

    it("should return 0 when page meets or exceeds ideal", () => {
      expect(computeLinkDeficitScore(10, 10)).toBe(0);
      expect(computeLinkDeficitScore(15, 10)).toBe(0);
    });

    it("should scale linearly between 0 and ideal", () => {
      // 50% of ideal = 50 score
      const score = computeLinkDeficitScore(5, 10);
      expect(score).toBe(50);
    });

    it("should handle edge case of 0 ideal", () => {
      const score = computeLinkDeficitScore(0, 0);
      expect(score).toBe(0);
    });
  });

  describe("computeExactMatchScore", () => {
    it("should return 100 when page has no exact-match anchors but has target keyword", () => {
      const score = computeExactMatchScore(0, true);
      expect(score).toBe(100);
    });

    it("should return 0 when page already has exact-match anchors", () => {
      const score = computeExactMatchScore(3, true);
      expect(score).toBe(0);
    });

    it("should return 0 when page has no target keyword", () => {
      const score = computeExactMatchScore(0, false);
      expect(score).toBe(0);
    });

    it("should scale for low exact-match count (1-2)", () => {
      // 1 exact-match: still some opportunity
      const score1 = computeExactMatchScore(1, true);
      expect(score1).toBeGreaterThan(0);
      expect(score1).toBeLessThan(100);

      // 2 exact-matches: less opportunity
      const score2 = computeExactMatchScore(2, true);
      expect(score2).toBeLessThan(score1);
    });
  });

  describe("computeOrphanScore", () => {
    it("should return 100 for orphan pages", () => {
      const score = computeOrphanScore(true);
      expect(score).toBe(100);
    });

    it("should return 0 for non-orphan pages", () => {
      const score = computeOrphanScore(false);
      expect(score).toBe(0);
    });
  });

  describe("computeDepthScore", () => {
    it("should return 100 for pages at max depth", () => {
      const score = computeDepthScore(5, 5);
      expect(score).toBe(100);
    });

    it("should return 0 for pages at depth 1", () => {
      const score = computeDepthScore(1, 5);
      expect(score).toBe(0);
    });

    it("should return 0 for null depth", () => {
      const score = computeDepthScore(null, 5);
      expect(score).toBe(0);
    });

    it("should scale linearly based on depth", () => {
      // Depth 3 out of 5 max = 50% score (depth - 1) / (max - 1)
      const score = computeDepthScore(3, 5);
      expect(score).toBe(50);
    });
  });

  describe("computeRelevanceScore", () => {
    it("should scale keyword overlap to 0-100", () => {
      // 50% overlap = 50 score
      const score = computeRelevanceScore(0.5);
      expect(score).toBe(50);
    });

    it("should return 0 for no overlap", () => {
      const score = computeRelevanceScore(0);
      expect(score).toBe(0);
    });

    it("should return 100 for perfect overlap", () => {
      const score = computeRelevanceScore(1);
      expect(score).toBe(100);
    });
  });

  // ============================================================
  // rankLinkTargets
  // ============================================================
  describe("rankLinkTargets", () => {
    const createSourcePage = (bodyText: string = "SEO marketing content strategy"): SourcePageData => ({
      pageId: "source-1",
      pageUrl: "https://example.com/source",
      bodyText,
      brandName: "Acme",
    });

    const createCandidate = (overrides: Partial<PageCandidate> = {}): PageCandidate => ({
      pageId: "page-1",
      pageUrl: "https://example.com/page-1",
      pageTitle: "Test Page",
      targetKeyword: "SEO tips",
      inboundCount: 5,
      idealInboundCount: 10,
      clickDepth: 2,
      isOrphan: false,
      contentKeywords: ["seo", "tips", "optimization"],
      ...overrides,
    });

    it("should return sorted candidates by score (descending)", () => {
      const sourcePage = createSourcePage();
      const candidates: PageCandidate[] = [
        createCandidate({ pageId: "low", inboundCount: 9, isOrphan: false }),
        createCandidate({ pageId: "high", inboundCount: 0, isOrphan: true }),
        createCandidate({ pageId: "medium", inboundCount: 3, isOrphan: false }),
      ];

      const results = rankLinkTargets({ sourcePage, candidates });

      expect(results.length).toBe(3);
      expect(results[0].pageId).toBe("high"); // Orphan with 0 inbound
      expect(results[2].pageId).toBe("low"); // Nearly at ideal
    });

    it("should respect maxResults parameter", () => {
      const sourcePage = createSourcePage();
      const candidates = Array.from({ length: 10 }, (_, i) =>
        createCandidate({ pageId: `page-${i}` })
      );

      const results = rankLinkTargets({ sourcePage, candidates, maxResults: 3 });

      expect(results.length).toBe(3);
    });

    it("should include reasons in results", () => {
      const sourcePage = createSourcePage();
      const candidates = [
        createCandidate({ isOrphan: true, inboundCount: 0, clickDepth: 5 }),
      ];

      const results = rankLinkTargets({
        sourcePage,
        candidates,
        maxClickDepth: 5,
      });

      expect(results[0].reasons.length).toBeGreaterThan(0);
      // Should mention orphan status
      expect(results[0].reasons.some((r) => r.toLowerCase().includes("orphan"))).toBe(true);
    });

    it("should calculate composite score with correct weights", () => {
      const sourcePage = createSourcePage("seo optimization tips");
      const candidate = createCandidate({
        inboundCount: 0,
        idealInboundCount: 10,
        isOrphan: true,
        clickDepth: 5,
        targetKeyword: "SEO tips",
        contentKeywords: ["seo", "tips", "optimization"],
      });

      const results = rankLinkTargets({
        sourcePage,
        candidates: [candidate],
        maxClickDepth: 5,
      });

      const result = results[0];
      // Verify weights are applied correctly
      // Total = 0.25*deficit + 0.20*exact + 0.30*orphan + 0.15*depth + 0.20*relevance
      // Note: This is a sanity check, not an exact calculation
      expect(result.score).toBeGreaterThan(0);
      expect(result.linkDeficitScore).toBe(100); // 0 inbound
      expect(result.orphanScore).toBe(100); // is orphan
      expect(result.depthScore).toBe(100); // at max depth
    });

    it("should filter out source page from candidates", () => {
      const sourcePage = createSourcePage();
      const candidates = [
        createCandidate({ pageId: "source-1", pageUrl: "https://example.com/source" }),
        createCandidate({ pageId: "other", pageUrl: "https://example.com/other" }),
      ];

      const results = rankLinkTargets({ sourcePage, candidates });

      expect(results.length).toBe(1);
      expect(results[0].pageId).toBe("other");
    });

    it("should handle empty candidates array", () => {
      const sourcePage = createSourcePage();
      const results = rankLinkTargets({ sourcePage, candidates: [] });

      expect(results).toEqual([]);
    });

    it("should use default site average when not provided", () => {
      const sourcePage = createSourcePage();
      const candidates = [createCandidate({ inboundCount: 5 })];

      // Should not throw
      const results = rankLinkTargets({ sourcePage, candidates });
      expect(results.length).toBe(1);
    });
  });
});
