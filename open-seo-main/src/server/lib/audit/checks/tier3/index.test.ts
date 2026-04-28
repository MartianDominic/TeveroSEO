/**
 * Tier 3 Checks Index Tests
 * Phase 32: 107 SEO Checks Implementation
 */
import { describe, it, expect } from "vitest";
import { verifyTier3Registration, getTier3Checks, TIER_3_CHECK_IDS } from "./index";
import { runTier3Checks } from "../runner";

describe("Tier 3 Checks Index", () => {
  describe("registration", () => {
    it("should register all 13 Tier 3 checks", () => {
      const checks = getTier3Checks();
      expect(checks).toHaveLength(13);
    });

    it("should have all expected check IDs registered", () => {
      const result = verifyTier3Registration();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
    });

    it("should register checks with correct tiers", () => {
      const checks = getTier3Checks();
      for (const check of checks) {
        expect(check.tier).toBe(3);
      }
    });

    it("should register checks with valid categories", () => {
      const checks = getTier3Checks();
      const validCategories = ["cwv", "entity-nlp", "backlinks", "engagement"];
      for (const check of checks) {
        expect(validCategories).toContain(check.category);
      }
    });
  });

  describe("CWV checks (T3-01 to T3-03)", () => {
    const sampleHtml = "<html><head><title>Test</title></head><body><p>Content</p></body></html>";

    it("should skip T3-01 (LCP) when API key not configured", async () => {
      const results = await runTier3Checks(sampleHtml, "https://example.com");
      const lcpResult = results.find((r) => r.checkId === "T3-01");
      expect(lcpResult).toBeDefined();
      expect(lcpResult?.details?.skipped).toBe(true);
      expect(lcpResult?.message).toContain("Skipped");
    });

    it("should skip T3-02 (INP) when API key not configured", async () => {
      const results = await runTier3Checks(sampleHtml, "https://example.com");
      const inpResult = results.find((r) => r.checkId === "T3-02");
      expect(inpResult).toBeDefined();
      expect(inpResult?.details?.skipped).toBe(true);
    });

    it("should skip T3-03 (CLS) when API key not configured", async () => {
      const results = await runTier3Checks(sampleHtml, "https://example.com");
      const clsResult = results.find((r) => r.checkId === "T3-03");
      expect(clsResult).toBeDefined();
      expect(clsResult?.details?.skipped).toBe(true);
    });
  });

  describe("Engagement checks (T3-11 to T3-13)", () => {
    const sampleHtml = "<html><head><title>Test</title></head><body><p>Content</p></body></html>";

    it("should skip T3-11 (CTR) when GSC not connected", async () => {
      const results = await runTier3Checks(sampleHtml, "https://example.com");
      const ctrResult = results.find((r) => r.checkId === "T3-11");
      expect(ctrResult).toBeDefined();
      expect(ctrResult?.details?.skipped).toBe(true);
      expect(ctrResult?.message).toContain("Search Console");
    });

    it("should skip T3-12 (scroll depth) when GA4 not connected", async () => {
      const results = await runTier3Checks(sampleHtml, "https://example.com");
      const scrollResult = results.find((r) => r.checkId === "T3-12");
      expect(scrollResult).toBeDefined();
      expect(scrollResult?.details?.skipped).toBe(true);
    });

    it("should skip T3-13 (bounce rate) when GA4 not connected", async () => {
      const results = await runTier3Checks(sampleHtml, "https://example.com");
      const bounceResult = results.find((r) => r.checkId === "T3-13");
      expect(bounceResult).toBeDefined();
      expect(bounceResult?.details?.skipped).toBe(true);
    });
  });

  describe("performance", () => {
    it("should execute all 13 Tier 3 checks in under 500ms", async () => {
      const html = "<html><head><title>Test</title></head><body><p>Test content for checks</p></body></html>";
      const start = performance.now();
      const results = await runTier3Checks(html, "https://example.com");
      const duration = performance.now() - start;

      expect(results).toHaveLength(13);
      expect(duration).toBeLessThan(500);
    });
  });
});
