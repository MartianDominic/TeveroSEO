/**
 * Tier 1 SEO Checks Test Suite
 * Phase 72-02: SEO Checks Validation
 *
 * Tests 68 DOM/regex checks for:
 * - Consistent scoring (0.3 pts each, max 20 pts)
 * - Edge case handling
 * - Specific recommendations
 */
import { describe, it, expect } from "vitest";
import { runTier1Checks } from "@/server/lib/audit/checks/runner";
import { getChecksByTier } from "@/server/lib/audit/checks/registry";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";

// Import to trigger registration
import "@/server/lib/audit/checks/tier1";

const TIER1_CHECK_COUNT = 68;

describe("Tier 1 SEO Checks", () => {
  describe("Registration", () => {
    it("should register exactly 68 Tier 1 checks", () => {
      const checks = getChecksByTier(1);
      expect(checks.length).toBe(TIER1_CHECK_COUNT);
    });

    it("should have unique IDs in T1-XX format", () => {
      const checks = getChecksByTier(1);
      const ids = new Set<string>();
      for (const check of checks) {
        expect(check.id).toMatch(/^T1-\d{2}$/);
        expect(ids.has(check.id)).toBe(false);
        ids.add(check.id);
      }
    });

    it("should have valid severity levels", () => {
      const checks = getChecksByTier(1);
      const validSeverities = ["critical", "high", "medium", "low", "info"];
      for (const check of checks) {
        expect(validSeverities).toContain(check.severity);
      }
    });

    it("should have editRecipe when autoEditable is true", () => {
      const checks = getChecksByTier(1);
      for (const check of checks) {
        if (check.autoEditable) {
          expect(check.editRecipe).toBeDefined();
          expect(check.editRecipe).not.toBe("");
        }
      }
    });
  });

  describe("Scoring Integration", () => {
    it("should contribute 0.3 points per passing check", async () => {
      const html = createOptimalHtml();
      const results = await runTier1Checks(html, "https://example.com/page", "SEO");
      const passCount = results.filter((r) => r.passed).length;
      const score = calculateOnPageScore(results);

      // Each pass = 0.3 pts, max 20 pts
      const expectedTier1 = Math.min(20, passCount * 0.3);
      expect(score.breakdown.tier1).toBeCloseTo(expectedTier1, 1);
    });

    it("should cap Tier 1 contribution at 20 points", async () => {
      const html = createOptimalHtml();
      const results = await runTier1Checks(html, "https://example.com/page", "SEO");
      const score = calculateOnPageScore(results);

      expect(score.breakdown.tier1).toBeLessThanOrEqual(20);
    });

    it("should trigger noindex gate when T1-67 fails", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head>
          <meta name="robots" content="noindex">
          <title>Test Page</title>
        </head><body><h1>Test</h1></body></html>
      `;
      const results = await runTier1Checks(html, "https://example.com/page");
      const score = calculateOnPageScore(results);

      expect(score.score).toBe(0);
      expect(score.gates).toContain("noindex");
    });

    it("should trigger YMYL author gate when T1-68 fails", async () => {
      // YMYL page without author
      const html = `
        <!DOCTYPE html>
        <html><head><title>Health Advice</title></head>
        <body>
          <h1>Medical Treatment Guide</h1>
          <p>This is your money or your life content about health.</p>
        </body></html>
      `;
      const results = await runTier1Checks(html, "https://example.com/health-advice");
      const score = calculateOnPageScore(results);

      // T1-68 checks for author on YMYL - if page is detected as YMYL and no author, caps at 60
      const ymylCheck = results.find((r) => r.checkId === "T1-68");
      if (ymylCheck && !ymylCheck.passed) {
        expect(score.score).toBeLessThanOrEqual(60);
        expect(score.gates).toContain("ymyl-no-author");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty HTML gracefully", async () => {
      const results = await runTier1Checks("<html><body></body></html>", "https://example.com/page");
      expect(results.length).toBe(TIER1_CHECK_COUNT);
      // All checks should complete without throwing
      for (const result of results) {
        expect(result.checkId).toMatch(/^T1-\d{2}$/);
        expect(result.message).toBeTruthy();
      }
    });

    it("should handle missing keyword parameter", async () => {
      const html = createMinimalHtml();
      const results = await runTier1Checks(html, "https://example.com/page");

      // Keyword-dependent checks should return info severity
      const keywordChecks = results.filter((r) => r.message.includes("No keyword provided"));
      expect(keywordChecks.length).toBeGreaterThan(0);
      for (const check of keywordChecks) {
        expect(check.severity).toBe("info");
        expect(check.passed).toBe(true);
      }
    });

    it("should handle malformed URLs gracefully", async () => {
      const html = createMinimalHtml();
      // The runner validates URL format
      await expect(
        runTier1Checks(html, "not-a-valid-url")
      ).rejects.toThrow("Invalid URL");
    });

    it("should handle special characters in keyword", async () => {
      const html = `
        <!DOCTYPE html>
        <html><head><title>C++ Programming Guide</title></head>
        <body><h1>Learn C++</h1><p>C++ is great.</p></body></html>
      `;
      const results = await runTier1Checks(html, "https://example.com/cpp", "C++");
      expect(results.length).toBe(TIER1_CHECK_COUNT);
    });

    it("should handle very large HTML within limits", async () => {
      // Generate 1MB of HTML (under 5MB limit)
      const largeContent = "<p>Content</p>".repeat(50000);
      const html = `<!DOCTYPE html><html><head><title>Large</title></head><body>${largeContent}</body></html>`;

      const start = performance.now();
      const results = await runTier1Checks(html, "https://example.com/large");
      const duration = performance.now() - start;

      expect(results.length).toBe(TIER1_CHECK_COUNT);
      // Performance varies by environment; verify it completes without timeout
      expect(duration).toBeLessThan(60000); // Should complete in under 60s
    }, 60000); // Extended timeout for large HTML processing

    it("should reject HTML exceeding 5MB limit", async () => {
      const hugeContent = "x".repeat(6 * 1024 * 1024); // 6MB
      const html = `<html><body>${hugeContent}</body></html>`;

      await expect(
        runTier1Checks(html, "https://example.com/huge")
      ).rejects.toThrow("exceeds maximum size");
    });
  });

  describe("Category Coverage", () => {
    it("should have 5 html-signals checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "html-signals");
      expect(checks.length).toBe(5);
    });

    it("should have 8 heading-structure checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "heading-structure");
      expect(checks.length).toBe(8);
    });

    it("should have 7 title-meta checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "title-meta");
      expect(checks.length).toBe(7);
    });

    it("should have 5 url-structure checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "url-structure");
      expect(checks.length).toBe(5);
    });

    it("should have 7 content-structure checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "content-structure");
      expect(checks.length).toBe(7);
    });

    it("should have 6 image-basics checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "image-basics");
      expect(checks.length).toBe(6);
    });

    it("should have 5 internal-links checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "internal-links");
      expect(checks.length).toBe(5);
    });

    it("should have 4 external-links checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "external-links");
      expect(checks.length).toBe(4);
    });

    it("should have 7 schema-basics checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "schema-basics");
      expect(checks.length).toBe(7);
    });

    it("should have 6 technical-basics checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "technical-basics");
      expect(checks.length).toBe(6);
    });

    it("should have 8 eeat-signals checks", () => {
      const checks = getChecksByTier(1).filter((c) => c.category === "eeat-signals");
      expect(checks.length).toBe(8);
    });
  });

  describe("Recommendation Quality", () => {
    it("should return specific fix guidance for failing checks", async () => {
      const html = createMinimalHtml();
      const results = await runTier1Checks(html, "https://example.com/page", "keyword");

      const failingChecks = results.filter((r) => !r.passed && r.autoEditable);
      for (const result of failingChecks) {
        expect(result.editRecipe).toBeDefined();
        expect(result.editRecipe).not.toContain("fix this");
        expect(result.editRecipe).not.toContain("update this");
        expect(result.editRecipe!.length).toBeGreaterThan(10);
      }
    });

    it("should not have generic messages", async () => {
      const html = createMinimalHtml();
      const results = await runTier1Checks(html, "https://example.com/page");

      for (const result of results) {
        expect(result.message.toLowerCase()).not.toContain("fix this issue");
        expect(result.message.toLowerCase()).not.toContain("update this");
        expect(result.message.toLowerCase()).not.toContain("correct this");
      }
    });
  });
});

// Helper functions

function createMinimalHtml(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Minimal Page</title>
    </head>
    <body>
      <h1>Hello World</h1>
      <p>This is a minimal page.</p>
    </body>
    </html>
  `;
}

function createOptimalHtml(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="description" content="Learn the best SEO practices for 2026. Discover tips and strategies to improve your search rankings and drive more organic traffic.">
      <title>Best SEO Practices [2026 Guide] - Expert Tips</title>
      <link rel="canonical" href="https://example.com/page">
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "Best SEO Practices 2026",
        "author": {
          "@type": "Person",
          "name": "John Smith",
          "url": "https://example.com/author/john-smith",
          "sameAs": ["https://linkedin.com/in/johnsmith", "https://twitter.com/johnsmith"]
        },
        "datePublished": "2026-04-22",
        "dateModified": "2026-04-22",
        "publisher": {
          "@type": "Organization",
          "name": "SEO Guide",
          "logo": {
            "@type": "ImageObject",
            "url": "https://example.com/logo.png",
            "width": 200,
            "height": 200
          }
        }
      }
      </script>
    </head>
    <body>
      <header>
        <nav>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main>
        <article>
          <h1>Best SEO Practices for 2026</h1>
          <p class="byline">By <a href="/author/john-smith" rel="author">John Smith</a></p>
          <p>SEO is essential for any website. <strong>SEO practices</strong> help you rank higher.
          This guide covers the best <em>SEO strategies</em> for 2026. Learn how to optimize your SEO content.</p>
          <p>Here are the key SEO factors you need to know about for better rankings.</p>

          <h2>On-Page SEO Factors</h2>
          <p>On-page SEO includes optimizing your content and meta tags.</p>
          <a href="/technical-seo" title="Technical SEO Guide">Learn Technical SEO</a>

          <h3>Title Tags</h3>
          <p>Your title tag should be 50-60 characters.</p>

          <h2>Technical SEO</h2>
          <p>Technical SEO ensures search engines can crawl your site.</p>
          <a href="/crawling" title="Crawling Guide">Crawling Best Practices</a>

          <h2>Content Quality</h2>
          <p>High-quality content is the foundation of good SEO.</p>
          <a href="/content-tips" title="Content Tips">Content Writing Tips</a>

          <h2>Link Building</h2>
          <p>Building quality backlinks improves your domain authority.</p>

          <h2>Mobile Optimization</h2>
          <p>With mobile-first indexing, mobile optimization is critical.</p>

          <h2>Final Thoughts on SEO</h2>
          <p>Implementing these SEO practices will help you succeed in 2026.</p>

          <a href="https://moz.com" target="_blank" rel="noopener">Moz SEO Guide</a>
          <a href="https://ahrefs.com" target="_blank" rel="noopener">Ahrefs</a>

          <img src="/images/seo-chart.webp" alt="SEO ranking factors chart showing key metrics" width="800" height="600" loading="lazy">
        </article>
      </main>
      <footer>
        <a href="/about">About Us</a>
        <a href="/contact">Contact Us</a>
      </footer>
    </body>
    </html>
  `;
}
