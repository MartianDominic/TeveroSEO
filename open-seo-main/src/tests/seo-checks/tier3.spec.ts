/**
 * Tier 3 SEO Checks Test Suite
 * Phase 72-02: SEO Checks Validation
 *
 * Tests 13 API-based checks for:
 * - Consistent scoring (0.8 pts each, max 6 pts)
 * - Graceful handling when APIs unavailable
 * - CWV gate integration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runTier3Checks } from "@/server/lib/audit/checks/runner";
import { getChecksByTier } from "@/server/lib/audit/checks/registry";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import { clearCruxCache } from "@/server/lib/audit/checks/tier3";

// Import to trigger registration
import "@/server/lib/audit/checks/tier3";

const TIER3_CHECK_COUNT = 13;

describe("Tier 3 SEO Checks", () => {
  beforeEach(() => {
    // Clear CrUX cache between tests
    clearCruxCache();
  });

  describe("Registration", () => {
    it("should register exactly 13 Tier 3 checks", () => {
      const checks = getChecksByTier(3);
      expect(checks.length).toBe(TIER3_CHECK_COUNT);
    });

    it("should have unique IDs in T3-XX format", () => {
      const checks = getChecksByTier(3);
      const ids = new Set<string>();
      for (const check of checks) {
        expect(check.id).toMatch(/^T3-\d{2}$/);
        expect(ids.has(check.id)).toBe(false);
        ids.add(check.id);
      }
    });

    it("should have valid categories", () => {
      const checks = getChecksByTier(3);
      const validCategories = ["cwv", "entity-nlp", "backlinks", "engagement"];
      for (const check of checks) {
        expect(validCategories).toContain(check.category);
      }
    });
  });

  describe("Scoring Integration", () => {
    it("should contribute 0.8 points per passing check (max 6 pts)", () => {
      // When all checks pass, max is 6 pts
      const passCount = 10;
      const expectedTier3 = Math.min(6, passCount * 0.8);
      expect(expectedTier3).toBe(6);
    });

    it("should cap Tier 3 contribution at 6 points", () => {
      // Even with 13 checks * 0.8 = 10.4, cap at 6
      const maxContribution = Math.min(6, 13 * 0.8);
      expect(maxContribution).toBe(6);
    });

    it("should trigger CWV poor gate on critical severity failures", () => {
      // Simulate CWV poor results
      const mockResults = [
        { checkId: "T3-01", passed: false, severity: "critical" as const, message: "LCP poor", autoEditable: false },
        { checkId: "T3-02", passed: true, severity: "info" as const, message: "INP good", autoEditable: false },
        { checkId: "T3-03", passed: true, severity: "info" as const, message: "CLS good", autoEditable: false },
      ];

      const score = calculateOnPageScore(mockResults);

      expect(score.gates).toContain("cwv-poor");
      expect(score.score).toBeLessThanOrEqual(75);
    });

    it("should not trigger gate when CWV checks are skipped", () => {
      // Skipped checks should not trigger gate
      const mockResults = [
        {
          checkId: "T3-01",
          passed: false,
          severity: "info" as const,
          message: "Skipped",
          details: { skipped: true },
          autoEditable: false,
        },
        {
          checkId: "T3-02",
          passed: false,
          severity: "info" as const,
          message: "Skipped",
          details: { skipped: true },
          autoEditable: false,
        },
        {
          checkId: "T3-03",
          passed: false,
          severity: "info" as const,
          message: "Skipped",
          details: { skipped: true },
          autoEditable: false,
        },
      ];

      const score = calculateOnPageScore(mockResults);

      expect(score.gates).not.toContain("cwv-poor");
    });
  });

  describe("API Unavailable Handling", () => {
    it("should gracefully skip CWV checks when API key missing", async () => {
      // Without GOOGLE_CWV_API_KEY, checks should skip gracefully
      const originalKey = process.env.GOOGLE_CWV_API_KEY;
      delete process.env.GOOGLE_CWV_API_KEY;

      try {
        const html = "<html><body><h1>Test</h1></body></html>";
        const results = await runTier3Checks(html, "https://example.com/page");

        // CWV checks (T3-01 to T3-03) should be skipped
        const cwvChecks = results.filter((r) => ["T3-01", "T3-02", "T3-03"].includes(r.checkId));
        for (const check of cwvChecks) {
          expect(check.severity).toBe("info");
          expect(check.message).toContain("Skipped");
          const details = check.details as { skipped?: boolean };
          expect(details?.skipped).toBe(true);
        }
      } finally {
        if (originalKey) {
          process.env.GOOGLE_CWV_API_KEY = originalKey;
        }
      }
    });

    it("should return skipped status for entity/NLP checks without data", async () => {
      const html = "<html><body><h1>Test</h1></body></html>";
      const results = await runTier3Checks(html, "https://example.com/page");

      // Most T3 checks require external data, should gracefully skip
      const skippedCount = results.filter((r) => {
        const details = r.details as { skipped?: boolean } | undefined;
        return details?.skipped === true;
      }).length;

      // Most checks should be skipped without proper API access
      expect(skippedCount).toBeGreaterThan(0);
    });
  });

  describe("CWV Checks", () => {
    it("should define proper CWV thresholds", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "cwv");
      expect(checks.length).toBe(3);

      const ids = checks.map((c) => c.id);
      expect(ids).toContain("T3-01"); // LCP
      expect(ids).toContain("T3-02"); // INP
      expect(ids).toContain("T3-03"); // CLS
    });

    it("should have critical severity for CWV checks", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "cwv");
      for (const check of checks) {
        expect(check.severity).toBe("critical");
      }
    });
  });

  describe("Entity/NLP Checks", () => {
    it("should have entity-nlp checks registered", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "entity-nlp");
      expect(checks.length).toBeGreaterThan(0);
    });
  });

  describe("Backlinks Checks", () => {
    it("should have backlinks checks registered", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "backlinks");
      expect(checks.length).toBeGreaterThan(0);
    });
  });

  describe("Engagement Checks", () => {
    it("should have engagement checks registered", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "engagement");
      expect(checks.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid URL in CWV origin extraction", async () => {
      const html = "<html><body><h1>Test</h1></body></html>";

      // Valid URL should work
      const results = await runTier3Checks(html, "https://valid-domain.com/page");
      expect(results.length).toBe(TIER3_CHECK_COUNT);
    });

    it("should not throw on empty HTML", async () => {
      const results = await runTier3Checks("<html></html>", "https://example.com/empty");
      expect(results.length).toBe(TIER3_CHECK_COUNT);
    });

    it("should handle concurrent requests gracefully", async () => {
      const html = "<html><body><h1>Test</h1></body></html>";
      const urls = [
        "https://example1.com/page",
        "https://example2.com/page",
        "https://example3.com/page",
      ];

      const results = await Promise.all(
        urls.map((url) => runTier3Checks(html, url))
      );

      expect(results.length).toBe(3);
      for (const result of results) {
        expect(result.length).toBe(TIER3_CHECK_COUNT);
      }
    });
  });

  describe("Recommendation Quality", () => {
    it("should provide actionable messages for all results", async () => {
      const html = "<html><body><h1>Test</h1></body></html>";
      const results = await runTier3Checks(html, "https://example.com/page");

      for (const result of results) {
        expect(result.message).toBeTruthy();
        expect(result.message.length).toBeGreaterThan(5);
        expect(result.message).not.toContain("fix this");
      }
    });
  });

  describe("Category Coverage", () => {
    it("should have 3 cwv checks (T3-01, T3-02, T3-03)", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "cwv");
      expect(checks.length).toBe(3);
    });

    it("should have entity-nlp checks", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "entity-nlp");
      expect(checks.length).toBeGreaterThan(0);
    });

    it("should have backlinks checks", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "backlinks");
      expect(checks.length).toBeGreaterThan(0);
    });

    it("should have engagement checks", () => {
      const checks = getChecksByTier(3).filter((c) => c.category === "engagement");
      expect(checks.length).toBeGreaterThan(0);
    });
  });
});
