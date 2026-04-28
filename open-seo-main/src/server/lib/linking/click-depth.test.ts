/**
 * Tests for click-depth BFS algorithm.
 * Phase 35-02: Opportunity Detection
 */
import { describe, it, expect } from "vitest";
import { computeClickDepths, type LinkEdge } from "./click-depth";

describe("click-depth", () => {
  describe("computeClickDepths", () => {
    it("returns depth 0 for homepage", () => {
      const edges: LinkEdge[] = [];
      const homepageUrl = "https://example.com/";

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl],
      });

      expect(result.depths.get(homepageUrl)).toBe(0);
    });

    it("returns depth 1 for pages directly linked from homepage", () => {
      const homepageUrl = "https://example.com/";
      const page1 = "https://example.com/page1";
      const page2 = "https://example.com/page2";

      const edges: LinkEdge[] = [
        { sourceUrl: homepageUrl, targetUrl: page1 },
        { sourceUrl: homepageUrl, targetUrl: page2 },
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl, page1, page2],
      });

      expect(result.depths.get(homepageUrl)).toBe(0);
      expect(result.depths.get(page1)).toBe(1);
      expect(result.depths.get(page2)).toBe(1);
    });

    it("computes multi-level depths correctly", () => {
      const homepageUrl = "https://example.com/";
      const level1 = "https://example.com/level1";
      const level2 = "https://example.com/level2";
      const level3 = "https://example.com/level3";

      const edges: LinkEdge[] = [
        { sourceUrl: homepageUrl, targetUrl: level1 },
        { sourceUrl: level1, targetUrl: level2 },
        { sourceUrl: level2, targetUrl: level3 },
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl, level1, level2, level3],
      });

      expect(result.depths.get(homepageUrl)).toBe(0);
      expect(result.depths.get(level1)).toBe(1);
      expect(result.depths.get(level2)).toBe(2);
      expect(result.depths.get(level3)).toBe(3);
    });

    it("finds shortest path when multiple routes exist", () => {
      const homepageUrl = "https://example.com/";
      const pageA = "https://example.com/a";
      const pageB = "https://example.com/b";
      const target = "https://example.com/target";

      // Route 1: homepage -> A -> target (depth 2)
      // Route 2: homepage -> B -> A -> target (depth 3)
      // Route 3: homepage -> target (depth 1) - shortest!
      const edges: LinkEdge[] = [
        { sourceUrl: homepageUrl, targetUrl: pageA },
        { sourceUrl: homepageUrl, targetUrl: pageB },
        { sourceUrl: homepageUrl, targetUrl: target }, // Direct link
        { sourceUrl: pageA, targetUrl: target },
        { sourceUrl: pageB, targetUrl: pageA },
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl, pageA, pageB, target],
      });

      expect(result.depths.get(target)).toBe(1); // Shortest path
    });

    it("marks unreachable pages as Infinity", () => {
      const homepageUrl = "https://example.com/";
      const connected = "https://example.com/connected";
      const orphan = "https://example.com/orphan";

      const edges: LinkEdge[] = [
        { sourceUrl: homepageUrl, targetUrl: connected },
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl, connected, orphan],
      });

      expect(result.depths.get(homepageUrl)).toBe(0);
      expect(result.depths.get(connected)).toBe(1);
      expect(result.depths.get(orphan)).toBe(Infinity);
      expect(result.unreachableUrls).toContain(orphan);
    });

    it("caps depth at maxDepth (default 10)", () => {
      const homepageUrl = "https://example.com/";
      const pages: string[] = [homepageUrl];
      const edges: LinkEdge[] = [];

      // Create a chain of 15 pages
      for (let i = 1; i <= 15; i++) {
        const pageUrl = `https://example.com/page${i}`;
        pages.push(pageUrl);
        edges.push({
          sourceUrl: i === 1 ? homepageUrl : `https://example.com/page${i - 1}`,
          targetUrl: pageUrl,
        });
      }

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: pages,
        maxDepth: 10,
      });

      // Pages 1-10 should have depths 1-10
      expect(result.depths.get("https://example.com/page10")).toBe(10);
      // Pages 11-15 should be marked as unreachable (beyond max depth)
      expect(result.depths.get("https://example.com/page11")).toBe(Infinity);
      expect(result.unreachableUrls).toContain("https://example.com/page15");
    });

    it("caps iterations at maxIterations (default 10000)", () => {
      const homepageUrl = "https://example.com/";
      const pages: string[] = [homepageUrl];
      const edges: LinkEdge[] = [];

      // Create many pages at depth 1
      for (let i = 1; i <= 100; i++) {
        const pageUrl = `https://example.com/page${i}`;
        pages.push(pageUrl);
        edges.push({ sourceUrl: homepageUrl, targetUrl: pageUrl });
      }

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: pages,
        maxIterations: 50, // Limit iterations
      });

      // Should process homepage + some pages, then stop
      expect(result.iterationsUsed).toBeLessThanOrEqual(50);
      // Some pages may be unreachable due to iteration cap
      expect(result.cappedAtIterations).toBe(true);
    });

    it("handles cycles without infinite loops", () => {
      const homepageUrl = "https://example.com/";
      const pageA = "https://example.com/a";
      const pageB = "https://example.com/b";

      // Create a cycle: homepage -> A -> B -> A
      const edges: LinkEdge[] = [
        { sourceUrl: homepageUrl, targetUrl: pageA },
        { sourceUrl: pageA, targetUrl: pageB },
        { sourceUrl: pageB, targetUrl: pageA }, // Cycle back to A
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl, pageA, pageB],
      });

      // Should not infinite loop, depths should be correct
      expect(result.depths.get(homepageUrl)).toBe(0);
      expect(result.depths.get(pageA)).toBe(1);
      expect(result.depths.get(pageB)).toBe(2);
    });

    it("handles homepage without trailing slash normalization", () => {
      const homepageUrl = "https://example.com";
      const page1 = "https://example.com/page1";

      const edges: LinkEdge[] = [
        { sourceUrl: "https://example.com/", targetUrl: page1 }, // With slash
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl, page1],
        normalizeUrls: true,
      });

      // Should still work with URL normalization
      expect(result.depths.get(page1)).toBeDefined();
    });

    it("returns statistics about the crawl", () => {
      const homepageUrl = "https://example.com/";
      const page1 = "https://example.com/page1";

      const edges: LinkEdge[] = [
        { sourceUrl: homepageUrl, targetUrl: page1 },
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: [homepageUrl, page1],
      });

      expect(result.totalPages).toBe(2);
      expect(result.reachablePages).toBe(2);
      expect(result.maxDepthFound).toBe(1);
      expect(result.iterationsUsed).toBeGreaterThan(0);
      expect(result.cappedAtIterations).toBe(false);
    });

    it("returns empty result for empty input", () => {
      const result = computeClickDepths({
        edges: [],
        homepageUrl: "https://example.com/",
        allPageUrls: [],
      });

      expect(result.depths.size).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it("handles pages at exactly depth 3 (opportunity threshold)", () => {
      const homepageUrl = "https://example.com/";
      const pages = [
        homepageUrl,
        "https://example.com/l1",
        "https://example.com/l2",
        "https://example.com/l3",
        "https://example.com/l4",
      ];

      const edges: LinkEdge[] = [
        { sourceUrl: pages[0], targetUrl: pages[1] }, // depth 1
        { sourceUrl: pages[1], targetUrl: pages[2] }, // depth 2
        { sourceUrl: pages[2], targetUrl: pages[3] }, // depth 3
        { sourceUrl: pages[3], targetUrl: pages[4] }, // depth 4
      ];

      const result = computeClickDepths({
        edges,
        homepageUrl,
        allPageUrls: pages,
      });

      // Pages with depth > 3 are candidates for depth_reduction
      const deepPages: [string, number][] = [];
      for (const [url, depth] of result.depths) {
        if (depth > 3 && depth !== Infinity) {
          deepPages.push([url, depth]);
        }
      }

      expect(deepPages).toHaveLength(1);
      expect(deepPages[0][0]).toBe("https://example.com/l4");
      expect(deepPages[0][1]).toBe(4);
    });
  });
});
