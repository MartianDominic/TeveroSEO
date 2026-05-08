/**
 * Platform OAuth Crawler
 *
 * Universal fallback crawler with Playwright for JS-rendered sites.
 * Used when OAuth connection is not available.
 */

export {
  RobotsTxtParser,
  type RobotsTxt,
  type RobotsTxtRule,
} from "./RobotsTxtParser";

// Re-export from unified sitemap module
export {
  SitemapParser,
  SITEMAP_LOCATIONS,
  type SitemapUrl,
  type SitemapParseResult,
} from "@/server/lib/sitemap";

export {
  SPADetector,
  detectSPA,
  needsJsRendering,
  type SPAFramework,
  type SPADetectionResult,
} from "./SPADetector";

export {
  UniversalCrawler,
  crawlUrl,
  type CrawlOptions,
  type CrawlResult,
  type PageData,
} from "./UniversalCrawler";
