/**
 * VoiceAnalyzer tests - TDD RED phase.
 * Phase 37: Brand Voice Management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzePageVoice, aggregateVoiceResults, buildVoicePrompt } from "./VoiceAnalyzer";
import type { PageAnalysis } from "@/server/lib/audit/types";
import type { VoiceExtractionResult } from "../types";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// Store original env
const originalEnv = process.env.ANTHROPIC_API_KEY;

const mockPage: PageAnalysis = {
  url: "https://example.com/about",
  statusCode: 200,
  redirectUrl: null,
  responseTimeMs: 150,
  title: "About Us - Example Company",
  metaDescription: "We are a professional team dedicated to excellence.",
  canonical: "https://example.com/about",
  robotsMeta: null,
  ogTitle: "About Example Company",
  ogDescription: "Learn about our team and mission.",
  ogImage: null,
  h1s: ["About Our Company"],
  headingOrder: [1, 2, 2, 3],
  wordCount: 850,
  images: [],
  internalLinks: [],
  externalLinks: [],
  hasStructuredData: true,
  hreflangTags: [],
};

const mockValidResponse = {
  tone_primary: "professional",
  tone_secondary: "friendly",
  formality_level: 7,
  personality_traits: ["trustworthy", "knowledgeable", "approachable"],
  archetype: "professional" as const,
  sentence_length_avg: 18,
  paragraph_length_avg: 4,
  contraction_usage: "sometimes" as const,
  vocabulary_patterns: { preferred: ["innovative", "solutions"], avoided: ["cheap", "basic"] },
  signature_phrases: ["leading the way", "trusted partner"],
  forbidden_phrases: ["buy now", "limited time"],
  heading_style: "title_case" as const,
};

describe("VoiceAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set API key for tests that need it
    process.env.ANTHROPIC_API_KEY = "test-api-key";
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  describe("analyzePageVoice", () => {
    it("returns VoiceExtractionResult with all 12 dimensions", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ ...mockValidResponse, confidence: 85, sample_sentences: ["We deliver excellence."], reasoning: "Clear professional tone." }) }],
      });
      vi.mocked(Anthropic).mockImplementation(() => ({ messages: { create: mockCreate } }) as never);

      const result = await analyzePageVoice(mockPage, "example.com");

      expect(result.dimensions).toBeDefined();
      expect(result.dimensions.tone_primary).toBe("professional");
      expect(result.dimensions.formality_level).toBeGreaterThanOrEqual(1);
      expect(result.dimensions.formality_level).toBeLessThanOrEqual(10);
      expect(result.dimensions.personality_traits).toBeInstanceOf(Array);
      expect(result.dimensions.archetype).toBeDefined();
      expect(result.dimensions.vocabulary_patterns.preferred).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it("returns low confidence (< 30) for minimal content", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ ...mockValidResponse, confidence: 25, sample_sentences: [], reasoning: "Insufficient content." }) }],
      });
      vi.mocked(Anthropic).mockImplementation(() => ({ messages: { create: mockCreate } }) as never);

      const minimalPage: PageAnalysis = { ...mockPage, wordCount: 50, title: "", metaDescription: "" };
      const result = await analyzePageVoice(minimalPage, "example.com");

      expect(result.confidence).toBeLessThan(30);
    });

    it("rejects malformed AI output", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "not valid json" }],
      });
      vi.mocked(Anthropic).mockImplementation(() => ({ messages: { create: mockCreate } }) as never);

      await expect(analyzePageVoice(mockPage, "example.com")).rejects.toThrow();
    });
  });

  describe("buildVoicePrompt", () => {
    it("includes all 12 dimension definitions", () => {
      const prompt = buildVoicePrompt([mockPage]);

      expect(prompt).toContain("tone_primary");
      expect(prompt).toContain("tone_secondary");
      expect(prompt).toContain("formality_level");
      expect(prompt).toContain("personality_traits");
      expect(prompt).toContain("archetype");
      expect(prompt).toContain("sentence_length_avg");
      expect(prompt).toContain("paragraph_length_avg");
      expect(prompt).toContain("contraction_usage");
      expect(prompt).toContain("vocabulary_patterns");
      expect(prompt).toContain("signature_phrases");
      expect(prompt).toContain("forbidden_phrases");
      expect(prompt).toContain("heading_style");
    });
  });

  describe("aggregateVoiceResults", () => {
    it("combines multiple page analyses into single profile", () => {
      const results: VoiceExtractionResult[] = [
        {
          dimensions: { ...mockValidResponse, formality_level: 6, sentence_length_avg: 16 },
          confidence: 80,
          sample_sentences: ["First page."],
          reasoning: "Professional tone.",
        },
        {
          dimensions: { ...mockValidResponse, formality_level: 8, sentence_length_avg: 20 },
          confidence: 90,
          sample_sentences: ["Second page."],
          reasoning: "Formal tone.",
        },
      ];

      const aggregated = aggregateVoiceResults(results);

      // Numeric fields should be averaged (weighted by confidence)
      expect(aggregated.formality_level).toBeGreaterThan(6);
      expect(aggregated.formality_level).toBeLessThan(8);
      expect(aggregated.sentence_length_avg).toBeGreaterThan(16);
      expect(aggregated.sentence_length_avg).toBeLessThan(20);
    });

    it("merges arrays from multiple results", () => {
      const results: VoiceExtractionResult[] = [
        {
          dimensions: { ...mockValidResponse, personality_traits: ["trustworthy"], signature_phrases: ["phrase1"] },
          confidence: 80,
          sample_sentences: [],
          reasoning: "",
        },
        {
          dimensions: { ...mockValidResponse, personality_traits: ["innovative"], signature_phrases: ["phrase2"] },
          confidence: 85,
          sample_sentences: [],
          reasoning: "",
        },
      ];

      const aggregated = aggregateVoiceResults(results);

      expect(aggregated.personality_traits).toContain("trustworthy");
      expect(aggregated.personality_traits).toContain("innovative");
      expect(aggregated.signature_phrases).toContain("phrase1");
      expect(aggregated.signature_phrases).toContain("phrase2");
    });

    it("picks most common categorical values", () => {
      const results: VoiceExtractionResult[] = [
        { dimensions: { ...mockValidResponse, archetype: "professional", heading_style: "title_case" }, confidence: 80, sample_sentences: [], reasoning: "" },
        { dimensions: { ...mockValidResponse, archetype: "professional", heading_style: "sentence_case" }, confidence: 85, sample_sentences: [], reasoning: "" },
        { dimensions: { ...mockValidResponse, archetype: "casual", heading_style: "title_case" }, confidence: 75, sample_sentences: [], reasoning: "" },
      ];

      const aggregated = aggregateVoiceResults(results);

      expect(aggregated.archetype).toBe("professional"); // Most common
      expect(aggregated.heading_style).toBe("title_case"); // Most common
    });
  });
});
