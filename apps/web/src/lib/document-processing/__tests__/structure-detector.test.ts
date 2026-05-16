/**
 * Tests for AI Structure Detection Service
 * Phase 102-10: Task 2 - AI structure detector
 *
 * TDD: Tests for Gemini-powered persuasion block detection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI SDK before importing the module under test
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mocked-model"),
}));

import {
  detectStructure,
  type DetectedBlock,
  type StructureDetectionResult,
} from "../structure-detector";

describe("structure-detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectStructure", () => {
    it("identifies pain_amplifier blocks from text", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          blocks: [
            {
              id: "block-1",
              type: "pain_amplifier",
              title: "Lost Revenue",
              content: "Every day without SEO, you're losing potential customers to competitors.",
              confidence: 92,
              reasoning: "Quantifies cost and creates urgency",
              variables: [],
            },
          ],
          metadata: {
            language: "en",
            totalWords: 15,
            structurePattern: "Problem statement",
            tone: "direct, urgent",
          },
        },
      } as never);

      const result = await detectStructure(
        "Every day without SEO, you're losing potential customers to competitors."
      );

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe("pain_amplifier");
      expect(result.blocks[0].confidence).toBeGreaterThan(80);
    });

    it("identifies credibility blocks from text", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          blocks: [
            {
              id: "block-1",
              type: "credibility",
              title: "Experience",
              content: "We've helped 47 e-commerce brands achieve page 1 rankings.",
              confidence: 95,
              reasoning: "Specific numbers establish authority",
              variables: [],
            },
          ],
          metadata: {
            language: "en",
            totalWords: 10,
            structurePattern: "Authority statement",
            tone: "confident",
          },
        },
      } as never);

      const result = await detectStructure(
        "We've helped 47 e-commerce brands achieve page 1 rankings."
      );

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe("credibility");
    });

    it("identifies offer_stack blocks with pricing", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          blocks: [
            {
              id: "block-1",
              type: "offer_stack",
              title: "Pricing Packages",
              content: "Starto Package: 2,500 EUR | Augimo Package: 3,500 EUR | Lyderio Package: 5,000 EUR",
              confidence: 97,
              reasoning: "Clear pricing structure with multiple tiers",
              variables: [
                {
                  id: "var-1",
                  originalText: "2,500 EUR",
                  suggestedVariable: "{{pricing.basic}}",
                  variableType: "price",
                  confidence: 90,
                  occurrences: 1,
                  positions: [{ start: 17, end: 26 }],
                },
              ],
            },
          ],
          metadata: {
            language: "lt",
            totalWords: 12,
            structurePattern: "Pricing table",
            tone: "professional",
          },
        },
      } as never);

      const result = await detectStructure(
        "Starto Package: 2,500 EUR | Augimo Package: 3,500 EUR | Lyderio Package: 5,000 EUR"
      );

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe("offer_stack");
    });

    it("includes confidence score for each block", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          blocks: [
            {
              id: "block-1",
              type: "risk_reversal",
              title: "Guarantee",
              content: "If we don't achieve results, you get a full refund.",
              confidence: 88,
              reasoning: "Clear guarantee language",
              variables: [],
            },
          ],
          metadata: { language: "en", totalWords: 10, structurePattern: "Guarantee", tone: "confident" },
        },
      } as never);

      const result = await detectStructure(
        "If we don't achieve results, you get a full refund."
      );

      expect(result.blocks[0].confidence).toBe(88);
      expect(result.blocks[0].confidence).toBeGreaterThanOrEqual(0);
      expect(result.blocks[0].confidence).toBeLessThanOrEqual(100);
    });

    it("orders blocks by position in document", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          blocks: [
            { id: "block-1", type: "pain_amplifier", title: "Pain", content: "Problem first", confidence: 90, position: 0, variables: [] },
            { id: "block-2", type: "credibility", title: "Trust", content: "Authority second", confidence: 85, position: 1, variables: [] },
            { id: "block-3", type: "cta", title: "Action", content: "CTA last", confidence: 95, position: 2, variables: [] },
          ],
          metadata: { language: "en", totalWords: 6, structurePattern: "PAS", tone: "direct" },
        },
      } as never);

      const result = await detectStructure("Problem first\n\nAuthority second\n\nCTA last");

      expect(result.blocks).toHaveLength(3);
      expect(result.blocks[0].position).toBeLessThan(result.blocks[1].position!);
      expect(result.blocks[1].position).toBeLessThan(result.blocks[2].position!);
    });

    it("handles Lithuanian content correctly", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          blocks: [
            {
              id: "block-1",
              type: "pain_amplifier",
              title: "Nuostoliai",
              content: "Kasdien jus atiduodate potencialius klientus konkurentams.",
              confidence: 91,
              reasoning: "Lithuanian pain point text",
              variables: [],
            },
          ],
          metadata: {
            language: "lt",
            totalWords: 7,
            structurePattern: "Problem",
            tone: "direct",
          },
        },
      } as never);

      const result = await detectStructure(
        "Kasdien jus atiduodate potencialius klientus konkurentams."
      );

      expect(result.blocks).toHaveLength(1);
      expect(result.metadata.language).toBe("lt");
    });

    it("returns empty blocks array for non-persuasive text", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          blocks: [],
          metadata: {
            language: "en",
            totalWords: 5,
            structurePattern: "None detected",
            tone: "neutral",
          },
        },
      } as never);

      const result = await detectStructure("The weather is nice today.");

      expect(result.blocks).toHaveLength(0);
    });

    it("handles AI errors gracefully", async () => {
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockRejectedValue(
        new Error("API rate limit exceeded")
      );

      await expect(
        detectStructure("Test content that is longer than five words for testing")
      ).rejects.toThrow("Structure detection failed");
    });

    it("handles empty text input", async () => {
      const result = await detectStructure("");

      expect(result.blocks).toHaveLength(0);
      expect(result.metadata.language).toBe("unknown");
      expect(result.metadata.totalWords).toBe(0);
    });

    it("handles very short text without calling AI", async () => {
      const result = await detectStructure("Hi");

      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe("paragraph");
      expect(result.blocks[0].confidence).toBe(100);
    });
  });

  describe("DetectedBlock type", () => {
    it("has required fields", () => {
      const block: DetectedBlock = {
        id: "test-id",
        type: "pain_amplifier",
        title: "Test",
        content: "Test content",
        confidence: 90,
        variables: [],
      };

      expect(block.id).toBeDefined();
      expect(block.type).toBeDefined();
      expect(block.content).toBeDefined();
      expect(block.confidence).toBeDefined();
    });
  });
});
