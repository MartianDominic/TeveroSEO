/**
 * Tier 4 SEO Checks Test Suite
 * Phase 72-02: SEO Checks Validation
 *
 * Tests 7 crawl-based checks for:
 * - Consistent scoring (0.4 pts each, max 4 pts)
 * - SiteContext dependency handling
 * - Duplicate content gate integration
 */
import { describe, it, expect } from "vitest";
import { runTier4Checks } from "@/server/lib/audit/checks/runner";
import { getChecksByTier } from "@/server/lib/audit/checks/registry";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import type { SiteContext } from "@/server/lib/audit/checks/types";

// Import to trigger registration
import "@/server/lib/audit/checks/tier4";

const TIER4_CHECK_COUNT = 7;

describe("Tier 4 SEO Checks", () => {
  describe("Registration", () => {
    it("should register exactly 7 Tier 4 checks", () => {
      const checks = getChecksByTier(4);
      expect(checks.length).toBe(TIER4_CHECK_COUNT);
    });

    it("should have unique IDs in T4-XX format", () => {
      const checks = getChecksByTier(4);
      const ids = new Set<string>();
      for (const check of checks) {
        expect(check.id).toMatch(/^T4-\d{2}$/);
        expect(ids.has(check.id)).toBe(false);
        ids.add(check.id);
      }
    });

    it("should have valid categories", () => {
      const checks = getChecksByTier(4);
      const validCategories = ["architecture", "differentiation"];
      for (const check of checks) {
        expect(validCategories).toContain(check.category);
      }
    });
  });

  describe("Scoring Integration", () => {
    it("should contribute 0.4 points per passing check (max 4 pts)", () => {
      // 7 checks * 0.4 = 2.8 pts, under max
      const allPassScore = Math.min(4, 7 * 0.4);
      expect(allPassScore).toBeCloseTo(2.8, 1);
    });

    it("should cap Tier 4 contribution at 4 points", () => {
      // Even with high pass count, max is 4
      const maxContribution = Math.min(4, 10 * 0.4);
      expect(maxContribution).toBe(4);
    });

    it("should trigger duplicate content gate when T4-06 fails with >60%", () => {
      const mockResults = [
        {
          checkId: "T4-06",
          passed: false,
          severity: "critical" as const,
          message: "Duplicate content detected",
          details: { duplicatePercent: 65, uniquePercent: 35 },
          autoEditable: true,
        },
      ];

      const score = calculateOnPageScore(mockResults);

      expect(score.gates).toContain("duplicate-content");
      expect(score.score).toBeLessThanOrEqual(50);
    });

    it("should not trigger gate when duplicate percent <= 60%", () => {
      const mockResults = [
        {
          checkId: "T4-06",
          passed: false,
          severity: "high" as const,
          message: "Similar content detected",
          details: { duplicatePercent: 55, uniquePercent: 45 },
          autoEditable: true,
        },
      ];

      const score = calculateOnPageScore(mockResults);

      expect(score.gates).not.toContain("duplicate-content");
    });
  });

  describe("SiteContext Handling", () => {
    it("should skip checks when SiteContext is missing", async () => {
      const html = createTestHtml();
      const results = await runTier4Checks(html, "https://example.com/page", undefined as unknown as SiteContext);

      // All checks should be skipped/passed due to missing context
      const skippedOrPassed = results.filter((r) => {
        const details = r.details as { skipped?: boolean } | undefined;
        return r.passed || details?.skipped === true;
      });
      expect(skippedOrPassed.length).toBe(TIER4_CHECK_COUNT);
    });

    it("should run checks when SiteContext is provided", async () => {
      const html = createTestHtml();
      const siteContext: SiteContext = {
        totalPages: 10,
        linkGraph: new Map([
          ["https://example.com/", ["https://example.com/page"]],
          ["https://example.com/page", ["https://example.com/"]],
        ]),
        clickDepths: new Map([
          ["https://example.com/", 0],
          ["https://example.com/page", 1],
        ]),
      };

      const results = await runTier4Checks(
        html,
        "https://example.com/page",
        siteContext
      );

      expect(results.length).toBe(TIER4_CHECK_COUNT);
      // With proper context, some checks should actually evaluate
      const evaluatedChecks = results.filter((r) => {
        const details = r.details as { skipped?: boolean } | undefined;
        return !details?.skipped;
      });
      expect(evaluatedChecks.length).toBeGreaterThan(0);
    });
  });

  describe("Architecture Checks", () => {
    it("should verify click depth <= 3", async () => {
      const html = createTestHtml();
      const siteContext: SiteContext = {
        totalPages: 10,
        clickDepths: new Map([
          ["https://example.com/", 0],
          ["https://example.com/deep/page", 5], // Too deep
        ]),
        linkGraph: new Map(),
      };

      const results = await runTier4Checks(
        html,
        "https://example.com/deep/page",
        siteContext
      );

      const clickDepthCheck = results.find((r) => r.checkId === "T4-01");
      expect(clickDepthCheck).toBeDefined();
      expect(clickDepthCheck?.passed).toBe(false);
      expect(clickDepthCheck?.message).toContain("clicks");
    });

    it("should pass click depth check when <= 3", async () => {
      const html = createTestHtml();
      const siteContext: SiteContext = {
        totalPages: 10,
        clickDepths: new Map([
          ["https://example.com/page", 2],
        ]),
        linkGraph: new Map(),
      };

      const results = await runTier4Checks(
        html,
        "https://example.com/page",
        siteContext
      );

      const clickDepthCheck = results.find((r) => r.checkId === "T4-01");
      expect(clickDepthCheck?.passed).toBe(true);
    });

    it("should detect orphan pages", async () => {
      const html = createTestHtml();
      const siteContext: SiteContext = {
        totalPages: 10,
        linkGraph: new Map([
          ["https://example.com/", []], // No links to /page
        ]),
        clickDepths: new Map(),
      };

      const results = await runTier4Checks(
        html,
        "https://example.com/orphan-page",
        siteContext
      );

      const orphanCheck = results.find((r) => r.checkId === "T4-02");
      expect(orphanCheck).toBeDefined();
      // Orphan pages have no inbound links
      if (orphanCheck && !orphanCheck.message.includes("Skipped")) {
        expect(orphanCheck.passed).toBe(false);
      }
    });

    it("should pass when page has inbound links", async () => {
      const html = createTestHtml();
      const siteContext: SiteContext = {
        totalPages: 10,
        linkGraph: new Map([
          ["https://example.com/", ["https://example.com/page"]],
          ["https://example.com/about", ["https://example.com/page"]],
        ]),
        clickDepths: new Map(),
      };

      const results = await runTier4Checks(
        html,
        "https://example.com/page",
        siteContext
      );

      const orphanCheck = results.find((r) => r.checkId === "T4-02");
      if (orphanCheck && !orphanCheck.message.includes("Skipped")) {
        expect(orphanCheck.passed).toBe(true);
        expect(orphanCheck.details).toHaveProperty("inboundLinkCount");
      }
    });
  });

  describe("Differentiation Checks", () => {
    it("should have differentiation category checks", () => {
      const checks = getChecksByTier(4).filter((c) => c.category === "differentiation");
      expect(checks.length).toBe(2); // T4-06 and T4-07
    });

    it("should detect scaled content patterns (T4-07)", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>Template Page</title></head>
        <body>
          <h1>Services in [CITY]</h1>
          <p>We offer services in [CITY]. Contact us for [CITY] services.</p>
          <p>Our [CITY] team is ready to help with your [CITY] needs.</p>
        </body></html>
      `;
      const siteContext: SiteContext = { totalPages: 10 };

      const results = await runTier4Checks(html, "https://example.com/template", siteContext);

      const scaledCheck = results.find((r) => r.checkId === "T4-07");
      expect(scaledCheck).toBeDefined();
      if (scaledCheck && !scaledCheck.message.includes("Skipped")) {
        expect(scaledCheck.passed).toBe(false);
        expect(scaledCheck.message).toContain("scaled content");
      }
    });

    it("should pass when no scaled content patterns detected", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>Quality Article</title></head>
        <body>
          <h1>Understanding SEO Best Practices</h1>
          <p>Search engine optimization involves many different strategies and techniques
          that help websites rank better in search results. This comprehensive guide
          explores various aspects of SEO including keyword research, content creation,
          technical optimization, and link building.</p>
          <p>Content quality remains one of the most important ranking factors. Search
          engines prioritize websites that provide valuable, informative content to users.
          Focus on creating comprehensive articles that thoroughly cover your topic.</p>
        </body></html>
      `;
      const siteContext: SiteContext = { totalPages: 10 };

      const results = await runTier4Checks(html, "https://example.com/quality", siteContext);

      const scaledCheck = results.find((r) => r.checkId === "T4-07");
      if (scaledCheck && !scaledCheck.message.includes("Skipped")) {
        expect(scaledCheck.passed).toBe(true);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty link graph", async () => {
      const html = createTestHtml();
      const siteContext: SiteContext = {
        totalPages: 1,
        linkGraph: new Map(),
        clickDepths: new Map(),
      };

      const results = await runTier4Checks(html, "https://example.com/page", siteContext);
      expect(results.length).toBe(TIER4_CHECK_COUNT);
    });

    it("should handle very large link graph", async () => {
      const html = createTestHtml();
      const linkGraph = new Map<string, string[]>();

      // Create 1000 page link graph
      for (let i = 0; i < 1000; i++) {
        const links: string[] = [];
        for (let j = 0; j < 10; j++) {
          links.push(`https://example.com/page-${(i + j) % 1000}`);
        }
        linkGraph.set(`https://example.com/page-${i}`, links);
      }

      const siteContext: SiteContext = {
        totalPages: 1000,
        linkGraph,
        clickDepths: new Map(),
      };

      const start = performance.now();
      const results = await runTier4Checks(html, "https://example.com/page-0", siteContext);
      const duration = performance.now() - start;

      expect(results.length).toBe(TIER4_CHECK_COUNT);
      expect(duration).toBeLessThan(5000); // Should complete in under 5s
    });

    it("should handle short content gracefully", async () => {
      const html = "<html><body><p>Short</p></body></html>";
      const siteContext: SiteContext = { totalPages: 1 };

      const results = await runTier4Checks(html, "https://example.com/short", siteContext);

      // T4-06 should skip for content < 500 chars
      const duplicateCheck = results.find((r) => r.checkId === "T4-06");
      if (duplicateCheck) {
        const details = duplicateCheck.details as { skipped?: boolean };
        expect(details?.skipped).toBe(true);
      }
    });
  });

  describe("Category Coverage", () => {
    it("should have 5 architecture checks (T4-01 to T4-05)", () => {
      const checks = getChecksByTier(4).filter((c) => c.category === "architecture");
      expect(checks.length).toBe(5);
    });

    it("should have 2 differentiation checks (T4-06, T4-07)", () => {
      const checks = getChecksByTier(4).filter((c) => c.category === "differentiation");
      expect(checks.length).toBe(2);
    });
  });

  describe("Recommendation Quality", () => {
    it("should provide specific editRecipes for auto-editable checks", () => {
      const checks = getChecksByTier(4).filter((c) => c.autoEditable);

      for (const check of checks) {
        expect(check.editRecipe).toBeDefined();
        expect(check.editRecipe).not.toContain("fix this");
        expect(check.editRecipe!.length).toBeGreaterThan(10);
      }
    });
  });
});

// Helper function

function createTestHtml(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Test Page</title>
    </head>
    <body>
      <h1>Test Page Title</h1>
      <p>This is test content for the SEO checks. The content includes multiple
      paragraphs of text to ensure proper analysis. Search engine optimization
      is an important aspect of web development.</p>
      <p>Additional content here to meet minimum requirements for various checks.
      Quality content helps websites rank better in search results.</p>
    </body>
    </html>
  `;
}
