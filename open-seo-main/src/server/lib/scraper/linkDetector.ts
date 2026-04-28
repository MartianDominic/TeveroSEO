/**
 * Link detection for business-relevant pages.
 *
 * Pattern matching for:
 * - Products: /products, /shop, /store, /catalog, /buy
 * - About: /about, /about-us, /company, /who-we-are, /our-story
 * - Services: /services, /what-we-do, /solutions, /offerings
 * - Contact: /contact, /contact-us, /get-in-touch
 * - Categories: /category/*, /categories/*, /collections/*
 */

import type { BusinessLinks } from "./types";

// Pattern matching (case-insensitive)
// Ordered by priority - exact matches first
const PRODUCT_PATTERNS = [
  /^\/products(\/|$|\?|#)/i, // Exact /products first
  /^\/product(\/|$|\?|#)/i,  // Then /product
  /^\/shop(\/|$|\?|#)/i,
  /^\/store(\/|$|\?|#)/i,
  /^\/catalog(\/|$|\?|#)/i,
  /^\/buy(\/|$|\?|#)/i,
];

const ABOUT_PATTERNS = [
  /^\/about(\/|$|\?|#)/i,    // Exact /about first
  /^\/about-us(\/|$|\?|#)/i,
  /^\/company(\/|$|\?|#)/i,
  /^\/who-we-are(\/|$|\?|#)/i,
  /^\/our-story(\/|$|\?|#)/i,
];

const SERVICES_PATTERNS = [
  /^\/services(\/|$|\?|#)/i, // Exact /services first
  /^\/service(\/|$|\?|#)/i,  // Then /service
  /^\/what-we-do(\/|$|\?|#)/i,
  /^\/solutions(\/|$|\?|#)/i,
  /^\/offerings(\/|$|\?|#)/i,
];

const CONTACT_PATTERNS = [
  /^\/contact(\/|$|\?|#)/i,  // Exact /contact first
  /^\/contact-us(\/|$|\?|#)/i,
  /^\/get-in-touch(\/|$|\?|#)/i,
];

const CATEGORY_PATTERNS = [
  /^\/categor(y|ies)\//i,
  /^\/collections?\//i,
];

/**
 * Dangerous URL schemes that should be filtered out.
 * These can be used for XSS attacks or are not useful for web scraping.
 */
const DANGEROUS_SCHEMES = [
  "javascript:",
  "data:",
  "vbscript:",
  "mailto:",
];

/**
 * Check if a URL uses a dangerous scheme.
 */
function hasDangerousScheme(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return DANGEROUS_SCHEMES.some((scheme) => lowerUrl.startsWith(scheme));
}

/**
 * Normalize a URL to absolute form.
 */
function normalizeUrl(link: string, baseUrl: string): string | null {
  try {
    // Filter dangerous URL schemes early
    if (hasDangerousScheme(link)) {
      return null;
    }

    // If already absolute, parse it
    if (link.startsWith("http://") || link.startsWith("https://")) {
      const url = new URL(link);
      const base = new URL(baseUrl);

      // Filter external domains
      if (url.hostname !== base.hostname) {
        return null;
      }

      return link;
    }

    // Relative URL - combine with base
    const base = new URL(baseUrl);
    const absolute = new URL(link, base);
    return absolute.href;
  } catch {
    return null;
  }
}

/**
 * Extract pathname from a URL for pattern matching.
 */
function extractPathname(url: string): string {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return new URL(url).pathname;
    }
    // Already a pathname
    return url.split("?")[0]?.split("#")[0] ?? url;
  } catch {
    return url;
  }
}

/**
 * Find first link matching any of the patterns.
 * Prioritizes patterns in order - checks all links for pattern[0],
 * then all links for pattern[1], etc.
 */
function findFirstMatch(
  links: string[],
  patterns: RegExp[],
  baseUrl: string,
): string | null {
  // Check patterns in priority order
  for (const pattern of patterns) {
    for (const link of links) {
      const pathname = extractPathname(link);

      if (pattern.test(pathname)) {
        const normalized = normalizeUrl(link, baseUrl);
        if (normalized) {
          return normalized;
        }
      }
    }
  }

  return null;
}

/**
 * Find all category links (limited to 3).
 */
function findCategories(links: string[], baseUrl: string): string[] {
  const categories: string[] = [];

  for (const link of links) {
    if (categories.length >= 3) break;

    const pathname = extractPathname(link);

    for (const pattern of CATEGORY_PATTERNS) {
      if (pattern.test(pathname)) {
        const normalized = normalizeUrl(link, baseUrl);
        if (normalized) {
          categories.push(normalized);
          break; // Move to next link
        }
      }
    }
  }

  return categories;
}

/**
 * Detect business-relevant pages from internal links.
 *
 * @param internalLinks - List of internal links (relative or absolute)
 * @param baseUrl - Base URL of the website
 * @returns Business links organized by type
 */
export function detectBusinessLinks(
  internalLinks: string[],
  baseUrl: string,
): BusinessLinks {
  return {
    products: findFirstMatch(internalLinks, PRODUCT_PATTERNS, baseUrl),
    about: findFirstMatch(internalLinks, ABOUT_PATTERNS, baseUrl),
    services: findFirstMatch(internalLinks, SERVICES_PATTERNS, baseUrl),
    contact: findFirstMatch(internalLinks, CONTACT_PATTERNS, baseUrl),
    categories: findCategories(internalLinks, baseUrl),
  };
}
