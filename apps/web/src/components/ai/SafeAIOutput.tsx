'use client';

import { useMemo } from 'react';

import DOMPurify, { type Config } from 'dompurify';

/**
 * Default allowed tags for AI-generated HTML content.
 * These are safe formatting elements that don't allow script execution.
 */
const DEFAULT_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'blockquote', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div', 'hr',
];

/**
 * Safe attributes that don't enable script execution.
 */
const DEFAULT_ALLOWED_ATTRS = ['href', 'target', 'rel', 'class', 'id'];

interface SafeAIOutputProps {
  /** The AI-generated content to render */
  content: string;
  /** Whether to allow HTML rendering (default: false - plain text only) */
  allowHtml?: boolean;
  /** Custom list of allowed HTML tags (only used when allowHtml=true) */
  allowedTags?: string[];
  /** Custom list of allowed attributes */
  allowedAttrs?: string[];
  /** Additional CSS classes */
  className?: string;
  /** HTML tag to use as container (default: 'div') */
  as?: 'div' | 'span' | 'article' | 'section';
}

/**
 * Safely render AI-generated content.
 *
 * Uses DOMPurify for HTML sanitization when HTML rendering is enabled.
 * By default, renders content as plain text with no HTML interpretation.
 *
 * SECURITY: This component uses dangerouslySetInnerHTML ONLY with content
 * that has been sanitized by DOMPurify. The sanitization removes all
 * potentially dangerous elements including script tags, event handlers,
 * and javascript: URLs.
 *
 * @example
 * // Plain text rendering (safest)
 * <SafeAIOutput content={aiResponse} />
 *
 * @example
 * // HTML rendering with sanitization
 * <SafeAIOutput content={aiHtml} allowHtml />
 *
 * @example
 * // Custom allowed tags
 * <SafeAIOutput
 *   content={aiHtml}
 *   allowHtml
 *   allowedTags={['p', 'br', 'strong', 'em']}
 * />
 */
export function SafeAIOutput({
  content,
  allowHtml = false,
  allowedTags = DEFAULT_ALLOWED_TAGS,
  allowedAttrs = DEFAULT_ALLOWED_ATTRS,
  className = '',
  as: Component = 'div',
}: SafeAIOutputProps) {
  const sanitizedContent = useMemo(() => {
    if (!content) {
      return '';
    }

    if (!allowHtml) {
      // Strip all HTML and render as plain text
      // This is the safest option for most use cases
      return content.replace(/<[^>]*>/g, '');
    }

    // Configure DOMPurify for safe HTML rendering
    const purifyConfig: Config = {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttrs,
      ALLOW_DATA_ATTR: false,
      // Prevent JavaScript URL schemes
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      // Remove any CDATA sections
      KEEP_CONTENT: true,
      // Return string, not DOM node
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    };

    return DOMPurify.sanitize(content, purifyConfig);
  }, [content, allowHtml, allowedTags, allowedAttrs]);

  if (!allowHtml) {
    return (
      <Component className={`whitespace-pre-wrap ${className}`}>
        {sanitizedContent}
      </Component>
    );
  }

  // SECURITY: Content is sanitized by DOMPurify above - all dangerous
  // elements (script, event handlers, javascript: URLs) are removed.
  // This is a safe use of dangerouslySetInnerHTML.
  return (
    <Component
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}

interface SafeMarkdownProps {
  /** The AI-generated markdown content */
  content: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Render AI-generated markdown safely.
 *
 * Performs basic markdown-to-HTML conversion and then sanitizes
 * the result with DOMPurify.
 *
 * SECURITY: Uses DOMPurify to sanitize the converted HTML before rendering.
 *
 * Note: For production use with complex markdown, consider using
 * a proper markdown parser like remark or marked with DOMPurify.
 *
 * @example
 * <SafeMarkdown content={aiMarkdown} />
 */
export function SafeMarkdown({
  content,
  className = '',
}: SafeMarkdownProps) {
  const sanitized = useMemo(() => {
    if (!content) {
      return '';
    }

    // Basic markdown to HTML conversion
    // For production, use a proper markdown parser
    let html = content
      // Headers (must come before other patterns to avoid conflicts)
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Code blocks (must come before inline code)
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Unordered lists (basic)
      .replace(/^\s*[-*+]\s+(.*)$/gm, '<li>$1</li>')
      // Ordered lists (basic)
      .replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>')
      // Horizontal rules
      .replace(/^[-*_]{3,}$/gm, '<hr />')
      // Blockquotes
      .replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
      // Paragraphs (line breaks)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br />');

    // Wrap in paragraph if not starting with block element
    if (!html.match(/^<(h[1-6]|p|ul|ol|pre|blockquote|hr)/)) {
      html = `<p>${html}</p>`;
    }

    // Sanitize the resulting HTML with DOMPurify
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'b', 'em', 'i',
        'ul', 'ol', 'li',
        'a', 'code', 'pre',
        'blockquote',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [content]);

  // SECURITY: Content is sanitized by DOMPurify above
  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

/**
 * Strip all HTML tags from content, returning plain text.
 * Useful for cases where you need the text content only.
 */
export function stripHtml(content: string): string {
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [] });
}

/**
 * Check if content contains potentially dangerous patterns.
 * Returns true if the content appears safe.
 */
export function isContentSafe(content: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:\s*text\/html/i,
    /vbscript:/i,
  ];

  return !dangerousPatterns.some(pattern => pattern.test(content));
}
