/**
 * AI Generator Service Tests
 * Phase 102-03: AI content generation
 *
 * TDD tests for the AI content generation service.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the Google AI SDK
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => ({
    name: "gemini-3.1-pro",
  })),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

import { generateText } from "ai";

import {
  generateBlockContent,
  buildPrompt,
  type GenerationRequest,
} from "../ai-generator";

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

describe("ai-generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateBlockContent", () => {
    it("accepts GenerationRequest and returns content string", async () => {
      const request: GenerationRequest = {
        blockType: "pain_amplifier",
        intent: "create",
        prospect: {
          id: "prospect-1",
          domain: "example.com",
          niche: "e-commerce",
          painPoints: ["low traffic", "poor rankings"],
        },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Jūsų dabartinė SEO strategija kainuoja jums €5,000 per mėnesį...",
      });

      const result = await generateBlockContent(request);

      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("calls generateText with gemini-3.1-pro model", async () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: {
          id: "prospect-1",
          domain: "test.lt",
        },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Per pastaruosius 5 metus padėjome...",
      });

      await generateBlockContent(request);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.model.name).toBe("gemini-3.1-pro");
    });

    it("returns fallback message on API failure", async () => {
      const request: GenerationRequest = {
        blockType: "cta",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      mockGenerateText.mockRejectedValueOnce(new Error("API rate limit exceeded"));

      const result = await generateBlockContent(request);

      expect(result.content).toContain("Unable to generate content");
      expect(result.confidence).toBe(0);
    });

    it("handles Lithuanian language constraint", async () => {
      const request: GenerationRequest = {
        blockType: "offer_stack",
        intent: "create",
        prospect: {
          id: "prospect-1",
          domain: "parduotuve.lt",
        },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Paketas apima...",
      });

      await generateBlockContent(request);

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.prompt).toContain("Lithuanian");
    });

    it("handles English language constraint", async () => {
      const request: GenerationRequest = {
        blockType: "risk_reversal",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "We guarantee...",
      });

      await generateBlockContent(request);

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.prompt).toContain("English");
    });
  });

  describe("buildPrompt", () => {
    it("includes block type in prompt", () => {
      const request: GenerationRequest = {
        blockType: "social_proof",
        intent: "create",
        prospect: { id: "p1" },
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("social_proof");
      expect(prompt).toContain("Social Proof");
    });

    it("includes prospect context when available", () => {
      const request: GenerationRequest = {
        blockType: "pain_amplifier",
        intent: "create",
        prospect: {
          id: "p1",
          domain: "myshop.lt",
          niche: "fashion retail",
          painPoints: ["low conversion rate", "high bounce rate"],
        },
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("myshop.lt");
      expect(prompt).toContain("fashion retail");
      expect(prompt).toContain("low conversion rate");
      expect(prompt).toContain("high bounce rate");
    });

    it("includes style references when provided", () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: { id: "p1" },
        styleReferences: [
          {
            id: "ref-1",
            type: "text",
            content: "Professional, confident, data-driven tone",
          },
        ],
        language: "en",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("Professional, confident, data-driven tone");
    });

    it("includes existing content for improve intent", () => {
      const request: GenerationRequest = {
        blockType: "cta",
        intent: "improve",
        prospect: { id: "p1" },
        existingContent: "Contact us today!",
        language: "en",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("Contact us today!");
      expect(prompt).toContain("Improve");
    });

    it("includes framework context when provided", () => {
      const request: GenerationRequest = {
        blockType: "villain_story",
        intent: "create",
        prospect: { id: "p1" },
        framework: "russell_brunson",
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("russell_brunson");
    });

    it("includes preceding blocks context when provided", () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: { id: "p1" },
        precedingBlocks: [
          "Your current SEO costs you money",
          "Other agencies fail to deliver",
        ],
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("Your current SEO costs you money");
      expect(prompt).toContain("Other agencies fail to deliver");
    });

    it("includes max length constraint when provided", () => {
      const request: GenerationRequest = {
        blockType: "urgency",
        intent: "create",
        prospect: { id: "p1" },
        maxLength: 150,
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("150");
    });

    it("includes tone constraint when provided", () => {
      const request: GenerationRequest = {
        blockType: "offer_stack",
        intent: "create",
        prospect: { id: "p1" },
        tone: "urgent",
        language: "en",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("urgent");
    });
  });
});
