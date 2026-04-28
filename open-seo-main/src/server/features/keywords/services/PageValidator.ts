/**
 * PageValidator - Consent/Challenge Page Detection
 *
 * Detects cookie consent walls, bot challenges, and blocking pages
 * that return HTTP 200 but contain only a consent shell instead of
 * actual content.
 *
 * The problem: GDPR cookie-consent walls and Cloudflare bot-challenge
 * pages return HTTP 200 with structured-looking HTML, but the body is
 * a consent shell - not the actual content. Without detection, the
 * crawler would:
 * - Extract "We use cookies" as product description
 * - Report "thin content" for pages that are actually rich
 * - Miss all product data behind the consent wall
 *
 * This validator uses a layered approach:
 * 1. Fast string signature matching (no parsing)
 * 2. HTML size threshold checking
 * 3. DOM selector validation (only if needed)
 * 4. Product indicator verification
 */

import {
  CONSENT_SIGNATURES,
  CONSENT_DOM_SELECTORS,
  BOT_CHALLENGE_SIGNATURES,
  PRODUCT_PAGE_INDICATORS,
  MAIN_CONTENT_SELECTORS,
} from "../data/consent-signatures";
import {
  ValidationResult,
  ValidationConfig,
  DEFAULT_VALIDATION_CONFIG,
  type SuggestedAction,
  type ValidationReason,
} from "../types/validation";

/**
 * PageValidator detects consent walls, bot challenges, and blocking pages.
 *
 * Design principles:
 * - Fast validation: signature check before any DOM parsing
 * - Layered checks: cheap operations first
 * - Actionable results: suggestedAction tells crawler what to do
 * - Non-blocking: valid pages with non-blocking banners pass
 */
export class PageValidator {
  private readonly config: ValidationConfig;

  // Pre-computed lowercase signatures for fast matching
  private readonly consentSignaturesLower: readonly string[];
  private readonly challengeSignaturesLower: readonly string[];

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };

    // Pre-compute lowercase versions for case-insensitive matching
    this.consentSignaturesLower = CONSENT_SIGNATURES.map((s) => s.toLowerCase());
    this.challengeSignaturesLower = BOT_CHALLENGE_SIGNATURES.map((s) =>
      s.toLowerCase()
    );
  }

  /**
   * Validate that a page contains real content, not a consent/challenge wall.
   *
   * Uses layered checks for performance:
   * 1. Empty/invalid HTML check
   * 2. Known platform signatures (fast string includes)
   * 3. Suspiciously small page check
   * 4. Consent banner DOM check
   * 5. Product content verification
   *
   * @param html - Raw HTML string from crawler
   * @returns ValidationResult with isValid, reason, and suggestedAction
   */
  validate(html: string): ValidationResult {
    // Handle empty/null HTML
    if (!html || html.trim().length === 0) {
      return this.createResult(false, "empty_html", "skip_or_reclassify", {
        htmlSize: 0,
      });
    }

    const htmlLower = html.toLowerCase();
    const htmlSize = html.length;

    // Check 1: Known platform signatures (fast string matching)
    const signatureResult = this.checkSignatures(htmlLower, htmlSize);
    if (signatureResult !== null) {
      return signatureResult;
    }

    // Check 2: Suspiciously small page with consent keywords
    if (htmlSize < this.config.minHtmlSize) {
      if (this.hasConsentKeywords(htmlLower)) {
        return this.createResult(
          false,
          "small_page_with_consent_keywords",
          "retry_with_js",
          { htmlSize }
        );
      }
    }

    // Check 3: Consent banner DOM elements without main content
    // Only parse DOM if we suspect consent issues
    const domResult = this.checkDomElements(html, htmlSize);
    if (domResult !== null) {
      return domResult;
    }

    // Check 4: Product content verification (if required)
    if (this.config.requireProductIndicators) {
      const hasProducts = this.looksLikeProductPage(html);
      if (!hasProducts) {
        return this.createResult(
          false,
          "no_product_content_found",
          "skip_or_reclassify",
          { htmlSize, hasProductIndicators: false }
        );
      }
    }

    // All checks passed
    return this.createResult(true, "ok", null, {
      htmlSize,
      hasProductIndicators: this.looksLikeProductPage(html),
    });
  }

  /**
   * Quick check if page is a consent or challenge page.
   * Faster than full validate() when you only need a boolean.
   */
  isConsentOrChallengePage(html: string): boolean {
    if (!html || html.trim().length === 0) {
      return false;
    }

    const htmlLower = html.toLowerCase();

    // Check for consent signatures
    for (const sig of this.consentSignaturesLower) {
      if (htmlLower.includes(sig)) {
        // Found signature - check if it's blocking content
        if (!this.hasMainContent(html)) {
          return true;
        }
      }
    }

    // Check for challenge signatures
    for (const sig of this.challengeSignaturesLower) {
      if (htmlLower.includes(sig)) {
        // Challenge signatures are almost always blocking
        if (!this.hasMainContent(html)) {
          return true;
        }
      }
    }

    // Check for small pages with consent keywords
    if (html.length < this.config.minHtmlSize && this.hasConsentKeywords(htmlLower)) {
      return true;
    }

    return false;
  }

  /**
   * Check if page has substantial main content.
   * Uses simple CSS selectors to find content areas.
   */
  hasMainContent(html: string): boolean {
    const htmlLower = html.toLowerCase();

    for (const selector of MAIN_CONTENT_SELECTORS) {
      // Convert CSS selector to simple tag/class/id check
      const pattern = this.selectorToPattern(selector);
      if (pattern && htmlLower.includes(pattern)) {
        // Found content area - check if it has substantial text
        const contentLength = this.estimateContentLength(html, selector);
        if (contentLength >= this.config.minContentLength) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if page looks like a product page.
   * Uses product-specific indicators to verify.
   */
  looksLikeProductPage(html: string): boolean {
    const htmlLower = html.toLowerCase();

    for (const indicator of PRODUCT_PAGE_INDICATORS) {
      const pattern = this.selectorToPattern(indicator);
      if (pattern && htmlLower.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  // ========== Private Methods ==========

  /**
   * Check for known consent/challenge platform signatures.
   */
  private checkSignatures(
    htmlLower: string,
    htmlSize: number
  ): ValidationResult | null {
    // Check consent signatures
    for (const sig of this.consentSignaturesLower) {
      if (htmlLower.includes(sig)) {
        // Signature found - but is real content also present?
        // Simple heuristic: check if page has enough content
        if (htmlSize < this.config.minHtmlSize * 3) {
          // Small page with consent signature is likely blocking
          return this.createResult(
            false,
            `consent_or_challenge:${sig}` as ValidationReason,
            "retry_with_js",
            { htmlSize, detectedSignature: sig }
          );
        }
        // Large page with consent signature might just have a non-blocking banner
        // Continue to content checks
      }
    }

    // Check challenge signatures (these are almost always blocking)
    for (const sig of this.challengeSignaturesLower) {
      if (htmlLower.includes(sig)) {
        // Challenge pages are typically small
        if (htmlSize < this.config.minHtmlSize * 5) {
          return this.createResult(
            false,
            `consent_or_challenge:${sig}` as ValidationReason,
            "retry_with_js",
            { htmlSize, detectedSignature: sig }
          );
        }
      }
    }

    return null;
  }

  /**
   * Check for consent banner DOM elements.
   */
  private checkDomElements(
    html: string,
    htmlSize: number
  ): ValidationResult | null {
    const htmlLower = html.toLowerCase();

    for (const selector of CONSENT_DOM_SELECTORS) {
      const pattern = this.selectorToPattern(selector);
      if (pattern && htmlLower.includes(pattern)) {
        // Found consent DOM element - check for main content
        if (!this.hasMainContent(html)) {
          return this.createResult(
            false,
            `consent_banner_blocking:${selector}` as ValidationReason,
            "retry_with_js",
            { htmlSize, detectedSignature: selector }
          );
        }
        // Consent element present but main content exists - non-blocking banner
      }
    }

    return null;
  }

  /**
   * Check if HTML contains generic consent keywords.
   */
  private hasConsentKeywords(htmlLower: string): boolean {
    const keywords = [
      "cookie",
      "consent",
      "gdpr",
      "privacy",
      "captcha",
      "challenge",
      "verifying",
      "checking your browser",
    ];

    let matches = 0;
    for (const keyword of keywords) {
      if (htmlLower.includes(keyword)) {
        matches++;
        if (matches >= 2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Convert CSS selector to simple pattern for string matching.
   * Only handles basic selectors (id, class, tag, attribute).
   */
  private selectorToPattern(selector: string, depth = 0): string | null {
    // Prevent infinite recursion
    if (depth > 3 || !selector || selector.trim().length === 0) {
      return null;
    }

    const trimmed = selector.trim();

    // ID selector: #foo -> id="foo" or id='foo'
    if (trimmed.startsWith("#")) {
      const id = trimmed.slice(1).toLowerCase();
      if (id.length > 0) {
        return `id="${id}"`;
      }
      return null;
    }

    // Class selector: .foo -> class="...foo..." or class='...foo...'
    if (trimmed.startsWith(".")) {
      const className = trimmed.slice(1).toLowerCase();
      if (className.length > 0) {
        return className;
      }
      return null;
    }

    // Attribute selector: [attr="value"] or [attr*="value"]
    if (trimmed.startsWith("[")) {
      const match = trimmed.match(/\[([^=\]]+)(?:[\*~\^$]?=["']?([^"'\]]+))?/);
      if (match) {
        const attr = match[1].toLowerCase();
        const value = match[2]?.toLowerCase();
        if (value) {
          return `${attr}="${value}"`;
        }
        return attr;
      }
      return null;
    }

    // Tag selector
    if (/^[a-z]+$/i.test(trimmed)) {
      return `<${trimmed.toLowerCase()}`;
    }

    // Complex selectors - return first part
    const parts = trimmed.split(/[\s,>+~]/);
    if (parts.length > 0 && parts[0] && parts[0].trim().length > 0) {
      return this.selectorToPattern(parts[0], depth + 1);
    }

    return null;
  }

  /**
   * Estimate content length within a selector area.
   * Simple heuristic - counts text-like characters after tag.
   */
  private estimateContentLength(html: string, selector: string): number {
    const pattern = this.selectorToPattern(selector);
    if (!pattern) return 0;

    const htmlLower = html.toLowerCase();
    const startIdx = htmlLower.indexOf(pattern);
    if (startIdx === -1) return 0;

    // Find the closing tag (rough estimate)
    const tagMatch = selector.match(/^([a-z]+)/i);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : null;

    // Extract a chunk after the match and count text
    const chunk = html.slice(startIdx, startIdx + 5000);

    // Strip HTML tags and count remaining text
    const textOnly = chunk.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    return textOnly.length;
  }

  /**
   * Create a ValidationResult with all fields.
   */
  private createResult(
    isValid: boolean,
    reason: ValidationReason,
    suggestedAction: SuggestedAction,
    details?: ValidationResult["details"]
  ): ValidationResult {
    return {
      isValid,
      reason,
      suggestedAction,
      details,
    };
  }
}

// Export default instance
export const pageValidator = new PageValidator();
