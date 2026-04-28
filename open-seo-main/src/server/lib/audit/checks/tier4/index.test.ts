/**
 * Tier 4 Checks Index Tests
 * Phase 32: 107 SEO Checks Implementation
 */
import { describe, it, expect } from "vitest";
import { verifyTier4Registration, getTier4Checks, TIER_4_CHECK_IDS } from "./index";
import { runTier4Checks } from "../runner";
import type { SiteContext } from "../types";

describe("Tier 4 Checks Index", () => {
  describe("registration", () => {
    it("should register all 7 Tier 4 checks", () => {
      const checks = getTier4Checks();
      expect(checks).toHaveLength(7);
    });

    it("should have all expected check IDs registered", () => {
      const result = verifyTier4Registration();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
    });

    it("should register checks with correct tiers", () => {
      const checks = getTier4Checks();
      for (const check of checks) {
        expect(check.tier).toBe(4);
      }
    });

    it("should register checks with valid categories", () => {
      const checks = getTier4Checks();
      const validCategories = ["architecture", "differentiation"];
      for (const check of checks) {
        expect(validCategories).toContain(check.category);
      }
    });
  });

  describe("Architecture checks (T4-01 to T4-05)", () => {
    const sampleHtml = "<html><head><title>Test</title></head><body><p>Content</p></body></html>";

    it("should check click depth with SiteContext", async () => {
      const siteContext: SiteContext = {
        totalPages: 10,
        linkGraph: new Map([
          ["https://example.com/", ["https://example.com/about"]],
        ]),
        clickDepths: new Map([
          ["https://example.com/", 0],
          ["https://example.com/about", 1],
          ["https://example.com/deep", 5],
        ]),
      };

      // Test page at depth 1 (should pass)
      const results1 = await runTier4Checks(sampleHtml, "https://example.com/about", siteContext);
      const depthResult1 = results1.find((r) => r.checkId === "T4-01");
      expect(depthResult1).toBeDefined();
      expect(depthResult1?.passed).toBe(true);
      expect(depthResult1?.details?.clickDepth).toBe(1);

      // Test page at depth 5 (should fail - exceeds 3)
      const results2 = await runTier4Checks(sampleHtml, "https://example.com/deep", siteContext);
      const depthResult2 = results2.find((r) => r.checkId === "T4-01");
      expect(depthResult2).toBeDefined();
      expect(depthResult2?.passed).toBe(false);
      expect(depthResult2?.details?.clickDepth).toBe(5);
    });

    it("should detect orphan pages (T4-02)", async () => {
      const siteContext: SiteContext = {
        totalPages: 3,
        linkGraph: new Map([
          ["https://example.com/", ["https://example.com/linked"]],
        ]),
        clickDepths: new Map([
          ["https://example.com/", 0],
          ["https://example.com/linked", 1],
        ]),
      };

      // Linked page should pass
      const results1 = await runTier4Checks(sampleHtml, "https://example.com/linked", siteContext);
      const orphanResult1 = results1.find((r) => r.checkId === "T4-02");
      expect(orphanResult1?.passed).toBe(true);

      // Orphan page (not in any linkGraph values) should fail
      const results2 = await runTier4Checks(sampleHtml, "https://example.com/orphan", siteContext);
      const orphanResult2 = results2.find((r) => r.checkId === "T4-02");
      expect(orphanResult2?.passed).toBe(false);
      expect(orphanResult2?.details?.isOrphan).toBe(true);
    });

    it("should skip hub-spoke checks without cluster data (T4-03, T4-04, T4-05)", async () => {
      const siteContext: SiteContext = {
        totalPages: 5,
        linkGraph: new Map(),
        clickDepths: new Map(),
      };

      const results = await runTier4Checks(sampleHtml, "https://example.com/page", siteContext);

      const t403 = results.find((r) => r.checkId === "T4-03");
      const t404 = results.find((r) => r.checkId === "T4-04");
      const t405 = results.find((r) => r.checkId === "T4-05");

      // These checks require topic cluster mapping which isn't in basic SiteContext
      expect(t403?.details?.skipped).toBe(true);
      expect(t404?.details?.skipped).toBe(true);
      expect(t405?.details?.skipped).toBe(true);
    });
  });

  describe("Differentiation checks (T4-06 to T4-07)", () => {
    it("should detect scaled content patterns (T4-07)", async () => {
      const siteContext: SiteContext = {
        totalPages: 5,
        linkGraph: new Map(),
        clickDepths: new Map(),
      };

      // HTML with template placeholders should fail
      const templateHtml = `
        <html><head><title>[CITY] Plumber Services</title></head>
        <body>
          <h1>Best [CITY] Plumber</h1>
          <p>Welcome to [CITY]! We offer plumbing in [LOCATION].</p>
          <p>Contact us for [KEYWORD] services in [CITY].</p>
        </body></html>
      `;

      const results1 = await runTier4Checks(templateHtml, "https://example.com/page", siteContext);
      const scaledResult1 = results1.find((r) => r.checkId === "T4-07");
      expect(scaledResult1?.passed).toBe(false);
      expect(scaledResult1?.severity).toBe("critical");
      expect(scaledResult1?.details?.warnings).toContain("Unfilled template placeholders detected");

      // Normal HTML should pass
      const normalHtml = `
        <html><head><title>Plumber Services in New York</title></head>
        <body>
          <h1>Professional Plumbing in New York City</h1>
          <p>We have been serving the New York area for over 20 years. Our team of certified plumbers provides reliable service for residential and commercial properties.</p>
          <p>Contact us today for a free estimate on your plumbing needs.</p>
        </body></html>
      `;

      const results2 = await runTier4Checks(normalHtml, "https://example.com/page", siteContext);
      const scaledResult2 = results2.find((r) => r.checkId === "T4-07");
      expect(scaledResult2?.passed).toBe(true);
    });

    it("should compute content fingerprint for T4-06", async () => {
      const siteContext: SiteContext = {
        totalPages: 5,
        linkGraph: new Map(),
        clickDepths: new Map(),
      };

      // Content with sufficient length should compute fingerprint
      const longContent = `
        <html><head><title>Test Page</title></head>
        <body>
          <article>
            <p>${"This is unique content that should be analyzed for differentiation. ".repeat(50)}</p>
          </article>
        </body></html>
      `;

      const results = await runTier4Checks(longContent, "https://example.com/page", siteContext);
      const diffResult = results.find((r) => r.checkId === "T4-06");
      expect(diffResult).toBeDefined();
      expect(diffResult?.details?.fingerprint).toBeDefined();
    });
  });

  describe("performance", () => {
    it("should execute all 7 Tier 4 checks in under 200ms", async () => {
      const html = `
        <html><head><title>Test</title></head>
        <body>
          <article>
            <p>${"Sample content for testing SEO checks performance. ".repeat(100)}</p>
          </article>
        </body></html>
      `;

      const siteContext: SiteContext = {
        totalPages: 100,
        linkGraph: new Map([
          ["https://example.com/", ["https://example.com/about", "https://example.com/contact"]],
          ["https://example.com/about", ["https://example.com/"]],
        ]),
        clickDepths: new Map([
          ["https://example.com/", 0],
          ["https://example.com/about", 1],
          ["https://example.com/test", 2],
        ]),
      };

      const start = performance.now();
      const results = await runTier4Checks(html, "https://example.com/test", siteContext);
      const duration = performance.now() - start;

      expect(results).toHaveLength(7);
      expect(duration).toBeLessThan(200);
    });
  });

  describe("missing SiteContext", () => {
    it("should skip checks when SiteContext not provided", async () => {
      const html = "<html><head><title>Test</title></head><body><p>Content</p></body></html>";
      const emptySiteContext: SiteContext = {
        totalPages: 0,
        linkGraph: new Map(),
        clickDepths: new Map(),
      };

      const results = await runTier4Checks(html, "https://example.com/page", emptySiteContext);

      // Architecture checks should skip when no crawl data
      const t401 = results.find((r) => r.checkId === "T4-01");
      expect(t401?.details?.skipped).toBe(true);
    });
  });
});
