/**
 * SitemapParser Tests
 *
 * Tests for sitemap discovery and parsing.
 * Per D-17: Sitemap discovery checks 5 common locations plus robots.txt directive.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SitemapParser,
  type SitemapUrl,
  SITEMAP_LOCATIONS,
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
    it("checks 5 common locations per D-17", async () => {
      const fetchCalls: string[] = [];
      globalThis.fetch = vi.fn().mockImplementation(async (url) => {
        fetchCalls.push(String(url));
        // First location succeeds
        if (String(url).endsWith("/sitemap.xml")) {
          return {
            ok: true,
            headers: {
              get: () => "application/xml",
            },
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
        // All common locations fail
        if (
          SITEMAP_LOCATIONS.some((loc) => urlStr.endsWith(loc)) &&
          options?.method === "HEAD"
        ) {
          return { ok: false };
        }
        // robots.txt succeeds
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

    it("limits child sitemap parsing to 5 to prevent DoS", async () => {
      const manySitemaps = Array.from(
        { length: 20 },
        (_, i) => `<sitemap><loc>https://example.com/sitemap-${i}.xml</loc></sitemap>`
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
            text: () => Promise.resolve(sitemapIndexXml),
          };
        }
        // Child sitemaps return empty
        return {
          ok: true,
          text: () =>
            Promise.resolve(`<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page</loc></url>
</urlset>`),
        };
      });

      const result = await SitemapParser.parseRecursive(
        "https://example.com/sitemap_index.xml"
      );

      // Should have parsed index + at most 5 child sitemaps
      expect(fetchCount).toBeLessThanOrEqual(6);
    });

    it("handles malformed XML gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
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
  });
});
