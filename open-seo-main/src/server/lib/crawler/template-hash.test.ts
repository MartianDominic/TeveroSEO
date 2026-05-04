/**
 * Template-aware Hash Tests
 *
 * Tests for SEO-focused template hashing that ignores dynamic content.
 * Per 73-02-PLAN.md: Upgrade L2 delta detection from regex to Cheerio-based.
 *
 * Key behaviors:
 * - Ignore price, stock, cart, and widget changes
 * - Detect title, meta description, h1-h3, and main content changes
 * - Strip dynamic blocks before hashing
 */

import { describe, it, expect } from "vitest";
import {
  computeTemplateAwareHash,
  hasSemanticChanges,
  DYNAMIC_BLOCKS,
  SEO_RELEVANT,
} from "./template-hash";

describe("computeTemplateAwareHash", () => {
  describe("ignores dynamic content", () => {
    it("ignores price changes", () => {
      const html1 = `
        <html>
          <head><title>Product</title></head>
          <body>
            <h1>Widget</h1>
            <div class="price">$99.99</div>
          </body>
        </html>
      `;
      const html2 = `
        <html>
          <head><title>Product</title></head>
          <body>
            <h1>Widget</h1>
            <div class="price">$149.99</div>
          </body>
        </html>
      `;

      const hash1 = computeTemplateAwareHash(html1);
      const hash2 = computeTemplateAwareHash(html2);

      expect(hash1.hash).toBe(hash2.hash);
    });

    it("ignores product-price class changes", () => {
      const html1 = '<h1>Product</h1><span class="product-price">$50</span>';
      const html2 = '<h1>Product</h1><span class="product-price">$75</span>';

      expect(computeTemplateAwareHash(html1).hash).toBe(
        computeTemplateAwareHash(html2).hash
      );
    });

    it("ignores [itemprop=price] changes", () => {
      const html1 = '<h1>Item</h1><span itemprop="price">100</span>';
      const html2 = '<h1>Item</h1><span itemprop="price">200</span>';

      expect(computeTemplateAwareHash(html1).hash).toBe(
        computeTemplateAwareHash(html2).hash
      );
    });

    it("ignores stock availability changes", () => {
      const html1 = '<h1>Product</h1><span class="stock">In Stock</span>';
      const html2 = '<h1>Product</h1><span class="stock">Out of Stock</span>';

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });

    it("ignores [itemprop=availability] changes", () => {
      const html1 =
        '<h1>Product</h1><link itemprop="availability" href="InStock">';
      const html2 =
        '<h1>Product</h1><link itemprop="availability" href="OutOfStock">';

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });

    it("ignores cart and add-to-cart button changes", () => {
      const html1 =
        '<h1>Product</h1><button class="add-to-cart">Add to Cart</button>';
      const html2 =
        '<h1>Product</h1><button class="add-to-cart">Added!</button>';

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });

    it("ignores reviews count changes", () => {
      const html1 =
        '<h1>Product</h1><span class="product-reviews-count">42 reviews</span>';
      const html2 =
        '<h1>Product</h1><span class="product-reviews-count">43 reviews</span>';

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });

    it("ignores related products changes", () => {
      const html1 =
        '<h1>Product</h1><div class="related-products"><a href="/a">A</a></div>';
      const html2 =
        '<h1>Product</h1><div class="related-products"><a href="/b">B</a></div>';

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });

    it("ignores script and style tags", () => {
      const html1 = `
        <h1>Page</h1>
        <script>var x = 1;</script>
        <style>.foo { color: red; }</style>
      `;
      const html2 = `
        <h1>Page</h1>
        <script>var x = 2;</script>
        <style>.foo { color: blue; }</style>
      `;

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });

    it("ignores cookie banner changes", () => {
      const html1 =
        '<h1>Page</h1><div class="cookie-banner">Accept cookies?</div>';
      const html2 =
        '<h1>Page</h1><div class="cookie-banner">Cookies accepted!</div>';

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });
  });

  describe("detects SEO-relevant changes", () => {
    it("detects h1 changes", () => {
      const html1 = '<h1>Product A</h1><div class="price">$99</div>';
      const html2 = '<h1>Product B</h1><div class="price">$99</div>';

      const hash1 = computeTemplateAwareHash(html1);
      const hash2 = computeTemplateAwareHash(html2);

      expect(hash1.hash).not.toBe(hash2.hash);
    });

    it("detects h2 changes", () => {
      const html1 = "<h1>Title</h1><h2>Section One</h2>";
      const html2 = "<h1>Title</h1><h2>Section Two</h2>";

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects h3 changes", () => {
      const html1 = "<h1>Title</h1><h3>Subsection A</h3>";
      const html2 = "<h1>Title</h1><h3>Subsection B</h3>";

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects title tag changes", () => {
      const html1 = "<title>Old Title</title><h1>Page</h1>";
      const html2 = "<title>New Title</title><h1>Page</h1>";

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects meta description changes", () => {
      const html1 =
        '<meta name="description" content="Old description"><h1>Page</h1>';
      const html2 =
        '<meta name="description" content="New description"><h1>Page</h1>';

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects og:title changes", () => {
      const html1 =
        '<meta property="og:title" content="Old OG Title"><h1>Page</h1>';
      const html2 =
        '<meta property="og:title" content="New OG Title"><h1>Page</h1>';

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects og:description changes", () => {
      const html1 =
        '<meta property="og:description" content="Old OG Desc"><h1>Page</h1>';
      const html2 =
        '<meta property="og:description" content="New OG Desc"><h1>Page</h1>';

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects main content changes", () => {
      const html1 = "<h1>Title</h1><main>Old main content</main>";
      const html2 = "<h1>Title</h1><main>New main content</main>";

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects article content changes", () => {
      const html1 = "<h1>Title</h1><article>Old article</article>";
      const html2 = "<h1>Title</h1><article>New article</article>";

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects [itemprop=description] changes", () => {
      const html1 =
        '<h1>Product</h1><div itemprop="description">Old desc</div>';
      const html2 =
        '<h1>Product</h1><div itemprop="description">New desc</div>';

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects [itemprop=name] changes", () => {
      const html1 = '<h1>Product</h1><span itemprop="name">Old Name</span>';
      const html2 = '<h1>Product</h1><span itemprop="name">New Name</span>';

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });

    it("detects product-description class changes", () => {
      const html1 =
        '<h1>Product</h1><div class="product-description">Old</div>';
      const html2 =
        '<h1>Product</h1><div class="product-description">New</div>';

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });
  });

  describe("reports metadata", () => {
    it("reports dynamic blocks removed count", () => {
      const html = `
        <h1>Product</h1>
        <div class="price">$99</div>
        <div class="stock">In Stock</div>
        <div class="related-products">Related</div>
        <script>console.log('hi')</script>
        <style>.x{}</style>
      `;

      const result = computeTemplateAwareHash(html);
      expect(result.dynamicBlocksRemoved).toBeGreaterThanOrEqual(5);
    });

    it("returns extracted parts for debugging", () => {
      const html = `
        <html>
          <head>
            <title>Page Title</title>
            <meta name="description" content="Page description">
          </head>
          <body>
            <h1>Main Heading</h1>
            <h2>Section Heading</h2>
          </body>
        </html>
      `;

      const result = computeTemplateAwareHash(html);

      expect(result.extractedParts.length).toBeGreaterThan(0);

      // Should have title
      const titlePart = result.extractedParts.find((p) => p.selector === "title");
      expect(titlePart?.content).toBe("Page Title");

      // Should have meta description
      const metaPart = result.extractedParts.find(
        (p) => p.selector === 'meta[name="description"]'
      );
      expect(metaPart?.content).toBe("Page description");

      // Should have h1
      const h1Part = result.extractedParts.find((p) => p.selector === "h1");
      expect(h1Part?.content).toBe("Main Heading");
    });

    it("normalizes whitespace in extracted content", () => {
      const html = "<h1>  Multiple   Spaces   Here  </h1>";

      const result = computeTemplateAwareHash(html);
      const h1Part = result.extractedParts.find((p) => p.selector === "h1");

      expect(h1Part?.content).toBe("Multiple Spaces Here");
    });

    it("produces consistent hash format (64 char hex)", () => {
      const html = "<h1>Test</h1>";

      const result = computeTemplateAwareHash(html);

      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("hasSemanticChanges helper", () => {
    it("returns false for identical content", () => {
      const html = "<h1>Same</h1><p>Content</p>";

      expect(hasSemanticChanges(html, html)).toBe(false);
    });

    it("returns false for whitespace-only differences", () => {
      const html1 = "<h1>Title</h1>";
      const html2 = "<h1>  Title  </h1>";

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });

    it("returns true for content differences", () => {
      const html1 = "<h1>Title A</h1>";
      const html2 = "<h1>Title B</h1>";

      expect(hasSemanticChanges(html1, html2)).toBe(true);
    });
  });

  describe("complex e-commerce scenarios", () => {
    it("ignores full product page price/stock but detects description change", () => {
      const baseHtml = (desc: string, price: string, stock: string) => `
        <html>
          <head>
            <title>Widget Pro - Shop</title>
            <meta name="description" content="${desc}">
          </head>
          <body>
            <h1>Widget Pro</h1>
            <div class="product-price">${price}</div>
            <span class="stock">${stock}</span>
            <div class="product-description">The best widget for pros.</div>
            <div class="related-products">
              <a href="/widget-basic">Widget Basic</a>
            </div>
            <button class="add-to-cart">Add to Cart</button>
          </body>
        </html>
      `;

      // Price and stock changes - should be same hash
      const html1 = baseHtml("Great widget", "$99", "In Stock");
      const html2 = baseHtml("Great widget", "$149", "Out of Stock");
      expect(hasSemanticChanges(html1, html2)).toBe(false);

      // Description change - should be different hash
      const html3 = baseHtml("Updated widget description", "$99", "In Stock");
      expect(hasSemanticChanges(html1, html3)).toBe(true);
    });

    it("handles nested dynamic content within main", () => {
      // main should be extracted but price inside should be stripped
      const html1 = `
        <main>
          <h1>Product</h1>
          <p>Description text</p>
          <div class="price">$99</div>
        </main>
      `;
      const html2 = `
        <main>
          <h1>Product</h1>
          <p>Description text</p>
          <div class="price">$199</div>
        </main>
      `;

      expect(hasSemanticChanges(html1, html2)).toBe(false);
    });
  });

  describe("selector constants exported", () => {
    it("exports DYNAMIC_BLOCKS array", () => {
      expect(Array.isArray(DYNAMIC_BLOCKS)).toBe(true);
      expect(DYNAMIC_BLOCKS).toContain(".price");
      expect(DYNAMIC_BLOCKS).toContain(".stock");
      expect(DYNAMIC_BLOCKS).toContain("script");
    });

    it("exports SEO_RELEVANT array", () => {
      expect(Array.isArray(SEO_RELEVANT)).toBe(true);
      expect(SEO_RELEVANT).toContain("title");
      expect(SEO_RELEVANT).toContain("h1");
      expect(SEO_RELEVANT).toContain('meta[name="description"]');
    });
  });
});
