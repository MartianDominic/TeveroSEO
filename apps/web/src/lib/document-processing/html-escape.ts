/**
 * HTML Escape Utility
 * Phase 102: XSS Prevention for PDF Export
 *
 * Escapes HTML special characters to prevent XSS attacks
 * when inserting user-controlled values into HTML templates.
 *
 * IMPORTANT: Use escapeHtml() for user-provided TEXT that should
 * appear as plain text in HTML. Use sanitizeHtml() from @/lib/sanitize
 * for HTML content that needs to preserve safe formatting.
 */

/**
 * Map of HTML special characters to their entity equivalents.
 * Covers all characters that could be used for XSS injection.
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Regex matching all characters that need escaping.
 */
const HTML_ESCAPE_REGEX = /[&<>"'`=/]/g;

/**
 * Escape HTML special characters in a string.
 *
 * Converts characters like <, >, &, ", ', /, `, = to their HTML entity
 * equivalents to prevent XSS attacks when inserting user content into HTML.
 *
 * @param text - The text to escape
 * @returns The escaped text safe for HTML insertion
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
 *
 * @example
 * escapeHtml('Hello, World!')
 * // Returns: 'Hello, World!' (unchanged, no special characters)
 */
export function escapeHtml(text: string): string {
  if (!text) return "";
  if (typeof text !== "string") {
    // Handle non-string values gracefully
    return escapeHtml(String(text));
  }
  return text.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Unescape HTML entities back to their original characters.
 * Useful for displaying escaped content in non-HTML contexts.
 *
 * @param html - The HTML-escaped text
 * @returns The original unescaped text
 */
export function unescapeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&#x3D;/g, "=");
}
