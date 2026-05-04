import { describe, it, expect, vi, beforeEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import {
  ConstraintExtractor,
  createConstraintExtractor,
  getDefaultExtractor,
} from "./ConstraintExtractor";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn();
  MockAnthropic.prototype.messages = {
    create: vi.fn(),
  };
  return { default: MockAnthropic };
});

describe("ConstraintExtractor", () => {
  const mockAnthropicResponse = (content: string): Message => ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: content,
      },
    ],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 200,
    },
  });

  beforeEach(() => {
    // Set test API key
    process.env.ANTHROPIC_API_KEY = "test-api-key";

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe("ConstraintExtractor class", () => {
    it("should create extractor with default config", () => {
      const extractor = new ConstraintExtractor();
      expect(extractor).toBeInstanceOf(ConstraintExtractor);
    });

    it("should create extractor with custom config", () => {
      const extractor = new ConstraintExtractor({
        model: "claude-opus-4-20250514",
        maxTokens: 8192,
        temperature: 0.2,
      });
      expect(extractor).toBeInstanceOf(ConstraintExtractor);
    });

    it("should extract constraints from valid conversation", async () => {
      const validResponse = {
        constraints: {
          business: {
            type: "local",
            coreOffering: "Car wash",
            problemsSolved: ["Dirty cars"],
            productCategories: ["Auto care"],
          },
          geo: {
            scope: "city",
            includeCities: ["Vilnius"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: false,
          },
          audience: {
            b2bOnly: false,
            b2cAllowed: true,
            industryFocus: [],
          },
          funnel: {
            primary: "bofu",
            fallbackOrder: ["mofu"],
            targetCount: 30,
          },
          priorities: [],
          negatives: {
            excludeTerms: [],
            excludeBrands: [],
            excludeIntents: [],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.85,
          business: 0.9,
          geo: 0.9,
          audience: 0.8,
          funnel: 0.8,
          priorities: 0.7,
          negatives: 0.6,
          specialModes: 0.5,
        },
        clarificationNeeded: [],
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse(JSON.stringify(validResponse))
        );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Test conversation");

      expect(result.success).toBe(true);
      expect(result.constraints).toBeDefined();
      expect(result.constraints?.business.type).toBe("local");
      expect(result.error).toBeNull();
    });

    it("should handle markdown code blocks in response", async () => {
      const validResponse = {
        constraints: {
          business: {
            type: "ecommerce",
            coreOffering: "Online store",
            problemsSolved: [],
            productCategories: [],
          },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: false,
            genericAllowed: true,
          },
          audience: {
            b2bOnly: false,
            b2cAllowed: true,
            industryFocus: [],
          },
          funnel: {
            primary: "mofu",
            fallbackOrder: [],
            targetCount: 30,
          },
          priorities: [],
          negatives: {
            excludeTerms: [],
            excludeBrands: [],
            excludeIntents: [],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.8,
          business: 0.85,
          geo: 0.8,
          audience: 0.75,
          funnel: 0.8,
          priorities: 0.7,
          negatives: 0.6,
          specialModes: 0.5,
        },
        clarificationNeeded: [],
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse(
            "```json\n" + JSON.stringify(validResponse) + "\n```"
          )
        );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Test");

      expect(result.success).toBe(true);
      expect(result.constraints?.business.type).toBe("ecommerce");
    });

    it("should populate clarificationNeeded for low-confidence fields", async () => {
      const lowConfidenceResponse = {
        constraints: {
          business: {
            type: "saas",
            coreOffering: "Software",
            problemsSolved: [],
            productCategories: [],
          },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: false,
            genericAllowed: true,
          },
          audience: {
            b2bOnly: true,
            b2cAllowed: false,
            industryFocus: [],
          },
          funnel: {
            primary: "mofu",
            fallbackOrder: [],
            targetCount: 30,
          },
          priorities: [],
          negatives: {
            excludeTerms: [],
            excludeBrands: [],
            excludeIntents: [],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.6,
          business: 0.8,
          geo: 0.4,
          audience: 0.7,
          funnel: 0.5,
          priorities: 0.3,
          negatives: 0.2,
          specialModes: 0.4,
        },
        clarificationNeeded: [
          "Geographic targeting unclear",
          "Priority categories not specified",
        ],
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse(JSON.stringify(lowConfidenceResponse))
        );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Vague conversation");

      expect(result.success).toBe(true);
      expect(result.clarificationNeeded.length).toBeGreaterThan(0);
      expect(result.confidence?.overall).toBe(0.6);
    });

    it("should handle invalid JSON in response", async () => {
      const mockCreate = vi
        .fn()
        .mockResolvedValue(mockAnthropicResponse("Invalid JSON {not valid}"));

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Test");

      expect(result.success).toBe(false);
      expect(result.constraints).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain("JSON");
    });

    it("should handle malformed constraint structure", async () => {
      const malformedResponse = {
        constraints: {
          business: {
            type: "invalid_type",
          },
        },
        confidence: {
          overall: 0.5,
        },
        clarificationNeeded: [],
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse(JSON.stringify(malformedResponse))
        );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Test");

      expect(result.success).toBe(false);
      expect(result.constraints).toBeNull();
      expect(result.error).toBeDefined();
    });

    it("should use custom instruction when provided", async () => {
      const mockCreate = vi.fn().mockResolvedValue(
        mockAnthropicResponse(
          JSON.stringify({
            constraints: {
              business: {
                type: "b2b_services",
                coreOffering: "Test",
                problemsSolved: [],
                productCategories: [],
              },
              geo: {
                scope: "national",
                includeCities: [],
                excludeCities: [],
                nearMeAllowed: false,
                genericAllowed: true,
              },
              audience: {
                b2bOnly: true,
                b2cAllowed: false,
                industryFocus: [],
              },
              funnel: {
                primary: "mofu",
                fallbackOrder: [],
                targetCount: 30,
              },
              priorities: [],
              negatives: {
                excludeTerms: [],
                excludeBrands: [],
                excludeIntents: [],
              },
              specialModes: {
                pSEODetection: false,
                sideKeywordDiscovery: false,
                competitorGaps: false,
              },
            },
            confidence: {
              overall: 0.8,
              business: 0.8,
              geo: 0.8,
              audience: 0.8,
              funnel: 0.8,
              priorities: 0.7,
              negatives: 0.6,
              specialModes: 0.5,
            },
            clarificationNeeded: [],
          })
        )
      );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      await extractor.extract(
        "Test conversation",
        "Focus on B2B opportunities"
      );

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0];

      expect(userMessage.content).toContain("Focus on B2B opportunities");
    });

    it("should throw validation error if ANTHROPIC_API_KEY missing", () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new ConstraintExtractor()).toThrow("ANTHROPIC_API_KEY");

      process.env.ANTHROPIC_API_KEY = originalKey;
    });
  });

  describe("Factory functions", () => {
    it("should create extractor with createConstraintExtractor", () => {
      const extractor = createConstraintExtractor({
        model: "claude-opus-4-20250514",
      });
      expect(extractor).toBeInstanceOf(ConstraintExtractor);
    });

    it("should return singleton with getDefaultExtractor", () => {
      const extractor1 = getDefaultExtractor();
      const extractor2 = getDefaultExtractor();

      expect(extractor1).toBe(extractor2);
    });
  });
});
