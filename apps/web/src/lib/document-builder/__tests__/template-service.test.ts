/**
 * Template Service Tests
 * Phase 102-03: Framework templates
 *
 * Tests for framework template management and validation.
 */

import { describe, expect, it } from "vitest";

import {
  getFrameworkTemplate,
  getAllFrameworkTemplates,
  applyFrameworkToCanvas,
  validateCanvasCompliance,
  getCanvasFrameworkSequence,
  isBlockRequired,
  getSuggestedNextBlock,
} from "../template-service";
import type { PersuasionBlock } from "../types";

describe("template-service", () => {
  describe("getFrameworkTemplate", () => {
    it("returns russell_brunson framework", () => {
      const framework = getFrameworkTemplate("russell_brunson");
      expect(framework).toBeDefined();
      expect(framework?.name).toBe("Perfect Webinar");
    });

    it("returns storybrand framework", () => {
      const framework = getFrameworkTemplate("storybrand");
      expect(framework).toBeDefined();
      expect(framework?.name).toBe("StoryBrand");
    });

    it("returns pas framework", () => {
      const framework = getFrameworkTemplate("pas");
      expect(framework).toBeDefined();
      expect(framework?.name).toBe("Problem-Agitate-Solution");
    });

    it("returns undefined for unknown framework", () => {
      const framework = getFrameworkTemplate("unknown");
      expect(framework).toBeUndefined();
    });
  });

  describe("getAllFrameworkTemplates", () => {
    it("returns array with 3 frameworks", () => {
      const frameworks = getAllFrameworkTemplates();
      expect(frameworks).toHaveLength(3);
      expect(frameworks.map((f) => f.id)).toContain("russell_brunson");
      expect(frameworks.map((f) => f.id)).toContain("storybrand");
      expect(frameworks.map((f) => f.id)).toContain("pas");
    });
  });

  describe("applyFrameworkToCanvas", () => {
    it("creates blocks for russell_brunson framework", () => {
      const blocks = applyFrameworkToCanvas("russell_brunson");
      expect(blocks).not.toBeNull();
      expect(blocks!.length).toBeGreaterThan(0);
      expect(blocks![0].persuasionMeta.frameworkId).toBe("russell_brunson");
    });

    it("returns null for unknown framework (M-ERR-01)", () => {
      const blocks = applyFrameworkToCanvas("unknown");
      // M-ERR-01: null indicates "not found" vs [] for "exists but empty"
      expect(blocks).toBeNull();
    });

    it("creates blocks in recommended sequence order", () => {
      const blocks = applyFrameworkToCanvas("pas");
      expect(blocks).not.toBeNull();
      expect(blocks![0].type).toBe("pain_amplifier");
      expect(blocks![blocks!.length - 1].type).toBe("cta");
    });

    it("marks required blocks correctly", () => {
      const blocks = applyFrameworkToCanvas("pas");
      expect(blocks).not.toBeNull();
      const ctaBlock = blocks!.find((b) => b.type === "cta");
      expect(ctaBlock?.persuasionMeta.isRequired).toBe(true);
    });

    it("creates blocks with template placeholder content (not empty)", () => {
      const blocks = applyFrameworkToCanvas("russell_brunson");
      expect(blocks).not.toBeNull();

      // Every block should have TipTap content with actual text
      for (const block of blocks!) {
        expect(block.content).toBeDefined();
        expect(block.content.type).toBe("doc");
        expect(block.content.content).toBeDefined();
        expect(block.content.content!.length).toBeGreaterThan(0);

        // Verify the content has actual text (not just empty paragraph)
        const paragraph = block.content.content![0] as { type: string; content?: Array<{ text?: string }> };
        expect(paragraph.type).toBe("paragraph");
        expect(paragraph.content).toBeDefined();
        expect(paragraph.content!.length).toBeGreaterThan(0);
        expect(paragraph.content![0].text).toBeTruthy();
      }
    });

    it("creates blocks with block-type-specific placeholder text", () => {
      const blocks = applyFrameworkToCanvas("pas");
      expect(blocks).not.toBeNull();

      // pain_amplifier should have cost/SEO related placeholder
      const painBlock = blocks!.find((b) => b.type === "pain_amplifier");
      const painContent = painBlock?.content.content as Array<{ content?: Array<{ text?: string }> }> | undefined;
      expect(painContent?.[0]?.content?.[0]?.text).toContain("SEO");

      // cta should have action-oriented placeholder
      const ctaBlock = blocks!.find((b) => b.type === "cta");
      const ctaContent = ctaBlock?.content.content as Array<{ content?: Array<{ text?: string }> }> | undefined;
      expect(ctaContent?.[0]?.content?.[0]?.text).toContain("transform");
    });
  });

  describe("validateCanvasCompliance", () => {
    const createMockBlock = (type: string, position = 0): PersuasionBlock => ({
      id: `block-${type}`,
      type: type as PersuasionBlock["type"],
      position,
      content: { type: "doc", content: [] },
      title: type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    it("returns valid for no framework", () => {
      const blocks = [createMockBlock("pain_amplifier")];
      const result = validateCanvasCompliance(blocks, "");
      expect(result.isValid).toBe(true);
      expect(result.complianceScore).toBe(100);
    });

    it("returns valid when all required blocks present", () => {
      // PAS framework requires: pain_amplifier, offer_stack, cta
      const blocks = [
        createMockBlock("pain_amplifier"),
        createMockBlock("offer_stack"),
        createMockBlock("cta"),
      ];
      const result = validateCanvasCompliance(blocks, "pas");
      expect(result.isValid).toBe(true);
      expect(result.missingBlocks).toHaveLength(0);
    });

    it("returns invalid when required blocks missing", () => {
      // PAS framework requires: pain_amplifier, offer_stack, cta
      const blocks = [createMockBlock("pain_amplifier")];
      const result = validateCanvasCompliance(blocks, "pas");
      expect(result.isValid).toBe(false);
      expect(result.missingBlocks).toContain("offer_stack");
      expect(result.missingBlocks).toContain("cta");
    });

    it("includes warnings for missing blocks", () => {
      const blocks = [createMockBlock("pain_amplifier")];
      const result = validateCanvasCompliance(blocks, "pas");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("Missing required block"))).toBe(true);
    });

    it("calculates compliance score correctly", () => {
      // PAS has 3 required blocks
      const blocks = [
        createMockBlock("pain_amplifier"),
        createMockBlock("cta"),
      ];
      const result = validateCanvasCompliance(blocks, "pas");
      expect(result.complianceScore).toBe(67); // 2/3 = 66.67, rounded to 67
    });
  });

  describe("getCanvasFrameworkSequence", () => {
    it("returns sequence for valid framework", () => {
      const sequence = getCanvasFrameworkSequence("pas");
      expect(sequence).toContain("pain_amplifier");
      expect(sequence).toContain("cta");
    });

    it("returns empty array for unknown framework", () => {
      const sequence = getCanvasFrameworkSequence("unknown");
      expect(sequence).toHaveLength(0);
    });
  });

  describe("isBlockRequired", () => {
    it("returns true for required block", () => {
      expect(isBlockRequired("pas", "pain_amplifier")).toBe(true);
      expect(isBlockRequired("pas", "cta")).toBe(true);
    });

    it("returns false for optional block", () => {
      expect(isBlockRequired("pas", "social_proof")).toBe(false);
    });

    it("returns false for unknown framework", () => {
      expect(isBlockRequired("unknown", "pain_amplifier")).toBe(false);
    });
  });

  describe("getSuggestedNextBlock", () => {
    const createMockBlock = (type: string, position: number): PersuasionBlock => ({
      id: `block-${type}`,
      type: type as PersuasionBlock["type"],
      position,
      content: { type: "doc", content: [] },
      title: type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    it("suggests first block when canvas is empty", () => {
      const suggestion = getSuggestedNextBlock([], "pas");
      expect(suggestion).toBe("pain_amplifier");
    });

    it("suggests next block in sequence", () => {
      const blocks = [createMockBlock("pain_amplifier", 0)];
      const suggestion = getSuggestedNextBlock(blocks, "pas");
      expect(suggestion).toBe("villain_story");
    });

    it("returns undefined when all blocks present", () => {
      // PAS sequence: pain_amplifier, villain_story, offer_stack, cta
      const blocks = [
        createMockBlock("pain_amplifier", 0),
        createMockBlock("villain_story", 1),
        createMockBlock("offer_stack", 2),
        createMockBlock("cta", 3),
      ];
      const suggestion = getSuggestedNextBlock(blocks, "pas");
      expect(suggestion).toBeUndefined();
    });

    it("returns undefined when no framework", () => {
      const suggestion = getSuggestedNextBlock([], null);
      expect(suggestion).toBeUndefined();
    });
  });
});
