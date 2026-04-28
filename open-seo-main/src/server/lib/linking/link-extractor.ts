/**
 * Link extractor for internal linking analysis.
 * Phase 35-01: Link Graph Schema + Extraction
 *
 * Parses HTML and extracts detailed link information including position,
 * anchor text, and contextual data for the link graph.
 */
import * as cheerio from "cheerio";
import type { LinkPosition, LinkType } from "@/db/link-schema";
import type {
  DetailedLink,
  ExtractLinksOptions,
  ExtractLinksResult,
} from "./types";

/**
 * Extract all internal links from HTML with detailed metadata.
 *
 * @param options - Extraction options including HTML, page URL, and site origin
 * @returns Extraction result with links and skip counts
 */
export function extractDetailedLinks(
  options: ExtractLinksOptions
): ExtractLinksResult {
  const { html, pageUrl, siteOrigin, urlToPageMap } = options;
  const $ = cheerio.load(html);

  const links: DetailedLink[] = [];
  let externalLinksSkipped = 0;
  let invalidLinksSkipped = 0;

  // Assign unique IDs to links for position/context extraction
  $("a[href]").each((index, element) => {
    const $link = $(element);
    $link.attr("data-link-index", String(index));
  });

  // Get modified HTML with data attributes for helper functions
  const modifiedHtml = $.html();

  $("a[href]").each((_, element) => {
    const $link = $(element);
    const href = $link.attr("href");

    if (!href) {
      invalidLinksSkipped++;
      return;
    }

    // Skip invalid link types
    if (isInvalidLink(href)) {
      invalidLinksSkipped++;
      return;
    }

    // Resolve relative URLs
    let resolvedUrl: URL;
    try {
      resolvedUrl = new URL(href, pageUrl);
    } catch {
      invalidLinksSkipped++;
      return;
    }

    // Skip external links
    const targetOrigin = `${resolvedUrl.protocol}//${resolvedUrl.hostname}`;
    if (!isSameOrigin(targetOrigin, siteOrigin)) {
      externalLinksSkipped++;
      return;
    }

    // Normalize URL (remove trailing slash, hash)
    const normalizedUrl = normalizeUrl(resolvedUrl);

    // Extract link attributes
    const anchorText = $link.text().trim();
    const rel = $link.attr("rel") || "";
    const hasTitle = !!$link.attr("title");

    // Detect link type
    const linkType = detectLinkType($link);

    // Get position and paragraph index
    const linkSelector = `a[data-link-index="${$link.attr("data-link-index")}"]`;
    const position = classifyLinkPosition(modifiedHtml, linkSelector);
    const paragraphIndex =
      position === "body" ? getParagraphIndex(modifiedHtml, linkSelector) : null;

    // Extract context
    const context = extractContext(modifiedHtml, linkSelector);

    // Resolve target page ID if available
    const targetPageId = urlToPageMap?.get(normalizedUrl) ?? null;

    links.push({
      targetUrl: normalizedUrl,
      targetPageId,
      anchorText,
      context,
      position,
      paragraphIndex,
      isDoFollow: !rel.includes("nofollow"),
      linkType,
      hasTitle,
      hasNoOpener: rel.includes("noopener"),
    });
  });

  return {
    links,
    externalLinksSkipped,
    invalidLinksSkipped,
  };
}

/**
 * Check if a link href is invalid (javascript:, mailto:, tel:, hash-only).
 */
function isInvalidLink(href: string): boolean {
  const lowerHref = href.toLowerCase().trim();

  if (lowerHref.startsWith("javascript:")) return true;
  if (lowerHref.startsWith("mailto:")) return true;
  if (lowerHref.startsWith("tel:")) return true;
  if (lowerHref === "#" || lowerHref.startsWith("#")) return true;

  return false;
}

/**
 * Check if two origins are the same (ignoring protocol).
 */
function isSameOrigin(origin1: string, origin2: string): boolean {
  const normalize = (o: string) =>
    o.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return normalize(origin1) === normalize(origin2);
}

/**
 * Normalize URL: remove trailing slash and hash fragment.
 */
function normalizeUrl(url: URL): string {
  let normalized = `${url.origin}${url.pathname}`;

  // Remove trailing slash (except for root)
  if (normalized.endsWith("/") && normalized !== url.origin + "/") {
    normalized = normalized.slice(0, -1);
  }

  // Handle root URL: keep it as origin without trailing slash
  if (normalized === url.origin + "/") {
    normalized = url.origin;
  }

  return normalized;
}

/**
 * Detect link type based on content and position.
 */
function detectLinkType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $link: cheerio.Cheerio<any>
): LinkType {
  // Check if link contains an image
  if ($link.find("img").length > 0) {
    return "image";
  }

  // Other types determined by position (will be set in main function)
  return "contextual";
}

/**
 * Classify the position of a link in the page structure.
 *
 * @param html - Full HTML content
 * @param linkSelector - CSS selector for the specific link
 * @returns Position classification
 */
export function classifyLinkPosition(
  html: string,
  linkSelector: string
): LinkPosition {
  const $ = cheerio.load(html);
  const $link = $(linkSelector);

  if ($link.length === 0) {
    return "body";
  }

  // Check ancestors for position indicators
  const ancestors = $link.parents().toArray();

  for (const ancestor of ancestors) {
    const $ancestor = $(ancestor);
    const tagName = ancestor.tagName?.toLowerCase() || "";
    const className = ($ancestor.attr("class") || "").toLowerCase();

    // Check for nav
    if (
      tagName === "nav" ||
      className.includes("navigation") ||
      className.includes("nav-") ||
      className.includes("-nav") ||
      className.includes("menu")
    ) {
      return "nav";
    }

    // Check for header
    if (tagName === "header" || className.includes("header")) {
      return "header";
    }

    // Check for footer
    if (tagName === "footer" || className.includes("footer")) {
      return "footer";
    }

    // Check for sidebar
    if (
      tagName === "aside" ||
      className.includes("sidebar") ||
      className.includes("widget")
    ) {
      return "sidebar";
    }
  }

  // Default to body
  return "body";
}

/**
 * Get the paragraph index (1-indexed) for a link within main content.
 *
 * @param html - Full HTML content
 * @param linkSelector - CSS selector for the specific link
 * @returns Paragraph index or null if not in a paragraph
 */
export function getParagraphIndex(
  html: string,
  linkSelector: string
): number | null {
  const $ = cheerio.load(html);
  const $link = $(linkSelector);

  if ($link.length === 0) {
    return null;
  }

  // Find the containing paragraph
  const $paragraph = $link.closest("p");
  if ($paragraph.length === 0) {
    return null;
  }

  // Find the main content container
  const $main = $("main, article, .content, .post-content, .entry-content");
  const $contentContainer = $main.length > 0 ? $main.first() : $("body");

  // Get all paragraphs in the content container
  const paragraphs = $contentContainer.find("p").toArray();

  // Find the index of the paragraph containing the link
  for (let i = 0; i < paragraphs.length; i++) {
    if ($(paragraphs[i]).is($paragraph)) {
      return i + 1; // 1-indexed
    }
  }

  return null;
}

/**
 * Extract surrounding context (~50 chars before and after the link).
 *
 * @param html - Full HTML content
 * @param linkSelector - CSS selector for the specific link
 * @returns Context string
 */
export function extractContext(html: string, linkSelector: string): string {
  const $ = cheerio.load(html);
  const $link = $(linkSelector);

  if ($link.length === 0) {
    return "";
  }

  // Get the parent element's text content
  const $parent = $link.parent();
  const parentText = $parent.text();
  const linkText = $link.text();

  // Find the link text position in parent
  const linkPos = parentText.indexOf(linkText);
  if (linkPos === -1) {
    return parentText.slice(0, 100);
  }

  // Extract context: ~50 chars before and after
  const contextBefore = 50;
  const contextAfter = 50;

  const start = Math.max(0, linkPos - contextBefore);
  const end = Math.min(
    parentText.length,
    linkPos + linkText.length + contextAfter
  );

  let context = parentText.slice(start, end).trim();

  // Clean up whitespace
  context = context.replace(/\s+/g, " ");

  return context;
}
