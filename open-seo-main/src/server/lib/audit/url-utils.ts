/**
 * URL normalization and utility functions for the site audit crawler.
 *
 * DEPRECATION NOTICE: This module re-exports from the canonical location.
 * New code should import directly from:
 *   @/server/features/scraping/cache/urlNormalization
 *
 * This file is maintained for backwards compatibility.
 */

// Re-export all URL utilities from canonical location
export {
  normalizeUrlWithBase as normalizeUrl,
  isSameOrigin,
  detectUrlTemplate,
  getOrigin,
  normalizeUrlForClickDepth,
  buildClickDepthMap,
} from "@/server/features/scraping/cache/urlNormalization";
