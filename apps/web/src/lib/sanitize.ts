import DOMPurify, { type Config } from 'dompurify';

/**
 * Strict sanitization configuration for HTML content.
 * Uses allowlist approach - only explicitly allowed tags/attributes pass through.
 *
 * SECURITY: This configuration:
 * - Uses ALLOWED_TAGS (allowlist) not FORBID_TAGS (blocklist)
 * - Removes all event handlers (onclick, onerror, etc.)
 * - Prevents javascript: URLs
 * - Disables data attributes
 * - Returns clean string output
 */
const SANITIZE_CONFIG: Config = {
  // Allowlist of safe formatting tags
  ALLOWED_TAGS: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'strong', 'b', 'em', 'i', 'u',
    'blockquote', 'code', 'pre',
    'img', 'br', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
  ],
  // Allowlist of safe attributes
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'target', 'rel',
  ],
  // Disable data-* attributes (potential XSS vector)
  ALLOW_DATA_ATTR: false,
  // Only allow safe URL schemes (blocks javascript:, vbscript:, data:)
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  // Return string, not DOM node
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  // Keep text content when stripping tags
  KEEP_CONTENT: true,
};

/**
 * Minimal sanitization config for simple text with links.
 * Used for footer text and similar minimal HTML content.
 */
const MINIMAL_CONFIG: Config = {
  ALLOWED_TAGS: ['p', 'br', 'a', 'span', 'strong', 'em'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

/**
 * Paste sanitization config for TipTap editor.
 * Allows variable-related data attributes needed by VariableExtension.
 *
 * SECURITY: Only allows specific data attributes for variables,
 * not arbitrary data-* attributes.
 */
const PASTE_CONFIG: Config = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'span'],
  ALLOWED_ATTR: ['href', 'data-variable-key', 'data-variable-label', 'class'],
  ALLOW_DATA_ATTR: false, // Keep false - we explicitly allow specific attrs above
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  KEEP_CONTENT: true,
};

/**
 * Sanitize HTML content using DOMPurify with strict configuration.
 *
 * CRITICAL: Always use this function instead of regex-based sanitization.
 * Regex patterns are easily bypassable via:
 * - img onerror handlers: <img src=x onerror=alert(1)>
 * - SVG scripts: <svg onload=alert(1)>
 * - Malformed tags: <scr<script>ipt>
 * - Event handlers: <div onmouseover=alert(1)>
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * // In a React component - content is sanitized by DOMPurify
 * const clean = sanitizeHtml(untrustedContent);
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * Sanitize minimal HTML content (footer text, simple formatting).
 * More restrictive than sanitizeHtml - only allows basic formatting.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeMinimalHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, MINIMAL_CONFIG);
}

/**
 * Strip all HTML tags, returning plain text only.
 * Useful for extracting text content from HTML.
 *
 * @param html - The HTML string to strip
 * @returns Plain text with all HTML removed
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize pasted HTML content for TipTap editor.
 * Preserves variable spans with data-variable-key/label attributes.
 *
 * Use this in TipTap's transformPastedHTML editorProp.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML safe for TipTap with variables preserved
 */
export function sanitizePastedHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, PASTE_CONFIG);
}
