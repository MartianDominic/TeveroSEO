/**
 * ProtectionEnforcementService
 * Phase 37-05: Gap Closure - Protection Enforcement
 *
 * Implements 3-layer content protection for preservation mode:
 * 1. Page-level: Protect entire pages via URL pattern matching
 * 2. Section-level: Protect sections via CSS selectors
 * 3. Text-level: Protect inline content via HTML comment tags
 *
 * Protection tags: <!-- voice:protected --> content <!-- /voice:protected -->
 *
 * Security:
 * - T-37-03: URL validation via ProtectionRulesService
 * - Uses existing protection rules from database
 */

import { protectionRulesService } from "./ProtectionRulesService";
import type { ContentProtectionRuleSelect } from "@/db/voice-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "protection-enforcement-service" });

/**
 * Result from content preservation check.
 */
export interface PreservationResult {
  /** True if entire page should be protected */
  preserveEntirePage: boolean;
  /** Array of protected HTML sections (text content between tags) */
  protectedSections: string[];
  /** CSS selectors for protected sections */
  protectedSelectors: string[];
  /** Reason for protection (if entire page protected) */
  reason?: string;
}

/**
 * Service for enforcing content protection rules.
 *
 * Used during SEO changes to determine what content must be preserved.
 * Supports three protection layers:
 * 1. URL patterns (e.g., /about, /blog/*)
 * 2. CSS selectors (e.g., .brand-message, #hero-section)
 * 3. Inline HTML comments (<!-- voice:protected --> ... <!-- /voice:protected -->)
 *
 * @example
 * ```typescript
 * const service = new ProtectionEnforcementService();
 *
 * // Check if page is protected
 * const isProtected = await service.isContentProtected(
 *   "profile-123",
 *   "https://example.com/about"
 * );
 *
 * // Get full preservation info
 * const result = await service.shouldPreserveContent(
 *   "profile-123",
 *   "https://example.com/blog",
 *   htmlContent
 * );
 * if (result.preserveEntirePage) {
 *   console.log("Cannot modify this page:", result.reason);
 * } else {
 *   console.log("Protected sections:", result.protectedSections.length);
 * }
 * ```
 */
export class ProtectionEnforcementService {
  /**
   * Check if content is protected (simple boolean check).
   *
   * @param profileId - Voice profile ID
   * @param url - Page URL to check
   * @param html - Optional HTML content to scan for inline protection tags
   * @returns True if content is protected by rules or inline tags
   */
  async isContentProtected(
    profileId: string,
    url: string,
    html?: string
  ): Promise<boolean> {
    // Check URL-based protection
    const urlProtected = await this.isUrlProtected(profileId, url);
    if (urlProtected) {
      return true;
    }

    // Check inline tag protection
    if (html && this.hasProtectionTags(html)) {
      return true;
    }

    return false;
  }

  /**
   * Extract all protected sections from HTML content.
   * Finds content between <!-- voice:protected --> and <!-- /voice:protected --> tags.
   *
   * @param html - HTML content to scan
   * @returns Array of protected HTML sections
   */
  extractProtectedSections(html: string): string[] {
    const sections: string[] = [];

    // Regex to find content between voice:protected tags
    // Non-greedy match to handle multiple protected sections
    const regex = /<!--\s*voice:protected\s*-->([\s\S]*?)<!--\s*\/voice:protected\s*-->/gi;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const content = match[1].trim();
      if (content) {
        sections.push(content);
      }
    }

    return sections;
  }

  /**
   * Comprehensive check for content preservation.
   * Returns detailed info about what should be preserved and why.
   *
   * @param profileId - Voice profile ID
   * @param url - Page URL to check
   * @param html - Optional HTML content to scan
   * @returns Preservation result with flags and protected content
   */
  async shouldPreserveContent(
    profileId: string,
    url: string,
    html?: string
  ): Promise<PreservationResult> {
    const result: PreservationResult = {
      preserveEntirePage: false,
      protectedSections: [],
      protectedSelectors: [],
    };

    // Layer 1: Check URL-based page protection
    const pageRule = await this.getMatchingPageRule(profileId, url);
    if (pageRule) {
      result.preserveEntirePage = true;
      result.reason = pageRule.reason ?? undefined;
      log.info("Page protected by URL rule", {
        url,
        rule: pageRule.target,
        reason: pageRule.reason,
      });
      return result;
    }

    // Layer 2: Check CSS selector rules
    const selectorRules = await this.getSelectorRules(profileId);
    if (selectorRules.length > 0) {
      result.protectedSelectors = selectorRules.map((r) => r.target);
      log.info("CSS selectors protected", {
        url,
        selectors: result.protectedSelectors,
      });
    }

    // Layer 3: Extract inline protected sections
    if (html) {
      result.protectedSections = this.extractProtectedSections(html);
      if (result.protectedSections.length > 0) {
        log.info("Inline protected sections found", {
          url,
          count: result.protectedSections.length,
        });
      }
    }

    return result;
  }

  /**
   * Check if URL matches any page protection rules.
   */
  private async isUrlProtected(profileId: string, url: string): Promise<boolean> {
    const rule = await this.getMatchingPageRule(profileId, url);
    return rule !== null;
  }

  /**
   * Get page rule that matches the given URL.
   */
  private async getMatchingPageRule(
    profileId: string,
    url: string
  ): Promise<ContentProtectionRuleSelect | null> {
    const rules = await protectionRulesService.getActiveRules(profileId);
    const pageRules = rules.filter((r) => r.ruleType === "page");

    // Extract path from URL for comparison
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    for (const rule of pageRules) {
      if (this.matchesPattern(path, rule.target)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Get all active CSS selector rules.
   */
  private async getSelectorRules(
    profileId: string
  ): Promise<ContentProtectionRuleSelect[]> {
    const rules = await protectionRulesService.getActiveRules(profileId);
    return rules.filter((r) => r.ruleType === "section");
  }

  /**
   * Match a path against a URL pattern.
   * Supports wildcards (e.g., /blog/* matches /blog/post-1).
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Exact match
    if (path === pattern) {
      return true;
    }

    // Wildcard match: /blog/* matches /blog/anything
    if (pattern.includes("*")) {
      const regexPattern = pattern
        .replace(/\*/g, ".*") // Replace * with .*
        .replace(/\//g, "\\/"); // Escape forward slashes
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(path);
    }

    // Full URL match (if pattern is full URL)
    if (pattern.startsWith("http://") || pattern.startsWith("https://")) {
      try {
        const patternUrl = new URL(pattern);
        return this.matchesPattern(path, patternUrl.pathname);
      } catch {
        // Invalid URL pattern, no match
        return false;
      }
    }

    return false;
  }

  /**
   * Check if HTML contains any voice:protected tags.
   */
  private hasProtectionTags(html: string): boolean {
    return /<!--\s*voice:protected\s*-->/.test(html);
  }
}

/**
 * Singleton instance for use in server functions.
 */
export const protectionEnforcementService = new ProtectionEnforcementService();
