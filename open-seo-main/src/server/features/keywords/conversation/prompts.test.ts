import { describe, it, expect } from "vitest";
import { CONSTRAINT_EXTRACTION_PROMPT, buildExtractionPrompt } from "./prompts";

describe("Constraint Extraction Prompts", () => {
  describe("CONSTRAINT_EXTRACTION_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof CONSTRAINT_EXTRACTION_PROMPT).toBe("string");
      expect(CONSTRAINT_EXTRACTION_PROMPT.length).toBeGreaterThan(100);
    });

    it("should contain XML structure", () => {
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("<system>");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("<task>");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("<categories>");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("<examples>");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("<output_schema>");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("<confidence_rules>");
    });

    it("should contain all 7 constraint categories", () => {
      const categories = [
        "business",
        "geo",
        "audience",
        "funnel",
        "priorities",
        "negatives",
        "specialModes",
      ];

      for (const category of categories) {
        expect(CONSTRAINT_EXTRACTION_PROMPT.toLowerCase()).toContain(
          category.toLowerCase()
        );
      }
    });

    it("should include Lithuanian examples", () => {
      // Check for Lithuanian language indicators
      expect(CONSTRAINT_EXTRACTION_PROMPT).toMatch(/Šiauliai|Vilnius|Kaunas/);
      // Check for example markers
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("Case 1");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("Case 2");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("Case 3");
    });

    it("should include confidence scoring rules", () => {
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("0.9");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("0.7");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("0.5");
    });

    it("should reference output schema matching AnalysisConstraints", () => {
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("BusinessContext");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("GeoConstraints");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("AudienceConstraints");
      expect(CONSTRAINT_EXTRACTION_PROMPT).toContain("FunnelConfig");
    });

    it("should include placeholder for user input", () => {
      expect(CONSTRAINT_EXTRACTION_PROMPT).toMatch(/\{\{USER_INPUT\}\}|\{\{CONVERSATION\}\}/);
    });
  });

  describe("buildExtractionPrompt", () => {
    it("should inject conversation into template", () => {
      const conversation = "I need SEO for my car wash business in Vilnius";
      const prompt = buildExtractionPrompt(conversation);

      expect(prompt).toContain(conversation);
      expect(prompt).not.toContain("{{USER_INPUT}}");
      expect(prompt).not.toContain("{{CONVERSATION}}");
    });

    it("should include optional instruction when provided", () => {
      const conversation = "Test conversation";
      const instruction = "Focus on B2B opportunities";
      const prompt = buildExtractionPrompt(conversation, instruction);

      expect(prompt).toContain(conversation);
      expect(prompt).toContain(instruction);
    });

    it("should work without optional instruction", () => {
      const conversation = "Test conversation";
      const prompt = buildExtractionPrompt(conversation);

      expect(prompt).toContain(conversation);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(conversation.length);
    });

    it("should preserve XML structure from template", () => {
      const conversation = "Test";
      const prompt = buildExtractionPrompt(conversation);

      expect(prompt).toContain("<system>");
      expect(prompt).toContain("<examples>");
      expect(prompt).toContain("<output_schema>");
    });

    it("should handle multi-line conversation", () => {
      const conversation = `We run an e-commerce cosmetics store.
We ship nationwide in Lithuania.
Looking for keywords that convert.`;
      const prompt = buildExtractionPrompt(conversation);

      expect(prompt).toContain(conversation);
    });

    it("should escape special characters safely", () => {
      const conversation = 'Company: "Best Car Wash" <in Vilnius>';
      const prompt = buildExtractionPrompt(conversation);

      expect(prompt).toContain(conversation);
    });
  });
});
