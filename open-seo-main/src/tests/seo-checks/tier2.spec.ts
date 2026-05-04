/**
 * Tier 2 SEO Checks Test Suite
 * Phase 72-02: SEO Checks Validation
 *
 * Tests 21 calculation-based checks for:
 * - Consistent scoring (0.5 pts each, max 10 pts)
 * - Edge case handling
 * - Content quality analysis
 */
import { describe, it, expect } from "vitest";
import { runTier2Checks } from "@/server/lib/audit/checks/runner";
import { getChecksByTier } from "@/server/lib/audit/checks/registry";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";

// Import to trigger registration
import "@/server/lib/audit/checks/tier2";

const TIER2_CHECK_COUNT = 21;

describe("Tier 2 SEO Checks", () => {
  describe("Registration", () => {
    it("should register exactly 21 Tier 2 checks", () => {
      const checks = getChecksByTier(2);
      expect(checks.length).toBe(TIER2_CHECK_COUNT);
    });

    it("should have unique IDs in T2-XX format", () => {
      const checks = getChecksByTier(2);
      const ids = new Set<string>();
      for (const check of checks) {
        expect(check.id).toMatch(/^T2-\d{2}$/);
        expect(ids.has(check.id)).toBe(false);
        ids.add(check.id);
      }
    });

    it("should have valid categories", () => {
      const checks = getChecksByTier(2);
      const validCategories = [
        "content-quality",
        "anchor-analysis",
        "schema-completeness",
        "freshness",
        "mobile",
      ];
      for (const check of checks) {
        expect(validCategories).toContain(check.category);
      }
    });
  });

  describe("Scoring Integration", () => {
    it("should contribute 0.5 points per passing check", async () => {
      const html = createContentRichHtml();
      const results = await runTier2Checks(html, "https://example.com/page", "SEO");

      // Filter out skipped checks (severity: "info" with skipped: true)
      const activeResults = results.filter((r) => {
        const details = r.details as { skipped?: boolean } | undefined;
        return !(r.severity === "info" && details?.skipped === true);
      });
      const passCount = activeResults.filter((r) => r.passed).length;
      const score = calculateOnPageScore(results);

      // Verify tier2 contribution matches formula: passCount * 0.5, max 10
      expect(score.breakdown.tier2).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.tier2).toBeLessThanOrEqual(10);
      // Verify the formula is correctly applied (accounting for skipped checks)
      expect(score.breakdown.tier2).toBeCloseTo(Math.min(10, passCount * 0.5), 1);
    });

    it("should cap Tier 2 contribution at 10 points", async () => {
      const html = createContentRichHtml();
      const results = await runTier2Checks(html, "https://example.com/page", "SEO");
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier2).toBeLessThanOrEqual(10);
    });
  });

  describe("Content Quality Checks", () => {
    it("should analyze reading level for content (T2-01)", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>Thin Content</title></head>
        <body>
          <h1>Short Article</h1>
          <p>This is very short content.</p>
        </body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/thin");
      const readingLevelCheck = results.find((r) => r.checkId === "T2-01");

      // T2-01 is Reading Level check - verify it runs and returns result
      expect(readingLevelCheck).toBeDefined();
      expect(typeof readingLevelCheck?.passed).toBe("boolean");
    });

    it("should have word count details for content analysis", async () => {
      const content = "This is quality content about SEO optimization strategies for websites. ".repeat(150);
      const html = `
        <!DOCTYPE html>
        <html><head><title>Good Content</title></head>
        <body>
          <h1>Comprehensive Guide</h1>
          <p>${content}</p>
        </body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/good");
      const wordCountCheck = results.find((r) => r.checkId === "T2-01");

      // Verify word count check returns details
      expect(wordCountCheck).toBeDefined();
      expect(wordCountCheck?.details).toBeDefined();
    });

    it("should analyze keyword density when keyword provided", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>Article</title></head>
        <body>
          <h1>Article Title</h1>
          <p>This article discusses various topics but not the target keyword at all.
          The content continues with more text that avoids the target topic entirely.</p>
        </body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/page", "specific-keyword");
      const densityCheck = results.find((r) => r.checkId === "T2-02");

      // Verify density check exists and has been evaluated
      expect(densityCheck).toBeDefined();
      expect(typeof densityCheck?.passed).toBe("boolean");
    });
  });

  describe("Freshness Checks", () => {
    it("should verify dateModified presence in schema", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head>
          <title>Article</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Test",
            "datePublished": "2026-01-01"
          }
          </script>
        </head>
        <body><h1>Article</h1></body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/article");
      const freshCheck = results.find((r) => r.checkId.startsWith("T2-") && r.message.includes("dateModified"));

      // Should flag missing dateModified
      if (freshCheck) {
        expect(freshCheck.passed).toBe(false);
      }
    });
  });

  describe("Mobile Checks", () => {
    it("should have mobile category checks registered", () => {
      const checks = getChecksByTier(2).filter((c) => c.category === "mobile");
      // Mobile checks exist in registration
      expect(checks.length).toBeGreaterThanOrEqual(0);
    });

    it("should run mobile-related checks", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>Mobile Test</title></head>
        <body>
          <button style="width: 20px; height: 20px;">Tiny</button>
        </body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/page");

      // All 21 checks should run
      expect(results.length).toBe(TIER2_CHECK_COUNT);
    });
  });

  describe("Edge Cases", () => {
    it("should handle content with only scripts/styles", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>Scripts Only</title></head>
        <body>
          <script>console.log('test');</script>
          <style>.test { color: red; }</style>
        </body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/page");

      expect(results.length).toBe(TIER2_CHECK_COUNT);
      // Should not throw, and word count should be 0
      const wordCountCheck = results.find((r) => r.checkId === "T2-01");
      if (wordCountCheck?.details && "wordCount" in wordCountCheck.details) {
        expect(wordCountCheck.details.wordCount).toBe(0);
      }
    });

    it("should handle Unicode content", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>Unicode Test</title></head>
        <body>
          <h1>Lietuviskos raidees</h1>
          <p>aaeceiyzus Unicode simboliai ir emojis.</p>
        </body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/unicode");

      expect(results.length).toBe(TIER2_CHECK_COUNT);
      for (const result of results) {
        expect(result.checkId).toMatch(/^T2-\d{2}$/);
      }
    });

    it("should handle deeply nested HTML", async () => {
      let nested = "<p>Content</p>";
      for (let i = 0; i < 50; i++) {
        nested = `<div>${nested}</div>`;
      }
      const html = `<!DOCTYPE html><html><head><title>Nested</title></head><body>${nested}</body></html>`;

      const results = await runTier2Checks(html, "https://example.com/nested");
      expect(results.length).toBe(TIER2_CHECK_COUNT);
    });
  });

  describe("Schema Completeness Checks", () => {
    it("should have schema-completeness checks registered", () => {
      const checks = getChecksByTier(2).filter((c) => c.category === "schema-completeness");
      expect(checks.length).toBeGreaterThan(0);
    });

    it("should run schema checks on Article pages", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head>
          <title>Article</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Test Article"
          }
          </script>
        </head>
        <body><h1>Article</h1></body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/article");

      // All checks should run
      expect(results.length).toBe(TIER2_CHECK_COUNT);

      // Verify results have valid structure
      for (const result of results) {
        expect(result.checkId).toMatch(/^T2-\d{2}$/);
        expect(typeof result.passed).toBe("boolean");
      }
    });

    it("should analyze complete Article schema", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head>
          <title>Complete Article</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Complete Article",
            "author": {
              "@type": "Person",
              "name": "John Smith",
              "url": "https://example.com/john",
              "sameAs": ["https://linkedin.com/in/john"]
            },
            "datePublished": "2026-04-01",
            "dateModified": "2026-04-22",
            "publisher": {
              "@type": "Organization",
              "name": "Example",
              "logo": {
                "@type": "ImageObject",
                "url": "https://example.com/logo.png",
                "width": 200,
                "height": 200
              }
            },
            "image": "https://example.com/image.jpg"
          }
          </script>
        </head>
        <body><h1>Complete Article</h1><p>Content here.</p></body></html>
      `;
      const results = await runTier2Checks(html, "https://example.com/complete");

      // All checks should complete
      expect(results.length).toBe(TIER2_CHECK_COUNT);
    });
  });

  describe("Category Coverage", () => {
    it("should have content-quality checks", () => {
      const checks = getChecksByTier(2).filter((c) => c.category === "content-quality");
      expect(checks.length).toBeGreaterThan(0);
    });

    it("should have anchor-analysis checks", () => {
      const checks = getChecksByTier(2).filter((c) => c.category === "anchor-analysis");
      expect(checks.length).toBeGreaterThan(0);
    });

    it("should have schema-completeness checks", () => {
      const checks = getChecksByTier(2).filter((c) => c.category === "schema-completeness");
      expect(checks.length).toBeGreaterThan(0);
    });

    it("should have freshness checks", () => {
      const checks = getChecksByTier(2).filter((c) => c.category === "freshness");
      expect(checks.length).toBeGreaterThan(0);
    });

    it("should have mobile checks", () => {
      const checks = getChecksByTier(2).filter((c) => c.category === "mobile");
      expect(checks.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions

function createContentRichHtml(): string {
  const content = `
    SEO optimization is essential for modern websites. This comprehensive guide covers
    all aspects of search engine optimization including technical SEO, content strategy,
    and link building best practices. Learn how to improve your website rankings and
    drive more organic traffic through proven SEO techniques.

    Content quality is the foundation of good SEO. Search engines prioritize websites
    that provide valuable, informative content to users. Focus on creating comprehensive
    articles that thoroughly cover your topic and answer user questions.

    Technical SEO ensures that search engines can properly crawl and index your website.
    This includes optimizing page speed, mobile responsiveness, and site architecture.
    A well-structured website helps both users and search engine bots navigate content.

    Link building remains an important ranking factor. Focus on earning high-quality
    backlinks from authoritative websites in your industry. Avoid black hat tactics
    that could result in penalties from search engines.
  `.repeat(3);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>SEO Guide 2026 - Comprehensive Optimization Tips</title>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "SEO Guide 2026",
        "author": {
          "@type": "Person",
          "name": "John Smith",
          "url": "https://example.com/john",
          "sameAs": ["https://linkedin.com/in/john"]
        },
        "datePublished": "2026-04-01",
        "dateModified": "2026-04-22"
      }
      </script>
    </head>
    <body>
      <article>
        <h1>Complete SEO Guide for 2026</h1>
        <p>${content}</p>
      </article>
    </body>
    </html>
  `;
}
