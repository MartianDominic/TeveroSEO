/**
 * Unified Sitemap Parsing Module
 *
 * Consolidated sitemap utilities for the TeveroSEO platform.
 * Gap: P2.G15 - Duplicate sitemap parsers unified
 */

export {
  SitemapParser,
  SITEMAP_LOCATIONS,
  type SitemapUrl,
  type SitemapParseResult,
  type SitemapParseOptions,
  type SitemapFetchStats,
  // Backward compatibility exports
  parseSitemap,
  fetchAllSitemapUrls,
  filterByLastmod,
} from "./SitemapParser";
