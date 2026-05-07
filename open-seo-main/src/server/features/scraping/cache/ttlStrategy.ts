/**
 * TTL Strategy - Content-Type Based TTL Management
 * Phase 95-02: Multi-Level Caching
 *
 * Determines cache TTL based on content type detected from:
 * - URL patterns
 * - Schema.org markup
 * - Page structure
 */

import type { CacheLevel, ContentType } from "./types";

// =============================================================================
// Constants
// =============================================================================

/**
 * Base TTL values by content type (in milliseconds).
 */
export const TTL_BY_CONTENT_TYPE: Record<ContentType, number> = {
  corporate: 7 * 24 * 60 * 60 * 1000, // 7 days
  blog_post: 24 * 60 * 60 * 1000, // 24 hours
  product: 4 * 60 * 60 * 1000, // 4 hours
  category: 12 * 60 * 60 * 1000, // 12 hours
  homepage: 4 * 60 * 60 * 1000, // 4 hours
  dynamic: 1 * 60 * 60 * 1000, // 1 hour
  generic: 12 * 60 * 60 * 1000, // 12 hours (default)
};

/**
 * TTL multipliers per cache level.
 * L1 keeps data for shortest time (hot cache).
 * L4 keeps data longest (archive).
 */
export const TTL_LEVEL_MULTIPLIERS: Record<CacheLevel, number> = {
  L1: 0.1, // L1 TTL = 10% of base (e.g., 2.4h for blog_post)
  L2: 0.5, // L2 TTL = 50% of base (e.g., 12h for blog_post)
  L3: 1.0, // L3 TTL = 100% of base (e.g., 24h for blog_post)
  L4: 3.0, // L4 TTL = 300% of base (e.g., 72h for blog_post)
};

/**
 * URL patterns for content type detection.
 */
const URL_PATTERNS: Array<{ pattern: RegExp; contentType: ContentType }> = [
  // Blog/Article patterns
  { pattern: /\/(blog|news|article|post|stories|magazine)\//i, contentType: "blog_post" },
  { pattern: /\/\d{4}\/\d{2}\/[^/]+\/?$/i, contentType: "blog_post" }, // /2026/05/article-slug

  // Product patterns
  { pattern: /\/(product|item|p|pd|sku)\//i, contentType: "product" },
  { pattern: /\/dp\/[A-Z0-9]+/i, contentType: "product" }, // Amazon-style

  // Category/Collection patterns
  { pattern: /\/(category|collection|shop|catalog|browse|c)\//i, contentType: "category" },
  { pattern: /\/(products|items)\/?$/i, contentType: "category" },

  // Corporate pages
  { pattern: /\/(about|contact|team|careers|company|press|investor)/i, contentType: "corporate" },
  { pattern: /\/(terms|privacy|legal|cookies|disclaimer)/i, contentType: "corporate" },

  // Dynamic content
  { pattern: /\/(search|filter|results)\b/i, contentType: "dynamic" },
  { pattern: /[?&](q|query|search)=/i, contentType: "dynamic" },
];

// =============================================================================
// Content Type Detection
// =============================================================================

/**
 * Detect content type from URL and optional HTML content.
 *
 * Detection order:
 * 1. URL pattern matching (includes query params for dynamic content)
 * 2. Check for homepage (root path without content-indicating params)
 * 3. Schema.org detection (if HTML provided)
 * 4. Fallback to generic
 */
export function detectContentType(url: string, html?: string): ContentType {
  // URL pattern matching first (catches ?q=, ?search= etc. on any path)
  for (const { pattern, contentType } of URL_PATTERNS) {
    if (pattern.test(url)) {
      return contentType;
    }
  }

  // Check for homepage after URL patterns
  if (isHomepageUrl(url)) {
    return "homepage";
  }

  // Schema.org detection if HTML is available
  if (html) {
    const schemaType = detectSchemaOrgType(html);
    if (schemaType) {
      return schemaType;
    }
  }

  // Default
  return "generic";
}

/**
 * Check if URL is a homepage.
 */
function isHomepageUrl(url: string): boolean {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    const path = parsed.pathname;
    return (
      path === "/" ||
      path === "" ||
      path === "/index.html" ||
      path === "/index.htm" ||
      path === "/index.php"
    );
  } catch {
    return false;
  }
}

/**
 * Detect content type from Schema.org JSON-LD.
 */
function detectSchemaOrgType(html: string): ContentType | null {
  // Quick regex extraction for performance (avoid full DOM parsing)
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const type = Array.isArray(data) ? data[0]?.["@type"] : data?.["@type"];

      if (!type) continue;

      // Map Schema.org types to content types
      if (type === "Product" || type === "ProductGroup") {
        return "product";
      }
      if (
        type === "Article" ||
        type === "BlogPosting" ||
        type === "NewsArticle" ||
        type === "WebContent"
      ) {
        return "blog_post";
      }
      if (type === "CollectionPage" || type === "ItemList") {
        return "category";
      }
      if (type === "Organization" || type === "Corporation" || type === "AboutPage") {
        return "corporate";
      }
      if (type === "WebPage" || type === "WebSite") {
        // Generic web page - check for homepage indicator
        const isHomepage = data?.isPartOf?.["@type"] === "WebSite" && !data?.mainEntity;
        if (isHomepage) return "homepage";
      }
    } catch {
      // Invalid JSON, continue to next script
    }
  }

  return null;
}

// =============================================================================
// TTL Calculation
// =============================================================================

/**
 * Get TTL for a specific content type and cache level.
 */
export function getTtl(contentType: ContentType, level: CacheLevel): number {
  const baseTtl = TTL_BY_CONTENT_TYPE[contentType] ?? TTL_BY_CONTENT_TYPE.generic;
  const multiplier = TTL_LEVEL_MULTIPLIERS[level];
  return Math.round(baseTtl * multiplier);
}

/**
 * Get TTL for a URL (auto-detects content type).
 */
export function getTtlForUrl(url: string, level: CacheLevel, html?: string): number {
  const contentType = detectContentType(url, html);
  return getTtl(contentType, level);
}

/**
 * Calculate expiration date from TTL.
 */
export function calculateExpiresAt(ttlMs: number, fromDate?: Date): Date {
  const start = fromDate ?? new Date();
  return new Date(start.getTime() + ttlMs);
}

/**
 * Check if a cached page is expired.
 */
export function isExpired(expiresAt: Date, now?: Date): boolean {
  const currentTime = now ?? new Date();
  return expiresAt.getTime() < currentTime.getTime();
}

/**
 * Calculate remaining TTL in milliseconds.
 */
export function getRemainingTtl(expiresAt: Date, now?: Date): number {
  const currentTime = now ?? new Date();
  return Math.max(0, expiresAt.getTime() - currentTime.getTime());
}

// =============================================================================
// TTL Policy Helpers
// =============================================================================

/**
 * Get human-readable TTL description.
 */
export function formatTtl(ttlMs: number): string {
  const seconds = Math.floor(ttlMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Get TTL policy summary for all content types at a given level.
 */
export function getTtlPolicy(level: CacheLevel): Record<ContentType, string> {
  const policy: Record<string, string> = {};
  for (const [type, baseTtl] of Object.entries(TTL_BY_CONTENT_TYPE)) {
    const ttl = Math.round(baseTtl * TTL_LEVEL_MULTIPLIERS[level]);
    policy[type] = formatTtl(ttl);
  }
  return policy as Record<ContentType, string>;
}

/**
 * Validate TTL is within acceptable bounds.
 */
export function validateTtl(ttlMs: number): boolean {
  const MIN_TTL = 60 * 1000; // 1 minute minimum
  const MAX_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year maximum
  return ttlMs >= MIN_TTL && ttlMs <= MAX_TTL;
}

/**
 * Clamp TTL to acceptable bounds.
 */
export function clampTtl(ttlMs: number): number {
  const MIN_TTL = 60 * 1000; // 1 minute
  const MAX_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year
  return Math.max(MIN_TTL, Math.min(MAX_TTL, ttlMs));
}

// =============================================================================
// Freshness Calculation
// =============================================================================

/**
 * Calculate freshness percentage (100% = just cached, 0% = expired).
 */
export function getFreshness(fetchedAt: Date, expiresAt: Date, now?: Date): number {
  const currentTime = now ?? new Date();
  const totalTtl = expiresAt.getTime() - fetchedAt.getTime();
  const elapsed = currentTime.getTime() - fetchedAt.getTime();

  if (totalTtl <= 0) return 0;
  if (elapsed <= 0) return 100;
  if (elapsed >= totalTtl) return 0;

  return Math.round(((totalTtl - elapsed) / totalTtl) * 100);
}

/**
 * Determine if content should be proactively refreshed.
 * Threshold: refresh when less than 20% fresh.
 */
export function shouldProactivelyRefresh(
  fetchedAt: Date,
  expiresAt: Date,
  threshold = 20
): boolean {
  return getFreshness(fetchedAt, expiresAt) < threshold;
}
