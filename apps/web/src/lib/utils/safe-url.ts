/**
 * URL safety utilities to prevent XSS via javascript: protocol URLs
 */

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Validates that a URL uses a safe protocol (http, https, mailto, tel)
 * Prevents XSS attacks via javascript: protocol URLs
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // If URL parsing fails, check if it's a relative URL (starts with / or .)
    // Relative URLs are safe as they don't allow protocol injection
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return true;
    }
    return false;
  }
}

/**
 * Returns the URL if safe, otherwise returns '#'
 * Use this for href attributes to prevent XSS
 */
export function safeHref(url: string): string {
  return isSafeUrl(url) ? url : '#';
}
