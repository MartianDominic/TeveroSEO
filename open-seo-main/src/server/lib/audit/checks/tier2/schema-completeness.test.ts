/**
 * Tests for Tier 2 Schema Completeness (T2-09 to T2-14)
 */
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { getCheckById } from "../registry";

// Import to register checks
import "./schema-completeness";

describe("Tier 2 Schema Completeness", () => {
  describe("T2-09: author.url to author page", () => {
    it("should pass when author has valid URL", async () => {
      const check = getCheckById("T2-09");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "author": {
              "@type": "Person",
              "name": "John Doe",
              "url": "https://example.com/authors/john-doe"
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(true);
      expect(result.details?.hasAuthor).toBe(true);
      expect(result.details?.isValidUrl).toBe(true);
    });

    it("should fail when author has no URL", async () => {
      const check = getCheckById("T2-09");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "author": {
              "@type": "Person",
              "name": "John Doe"
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(false);
      expect(result.details?.hasAuthor).toBe(true);
      expect(result.details?.isValidUrl).toBe(false);
    });

    it("should skip when no Article schema", async () => {
      const check = getCheckById("T2-09");

      const html = `<html><body><p>No schema here</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });
  });

  describe("T2-10: author.sameAs has 3+ links", () => {
    it("should pass with 3+ sameAs links", async () => {
      const check = getCheckById("T2-10");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "author": {
              "name": "John Doe",
              "sameAs": [
                "https://twitter.com/johndoe",
                "https://linkedin.com/in/johndoe",
                "https://github.com/johndoe"
              ]
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(true);
      expect(result.details?.sameAsCount).toBeGreaterThanOrEqual(3);
    });

    it("should fail with fewer than 3 sameAs links", async () => {
      const check = getCheckById("T2-10");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "author": {
              "name": "John Doe",
              "sameAs": ["https://twitter.com/johndoe"]
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(false);
      expect(result.details?.sameAsCount).toBeLessThan(3);
    });
  });

  describe("T2-11: author.sameAs includes LinkedIn", () => {
    it("should pass when LinkedIn is present", async () => {
      const check = getCheckById("T2-11");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "author": {
              "name": "John Doe",
              "sameAs": ["https://linkedin.com/in/johndoe"]
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(true);
      expect(result.details?.hasLinkedIn).toBe(true);
    });

    it("should fail when LinkedIn is missing", async () => {
      const check = getCheckById("T2-11");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "author": {
              "name": "John Doe",
              "sameAs": ["https://twitter.com/johndoe"]
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(false);
      expect(result.details?.hasLinkedIn).toBe(false);
    });
  });

  describe("T2-12: Organization sameAs array", () => {
    it("should pass with Wikipedia, LinkedIn, and Twitter", async () => {
      const check = getCheckById("T2-12");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Organization",
            "name": "Example Corp",
            "sameAs": [
              "https://en.wikipedia.org/wiki/Example",
              "https://linkedin.com/company/example",
              "https://twitter.com/example"
            ]
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.hasWikipedia).toBe(true);
      expect(result.details?.hasLinkedIn).toBe(true);
      expect(result.details?.hasTwitter).toBe(true);
    });

    it("should fail when missing required links", async () => {
      const check = getCheckById("T2-12");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Organization",
            "name": "Example Corp",
            "sameAs": ["https://facebook.com/example"]
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(false);
      expect(result.details?.missing).toContain("Wikipedia");
    });
  });

  describe("T2-13: publisher.logo >= 112x112px", () => {
    it("should pass with valid logo dimensions", async () => {
      const check = getCheckById("T2-13");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "publisher": {
              "@type": "Organization",
              "name": "Example",
              "logo": {
                "@type": "ImageObject",
                "url": "https://example.com/logo.png",
                "width": 200,
                "height": 200
              }
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(true);
      expect(result.details?.meetsRequirement).toBe(true);
    });

    it("should fail with small logo", async () => {
      const check = getCheckById("T2-13");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "publisher": {
              "@type": "Organization",
              "name": "Example",
              "logo": {
                "@type": "ImageObject",
                "url": "https://example.com/logo.png",
                "width": 50,
                "height": 50
              }
            }
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(false);
      expect(result.details?.meetsRequirement).toBe(false);
    });
  });

  describe("T2-14: citation array on YMYL", () => {
    it("should pass when YMYL has citations", async () => {
      const check = getCheckById("T2-14");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "citation": [
              {"@type": "CreativeWork", "name": "Source 1"},
              {"@type": "CreativeWork", "name": "Source 2"}
            ]
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com/health/article",
        pageAnalysis: { isYmyl: true } as any,
      });

      expect(result.passed).toBe(true);
      expect(result.details?.hasCitations).toBe(true);
    });

    it("should fail when YMYL missing citations", async () => {
      const check = getCheckById("T2-14");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "headline": "Health Article"
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com/health/article",
        pageAnalysis: { isYmyl: true } as any,
      });

      expect(result.passed).toBe(false);
      expect(result.details?.isYmyl).toBe(true);
      expect(result.details?.hasCitations).toBe(false);
    });

    it("should skip for non-YMYL content", async () => {
      const check = getCheckById("T2-14");

      const html = `<html><body><p>Regular content</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com/blog/post",
        pageAnalysis: { isYmyl: false } as any,
      });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });
  });
});
