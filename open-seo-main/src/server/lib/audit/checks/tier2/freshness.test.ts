/**
 * Tests for Tier 2 Freshness Signals (T2-15 to T2-17)
 */
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { getCheckById } from "../registry";

// Import to register checks
import "./freshness";

describe("Tier 2 Freshness Signals", () => {
  describe("T2-15: Visible date matches schema date", () => {
    it("should pass when dates match", async () => {
      const check = getCheckById("T2-15");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
          <time datetime="2024-03-15">March 15, 2024</time>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(true);
      expect(result.details?.matches).toBe(true);
    });

    it("should fail when dates do not match", async () => {
      const check = getCheckById("T2-15");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
          <time datetime="2024-01-01">January 1, 2024</time>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(false);
      expect(result.details?.matches).toBe(false);
    });

    it("should fail when no visible date found", async () => {
      const check = getCheckById("T2-15");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
          <p>No date shown here</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(false);
      expect(result.details?.visibleDate).toBeNull();
    });

    it("should skip when no Article schema", async () => {
      const check = getCheckById("T2-15");

      const html = `<html><body><p>No schema</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });
  });

  describe("T2-16: sitemap lastmod matches schema", () => {
    it("should skip when no sitemap data available", async () => {
      const check = getCheckById("T2-16");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });

    it("should pass when sitemap and schema dates match", async () => {
      const check = getCheckById("T2-16");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com/article",
        pageAnalysis: { sitemapLastmod: "2024-03-15T10:00:00Z" } as any,
      });

      expect(result.passed).toBe(true);
      expect(result.details?.matches).toBe(true);
    });
  });

  describe("T2-17: No date-only updates", () => {
    it("should skip when no historical data available", async () => {
      const check = getCheckById("T2-17");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com/article" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });

    it("should pass when both date and content changed", async () => {
      const check = getCheckById("T2-17");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com/article",
        pageAnalysis: {
          previousContentHash: "hash123",
          contentHash: "hash456", // Different hash = content changed
          previousDateModified: "2024-01-01T10:00:00Z",
        } as any,
      });

      expect(result.passed).toBe(true);
      expect(result.details?.dateChanged).toBe(true);
      expect(result.details?.contentChanged).toBe(true);
    });

    it("should fail when date changed but content same", async () => {
      const check = getCheckById("T2-17");

      const html = `
        <html><body>
          <script type="application/ld+json">{
            "@type": "Article",
            "dateModified": "2024-03-15T10:00:00Z"
          }</script>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com/article",
        pageAnalysis: {
          previousContentHash: "hash123",
          contentHash: "hash123", // Same hash = content NOT changed
          previousDateModified: "2024-01-01T10:00:00Z",
        } as any,
      });

      expect(result.passed).toBe(false);
      expect(result.details?.isDateOnlyUpdate).toBe(true);
    });
  });
});
