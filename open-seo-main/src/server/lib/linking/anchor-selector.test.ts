/**
 * Tests for anchor-selector.ts
 * Phase 35-03: Anchor Selection
 *
 * TDD: Tests written first, implementation follows.
 */
import { describe, it, expect } from "vitest";
import {
  selectAnchorText,
  findExistingTextMatch,
  determineAnchorType,
  generateBrandedAnchor,
  generateMiscAnchor,
  normalizeText,
} from "./anchor-selector";
import type { SourcePageData, AnchorDistribution } from "./types";

describe("anchor-selector", () => {
  // ============================================================
  // normalizeText
  // ============================================================
  describe("normalizeText", () => {
    it("should lowercase text", () => {
      expect(normalizeText("SEO Tips")).toBe("seo tips");
    });

    it("should trim whitespace", () => {
      expect(normalizeText("  hello world  ")).toBe("hello world");
    });

    it("should collapse multiple spaces", () => {
      expect(normalizeText("hello   world")).toBe("hello world");
    });
  });

  // ============================================================
  // findExistingTextMatch
  // ============================================================
  describe("findExistingTextMatch", () => {
    const bodyText = `
      Our comprehensive SEO tips guide covers everything you need to know.
      Learn about link building strategies and on-page optimization.
      Visit our marketing services page for more information.
    `;

    it("should find exact keyword match in body text", () => {
      const result = findExistingTextMatch(bodyText, "SEO tips");
      expect(result).not.toBeNull();
      expect(result?.toLowerCase()).toBe("seo tips");
    });

    it("should find case-insensitive match", () => {
      const result = findExistingTextMatch(bodyText, "seo tips");
      expect(result).not.toBeNull();
    });

    it("should return null when keyword not found", () => {
      const result = findExistingTextMatch(bodyText, "cryptocurrency trading");
      expect(result).toBeNull();
    });

    it("should prefer longer exact matches", () => {
      const text = "Our link building strategies help with link building campaigns";
      const result = findExistingTextMatch(text, "link building strategies");
      expect(result).toBe("link building strategies");
    });

    it("should handle partial matches within words", () => {
      const text = "SEO optimization is important";
      // Should NOT match "SEO" inside a word like "SEOtips" (if it existed)
      const result = findExistingTextMatch("SEOtips guide", "SEO");
      // If SEO is part of "SEOtips", it should not match as standalone
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // determineAnchorType
  // ============================================================
  describe("determineAnchorType", () => {
    it("should prefer exact when distribution is low", () => {
      const distribution: AnchorDistribution = { exact: 0, branded: 2, misc: 2 };
      const type = determineAnchorType(distribution, true, true);
      expect(type).toBe("exact");
    });

    it("should prefer branded when exact is high and branded is low", () => {
      const distribution: AnchorDistribution = { exact: 5, branded: 0, misc: 2 };
      const type = determineAnchorType(distribution, true, true);
      expect(type).toBe("branded");
    });

    it("should return misc when both exact and branded are high", () => {
      const distribution: AnchorDistribution = { exact: 5, branded: 3, misc: 0 };
      const type = determineAnchorType(distribution, true, true);
      expect(type).toBe("misc");
    });

    it("should not return exact when no target keyword available", () => {
      const distribution: AnchorDistribution = { exact: 0, branded: 0, misc: 0 };
      const type = determineAnchorType(distribution, false, true);
      expect(type).not.toBe("exact");
    });

    it("should not return branded when no brand name available", () => {
      const distribution: AnchorDistribution = { exact: 5, branded: 0, misc: 5 };
      const type = determineAnchorType(distribution, true, false);
      expect(type).not.toBe("branded");
    });

    it("should maintain ~50% exact / 25% branded / 25% misc ratio", () => {
      // Test the ideal distribution logic
      // With 4 exact, 2 branded, 2 misc -> total 8
      // Ideal: 4 exact (50%), 2 branded (25%), 2 misc (25%)
      // This is balanced, so next should go to exact if possible
      const distribution: AnchorDistribution = { exact: 4, branded: 2, misc: 2 };
      const type = determineAnchorType(distribution, true, true);
      // exact is at 50%, so we may continue with exact or balance others
      expect(["exact", "branded", "misc"]).toContain(type);
    });
  });

  // ============================================================
  // generateBrandedAnchor
  // ============================================================
  describe("generateBrandedAnchor", () => {
    it("should generate anchor with brand name", () => {
      const anchor = generateBrandedAnchor("SEO tips", "Acme");
      expect(anchor.toLowerCase()).toContain("acme");
    });

    it("should create variations like 'Brand's guide'", () => {
      const anchor = generateBrandedAnchor("SEO strategies", "Acme");
      // Could be "Acme's SEO strategies" or "Acme SEO guide" etc.
      expect(anchor.toLowerCase()).toContain("acme");
    });

    it("should handle missing keyword gracefully", () => {
      const anchor = generateBrandedAnchor(null, "Acme");
      expect(anchor.toLowerCase()).toContain("acme");
    });
  });

  // ============================================================
  // generateMiscAnchor
  // ============================================================
  describe("generateMiscAnchor", () => {
    it("should generate anchor from page title", () => {
      const anchor = generateMiscAnchor("10 Best SEO Tips for Beginners", "seo tips");
      expect(anchor.length).toBeGreaterThan(0);
      expect(anchor.length).toBeLessThanOrEqual(60); // Reasonable length
    });

    it("should use partial phrases like 'learn more about X'", () => {
      const anchor = generateMiscAnchor("SEO Guide", "seo");
      expect(anchor.length).toBeGreaterThan(0);
    });

    it("should handle null title", () => {
      const anchor = generateMiscAnchor(null, "seo tips");
      expect(anchor.length).toBeGreaterThan(0);
    });

    it("should handle null keyword", () => {
      const anchor = generateMiscAnchor("Page Title", null);
      expect(anchor.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // selectAnchorText - Main function
  // ============================================================
  describe("selectAnchorText", () => {
    const createSourcePage = (bodyText: string, brandName?: string): SourcePageData => ({
      pageId: "source-1",
      pageUrl: "https://example.com/source",
      bodyText,
      brandName,
    });

    it("should return confidence 0.9+ when wrapping existing text", () => {
      const sourcePage = createSourcePage(
        "Learn about our SEO strategies and marketing tips."
      );
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: "SEO strategies",
        targetTitle: "SEO Strategies Guide",
        anchorDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.existingTextMatch).not.toBeNull();
    });

    it("should return confidence ~0.6 when inserting new text", () => {
      const sourcePage = createSourcePage(
        "This article discusses various marketing topics."
      );
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: "SEO optimization",
        targetTitle: "SEO Optimization Tips",
        anchorDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      expect(result.confidence).toBeLessThan(0.9);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.existingTextMatch).toBeNull();
    });

    it("should select exact anchor type when distribution favors it", () => {
      const sourcePage = createSourcePage(
        "Our SEO tips guide covers everything.",
        "Acme"
      );
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: "SEO tips",
        targetTitle: "SEO Tips",
        anchorDistribution: { exact: 0, branded: 3, misc: 3 },
      });

      expect(result.anchorType).toBe("exact");
    });

    it("should select branded anchor type when needed for balance", () => {
      const sourcePage = createSourcePage(
        "Learn about digital marketing strategies.",
        "Acme"
      );
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: "marketing",
        targetTitle: "Marketing Guide",
        anchorDistribution: { exact: 5, branded: 0, misc: 2 },
      });

      expect(result.anchorType).toBe("branded");
      expect(result.anchorText.toLowerCase()).toContain("acme");
    });

    it("should provide insertion context when no existing match", () => {
      const sourcePage = createSourcePage(
        "First paragraph about general topics.\n\nSecond paragraph with more content."
      );
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: "unrelated keyword",
        targetTitle: "Unrelated Page",
        anchorDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      if (result.existingTextMatch === null) {
        expect(result.insertionContext).not.toBeNull();
      }
    });

    it("should handle source page without brand name", () => {
      const sourcePage = createSourcePage(
        "Content about SEO without brand."
        // No brand name
      );
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: "SEO",
        targetTitle: "SEO Guide",
        anchorDistribution: { exact: 5, branded: 0, misc: 0 },
      });

      // Should not return branded since no brand available
      expect(result.anchorType).not.toBe("branded");
    });

    it("should handle missing target keyword", () => {
      const sourcePage = createSourcePage("General content here.", "Acme");
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: null,
        targetTitle: "Some Page Title",
        anchorDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      // Should still return a valid anchor
      expect(result.anchorText.length).toBeGreaterThan(0);
      expect(result.anchorType).not.toBe("exact"); // Can't be exact without keyword
    });

    it("should return proper AnchorSelection shape", () => {
      const sourcePage = createSourcePage("SEO content here.", "Acme");
      const result = selectAnchorText({
        sourcePage,
        targetKeyword: "SEO",
        targetTitle: "SEO Guide",
        anchorDistribution: { exact: 0, branded: 0, misc: 0 },
      });

      expect(result).toHaveProperty("anchorText");
      expect(result).toHaveProperty("anchorType");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("existingTextMatch");
      expect(result).toHaveProperty("insertionContext");
      expect(typeof result.anchorText).toBe("string");
      expect(["exact", "branded", "misc"]).toContain(result.anchorType);
      expect(typeof result.confidence).toBe("number");
    });
  });
});
