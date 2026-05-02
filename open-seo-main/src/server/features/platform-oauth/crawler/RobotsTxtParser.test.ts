/**
 * RobotsTxtParser Tests
 *
 * Tests for robots.txt parsing and compliance checking.
 * Per D-16: Crawler respects robots.txt directives before crawling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RobotsTxtParser,
  type RobotsTxt,
  type RobotsTxtRule,
} from "./RobotsTxtParser";

describe("RobotsTxtParser", () => {
  describe("parse", () => {
    it("extracts User-agent, Disallow, Allow directives", () => {
      const content = `
User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /admin/public/

User-agent: Googlebot
Disallow: /no-google/
`;
      const result = RobotsTxtParser.parse(content);

      expect(result.rules.length).toBe(2);

      // Wildcard rule
      const wildcardRule = result.rules.find((r) => r.userAgent === "*");
      expect(wildcardRule).toBeDefined();
      expect(wildcardRule!.disallow).toContain("/admin/");
      expect(wildcardRule!.disallow).toContain("/private/");
      expect(wildcardRule!.allow).toContain("/admin/public/");

      // Googlebot rule
      const googlebotRule = result.rules.find(
        (r) => r.userAgent === "Googlebot"
      );
      expect(googlebotRule).toBeDefined();
      expect(googlebotRule!.disallow).toContain("/no-google/");
    });

    it("extracts Crawl-delay directive", () => {
      const content = `
User-agent: *
Crawl-delay: 10
Disallow: /admin/
`;
      const result = RobotsTxtParser.parse(content);

      expect(result.rules.length).toBe(1);
      expect(result.rules[0].crawlDelay).toBe(10);
    });

    it("extracts Sitemap directive from robots.txt", () => {
      const content = `
User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-posts.xml
`;
      const result = RobotsTxtParser.parse(content);

      expect(result.sitemaps).toContain("https://example.com/sitemap.xml");
      expect(result.sitemaps).toContain("https://example.com/sitemap-posts.xml");
    });

    it("handles empty robots.txt", () => {
      const result = RobotsTxtParser.parse("");
      expect(result.rules).toEqual([]);
      expect(result.sitemaps).toEqual([]);
    });

    it("handles malformed robots.txt gracefully", () => {
      const content = `
This is not a valid robots.txt
But we should not crash
User-agent: *
Disallow:
`;
      const result = RobotsTxtParser.parse(content);
      // Should extract what it can
      expect(result.rules.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isAllowed", () => {
    it("returns false for disallowed paths", () => {
      const robots: RobotsTxt = {
        rules: [
          {
            userAgent: "*",
            disallow: ["/admin/", "/private/"],
            allow: [],
            crawlDelay: null,
          },
        ],
        sitemaps: [],
      };

      expect(
        RobotsTxtParser.isAllowed(robots, "/admin/dashboard", "*")
      ).toBe(false);
      expect(
        RobotsTxtParser.isAllowed(robots, "/private/data", "*")
      ).toBe(false);
      expect(RobotsTxtParser.isAllowed(robots, "/public/page", "*")).toBe(true);
    });

    it("allows explicitly allowed paths even within disallowed directories", () => {
      const robots: RobotsTxt = {
        rules: [
          {
            userAgent: "*",
            disallow: ["/admin/"],
            allow: ["/admin/public/"],
            crawlDelay: null,
          },
        ],
        sitemaps: [],
      };

      expect(
        RobotsTxtParser.isAllowed(robots, "/admin/public/page", "*")
      ).toBe(true);
      expect(
        RobotsTxtParser.isAllowed(robots, "/admin/secret/page", "*")
      ).toBe(false);
    });

    it("matches specific user agent first, falls back to wildcard", () => {
      const robots: RobotsTxt = {
        rules: [
          {
            userAgent: "*",
            disallow: ["/all-disallow/"],
            allow: [],
            crawlDelay: null,
          },
          {
            userAgent: "TeveroSEO-Bot",
            disallow: ["/specific-disallow/"],
            allow: [],
            crawlDelay: null,
          },
        ],
        sitemaps: [],
      };

      // TeveroSEO-Bot should use its specific rule
      expect(
        RobotsTxtParser.isAllowed(robots, "/specific-disallow/page", "TeveroSEO-Bot")
      ).toBe(false);
      // But should NOT be blocked by wildcard rule
      expect(
        RobotsTxtParser.isAllowed(robots, "/all-disallow/page", "TeveroSEO-Bot")
      ).toBe(true);

      // Other bots use wildcard
      expect(
        RobotsTxtParser.isAllowed(robots, "/all-disallow/page", "OtherBot")
      ).toBe(false);
    });

    it("returns true when no rules match", () => {
      const robots: RobotsTxt = {
        rules: [
          {
            userAgent: "Googlebot",
            disallow: ["/no-google/"],
            allow: [],
            crawlDelay: null,
          },
        ],
        sitemaps: [],
      };

      // No rules for this user agent and no wildcard
      expect(
        RobotsTxtParser.isAllowed(robots, "/no-google/page", "TeveroSEO-Bot")
      ).toBe(true);
    });

    it("handles empty disallow (allows everything)", () => {
      const robots: RobotsTxt = {
        rules: [
          {
            userAgent: "*",
            disallow: [],
            allow: [],
            crawlDelay: null,
          },
        ],
        sitemaps: [],
      };

      expect(RobotsTxtParser.isAllowed(robots, "/any/path", "*")).toBe(true);
    });

    it("handles root disallow", () => {
      const robots: RobotsTxt = {
        rules: [
          {
            userAgent: "*",
            disallow: ["/"],
            allow: [],
            crawlDelay: null,
          },
        ],
        sitemaps: [],
      };

      expect(RobotsTxtParser.isAllowed(robots, "/", "*")).toBe(false);
      expect(RobotsTxtParser.isAllowed(robots, "/any/path", "*")).toBe(false);
    });
  });

  describe("fetch", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("fetches and parses robots.txt from URL", async () => {
      const mockRobotsTxt = `
User-agent: *
Disallow: /admin/

Sitemap: https://example.com/sitemap.xml
`;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockRobotsTxt),
      });

      const result = await RobotsTxtParser.fetch("https://example.com");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://example.com/robots.txt",
        expect.any(Object)
      );
      expect(result).not.toBeNull();
      expect(result!.rules.length).toBe(1);
      expect(result!.sitemaps).toContain("https://example.com/sitemap.xml");
    });

    it("returns null when robots.txt does not exist", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await RobotsTxtParser.fetch("https://example.com");

      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await RobotsTxtParser.fetch("https://example.com");

      expect(result).toBeNull();
    });
  });
});
