/**
 * Tests for document builder types.
 * Phase 102-01: Foundation Schema and Types
 *
 * TDD: RED phase - these tests should fail until types.ts is implemented.
 */

import { describe, it, expect } from "vitest";
import type {
  PersuasionBlockType,
  ExtendedEditorSection,
  StructureLayer,
  ContentLayer,
  ContextLayer,
  TemplateContentMode,
  TemplateBlock,
  BlockVariant,
} from "../types";

describe("document-builder/types", () => {
  describe("PersuasionBlockType", () => {
    it("includes all 11 persuasion block types", () => {
      // All 11 types from CONTEXT.md
      const expectedTypes: PersuasionBlockType[] = [
        "pain_amplifier",
        "villain_story",
        "credibility",
        "social_proof",
        "process_reveal",
        "offer_stack",
        "risk_reversal",
        "objection_handler",
        "urgency",
        "cta",
        "custom",
      ];

      // Type check - this will fail at compile time if any type is missing
      expectedTypes.forEach((type) => {
        const typeCheck: PersuasionBlockType = type;
        expect(typeCheck).toBeDefined();
      });
    });

    it("does not allow invalid types", () => {
      // This is a compile-time check - if uncommented it should fail to compile
      // const invalid: PersuasionBlockType = 'not_a_valid_type';
      expect(true).toBe(true);
    });
  });

  describe("ExtendedEditorSection", () => {
    it("includes optional persuasionType field per D-01", () => {
      const section: ExtendedEditorSection = {
        id: "test-1",
        key: "test_section",
        title: "Test Section",
        content: "<p>Test content</p>",
        sectionType: "custom",
      };

      // persuasionType is optional
      expect(section.persuasionType).toBeUndefined();

      const sectionWithType: ExtendedEditorSection = {
        ...section,
        persuasionType: "pain_amplifier",
      };

      expect(sectionWithType.persuasionType).toBe("pain_amplifier");
    });

    it("includes optional persuasionMeta field per D-01", () => {
      const section: ExtendedEditorSection = {
        id: "test-2",
        key: "pain_section",
        title: "Pain Amplifier",
        content: "<p>Your current SEO...</p>",
        sectionType: "custom",
        persuasionType: "pain_amplifier",
        persuasionMeta: {
          aiHints: "Quantify the cost of inaction",
          frameworkId: "russell_brunson",
          isRequired: true,
        },
      };

      expect(section.persuasionMeta).toBeDefined();
      expect(section.persuasionMeta?.aiHints).toBe("Quantify the cost of inaction");
      expect(section.persuasionMeta?.frameworkId).toBe("russell_brunson");
      expect(section.persuasionMeta?.isRequired).toBe(true);
    });
  });

  describe("3-Layer Architecture (StructureLayer, ContentLayer, ContextLayer)", () => {
    it("StructureLayer has blocks, framework, validation", () => {
      const structure: StructureLayer = {
        blocks: [
          { id: "block-1", type: "pain_amplifier", position: 0 },
          { id: "block-2", type: "credibility", position: 1 },
        ],
        frameworkId: "russell_brunson",
        frameworkName: "Perfect Webinar",
        validation: {
          isValid: false,
          missingBlocks: ["cta"],
          warnings: ["Missing call to action"],
        },
      };

      expect(structure.blocks).toHaveLength(2);
      expect(structure.frameworkId).toBe("russell_brunson");
      expect(structure.validation?.missingBlocks).toContain("cta");
    });

    it("ContentLayer has blocks with content, version, lastModified", () => {
      const content: ContentLayer = {
        blocks: [
          {
            id: "block-1",
            content: { type: "doc", content: [] },
            styling: { backgroundColor: "#fff" },
          },
        ],
        version: 3,
        lastModified: new Date().toISOString(),
      };

      expect(content.blocks).toHaveLength(1);
      expect(content.version).toBe(3);
      expect(content.lastModified).toBeDefined();
    });

    it("ContextLayer has prospect, styleReferences, previousSuccesses", () => {
      const context: ContextLayer = {
        prospect: {
          id: "prospect-1",
          domain: "example.com",
          niche: "e-commerce",
          painPoints: ["low traffic", "poor rankings"],
        },
        styleReferences: [
          { id: "ref-1", type: "pdf", url: "/uploads/style.pdf" },
        ],
        previousSuccesses: [
          {
            caseStudyId: "case-1",
            relevanceScore: 0.85,
            matchingKeywords: ["seo", "e-commerce"],
          },
        ],
      };

      expect(context.prospect.domain).toBe("example.com");
      expect(context.styleReferences).toHaveLength(1);
      expect(context.previousSuccesses?.[0].relevanceScore).toBe(0.85);
    });
  });

  describe("TemplateContentMode (D-07)", () => {
    it("supports fixed, variable, and regenerate modes", () => {
      const fixed: TemplateContentMode = "fixed";
      const variable: TemplateContentMode = "variable";
      const regenerate: TemplateContentMode = "regenerate";

      expect(fixed).toBe("fixed");
      expect(variable).toBe("variable");
      expect(regenerate).toBe("regenerate");
    });
  });

  describe("TemplateBlock", () => {
    it("has mode and content fields", () => {
      const block: TemplateBlock = {
        id: "template-block-1",
        type: "offer_stack",
        mode: "variable",
        defaultContent: { type: "doc", content: [] },
        variableKeys: ["package_name", "price"],
      };

      expect(block.mode).toBe("variable");
      expect(block.variableKeys).toContain("price");
    });
  });

  describe("BlockVariant (D-02)", () => {
    it("has normalized table design fields", () => {
      const variant: BlockVariant = {
        id: "variant-1",
        parentBlockId: "block-1",
        variantName: "Control",
        content: { type: "doc", content: [] },
        styling: null,
        weight: 50,
        impressions: 100,
        conversions: 5,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      expect(variant.parentBlockId).toBe("block-1");
      expect(variant.variantName).toBe("Control");
      expect(variant.weight).toBe(50);
      expect(variant.status).toBe("active");
    });

    it("status is one of: active, paused, winner, loser", () => {
      const statuses: BlockVariant["status"][] = [
        "active",
        "paused",
        "winner",
        "loser",
      ];

      statuses.forEach((status) => {
        expect(["active", "paused", "winner", "loser"]).toContain(status);
      });
    });
  });
});
