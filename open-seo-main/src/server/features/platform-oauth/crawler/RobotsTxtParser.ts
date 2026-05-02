/**
 * RobotsTxtParser
 *
 * Parses robots.txt files and checks if crawling is allowed.
 * Per D-16: Crawler respects robots.txt directives before crawling.
 */

export interface RobotsTxtRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay: number | null;
}

export interface RobotsTxt {
  rules: RobotsTxtRule[];
  sitemaps: string[];
}

const DEFAULT_USER_AGENT = "TeveroSEO-Bot/1.0 (+https://tevero.io/bot)";

export class RobotsTxtParser {
  /**
   * Parse robots.txt content into structured format.
   *
   * @param content - Raw robots.txt content
   * @returns Parsed robots.txt structure
   */
  static parse(content: string): RobotsTxt {
    const rules: RobotsTxtRule[] = [];
    const sitemaps: string[] = [];
    let currentRule: RobotsTxtRule | null = null;

    const lines = content.split("\n");

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Skip empty lines and comments
      if (!line || line.startsWith("#")) {
        continue;
      }

      // Parse directive
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      const directive = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();

      switch (directive) {
        case "user-agent":
          // If we have a pending rule, save it
          if (currentRule) {
            rules.push(currentRule);
          }
          currentRule = {
            userAgent: value,
            disallow: [],
            allow: [],
            crawlDelay: null,
          };
          break;

        case "disallow":
          if (currentRule && value) {
            currentRule.disallow.push(value);
          }
          break;

        case "allow":
          if (currentRule && value) {
            currentRule.allow.push(value);
          }
          break;

        case "crawl-delay":
          if (currentRule) {
            const delay = parseInt(value, 10);
            if (!isNaN(delay)) {
              currentRule.crawlDelay = delay;
            }
          }
          break;

        case "sitemap":
          if (value) {
            sitemaps.push(value);
          }
          break;
      }
    }

    // Add the last rule if exists
    if (currentRule) {
      rules.push(currentRule);
    }

    return { rules, sitemaps };
  }

  /**
   * Fetch and parse robots.txt from a URL.
   *
   * @param baseUrl - Base URL of the site (e.g., https://example.com)
   * @returns Parsed robots.txt or null if not found/error
   */
  static async fetch(baseUrl: string): Promise<RobotsTxt | null> {
    try {
      const url = new URL("/robots.txt", baseUrl);
      const response = await fetch(url.toString(), {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return null;
      }

      const content = await response.text();
      return this.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Check if a path is allowed for a given user agent.
   *
   * @param robots - Parsed robots.txt
   * @param path - Path to check (e.g., /admin/dashboard)
   * @param userAgent - User agent string to match
   * @returns true if crawling is allowed
   */
  static isAllowed(
    robots: RobotsTxt,
    path: string,
    userAgent: string = DEFAULT_USER_AGENT
  ): boolean {
    // Find matching rule - specific user agent first
    let matchingRule = robots.rules.find((r) =>
      userAgent.toLowerCase().includes(r.userAgent.toLowerCase())
    );

    // Fall back to wildcard rule
    if (!matchingRule) {
      matchingRule = robots.rules.find((r) => r.userAgent === "*");
    }

    // No matching rule means everything is allowed
    if (!matchingRule) {
      return true;
    }

    // Empty disallow means everything is allowed
    if (matchingRule.disallow.length === 0) {
      return true;
    }

    // Check if path is explicitly allowed
    for (const allowPath of matchingRule.allow) {
      if (path.startsWith(allowPath)) {
        // Find if there's a more specific disallow
        const hasMoreSpecificDisallow = matchingRule.disallow.some(
          (d) => path.startsWith(d) && d.length > allowPath.length
        );
        if (!hasMoreSpecificDisallow) {
          return true;
        }
      }
    }

    // Check if path is disallowed
    for (const disallowPath of matchingRule.disallow) {
      if (path.startsWith(disallowPath)) {
        // Check if there's a more specific allow
        const hasMoreSpecificAllow = matchingRule.allow.some(
          (a) => path.startsWith(a) && a.length > disallowPath.length
        );
        if (!hasMoreSpecificAllow) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get the crawl delay for a user agent.
   *
   * @param robots - Parsed robots.txt
   * @param userAgent - User agent string to match
   * @returns Crawl delay in seconds or null if not specified
   */
  static getCrawlDelay(
    robots: RobotsTxt,
    userAgent: string = DEFAULT_USER_AGENT
  ): number | null {
    // Find matching rule - specific user agent first
    let matchingRule = robots.rules.find((r) =>
      userAgent.toLowerCase().includes(r.userAgent.toLowerCase())
    );

    // Fall back to wildcard rule
    if (!matchingRule) {
      matchingRule = robots.rules.find((r) => r.userAgent === "*");
    }

    return matchingRule?.crawlDelay ?? null;
  }

  /**
   * Get sitemap URLs from robots.txt.
   *
   * @param robots - Parsed robots.txt
   * @returns Array of sitemap URLs
   */
  static getSitemapUrls(robots: RobotsTxt): string[] {
    return robots.sitemaps;
  }
}
