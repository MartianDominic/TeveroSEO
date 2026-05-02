/**
 * SitemapParser
 *
 * Discovers and parses XML sitemaps.
 * Per D-17: Sitemap discovery checks 5 common locations plus robots.txt directive.
 */

import { XMLParser } from "fast-xml-parser";
import { RobotsTxtParser } from "./RobotsTxtParser";

export interface SitemapUrl {
  loc: string;
  lastmod: Date | null;
  changefreq: string | null;
  priority: number | null;
}

export interface SitemapParseResult {
  urls: SitemapUrl[];
  childSitemaps: string[];
  isIndex: boolean;
}

/**
 * Common sitemap locations to check per D-17.
 */
export const SITEMAP_LOCATIONS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap/sitemap.xml",
  "/wp-sitemap.xml",
  "/sitemap/index.xml",
] as const;

const DEFAULT_USER_AGENT = "TeveroSEO-Bot/1.0 (+https://tevero.io/bot)";
const MAX_CHILD_SITEMAPS = 5;

export class SitemapParser {
  /**
   * Find sitemap URL by checking common locations and robots.txt.
   *
   * @param baseUrl - Base URL of the site
   * @returns Sitemap URL or null if not found
   */
  static async findSitemap(baseUrl: string): Promise<string | null> {
    const base = new URL(baseUrl).origin;

    // Check common locations first per D-17
    for (const path of SITEMAP_LOCATIONS) {
      try {
        const url = `${base}${path}`;
        const response = await fetch(url, {
          method: "HEAD",
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
          },
          signal: AbortSignal.timeout(5000),
        });

        if (
          response.ok &&
          response.headers.get("content-type")?.includes("xml")
        ) {
          return url;
        }
      } catch {
        // Continue to next location
      }
    }

    // Check robots.txt for Sitemap directive
    try {
      const robotsResponse = await fetch(`${base}/robots.txt`, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (robotsResponse.ok) {
        const robotsText = await robotsResponse.text();
        const robots = RobotsTxtParser.parse(robotsText);
        if (robots.sitemaps.length > 0) {
          return robots.sitemaps[0];
        }
      }
    } catch {
      // robots.txt not available
    }

    return null;
  }

  /**
   * Parse a sitemap XML file.
   *
   * @param sitemapUrl - URL of the sitemap to parse
   * @returns Parsed sitemap with URLs or child sitemap references
   */
  static async parse(sitemapUrl: string): Promise<SitemapParseResult> {
    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "application/xml, text/xml",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return { urls: [], childSitemaps: [], isIndex: false };
      }

      const xml = await response.text();
      return this.parseXml(xml);
    } catch {
      return { urls: [], childSitemaps: [], isIndex: false };
    }
  }

  /**
   * Parse sitemap XML content.
   *
   * @param xml - Raw XML content
   * @returns Parsed sitemap result
   */
  static parseXml(xml: string): SitemapParseResult {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
      });

      const parsed = parser.parse(xml);

      // Check if this is a sitemap index
      if (parsed.sitemapindex) {
        const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
          ? parsed.sitemapindex.sitemap
          : parsed.sitemapindex.sitemap
            ? [parsed.sitemapindex.sitemap]
            : [];

        const childSitemaps = sitemaps
          .filter(
            (s: unknown): s is { loc: string } =>
              s != null && typeof s === "object" && "loc" in s
          )
          .map((s: { loc: string }) => s.loc);

        return {
          urls: [],
          childSitemaps,
          isIndex: true,
        };
      }

      // Regular sitemap
      if (!parsed.urlset?.url) {
        return { urls: [], childSitemaps: [], isIndex: false };
      }

      const urlEntries = Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url];

      const urls: SitemapUrl[] = urlEntries
        .map((entry: Record<string, unknown>) => ({
          loc: String(entry.loc || ""),
          lastmod: this.parseLastmod(entry.lastmod),
          changefreq: entry.changefreq ? String(entry.changefreq) : null,
          priority: entry.priority ? Number(entry.priority) : null,
        }))
        .filter((u: SitemapUrl) => u.loc);

      return { urls, childSitemaps: [], isIndex: false };
    } catch {
      return { urls: [], childSitemaps: [], isIndex: false };
    }
  }

  /**
   * Parse lastmod value, handling various formats.
   */
  private static parseLastmod(value: unknown): Date | null {
    if (!value) return null;
    const str = String(value);

    // Handle Magento garbage timestamps
    if (str === "0000-00-00" || str.startsWith("0000")) {
      return null;
    }

    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Recursively parse sitemap, following sitemap index references.
   * Limits child sitemap parsing to MAX_CHILD_SITEMAPS to prevent DoS.
   *
   * @param sitemapUrl - URL of the sitemap to parse
   * @returns All URLs from sitemap and its children
   */
  static async parseRecursive(sitemapUrl: string): Promise<SitemapUrl[]> {
    const visited = new Set<string>();
    const allUrls: SitemapUrl[] = [];
    let childCount = 0;

    const processRecursive = async (url: string): Promise<void> => {
      if (visited.has(url) || childCount > MAX_CHILD_SITEMAPS) {
        return;
      }
      visited.add(url);

      const result = await this.parse(url);

      if (result.isIndex) {
        // Process child sitemaps with limit
        for (const childUrl of result.childSitemaps) {
          if (childCount >= MAX_CHILD_SITEMAPS) {
            break;
          }
          childCount++;
          await processRecursive(childUrl);
        }
      } else {
        allUrls.push(...result.urls);
      }
    };

    await processRecursive(sitemapUrl);
    return allUrls;
  }
}
