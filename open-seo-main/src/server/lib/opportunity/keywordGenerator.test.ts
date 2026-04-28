/**
 * Tests for AI-powered keyword opportunity generator.
 * Phase 29: AI Opportunity Discovery - Task 29-01
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateKeywordOpportunities,
  buildKeywordPrompt,
  parseKeywordResponse,
  type KeywordGeneratorInput,
  type GeneratedKeyword,
} from "./keywordGenerator";

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe("keywordGenerator", () => {
  const mockInput: KeywordGeneratorInput = {
    products: ["barrel sauna", "outdoor sauna", "sauna heater"],
    brands: ["Harvia", "Huum"],
    services: ["sauna installation", "sauna maintenance"],
    location: "Helsinki, Finland",
    targetMarket: "both",
    language: "en",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  describe("buildKeywordPrompt", () => {
    it("should include products in the prompt", () => {
      const prompt = buildKeywordPrompt(mockInput);

      expect(prompt).toContain("barrel sauna");
      expect(prompt).toContain("outdoor sauna");
      expect(prompt).toContain("sauna heater");
    });

    it("should include brands in the prompt", () => {
      const prompt = buildKeywordPrompt(mockInput);

      expect(prompt).toContain("Harvia");
      expect(prompt).toContain("Huum");
    });

    it("should include services in the prompt", () => {
      const prompt = buildKeywordPrompt(mockInput);

      expect(prompt).toContain("sauna installation");
      expect(prompt).toContain("sauna maintenance");
    });

    it("should include location in the prompt", () => {
      const prompt = buildKeywordPrompt(mockInput);

      expect(prompt).toContain("Helsinki, Finland");
    });

    it("should request JSON array output", () => {
      const prompt = buildKeywordPrompt(mockInput);

      expect(prompt).toContain("JSON");
    });

    it("should handle empty arrays gracefully", () => {
      const emptyInput: KeywordGeneratorInput = {
        products: [],
        brands: [],
        services: [],
        location: null,
        targetMarket: null,
        language: "en",
      };

      const prompt = buildKeywordPrompt(emptyInput);

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
    });

    it("should specify target language", () => {
      const ltInput: KeywordGeneratorInput = {
        ...mockInput,
        language: "lt",
      };

      const prompt = buildKeywordPrompt(ltInput);

      expect(prompt).toContain("Lithuanian");
    });
  });

  describe("parseKeywordResponse", () => {
    it("should parse valid JSON array response", () => {
      const response = JSON.stringify([
        { keyword: "barrel sauna price", category: "product" },
        { keyword: "Harvia heater reviews", category: "brand" },
        { keyword: "sauna installation cost", category: "service" },
        { keyword: "buy outdoor sauna", category: "commercial" },
        { keyword: "how to build a sauna", category: "informational" },
      ]);

      const result = parseKeywordResponse(response);

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        keyword: "barrel sauna price",
        category: "product",
      });
    });

    it("should handle JSON wrapped in markdown code blocks", () => {
      const response = `\`\`\`json
[
  { "keyword": "barrel sauna", "category": "product" }
]
\`\`\``;

      const result = parseKeywordResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].keyword).toBe("barrel sauna");
    });

    it("should filter out invalid categories", () => {
      const response = JSON.stringify([
        { keyword: "valid keyword", category: "product" },
        { keyword: "invalid category", category: "random" },
        { keyword: "another valid", category: "commercial" },
      ]);

      const result = parseKeywordResponse(response);

      expect(result).toHaveLength(2);
      // Ensure invalid category was filtered out (only valid categories remain)
      expect(result.every((k) => ["product", "brand", "service", "commercial", "informational"].includes(k.category))).toBe(true);
    });

    it("should filter out empty keywords", () => {
      const response = JSON.stringify([
        { keyword: "valid keyword", category: "product" },
        { keyword: "", category: "product" },
        { keyword: "   ", category: "product" },
      ]);

      const result = parseKeywordResponse(response);

      expect(result).toHaveLength(1);
    });

    it("should return empty array on invalid JSON", () => {
      const response = "not valid json";

      const result = parseKeywordResponse(response);

      expect(result).toEqual([]);
    });

    it("should return empty array if response is not an array", () => {
      const response = JSON.stringify({ keyword: "test", category: "product" });

      const result = parseKeywordResponse(response);

      expect(result).toEqual([]);
    });

    it("should deduplicate keywords", () => {
      const response = JSON.stringify([
        { keyword: "barrel sauna", category: "product" },
        { keyword: "barrel sauna", category: "product" },
        { keyword: "Barrel Sauna", category: "product" },
      ]);

      const result = parseKeywordResponse(response);

      expect(result).toHaveLength(1);
    });
  });

  describe("generateKeywordOpportunities", () => {
    it("should generate keywords from business info", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { keyword: "barrel sauna price", category: "product" },
              { keyword: "Harvia heater", category: "brand" },
              { keyword: "sauna installation Helsinki", category: "service" },
            ]),
          },
        ],
      });

      const result = await generateKeywordOpportunities(mockInput);

      expect(result).toHaveLength(3);
      expect(result[0].keyword).toBe("barrel sauna price");
      expect(result[0].category).toBe("product");
    });

    it("should return empty array when API key is not set", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const result = await generateKeywordOpportunities(mockInput);

      expect(result).toEqual([]);
    });

    it("should return empty array on API error", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));

      const result = await generateKeywordOpportunities(mockInput);

      expect(result).toEqual([]);
    });

    it("should include all five keyword categories", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { keyword: "barrel sauna", category: "product" },
              { keyword: "Harvia heater", category: "brand" },
              { keyword: "sauna installation", category: "service" },
              { keyword: "buy sauna online", category: "commercial" },
              { keyword: "how to use a sauna", category: "informational" },
            ]),
          },
        ],
      });

      const result = await generateKeywordOpportunities(mockInput);

      const categories = result.map((k) => k.category);
      expect(categories).toContain("product");
      expect(categories).toContain("brand");
      expect(categories).toContain("service");
      expect(categories).toContain("commercial");
      expect(categories).toContain("informational");
    });

    it("should handle Lithuanian language", async () => {
      const ltInput: KeywordGeneratorInput = {
        ...mockInput,
        language: "lt",
      };

      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { keyword: "pirtis kaina", category: "product" },
            ]),
          },
        ],
      });

      const result = await generateKeywordOpportunities(ltInput);

      expect(result).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalled();
    });

    it("should generate 50-100 keywords", async () => {
      // Generate a large array of mock keywords
      const mockKeywords = Array.from({ length: 75 }, (_, i) => ({
        keyword: `keyword ${i}`,
        category: ["product", "brand", "service", "commercial", "informational"][
          i % 5
        ],
      }));

      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockKeywords),
          },
        ],
      });

      const result = await generateKeywordOpportunities(mockInput);

      expect(result.length).toBeGreaterThanOrEqual(50);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });
});
