/**
 * Tests for AwarenessClassifier.
 * Phase 43-06: Proposal Generation
 *
 * Tests Schwartz awareness level classification from prospect signals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a shared mock for the create function
const mockCreate = vi.fn();

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Template string
const MOCK_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<prompt name="prospect-awareness-classifier" version="1.0">
  <input-schema>
    <prospect>
      <domain>{{DOMAIN}}</domain>
      <scrape-summary>{{SCRAPE_SUMMARY}}</scrape-summary>
      <initial-inquiry>{{INQUIRY_TEXT}}</initial-inquiry>
      <lead-source>{{LEAD_SOURCE}}</lead-source>
      <conversation-history>{{CONVERSATION_NOTES}}</conversation-history>
    </prospect>
  </input-schema>
</prompt>`;

// Mock fs module to avoid reading actual XML file
vi.mock("node:fs", () => ({
  readFileSync: () => MOCK_TEMPLATE,
}));

// Import AFTER mocks are set up
import {
  AwarenessClassifier,
  type ClassificationInput,
  type AwarenessLevel,
} from "./AwarenessClassifier";

describe("AwarenessClassifier", () => {
  let classifier: AwarenessClassifier;

  beforeEach(() => {
    classifier = new AwarenessClassifier();
    mockCreate.mockReset();
  });

  // Note: Don't use vi.clearAllMocks() as it clears the fs mock too

  describe("quickClassify (rule-based)", () => {
    it("should return 'unaware' for cold lead with no SEO mention", () => {
      const input: ClassificationInput = {
        domain: "example.lt",
        initialInquiry: "Gavome jusu laiska, kas tai?",
      };

      const result = classifier.quickClassify(input);
      expect(result).toBe("unaware");
    });

    it("should return 'problem-aware' when lead mentions traffic problems", () => {
      const input: ClassificationInput = {
        domain: "example.lt",
        initialInquiry: "Musu svetaine turi mazai lankytoju, noretume daugiau",
      };

      const result = classifier.quickClassify(input);
      expect(result).toBe("problem-aware");
    });

    it("should return 'solution-aware' when lead asks about SEO services", () => {
      const input: ClassificationInput = {
        domain: "example.lt",
        initialInquiry: "Ar teikiate SEO paslaugas? Norime optimizuoti svetaine.",
      };

      const result = classifier.quickClassify(input);
      expect(result).toBe("solution-aware");
    });

    it("should return 'product-aware' when lead is comparing providers", () => {
      const input: ClassificationInput = {
        domain: "example.lt",
        initialInquiry: "Kodel turetume pasirinkti jus, o ne kitus? Kokia kaina?",
      };

      // "kaina" (price) is most-aware, but "jus" (why you) is product-aware
      // most-aware check comes first, so "kaina" wins
      const result = classifier.quickClassify(input);
      expect(result).toBe("most-aware");
    });

    it("should return 'most-aware' when lead requests proposal", () => {
      const input: ClassificationInput = {
        domain: "example.lt",
        initialInquiry: "Norime gauti pasiulyma SEO paslaugoms",
      };

      const result = classifier.quickClassify(input);
      expect(result).toBe("most-aware");
    });

    it("should recognize Lithuanian keywords", () => {
      // Test kaina (price) -> most-aware
      expect(
        classifier.quickClassify({
          domain: "example.lt",
          initialInquiry: "Kokia kaina?",
        })
      ).toBe("most-aware");

      // Test lankytojai (visitors) -> problem-aware
      expect(
        classifier.quickClassify({
          domain: "example.lt",
          initialInquiry: "Turime mazai lankytoju",
        })
      ).toBe("problem-aware");
    });

    it("should detect product-aware when comparing without price mention", () => {
      const result = classifier.quickClassify({
        domain: "example.lt",
        initialInquiry: "Kodel jus, o ne konkurentai?",
      });
      expect(result).toBe("product-aware");
    });
  });

  describe("classify (AI-powered)", () => {
    it("should classify cold lead as 'unaware'", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              awareness_level: "unaware",
              confidence: 0.9,
              signals_detected: ["cold response", "no SEO mention"],
              hook_strategy: "Lead with problem agitation",
              recommended_approach: {
                opening_angle: "Jusu konkurentai gauna X lankytoju...",
                primary_cialdini: "social_proof",
                objections_to_address: ["what is SEO", "why should I care"],
              },
              reasoning: "Cold lead with no prior SEO awareness signals",
            }),
          },
        ],
      });

      const input: ClassificationInput = {
        domain: "grožiosalonas.lt",
        leadSource: "cold email response",
        initialInquiry: "Gavome jusu laiska, kas tai?",
      };

      const result = await classifier.classify(input);

      expect(result.awarenessLevel).toBe("unaware");
      expect(result.confidence).toBe(0.9);
      expect(result.signalsDetected).toContain("cold response");
      expect(result.hookStrategy).toContain("problem agitation");
      expect(result.recommendedApproach.primaryCialdini).toBe("social_proof");
    });

    it("should classify proposal request as 'most-aware'", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              awareness_level: "most-aware",
              confidence: 0.95,
              signals_detected: [
                "explicit proposal request",
                "uses SEO term",
                "ready language",
              ],
              hook_strategy: "Clear CTA, reduce friction",
              recommended_approach: {
                opening_angle: "Stai musu pasiulymas...",
                primary_cialdini: "commitment",
                objections_to_address: ["timing", "scope clarity"],
              },
              reasoning: "Prospect explicitly asked for a proposal",
            }),
          },
        ],
      });

      const input: ClassificationInput = {
        domain: "plaukucentras.lt",
        leadSource: "website form",
        initialInquiry: "Norime uzsisakyti SEO paslaugas. Ar galite atsiusti pasiulyma?",
      };

      const result = await classifier.classify(input);

      expect(result.awarenessLevel).toBe("most-aware");
      expect(result.confidence).toBe(0.95);
      expect(result.hookStrategy).toContain("CTA");
      expect(result.recommendedApproach.primaryCialdini).toBe("commitment");
    });

    it("should return recommended hook strategy for each awareness level", async () => {
      const testCases: Array<{
        level: AwarenessLevel;
        expectedStrategy: string;
      }> = [
        { level: "unaware", expectedStrategy: "problem agitation" },
        { level: "problem-aware", expectedStrategy: "SEO as THE solution" },
        { level: "solution-aware", expectedStrategy: "methodology" },
        { level: "product-aware", expectedStrategy: "trust" },
        { level: "most-aware", expectedStrategy: "CTA" },
      ];

      for (const testCase of testCases) {
        mockCreate.mockResolvedValueOnce({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                awareness_level: testCase.level,
                confidence: 0.85,
                signals_detected: ["test signal"],
                hook_strategy: `Use ${testCase.expectedStrategy} approach`,
                recommended_approach: {
                  opening_angle: "Test angle",
                  primary_cialdini: "authority",
                  objections_to_address: [],
                },
                reasoning: "Test",
              }),
            },
          ],
        });

        const result = await classifier.classify({
          domain: "test.lt",
          initialInquiry: "test",
        });

        expect(result.awarenessLevel).toBe(testCase.level);
        expect(result.hookStrategy.toLowerCase()).toContain(
          testCase.expectedStrategy.toLowerCase()
        );
      }
    });

    it("should handle JSON wrapped in markdown code blocks", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `Here is my analysis:

\`\`\`json
{
  "awareness_level": "solution-aware",
  "confidence": 0.8,
  "signals_detected": ["SEO mention"],
  "hook_strategy": "Differentiate methodology",
  "recommended_approach": {
    "opening_angle": "Our unique approach...",
    "primary_cialdini": "authority",
    "objections_to_address": ["cost", "timeline"]
  },
  "reasoning": "Prospect mentioned SEO"
}
\`\`\``,
          },
        ],
      });

      const result = await classifier.classify({
        domain: "test.lt",
        initialInquiry: "Looking for SEO services",
      });

      expect(result.awarenessLevel).toBe("solution-aware");
    });

    it("should throw error if no JSON in response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "I cannot analyze this prospect.",
          },
        ],
      });

      await expect(
        classifier.classify({
          domain: "test.lt",
          initialInquiry: "test",
        })
      ).rejects.toThrow("No JSON found in response");
    });

    it("should throw error for non-text response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "test",
            input: {},
          },
        ],
      });

      await expect(
        classifier.classify({
          domain: "test.lt",
          initialInquiry: "test",
        })
      ).rejects.toThrow("Unexpected response type");
    });
  });

  describe("getHookStrategyForLevel", () => {
    it("should return appropriate strategies for each level", () => {
      expect(AwarenessClassifier.getHookStrategyForLevel("unaware")).toContain(
        "problem"
      );
      expect(
        AwarenessClassifier.getHookStrategyForLevel("problem-aware")
      ).toContain("solution");
      expect(
        AwarenessClassifier.getHookStrategyForLevel("solution-aware")
      ).toContain("methodology");
      expect(
        AwarenessClassifier.getHookStrategyForLevel("product-aware")
      ).toContain("objection");
      expect(AwarenessClassifier.getHookStrategyForLevel("most-aware")).toContain(
        "CTA"
      );
    });
  });
});
