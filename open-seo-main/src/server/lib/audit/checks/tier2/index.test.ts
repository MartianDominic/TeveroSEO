/**
 * Tests for Tier 2 Check Registration and Performance
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as cheerio from "cheerio";
import { clearRegistry, getChecksByTier } from "../registry";

// Import tier2 index to register all checks
import { getTier2Checks, TIER_2_CHECK_IDS, verifyTier2Registration } from "./index";

describe("Tier 2 Check Registration", () => {
  it("should register all 21 Tier 2 checks", () => {
    const tier2Checks = getTier2Checks();
    expect(tier2Checks.length).toBe(21);
  });

  it("should have all expected check IDs", () => {
    const { valid, missing, extra } = verifyTier2Registration();

    if (!valid) {
      console.error("Missing checks:", missing);
      console.error("Extra checks:", extra);
    }

    expect(valid).toBe(true);
    expect(missing).toHaveLength(0);
    expect(extra).toHaveLength(0);
  });

  it("should have correct tier for all checks", () => {
    const tier2Checks = getTier2Checks();

    for (const check of tier2Checks) {
      expect(check.tier).toBe(2);
    }
  });

  it("should have check IDs matching T2-XX pattern", () => {
    const tier2Checks = getTier2Checks();

    for (const check of tier2Checks) {
      expect(check.id).toMatch(/^T2-\d{2}$/);
    }
  });

  it("should cover all 5 categories", () => {
    const tier2Checks = getTier2Checks();
    const categories = new Set(tier2Checks.map((c) => c.category));

    expect(categories.has("content-quality")).toBe(true);
    expect(categories.has("anchor-analysis")).toBe(true);
    expect(categories.has("schema-completeness")).toBe(true);
    expect(categories.has("freshness")).toBe(true);
    expect(categories.has("mobile")).toBe(true);
    expect(categories.size).toBe(5);
  });
});

describe("Tier 2 Performance", () => {
  /**
   * Generate sample HTML with realistic content for testing.
   */
  function generateSampleHtml(): string {
    const paragraphs = Array.from(
      { length: 20 },
      (_, i) =>
        `<p>This is paragraph ${i + 1} with some sample content. It contains various words and phrases that help test the readability and content quality checks. Statistics show 50% improvement.</p>`
    ).join("\n");

    const sections = Array.from(
      { length: 5 },
      (_, i) =>
        `<h2>Section ${i + 1}</h2>\n<p>${"word ".repeat(200)}</p>`
    ).join("\n");

    const internalLinks = Array.from(
      { length: 15 },
      (_, i) => `<a href="/page-${i}">Link ${i + 1} to internal page</a>`
    ).join(" ");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample SEO Page - Testing Content</title>
  <meta name="description" content="This is a sample page for testing SEO checks with various content elements.">
</head>
<body style="font-size: 16px;">
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>

  <main>
    <h1>Sample SEO Page Title for Testing</h1>

    <div class="byline">
      <span class="author">John Doe</span>
      <time datetime="2024-03-15">March 15, 2024</time>
    </div>

    ${sections}

    ${paragraphs}

    <div class="links">
      ${internalLinks}
    </div>

    <button style="width: 120px; height: 48px;">Click Here</button>
  </main>

  <script type="application/ld+json">
  {
    "@type": "Article",
    "headline": "Sample SEO Page",
    "dateModified": "2024-03-15T10:00:00Z",
    "author": {
      "@type": "Person",
      "name": "John Doe",
      "url": "https://example.com/authors/john",
      "sameAs": [
        "https://linkedin.com/in/johndoe",
        "https://twitter.com/johndoe",
        "https://github.com/johndoe"
      ]
    },
    "publisher": {
      "@type": "Organization",
      "name": "Example Corp",
      "logo": {
        "@type": "ImageObject",
        "url": "https://example.com/logo.png",
        "width": 200,
        "height": 200
      },
      "sameAs": [
        "https://wikipedia.org/wiki/Example",
        "https://linkedin.com/company/example",
        "https://twitter.com/example"
      ]
    }
  }
  </script>
</body>
</html>
    `;
  }

  it("should execute all 21 checks in under 500ms", async () => {
    const html = generateSampleHtml();
    const $ = cheerio.load(html);
    const ctx = {
      $,
      html,
      url: "https://example.com/sample-page",
      keyword: "seo",
    };

    const tier2Checks = getTier2Checks();
    expect(tier2Checks.length).toBe(21);

    const startTime = performance.now();

    const results = await Promise.all(
      tier2Checks.map((check) => check.run(ctx))
    );

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Tier 2 execution time: ${duration.toFixed(2)}ms`);

    expect(duration).toBeLessThan(500);
    expect(results.length).toBe(21);
  });

  it("should handle empty content gracefully", async () => {
    const html = "<html><body></body></html>";
    const $ = cheerio.load(html);
    const ctx = { $, html, url: "https://example.com" };

    const tier2Checks = getTier2Checks();
    const results: Array<{ checkId: string; error?: string }> = [];

    // All checks should complete without throwing
    for (const check of tier2Checks) {
      try {
        const result = await Promise.resolve(check.run(ctx));
        results.push({ checkId: result.checkId });
      } catch (e) {
        results.push({
          checkId: check.id,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    // Verify no errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error("Checks with errors:", errors);
    }
    expect(errors).toHaveLength(0);
  });

  it("should handle missing schema gracefully", async () => {
    const html = `
      <html><body>
        <h1>Page without schema</h1>
        <p>${"content ".repeat(100)}</p>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const ctx = { $, html, url: "https://example.com" };

    const tier2Checks = getTier2Checks();

    const results = await Promise.all(
      tier2Checks.map((check) => check.run(ctx))
    );

    // All checks should complete
    expect(results.length).toBe(21);

    // Schema-related checks should skip gracefully
    const schemaChecks = results.filter((r) =>
      ["T2-09", "T2-10", "T2-11", "T2-12", "T2-13", "T2-14", "T2-15", "T2-16", "T2-17"].includes(
        r.checkId
      )
    );

    for (const result of schemaChecks) {
      // Should either pass (skipped) or have appropriate messaging
      expect(result.message).toBeTruthy();
    }
  });

  it("should handle missing keyword gracefully", async () => {
    const html = `
      <html><body>
        <h1>Page Title</h1>
        <p>${"content ".repeat(100)}</p>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const ctx = { $, html, url: "https://example.com" }; // No keyword

    const keywordCheck = getTier2Checks().find((c) => c.id === "T2-02");
    expect(keywordCheck).toBeDefined();

    const result = await keywordCheck!.run(ctx);

    // Should skip gracefully
    expect(result.passed).toBe(true);
    expect(result.details?.skipped).toBe(true);
  });

  it("should handle Flesch-Kincaid on very long content without timeout", async () => {
    // Generate ~10,000 words of content (well under 50k word limit)
    const longContent = "The quick brown fox jumps over the lazy dog. ".repeat(1000);
    const html = `
      <html><body>
        <h1>Long Article for Reading Level Test</h1>
        <p>${longContent}</p>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const ctx = { $, html, url: "https://example.com" };

    const readingLevelCheck = getTier2Checks().find((c) => c.id === "T2-01");
    expect(readingLevelCheck).toBeDefined();

    const startTime = performance.now();
    const result = await readingLevelCheck!.run(ctx);
    const duration = performance.now() - startTime;

    // Should complete well under 500ms even for long content
    expect(duration).toBeLessThan(500);
    expect(result.checkId).toBe("T2-01");
    expect(result.details?.gradeLevel).toBeDefined();
  });

  it("should handle anchor analysis with 100+ internal links", async () => {
    // Generate 150 internal links with various anchor texts
    const links = Array.from(
      { length: 150 },
      (_, i) => `<a href="/page-${i}">Link text variation ${i % 20}</a>`
    ).join("\n");

    const html = `
      <html><body>
        <h1>Page with Many Links</h1>
        <p>${"content ".repeat(200)}</p>
        <div class="links">
          ${links}
        </div>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const ctx = { $, html, url: "https://example.com" };

    // T2-06: >=10 unique anchor variations
    // T2-08: Links evenly distributed
    const anchorChecks = getTier2Checks().filter((c) =>
      ["T2-06", "T2-07", "T2-08"].includes(c.id)
    );
    expect(anchorChecks.length).toBe(3);

    const startTime = performance.now();
    const results = await Promise.all(anchorChecks.map((check) => check.run(ctx)));
    const duration = performance.now() - startTime;

    // All anchor checks should complete quickly even with 150 links
    expect(duration).toBeLessThan(100);
    expect(results.length).toBe(3);

    // Should properly analyze all links
    for (const result of results) {
      expect(result.message).toBeTruthy();
    }
  });

  it("should handle complex nested schema JSON-LD", async () => {
    const complexSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Complex Article",
      "datePublished": "2024-03-15T10:00:00Z",
      "dateModified": "2024-03-20T15:30:00Z",
      "author": {
        "@type": "Person",
        "name": "John Doe",
        "url": "https://example.com/authors/john",
        "sameAs": [
          "https://linkedin.com/in/johndoe",
          "https://twitter.com/johndoe",
          "https://github.com/johndoe",
          "https://facebook.com/johndoe"
        ]
      },
      "publisher": {
        "@type": "Organization",
        "name": "Example Corp",
        "logo": {
          "@type": "ImageObject",
          "url": "https://example.com/logo.png",
          "width": 200,
          "height": 200
        },
        "sameAs": [
          "https://wikipedia.org/wiki/Example",
          "https://linkedin.com/company/example",
          "https://twitter.com/example"
        ]
      },
      "citation": [
        {"@type": "CreativeWork", "name": "Source 1"},
        {"@type": "CreativeWork", "name": "Source 2"}
      ],
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://example.com/article"
      }
    });

    const html = `
      <html><body>
        <h1>Complex Schema Article</h1>
        <p>${"content ".repeat(200)}</p>
        <script type="application/ld+json">${complexSchema}</script>
      </body></html>
    `;
    const $ = cheerio.load(html);
    const ctx = { $, html, url: "https://example.com" };

    // Run all schema-related checks (T2-09 to T2-14)
    const schemaChecks = getTier2Checks().filter((c) =>
      ["T2-09", "T2-10", "T2-11", "T2-12", "T2-13", "T2-14"].includes(c.id)
    );
    expect(schemaChecks.length).toBe(6);

    const startTime = performance.now();
    const results = await Promise.all(schemaChecks.map((check) => check.run(ctx)));
    const duration = performance.now() - startTime;

    // Schema parsing should be fast even for complex nested structures
    expect(duration).toBeLessThan(100);
    expect(results.length).toBe(6);

    // With properly structured schema, most checks should pass
    const passedChecks = results.filter((r) => r.passed);
    expect(passedChecks.length).toBeGreaterThan(0);
  });
});
