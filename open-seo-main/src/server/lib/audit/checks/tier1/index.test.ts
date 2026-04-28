/**
 * Tier 1 Checks Test Suite
 * Verifies all 66 checks are registered and perform well
 */
import { describe, it, expect, beforeEach } from "vitest";
import { runTier1Checks } from "../runner";
import { clearRegistry, getChecksByTier } from "../registry";

// Import all tier1 check files to register them
import "./html-signals";
import "./heading-structure";
import "./title-meta";
import "./url-structure";
import "./content-structure";
import "./image-basics";
import "./internal-links";
import "./external-links";
import "./schema-basics";
import "./technical-basics";
import "./eeat-signals";

const TIER1_CHECK_COUNT = 66;
const tier1Checks = () => getChecksByTier(1);

// Sample HTML for testing
const sampleHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Learn the best SEO practices for 2026. Discover tips and strategies to improve your search rankings and drive more traffic.">
  <title>Best SEO Practices [2026 Guide] - Expert Tips</title>
  <link rel="canonical" href="https://example.com/seo-practices-guide">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Best SEO Practices 2026",
    "author": {
      "@type": "Person",
      "name": "John Smith",
      "url": "https://example.com/author/john-smith"
    },
    "datePublished": "2026-04-22",
    "dateModified": "2026-04-22"
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
      This guide covers the best <em>SEO strategies</em> for 2026. Learn how to optimize your content.</p>
      <p>Here are the key SEO factors you need to know about.</p>

      <h2>On-Page SEO Factors</h2>
      <p>On-page SEO includes optimizing your content, meta tags, and internal linking structure to improve visibility.</p>

      <h3>Title Tags</h3>
      <p>Your title tag should be 50-60 characters and include your primary keyword.</p>

      <h2>Technical SEO</h2>
      <p>Technical SEO ensures search engines can crawl and index your site effectively.</p>

      <h2>Content Quality</h2>
      <p>High-quality content is the foundation of good SEO.</p>

      <h2>Link Building</h2>
      <p>Building quality backlinks improves your domain authority.</p>

      <h2>Mobile Optimization</h2>
      <p>With mobile-first indexing, mobile optimization is critical.</p>

      <h2>Final Thoughts on SEO</h2>
      <p>Implementing these SEO practices will help you succeed in 2026.</p>

      <a href="/related-article" title="SEO tips">Related SEO Tips</a>
      <a href="/seo-tools">SEO Tools</a>
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

// Minimal HTML for edge case testing
const minimalHtml = `
<!DOCTYPE html>
<html>
<head><title>Minimal</title></head>
<body><p>Hello</p></body>
</html>
`;

describe("Tier 1 Checks", () => {

  it("should register all 66 Tier 1 checks", () => {
    const checks = tier1Checks();
    expect(checks.length).toBe(TIER1_CHECK_COUNT);
  });

  it("should have unique check IDs", () => {
    const checks = tier1Checks();
    const ids = checks.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(checks.length);
  });

  it("should have IDs in T1-XX format", () => {
    const checks = tier1Checks();
    for (const check of checks) {
      expect(check.id).toMatch(/^T1-\d{2}$/);
    }
  });

  it("should run all checks in under 100ms", async () => {
    const start = performance.now();
    const results = await runTier1Checks(sampleHtml, "https://example.com/seo-practices-guide", "SEO");
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(results.length).toBe(TIER1_CHECK_COUNT);
  });

  it("should return valid CheckResult for each check", async () => {
    const results = await runTier1Checks(sampleHtml, "https://example.com/seo-practices-guide", "SEO");

    for (const result of results) {
      expect(result).toHaveProperty("checkId");
      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("severity");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("autoEditable");
      expect(typeof result.passed).toBe("boolean");
      expect(["critical", "high", "medium", "low", "info"]).toContain(result.severity);
    }
  });

  it("should not throw on minimal HTML", async () => {
    const results = await runTier1Checks(minimalHtml, "https://example.com/page", "test");
    expect(results.length).toBe(TIER1_CHECK_COUNT);
    // All checks should complete without throwing
    for (const result of results) {
      expect(result.checkId).toMatch(/^T1-\d{2}$/);
    }
  });

  it("should handle missing keyword gracefully", async () => {
    const results = await runTier1Checks(sampleHtml, "https://example.com/page");
    expect(results.length).toBe(TIER1_CHECK_COUNT);
    // Keyword-dependent checks should pass or return info
    const keywordChecks = results.filter(r => r.message.includes("No keyword provided"));
    expect(keywordChecks.length).toBeGreaterThan(0);
  });
});

describe("Performance Benchmarks", () => {
  it("should run all checks in under 100ms for realistic HTML (~5KB)", async () => {
    // Generate realistic 5KB HTML page
    const realisticHtml = generateRealisticHtml(5);
    const start = performance.now();
    const results = await runTier1Checks(realisticHtml, "https://example.com/realistic-page", "SEO");
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(results.length).toBe(TIER1_CHECK_COUNT);
  });

  it("should run all checks in under 100ms for large HTML (~50KB)", async () => {
    // Generate large 50KB HTML page (worst case realistic scenario)
    const largeHtml = generateRealisticHtml(50);
    const start = performance.now();
    const results = await runTier1Checks(largeHtml, "https://example.com/large-page", "SEO");
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(results.length).toBe(TIER1_CHECK_COUNT);
  });

  it("should run all checks in under 300ms for very large HTML (~500KB)", async () => {
    // Generate very large HTML (edge case - complex pages)
    const veryLargeHtml = generateRealisticHtml(500);
    const start = performance.now();
    const results = await runTier1Checks(veryLargeHtml, "https://example.com/very-large-page", "SEO");
    const duration = performance.now() - start;

    // Allow 300ms for very large pages (edge case, most pages are <50KB)
    // DoS mitigation threshold is 5MB which would be rejected
    expect(duration).toBeLessThan(300);
    expect(results.length).toBe(TIER1_CHECK_COUNT);
  });
});

/**
 * Generate realistic HTML of approximately the given size in KB.
 * Creates a blog-style page with navigation, article, sidebar, footer.
 */
function generateRealisticHtml(sizeKb: number): string {
  const targetSize = sizeKb * 1024;

  const header = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Comprehensive guide to SEO optimization strategies for 2026. Learn best practices for improving search rankings and driving organic traffic.">
  <title>Complete SEO Guide 2026 - Expert Optimization Strategies</title>
  <link rel="canonical" href="https://example.com/seo-guide">
  <meta property="og:title" content="SEO Guide 2026">
  <meta property="og:description" content="Learn SEO best practices">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Complete SEO Guide 2026",
    "author": {"@type": "Person", "name": "John Smith"},
    "datePublished": "2026-04-22"
  }
  </script>
</head>
<body>
<header>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/services" title="Our SEO services">Services</a>
    <a href="/contact">Contact</a>
  </nav>
</header>
<main>
  <article>
    <h1>Complete SEO Guide for 2026</h1>
    <p class="byline">By <a href="/author/john-smith" rel="author">John Smith</a> | Updated April 2026</p>
    <p>SEO optimization is essential for any website looking to improve its search engine rankings.
    This comprehensive guide covers all aspects of <strong>SEO</strong> including technical optimization,
    content strategy, and <em>link building</em>.</p>
`;

  const footer = `
    </article>
    <aside>
      <h3>Related Articles</h3>
      <ul>
        <li><a href="/seo-tools">Best SEO Tools</a></li>
        <li><a href="/keyword-research">Keyword Research Guide</a></li>
      </ul>
    </aside>
  </main>
  <footer>
    <p>&copy; 2026 SEO Guide. All rights reserved.</p>
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
  </footer>
  <noscript>SEO optimization content is available without JavaScript.</noscript>
</body>
</html>`;

  // Generate content paragraphs to fill the target size
  const paragraphTemplate = `
    <h2>SEO Strategy Section</h2>
    <p>Understanding search engine optimization requires knowledge of both technical and content factors.
    Google uses hundreds of ranking signals to determine page positions. Key factors include page speed,
    mobile-friendliness, content quality, and backlink profile. Implementing proper SEO practices can
    significantly improve organic traffic and visibility in search results.</p>
    <p>Content optimization involves targeting specific keywords while maintaining natural readability.
    Use semantic HTML, proper heading hierarchy, and include images with descriptive alt text.
    Internal linking helps distribute page authority throughout your site structure.</p>
    <ul>
      <li>Optimize title tags (50-60 characters)</li>
      <li>Write compelling meta descriptions (150-160 characters)</li>
      <li>Use H1 for main heading, H2-H6 for subheadings</li>
      <li>Include target keywords naturally</li>
    </ul>
    <img src="/images/seo-chart-${Math.random().toString(36).substring(7)}.webp" alt="SEO ranking factors chart" width="800" height="600" loading="lazy">
    <a href="/external-resource" target="_blank" rel="noopener">Learn more about SEO</a>
`;

  let content = "";
  while ((header + content + footer).length < targetSize) {
    content += paragraphTemplate;
  }

  return header + content + footer;
}

describe("Individual Check Categories", () => {
  it("should have 5 HTML signal checks (T1-01 to T1-05)", () => {
    const checks = tier1Checks().filter(c => c.category === "html-signals");
    expect(checks.length).toBe(5);
  });

  it("should have 8 heading structure checks (T1-06 to T1-13)", () => {
    const checks = tier1Checks().filter(c => c.category === "heading-structure");
    expect(checks.length).toBe(8);
  });

  it("should have 7 title/meta checks (T1-14 to T1-20)", () => {
    const checks = tier1Checks().filter(c => c.category === "title-meta");
    expect(checks.length).toBe(7);
  });

  it("should have 5 URL structure checks (T1-21 to T1-25)", () => {
    const checks = tier1Checks().filter(c => c.category === "url-structure");
    expect(checks.length).toBe(5);
  });

  it("should have 7 content structure checks (T1-26 to T1-32)", () => {
    const checks = tier1Checks().filter(c => c.category === "content-structure");
    expect(checks.length).toBe(7);
  });

  it("should have 6 image checks (T1-33 to T1-38)", () => {
    const checks = tier1Checks().filter(c => c.category === "image-basics");
    expect(checks.length).toBe(6);
  });

  it("should have 5 internal link checks (T1-39 to T1-43)", () => {
    const checks = tier1Checks().filter(c => c.category === "internal-links");
    expect(checks.length).toBe(5);
  });

  it("should have 4 external link checks (T1-44 to T1-47)", () => {
    const checks = tier1Checks().filter(c => c.category === "external-links");
    expect(checks.length).toBe(4);
  });

  it("should have 7 schema checks (T1-48 to T1-54)", () => {
    const checks = tier1Checks().filter(c => c.category === "schema-basics");
    expect(checks.length).toBe(7);
  });

  it("should have 5 technical checks (T1-55 to T1-59)", () => {
    const checks = tier1Checks().filter(c => c.category === "technical-basics");
    expect(checks.length).toBe(5);
  });

  it("should have 7 E-E-A-T checks (T1-60 to T1-66)", () => {
    const checks = tier1Checks().filter(c => c.category === "eeat-signals");
    expect(checks.length).toBe(7);
  });
});
