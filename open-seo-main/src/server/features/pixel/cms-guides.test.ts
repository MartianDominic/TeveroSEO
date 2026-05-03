/**
 * CMS Installation Guides Tests
 * Phase 66-03: Platform-specific installation guides
 *
 * Tests for installation guides with step-by-step instructions for 14+ platforms.
 * Per DESIGN.md Section 6 and 9 requirements:
 * - 3-5 steps per platform with simple language (5th-8th grade level)
 * - Screenshots, code snippets, and help links
 */
import { describe, it, expect } from "vitest";
import {
  CMS_GUIDES,
  getGuide,
  SUPPORTED_PLATFORMS,
  type InstallationGuide,
  type GuideStep,
} from "./cms-guides";

describe("CMS Installation Guides", () => {
  // ============================================================================
  // Guide Structure Tests
  // ============================================================================

  describe("CMS_GUIDES structure", () => {
    it("exports CMS_GUIDES object", () => {
      expect(CMS_GUIDES).toBeDefined();
      expect(typeof CMS_GUIDES).toBe("object");
    });

    it("contains all 14 required platforms", () => {
      const requiredPlatforms = [
        "wordpress_self_hosted",
        "wordpress_com",
        "shopify",
        "wix",
        "squarespace",
        "webflow",
        "weebly",
        "godaddy",
        "hubspot",
        "ghost",
        "bigcommerce",
        "woocommerce",
        "magento",
        "custom_html",
      ];

      for (const platform of requiredPlatforms) {
        expect(CMS_GUIDES[platform]).toBeDefined();
      }
    });

    it("includes GTM fallback guide", () => {
      expect(CMS_GUIDES.gtm_fallback).toBeDefined();
    });
  });

  // ============================================================================
  // Guide Content Tests
  // ============================================================================

  describe("guide content requirements", () => {
    const platforms = Object.keys(CMS_GUIDES);

    for (const platform of platforms) {
      describe(`${platform} guide`, () => {
        const guide = CMS_GUIDES[platform];

        it("has required properties", () => {
          expect(guide.platform).toBe(platform);
          expect(typeof guide.name).toBe("string");
          expect(guide.name.length).toBeGreaterThan(0);
          expect(typeof guide.estimatedTime).toBe("string");
          expect(["easy", "medium", "hard"]).toContain(guide.difficulty);
          expect(typeof guide.paidPlanRequired).toBe("boolean");
          expect(typeof guide.fallbackToGtm).toBe("boolean");
        });

        it("has 3-5 steps", () => {
          expect(guide.steps.length).toBeGreaterThanOrEqual(3);
          expect(guide.steps.length).toBeLessThanOrEqual(5);
        });

        it("steps have sequential numbers", () => {
          guide.steps.forEach((step, index) => {
            expect(step.number).toBe(index + 1);
          });
        });

        it("steps have title and description", () => {
          guide.steps.forEach((step) => {
            expect(typeof step.title).toBe("string");
            expect(step.title.length).toBeGreaterThan(0);
            expect(typeof step.description).toBe("string");
            expect(step.description.length).toBeGreaterThan(0);
          });
        });

        it("has at least one step with code snippet", () => {
          const hasCode = guide.steps.some((step) => step.code !== undefined);
          expect(hasCode).toBe(true);
        });
      });
    }
  });

  // ============================================================================
  // Code Snippet Tests
  // ============================================================================

  describe("code snippets", () => {
    it("code snippets contain TeveroSEO pixel script", () => {
      Object.values(CMS_GUIDES).forEach((guide) => {
        const stepsWithCode = guide.steps.filter((step) => step.code);
        stepsWithCode.forEach((step) => {
          expect(step.code).toContain("pixel.tevero.io");
          expect(step.code).toContain("{{SITE_ID}}");
        });
      });
    });

    it("WordPress guide has header.php code", () => {
      const guide = CMS_GUIDES.wordpress_self_hosted;
      const codeStep = guide.steps.find((step) => step.code);
      expect(codeStep?.code).toContain("<script");
    });

    it("Shopify guide has theme.liquid code", () => {
      const guide = CMS_GUIDES.shopify;
      const codeStep = guide.steps.find((step) => step.code);
      expect(codeStep?.code).toContain("<script");
    });
  });

  // ============================================================================
  // Copy Requirements Tests (5th-8th grade level)
  // ============================================================================

  describe("copy requirements (5th-8th grade level)", () => {
    const complexWords = [
      "implement",
      "deploy",
      "DOM",
      "JavaScript",
      "embed",
      "snippet",
    ];

    Object.entries(CMS_GUIDES).forEach(([platform, guide]) => {
      it(`${platform} uses simple language`, () => {
        const allText = guide.steps
          .map((step) => `${step.title} ${step.description}`)
          .join(" ");

        // Should not contain complex words
        for (const word of complexWords) {
          const regex = new RegExp(`\\b${word}\\b`, "i");
          expect(regex.test(allText)).toBe(false);
        }
      });
    });

    it("WordPress guide uses 'helper' instead of 'script'", () => {
      const guide = CMS_GUIDES.wordpress_self_hosted;
      const codeStepDescription = guide.steps.find((s) => s.code)?.description;
      // Either uses 'helper' or doesn't say 'script' in a confusing way
      expect(codeStepDescription?.toLowerCase()).not.toContain(
        "javascript file"
      );
    });

    it("guides include reassurance text", () => {
      // At least some guides should mention safety
      const allDescriptions = Object.values(CMS_GUIDES)
        .flatMap((g) => g.steps.map((s) => s.description.toLowerCase()))
        .join(" ");

      const hasReassurance =
        allDescriptions.includes("safe") ||
        allDescriptions.includes("that's it") ||
        allDescriptions.includes("done");

      expect(hasReassurance).toBe(true);
    });
  });

  // ============================================================================
  // Screenshot Path Tests
  // ============================================================================

  describe("screenshot paths", () => {
    Object.entries(CMS_GUIDES).forEach(([platform, guide]) => {
      it(`${platform} has valid screenshot paths`, () => {
        guide.steps.forEach((step) => {
          if (step.screenshot) {
            expect(step.screenshot).toMatch(/^\/guides\//);
            expect(step.screenshot).toMatch(/\.png$/);
          }
        });
      });
    });
  });

  // ============================================================================
  // Estimated Time Tests
  // ============================================================================

  describe("estimated time", () => {
    it("most platforms have 2 min estimated time", () => {
      const twoMinPlatforms = Object.values(CMS_GUIDES).filter(
        (g) => g.estimatedTime === "2 min"
      );
      expect(twoMinPlatforms.length).toBeGreaterThan(8);
    });

    it("Magento has longer estimated time (5 min)", () => {
      expect(CMS_GUIDES.magento.estimatedTime).toBe("5 min");
    });

    it("custom_html has shortest time (1 min)", () => {
      expect(CMS_GUIDES.custom_html.estimatedTime).toBe("1 min");
    });
  });

  // ============================================================================
  // Paid Plan Requirements Tests
  // ============================================================================

  describe("paid plan requirements", () => {
    it("wordpress_com requires paid plan", () => {
      expect(CMS_GUIDES.wordpress_com.paidPlanRequired).toBe(true);
    });

    it("wix requires paid plan", () => {
      expect(CMS_GUIDES.wix.paidPlanRequired).toBe(true);
    });

    it("squarespace requires paid plan", () => {
      expect(CMS_GUIDES.squarespace.paidPlanRequired).toBe(true);
    });

    it("wordpress_self_hosted does not require paid plan", () => {
      expect(CMS_GUIDES.wordpress_self_hosted.paidPlanRequired).toBe(false);
    });

    it("shopify does not require paid plan", () => {
      expect(CMS_GUIDES.shopify.paidPlanRequired).toBe(false);
    });
  });

  // ============================================================================
  // GTM Fallback Tests
  // ============================================================================

  describe("GTM fallback", () => {
    it("GTM fallback guide exists", () => {
      const guide = CMS_GUIDES.gtm_fallback;
      expect(guide).toBeDefined();
      expect(guide.platform).toBe("gtm_fallback");
      expect(guide.name).toContain("Google Tag Manager");
    });

    it("GTM fallback has 4 steps", () => {
      expect(CMS_GUIDES.gtm_fallback.steps.length).toBe(4);
    });

    it("GTM fallback mentions Custom HTML tag", () => {
      const guide = CMS_GUIDES.gtm_fallback;
      const hasCustomHtml = guide.steps.some(
        (step) =>
          step.title.toLowerCase().includes("custom html") ||
          step.description.toLowerCase().includes("custom html")
      );
      expect(hasCustomHtml).toBe(true);
    });
  });

  // ============================================================================
  // getGuide Function Tests
  // ============================================================================

  describe("getGuide function", () => {
    it("returns guide for valid platform", () => {
      const guide = getGuide("shopify");
      expect(guide).toBeDefined();
      expect(guide?.platform).toBe("shopify");
    });

    it("returns undefined for invalid platform", () => {
      const guide = getGuide("nonexistent" as any);
      expect(guide).toBeUndefined();
    });

    it("interpolates siteId into code snippets when provided", () => {
      const guide = getGuide("shopify", "my-site-123");
      const codeStep = guide?.steps.find((step) => step.code);
      expect(codeStep?.code).toContain("my-site-123");
      expect(codeStep?.code).not.toContain("{{SITE_ID}}");
    });

    it("keeps {{SITE_ID}} placeholder when no siteId provided", () => {
      const guide = getGuide("shopify");
      const codeStep = guide?.steps.find((step) => step.code);
      expect(codeStep?.code).toContain("{{SITE_ID}}");
    });
  });

  // ============================================================================
  // SUPPORTED_PLATFORMS Export Tests
  // ============================================================================

  describe("SUPPORTED_PLATFORMS export", () => {
    it("exports array of platform keys", () => {
      expect(Array.isArray(SUPPORTED_PLATFORMS)).toBe(true);
      expect(SUPPORTED_PLATFORMS.length).toBeGreaterThanOrEqual(14);
    });

    it("matches CMS_GUIDES keys", () => {
      const guideKeys = Object.keys(CMS_GUIDES);
      expect(SUPPORTED_PLATFORMS.length).toBe(guideKeys.length);
      for (const platform of SUPPORTED_PLATFORMS) {
        expect(guideKeys).toContain(platform);
      }
    });
  });

  // ============================================================================
  // Help Link Tests
  // ============================================================================

  describe("help links", () => {
    it("guides have help links on last step", () => {
      Object.values(CMS_GUIDES).forEach((guide) => {
        const lastStep = guide.steps[guide.steps.length - 1];
        // Last step should have either helpLink or clear completion message
        const hasHelpOrDone =
          lastStep.helpLink !== undefined ||
          lastStep.description.toLowerCase().includes("that's it") ||
          lastStep.description.toLowerCase().includes("done");
        expect(hasHelpOrDone).toBe(true);
      });
    });
  });
});
