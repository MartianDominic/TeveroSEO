/**
 * Template-aware Hash Function for L2 Delta Detection
 *
 * Computes stable SEO content hashes by:
 * 1. Removing dynamic blocks (price, stock, widgets)
 * 2. Extracting only SEO-relevant content (title, meta, headings, main content)
 * 3. Normalizing whitespace
 * 4. SHA256 hashing the result
 *
 * Per 73-02-PLAN.md and docs/infra-research/crawling-10-5000-tasks-day.md:
 * - Trafilatura and readability-lxml extract price as "main content" (unsafe)
 * - This module explicitly strips dynamic blocks before hashing
 *
 * Target: Improve L2 skip rate from 50-70% to 65-80%.
 *
 * @module template-hash
 */

import * as cheerio from "cheerio";
import { createHash } from "crypto";

/**
 * Dynamic blocks to REMOVE before hashing.
 * These change frequently but don't affect SEO.
 */
export const DYNAMIC_BLOCKS = [
  // Price and inventory
  ".price",
  ".product-price",
  '[itemprop="price"]',
  "[data-price]",
  ".stock",
  ".availability",
  '[itemprop="availability"]',
  ".cart",
  ".add-to-cart",
  ".buy-button",
  // Social proof widgets
  ".product-reviews-count",
  ".reviews-summary",
  ".rating-count",
  ".recently-viewed",
  ".people-viewing",
  // Related content (personalized)
  ".recommended",
  ".related-products",
  ".you-may-also-like",
  ".cross-sell",
  ".upsell",
  // Cookie/consent
  ".cookie-banner",
  ".consent-modal",
  "#onetrust-banner",
  // Scripts and styles
  "script",
  "style",
  "noscript",
  "iframe",
  // Forms and interactive elements
  "form",
  "input",
  'button:not([type="submit"])',
] as const;

/**
 * SEO-relevant content to EXTRACT for hashing.
 * Order matters - earlier selectors take priority.
 */
export const SEO_RELEVANT = [
  // Meta tags
  "title",
  'meta[name="description"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  // Headings
  "h1",
  "h2",
  "h3",
  // Structured data
  '[itemprop="description"]',
  '[itemprop="name"]',
  // Main content
  "main",
  "article",
  ".product-description",
  ".content",
  ".entry-content",
  ".post-content",
] as const;

/**
 * Result of template-aware hash computation.
 */
export interface TemplateHashResult {
  /** SHA256 hash of extracted SEO content */
  hash: string;
  /** Extracted content parts for debugging/logging */
  extractedParts: { selector: string; content: string }[];
  /** Number of dynamic blocks removed */
  dynamicBlocksRemoved: number;
}

/**
 * Compute a stable SEO content hash by:
 * 1. Removing dynamic blocks (price, stock, widgets)
 * 2. Extracting only SEO-relevant content
 * 3. Normalizing whitespace
 * 4. SHA256 hashing the result
 *
 * @param html - Raw HTML content
 * @returns Hash result with metadata
 *
 * @example
 * ```typescript
 * const result = computeTemplateAwareHash(html);
 * console.log(result.hash); // 64-char hex string
 * console.log(result.dynamicBlocksRemoved); // e.g., 5
 * ```
 */
export function computeTemplateAwareHash(html: string): TemplateHashResult {
  const $ = cheerio.load(html);
  let dynamicBlocksRemoved = 0;

  // Step 1: Remove dynamic blocks
  for (const selector of DYNAMIC_BLOCKS) {
    const elements = $(selector);
    dynamicBlocksRemoved += elements.length;
    elements.remove();
  }

  // Step 2: Extract SEO-relevant content
  const extractedParts: { selector: string; content: string }[] = [];

  for (const selector of SEO_RELEVANT) {
    $(selector).each((_, el) => {
      const $el = $(el);
      let content: string;

      // Handle meta tags specially - extract content attribute
      if (el.type === "tag" && el.name === "meta") {
        content = $el.attr("content") || "";
      } else if (el.type === "tag" && el.name === "title") {
        content = $el.text();
      } else {
        content = $el.text();
      }

      // Normalize whitespace
      content = content.replace(/\s+/g, " ").trim();

      if (content.length > 0) {
        extractedParts.push({ selector, content });
      }
    });
  }

  // Step 3: Build canonical string for hashing
  // Use selector::content format for deterministic ordering
  const canonicalContent = extractedParts
    .map((p) => `${p.selector}::${p.content}`)
    .join("\n");

  // Step 4: SHA256 hash (full 64 char for collision resistance)
  const hash = createHash("sha256").update(canonicalContent, "utf8").digest("hex");

  return { hash, extractedParts, dynamicBlocksRemoved };
}

/**
 * Compare two HTML documents for SEO-relevant changes.
 *
 * Uses template-aware hashing to ignore dynamic content (price, stock, widgets)
 * and only detect changes to SEO-relevant content (title, meta, headings, main).
 *
 * @param oldHtml - Previous HTML content
 * @param newHtml - Current HTML content
 * @returns true if SEO-relevant content changed, false otherwise
 *
 * @example
 * ```typescript
 * const changed = hasSemanticChanges(oldHtml, newHtml);
 * if (changed) {
 *   // SEO content changed, need to reprocess
 * } else {
 *   // Only dynamic content changed, safe to skip
 * }
 * ```
 */
export function hasSemanticChanges(oldHtml: string, newHtml: string): boolean {
  const oldResult = computeTemplateAwareHash(oldHtml);
  const newResult = computeTemplateAwareHash(newHtml);
  return oldResult.hash !== newResult.hash;
}
