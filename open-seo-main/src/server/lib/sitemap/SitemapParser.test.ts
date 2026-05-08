/**
 * SitemapParser Tests
 *
 * Tests for unified sitemap parsing utility.
 * Gap: P2.G15 - Duplicate sitemap parsers unified
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SitemapParser,
  SITEMAP_LOCATIONS,
  filterByLastmod,
  type SitemapUrl,
} from "./SitemapParser";

describe("SitemapParser", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("SITEMAP_LOCATIONS", () => {
    it("contains 5 common sitemap locations per D-17", () => {
      expect(SITEMAP_LOCATIONS).toContain("/sitemap.xml");
      expect(SITEMAP_LOCATIONS).toContain("/sitemap_index.xml");
      expect(SITEMAP_LOCATIONS).toContain("/sitemap/sitemap.xml");
      expect(SITEMAP_LOCATIONS).toContain("/wp-sitemap.xml");
      expect(SITEMAP_LOCATIONS).toContain("/sitemap/index.xml");
      expect(SITEMAP_LOCATIONS.length).toBe(5);
    });
  });

  describe("findSitemap", () => {
    it("checks common locations and returns first valid sitemap", async () => {
      const fetchCalls: string[] = [];
      globalThis.fetch = vi.fn().mockImplementation(async (url) => {
        fetchCalls.push(String(url));
        if (String(url).endsWith("/sitemap.xml")) {
          return {
            ok: true,
            headers: { get: () => "application/xml" },
          };
        }
        return { ok: false };
      });

      const result = await SitemapParser.findSitemap("https://example.com");

      expect(result).toBe("https://example.com/sitemap.xml");
      expect(fetchCalls[0]).toBe("https://example.com/sitemap.xml");
    });

    it("falls back to robots.txt Sitemap directive", async () => {
      const robotsTxt = `
User-agent: *
Disallow: /admin/

Sitemap: https://example.com/custom-sitemap.xml
`;
      globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
        const urlStr = String(url);
        if (options?.method === "HEAD") {
          return { ok: false };
        }
        if (urlStr.endsWith("/robots.txt")) {
          return {
            ok: true,
            text: () => Promise.resolve(robotsTxt),
          };
        }
        return { ok: false };
      });

      const result = await SitemapParser.findSitemap("https://example.com");

      expect(result).toBe("https://example.com/custom-sitemap.xml");
    });

    it("returns null when no sitemap found", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

      const result = await SitemapParser.findSitemap("https://example.com");

      expect(result).toBeNull();
    });

    it("handles network errors gracefully", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const result = await SitemapParser.findSitemap("https://example.com");

      expect(result).toBeNull();
    });
  });

  describe("parse", () => {
    it("extracts URLs from sitemap XML", async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-05-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2026-04-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve(sitemapXml),
      });

      const result = await SitemapParser.parse(
        "https://example.com/sitemap.xml"
      );

      expect(result.urls.length).toBe(2);
      expect(result.urls[0].loc).toBe("https://example.com/");
      expect(result.urls[0].lastmod).toBeInstanceOf(Date);
      expect(result.urls[0].changefreq).toBe("daily");
      expect(result.urls[0].priority).toBe(1.0);
      expect(result.urls[1].loc).toBe("https://example.com/about");
      expect(result.isIndex).toBe(false);
    });

    it("handles sitemap index files", async () => {
      const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-posts.xml</loc>
    <lastmod>2026-05-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
    <lastmod>2026-05-01</lastmod>
  </sitemap>
</sitemapindex>`;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve(sitemapIndexXml),
      });

      const result = await SitemapParser.parse(
        "https://example.com/sitemap_index.xml"
      );

      expect(result.isIndex).toBe(true);
      expect(result.childSitemaps.length).toBe(2);
      expect(result.childSitemaps).toContain(
        "https://example.com/sitemap-posts.xml"
      );
      expect(result.childSitemaps).toContain(
        "https://example.com/sitemap-pages.xml"
      );
    });

    it("handles malformed XML gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve("Not valid XML"),
      });

      const result = await SitemapParser.parse(
        "https://example.com/sitemap.xml"
      );

      expect(result.urls).toEqual([]);
      expect(result.childSitemaps).toEqual([]);
    });

    it("handles empty sitemap", async () => {
      const emptySitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve(emptySitemap),
      });

      const result = await SitemapParser.parse(
        "https://example.com/sitemap.xml"
      );

      expect(result.urls).toEqual([]);
    });

    it("handles missing optional fields", async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/minimal</loc>
  </url>
</urlset>`;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve(sitemapXml),
      });

      const result = await SitemapParser.parse(
        "https://example.com/sitemap.xml"
      );

      expect(result.urls.length).toBe(1);
      expect(result.urls[0].loc).toBe("https://example.com/minimal");
      expect(result.urls[0].lastmod).toBeNull();
      expect(result.urls[0].changefreq).toBeNull();
      expect(result.urls[0].priority).toBeNull();
    });

    it("handles Magento garbage timestamps", async () => {
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/product</loc>
    <lastmod>0000-00-00</lastmod>
  </url>
</urlset>`;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve(sitemapXml),
      });

      const result = await SitemapParser.parse(
        "https://example.com/sitemap.xml"
      );

      expect(result.urls[0].lastmod).toBeNull();
    });
  });

  describe("parseXml", () => {
    it("respects maxUrls limit", () => {
      const urls = Array.from(
        { length: 100 },
        (_, i) => `<url><loc>https://example.com/page-${i}</loc></url>`
      ).join("\n");
      const sitemapXml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

      const result = SitemapParser.parseXml(sitemapXml, 10);

      expect(result.urls.length).toBe(10);
    });
  });

  describe("parseRecursive", () => {
    it("limits child sitemap parsing to prevent DoS", async () => {
      const manySitemaps = Array.from(
        { length: 20 },
        (_, i) =>
          `<sitemap><loc>https://example.com/sitemap-${i}.xml</loc></sitemap>`
      ).join("\n");

      const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${manySitemaps}
</sitemapindex>`;

      let fetchCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url) => {
        fetchCount++;
        if (String(url).includes("sitemap_index")) {
          return {
            ok: true,
            headers: { get: () => "application/xml" },
            text: () => Promise.resolve(sitemapIndexXml),
          };
        }
        return {
          ok: true,
          headers: { get: () => "application/xml" },
          text: () =>
            Promise.resolve(`<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page</loc></url>
</urlset>`),
        };
      });

      await SitemapParser.parseRecursive(
        "https://example.com/sitemap_index.xml",
        { maxChildSitemaps: 5 }
      );

      // Should have parsed index + at most 5 child sitemaps
      expect(fetchCount).toBeLessThanOrEqual(6);
    });

    it("respects maxDepth limit", async () => {
      const depths: number[] = [];
      let callCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(async (url) => {
        callCount++;
        const urlStr = String(url);
        const depthMatch = urlStr.match(/depth-(\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
        depths.push(depth);

        // Return sitemap index pointing to deeper sitemaps
        if (depth < 5) {
          return {
            ok: true,
            headers: { get: () => "application/xml" },
            text: () =>
              Promise.resolve(`<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-depth-${depth + 1}.xml</loc></sitemap>
</sitemapindex>`),
          };
        }

        return {
          ok: true,
          headers: { get: () => "application/xml" },
          text: () =>
            Promise.resolve(`<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page</loc></url>
</urlset>`),
        };
      });

      await SitemapParser.parseRecursive(
        "https://example.com/sitemap-depth-0.xml",
        { maxDepth: 2 }
      );

      // Should not go beyond depth 2
      expect(Math.max(...depths)).toBeLessThanOrEqual(2);
    });
  });

  describe("parseRecursiveWithStats", () => {
    it("returns fetch statistics", async () => {
      const sitemapXml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
  <url><loc>https://example.com/page2</loc></url>
</urlset>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve(sitemapXml),
      });

      const result = await SitemapParser.parseRecursiveWithStats(
        "https://example.com/sitemap.xml"
      );

      expect(result.urls.length).toBe(2);
      expect(result.stats.fetched).toBe(1);
      expect(result.stats.failed).toBe(0);
      expect(result.stats.discoveredUrls).toBe(2);
      expect(result.stats.truncated).toBe(false);
    });

    it("reports truncation when maxUrls exceeded", async () => {
      const urls = Array.from(
        { length: 100 },
        (_, i) => `<url><loc>https://example.com/page-${i}</loc></url>`
      ).join("\n");
      const sitemapXml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/xml" },
        text: () => Promise.resolve(sitemapXml),
      });

      const result = await SitemapParser.parseRecursiveWithStats(
        "https://example.com/sitemap.xml",
        { maxUrls: 10 }
      );

      expect(result.urls.length).toBe(10);
      expect(result.stats.truncated).toBe(true);
    });
  });

  describe("filterByLastmod", () => {
    it("categorizes URLs by lastmod date", () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const urls: SitemapUrl[] = [
        { loc: "https://example.com/new", lastmod: now, changefreq: null, priority: null },
        { loc: "https://example.com/old", lastmod: twoWeeksAgo, changefreq: null, priority: null },
        { loc: "https://example.com/very-old", lastmod: twoMonthsAgo, changefreq: null, priority: null },
        { loc: "https://example.com/unknown", lastmod: null, changefreq: null, priority: null },
      ];

      // sinceDate = lastWeek, maxAgeDays = 30 (default)
      // - "new" (now) is after lastWeek -> changed
      // - "old" (2 weeks ago) is before lastWeek AND within 30 days -> unchanged
      // - "very-old" (2 months ago) is older than maxAgeDays -> changed (re-check to be safe)
      // - "unknown" has no lastmod -> unknown
      const result = filterByLastmod(urls, lastWeek);

      expect(result.changed.map((u) => u.loc)).toContain("https://example.com/new");
      expect(result.unchanged.map((u) => u.loc)).toContain("https://example.com/old");
      expect(result.changed.map((u) => u.loc)).toContain("https://example.com/very-old");
      expect(result.unknown.map((u) => u.loc)).toContain("https://example.com/unknown");
    });
  });
});
