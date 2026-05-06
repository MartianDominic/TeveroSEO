/**
 * QualityGateService Tests
 * Phase 92: On-Page SEO Mastery
 *
 * Tests for 7 quality gates (T5-01 to T5-07) using hybrid embedding + LLM approach.
 *
 * Requirements:
 * - OPM-07: Reddit Test evaluates content specificity
 * - OPM-08: Information Gain compares against SERP
 * - OPM-09: Prove-It Details checks claim-evidence pairing
 * - OPM-10: LLM fallback for borderline cases with Zod validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { GateResult, Vertical } from "../types";

// Mock OpenAI before imports
const mockCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor(_config: unknown) {
        // Store config if needed for assertions
      }
    },
  };
});

// Mock EmbeddingService
vi.mock("@/server/features/keywords/services/EmbeddingService", () => ({
  getEmbeddingService: vi.fn().mockReturnValue({
    embedQuery: vi.fn().mockResolvedValue(new Float32Array(256).fill(0.5)),
    embedPassages: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => new Float32Array(256).fill(0.5)))
    ),
  }),
  cosineSimilarity: vi.fn().mockReturnValue(0.8),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  QualityGateService,
  getQualityGateService,
  resetQualityGateService,
  CircuitOpenError,
} from "./QualityGateService";
import { getEmbeddingService, cosineSimilarity } from "@/server/features/keywords/services/EmbeddingService";

describe("QualityGateService", () => {
  let service: QualityGateService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetQualityGateService();
    process.env.XAI_API_KEY = "test-api-key";

    service = new QualityGateService();
  });

  afterEach(() => {
    delete process.env.XAI_API_KEY;
  });

  describe("constructor", () => {
    it("throws if XAI_API_KEY not configured", () => {
      delete process.env.XAI_API_KEY;
      expect(() => new QualityGateService()).toThrow("XAI_API_KEY not configured");
    });

    it("uses custom API key if provided", () => {
      delete process.env.XAI_API_KEY;
      // Should not throw when custom key provided
      const svc = new QualityGateService("custom-key");
      expect(svc).toBeInstanceOf(QualityGateService);
    });
  });

  describe("T5-01: Reddit Test", () => {
    const sampleContent = `
      Here's a comprehensive guide to SEO with specific examples.
      In 2025, 73% of marketers reported that content quality directly impacts rankings.
      Our A/B tests showed a 340% increase in organic traffic when we implemented structured data.
      John Mueller from Google confirmed in March 2025 that E-E-A-T signals are crucial.
    `.repeat(5); // Make it longer than 100 words

    it("returns passed=true for high-quality content via LLM", async () => {
      // Since getReferenceEmbeddings returns empty, it falls back to LLM
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 90,
                passed: true,
                reasoning: "Content demonstrates high specificity and expertise",
              }),
            },
          },
        ],
      });

      const result = await service.evaluateRedditTest(sampleContent, "saas");

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.method).toBe("llm");
    });

    it("returns passed=false for low-quality content via LLM", async () => {
      // Since getReferenceEmbeddings returns empty, it falls back to LLM
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 40,
                passed: false,
                reasoning: "Content is generic and lacks specificity",
              }),
            },
          },
        ],
      });

      const result = await service.evaluateRedditTest(sampleContent, "saas");

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThanOrEqual(70);
      expect(result.method).toBe("llm");
    });

    it("uses LLM when no reference embeddings available", async () => {
      // Mock LLM response
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 75,
                passed: true,
                reasoning: "Content shows domain expertise with specific examples",
                specificExamples: ["73% statistic", "A/B test results"],
              }),
            },
          },
        ],
      });

      const result = await service.evaluateRedditTest(sampleContent, "saas");

      expect(result.method).toBe("llm");
      expect(mockCreate).toHaveBeenCalled();
    });

    it("skips Reddit Test for content under 100 words", async () => {
      const shortContent = "This is a very short piece of content.";

      const result = await service.evaluateRedditTest(shortContent, "saas");

      expect(result.passed).toBe(true);
      expect(result.method).toBe("rule");
      expect(result.message).toContain("too short");
    });

  });

  describe("T5-02: Information Gain", () => {
    const content = `
      Our proprietary analysis of 10,000 websites revealed that sites with semantic HTML
      outperform competitors by 45% in Core Web Vitals. This contradicts conventional wisdom
      that only JavaScript frameworks can deliver modern UX.
    `.repeat(3);

    const serpContent = [
      "SEO is important for your website. Make sure to optimize your content.",
      "Here are 10 SEO tips to improve your rankings.",
      "Content marketing helps drive organic traffic to your site.",
    ];

    it("returns score based on unique content vs SERP", async () => {
      // Mock low similarity = high information gain
      vi.mocked(cosineSimilarity).mockReturnValue(0.50);

      const result = await service.evaluateInformationGain(content, serpContent);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.method).toBe("embedding");
    });

    it("fails when content too similar to SERP", async () => {
      // Mock high similarity = low information gain
      vi.mocked(cosineSimilarity).mockReturnValue(0.85);

      const result = await service.evaluateInformationGain(content, serpContent);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(40);
      expect(result.message).toContain("overlap");
    });
  });

  describe("T5-03: Prove-It Details", () => {
    it("passes content with sufficient evidence density", async () => {
      const evidenceRichContent = `
        According to a 2025 Forrester study, 73% of enterprises now use AI in content creation.
        Our analysis shows a 340% ROI improvement (Source: Internal Data 2025).
        Dr. Jane Smith at Stanford confirmed these findings in her March 2025 paper.
        The average cost per lead dropped from $50 to $12 after implementation.
      `.repeat(3);

      const result = await service.evaluateProveItDetails(evidenceRichContent, "saas");

      expect(result.passed).toBe(true);
      expect(result.method).toBe("rule");
    });

    it("fails content with insufficient evidence", async () => {
      const vaguContent = `
        SEO is really important for your business. You should definitely invest in it.
        Many experts agree that content quality matters. Some studies suggest improvements.
        Results may vary depending on your situation. Consider consulting a professional.
      `.repeat(3);

      const result = await service.evaluateProveItDetails(vaguContent, "saas");

      expect(result.passed).toBe(false);
      expect(result.message).toContain("Insufficient evidence");
    });

    it("uses LLM for YMYL verticals with borderline evidence", async () => {
      const medicalContent = `
        This medication may help reduce symptoms. Consult your doctor before use.
        Side effects include nausea and headache. Take as directed.
      `.repeat(5);

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 45,
                claimCount: 8,
                provenClaims: 3,
                unprovenClaims: ["may help reduce symptoms", "Side effects include"],
                reasoning: "Multiple claims lack proper citations for medical content",
              }),
            },
          },
        ],
      });

      const result = await service.evaluateProveItDetails(medicalContent, "healthcare");

      // Should use LLM for YMYL content with low evidence
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe("T5-04: Not For You Block", () => {
    it("scores higher when audience qualification present", () => {
      const qualifiedContent = `
        This guide is for experienced developers who already understand TypeScript.
        If you're looking for beginner content, this isn't for you.
      `;

      const result = service.evaluateNotForYou(qualifiedContent);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.message).toContain("qualification");
    });

    it("still passes but with lower score when qualification missing", () => {
      const genericContent = `
        Here's how to build a website. First, you need to learn HTML.
        Then move on to CSS and JavaScript.
      `;

      const result = service.evaluateNotForYou(genericContent);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(70);
      expect(result.message).toContain("Consider adding");
    });
  });

  describe("T5-05: QDD Vulnerability", () => {
    it("passes when content provides unique angle", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.70);

      const serpContent = ["Generic SEO content", "More generic content"];
      const uniqueContent = "Completely unique perspective with proprietary data";

      const result = await service.evaluateQDDVulnerability(uniqueContent, serpContent);

      expect(result.passed).toBe(true);
      expect(result.message).toContain("unique angle");
    });

    it("fails when content too similar to existing SERP result", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.95);

      const serpContent = ["Generic SEO content"];
      const copyContent = "Generic SEO content with slight modifications";

      const result = await service.evaluateQDDVulnerability(copyContent, serpContent);

      expect(result.passed).toBe(false);
      expect(result.message).toContain("too similar");
    });
  });

  describe("T5-06: Thin Content Detection", () => {
    it("passes content meeting vertical minimum word count", () => {
      const content = "word ".repeat(400); // 400 words

      const result = service.evaluateThinContent(content, "general");

      expect(result.passed).toBe(true);
      expect(result.message).toContain("meets");
    });

    it("fails content below 300 words for ecommerce", () => {
      const thinContent = "word ".repeat(200); // 200 words

      const result = service.evaluateThinContent(thinContent, "ecommerce");

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(100);
      expect(result.message).toContain("Thin content");
    });

    it("uses higher threshold for YMYL verticals", () => {
      const content = "word ".repeat(500); // 500 words - enough for general, not for healthcare

      const healthResult = service.evaluateThinContent(content, "healthcare");
      const generalResult = service.evaluateThinContent(content, "general");

      expect(healthResult.passed).toBe(false); // Healthcare needs 800
      expect(generalResult.passed).toBe(true); // General needs 400
    });
  });

  describe("T5-07: Fluff Detection", () => {
    it("passes content with low fluff density", () => {
      const directContent = `
        Implement structured data using JSON-LD format.
        Add Organization schema to your homepage.
        Include FAQ schema on product pages.
        Test with Google's Rich Results Test tool.
      `.repeat(5);

      const result = service.evaluateFluffDetection(directContent);

      expect(result.passed).toBe(true);
      expect(result.message).toContain("Low fluff density");
    });

    it("fails content with excessive fluff phrases", () => {
      const fluffyContent = `
        It goes without saying that SEO is important in today's digital age.
        Needless to say, when it comes to optimization, many experts believe
        that at the end of the day, results may vary. In the world of marketing,
        some believe that all things considered, it is thought that perhaps
        leveraging synergies might potentially unlock game-changing results.
      `.repeat(3);

      const result = service.evaluateFluffDetection(fluffyContent);

      expect(result.passed).toBe(false);
      expect(result.message).toContain("High fluff density");
    });

    it("detects weasel words", () => {
      const weaselContent = `
        This may help your rankings. It might improve traffic.
        Some experts believe this could potentially work.
        Results are relatively good and fairly consistent.
        It tends to seem to appear to work somewhat well.
      `.repeat(5);

      const result = service.evaluateFluffDetection(weaselContent);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(80);
    });
  });

  describe("evaluateAll", () => {
    beforeEach(() => {
      // Default mock for LLM calls during evaluateAll
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 80,
                passed: true,
                reasoning: "Content meets quality standards",
              }),
            },
          },
        ],
      });
    });

    it("combines all gate results correctly", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.80);

      const content = "word ".repeat(500);
      const result = await service.evaluateAll(content, "saas", []);

      expect(result.results).toHaveProperty("T5-04");
      expect(result.results).toHaveProperty("T5-06");
      expect(result.results).toHaveProperty("T5-07");
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it("includes blocking failures in result", async () => {
      // Use basic tier to avoid LLM calls for Reddit Test
      const basicService = new QualityGateService(undefined, { tier: "basic" });
      const thinContent = "short";

      const result = await basicService.evaluateAll(thinContent, "healthcare", []);

      expect(result.blockingFailures).toContain("T5-06");
      expect(result.passed).toBe(false);
    });

    it("respects tier configuration for check execution", async () => {
      const basicService = new QualityGateService(undefined, { tier: "basic" });

      const content = "word ".repeat(500);
      const result = await basicService.evaluateAll(content, "saas", []);

      // Basic tier should only have T5-04, T5-06, T5-07
      expect(result.results).toHaveProperty("T5-04");
      expect(result.results).toHaveProperty("T5-06");
      expect(result.results).toHaveProperty("T5-07");
      expect(result.results).not.toHaveProperty("T5-01");
      expect(result.results).not.toHaveProperty("T5-02");
    });

    it("runs SERP checks only for full tier with SERP content", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.50);

      const fullService = new QualityGateService(undefined, { tier: "full" });

      const content = "word ".repeat(500);
      const serpContent = ["Competitor content 1", "Competitor content 2"];

      const result = await fullService.evaluateAll(content, "saas", serpContent);

      expect(result.results).toHaveProperty("T5-02");
      expect(result.results).toHaveProperty("T5-05");
    });
  });

  describe("LLM Zod Validation", () => {
    it("validates LLM responses with Zod schema", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.78); // Borderline to trigger LLM

      // Invalid response - missing required fields
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: "not a number", // Invalid type
                passed: "yes", // Invalid type
              }),
            },
          },
        ],
      });

      const content = "word ".repeat(200);

      await expect(service.evaluateRedditTest(content, "saas")).rejects.toThrow();
    });

    it("records circuit failure on invalid response", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.78);

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "not valid json",
            },
          },
        ],
      });

      const content = "word ".repeat(200);

      await expect(service.evaluateRedditTest(content, "saas")).rejects.toThrow();
    });
  });

  describe("Circuit Breaker", () => {
    it("opens after 3 consecutive LLM failures", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.78);

      mockCreate.mockRejectedValue(new Error("API Error"));

      const content = "word ".repeat(200);

      // First 3 failures
      for (let i = 0; i < 3; i++) {
        await expect(service.evaluateRedditTest(content, "saas")).rejects.toThrow("API Error");
      }

      // 4th call should throw CircuitOpenError
      await expect(service.evaluateRedditTest(content, "saas")).rejects.toThrow(CircuitOpenError);
    });

    it("can be reset manually", async () => {
      vi.mocked(cosineSimilarity).mockReturnValue(0.78);

      mockCreate.mockRejectedValue(new Error("API Error"));

      const content = "word ".repeat(200);

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(service.evaluateRedditTest(content, "saas")).rejects.toThrow("API Error");
      }

      expect(service.isCircuitOpen).toBe(true);

      // Reset
      service.resetCircuit();
      expect(service.isCircuitOpen).toBe(false);
    });
  });

  describe("PII Stripping", () => {
    it("strips PII from content using stripPII utility", async () => {
      // Import stripPII dynamically
      const { stripPII } = await import("../utils/EntityExtractor");

      const contentWithPII = `
        Contact John at john@example.com or call 555-123-4567.
        SSN: 123-45-6789 for verification.
      `;

      const sanitized = stripPII(contentWithPII);

      // Verify PII is replaced with placeholders
      expect(sanitized).not.toContain("john@example.com");
      expect(sanitized).not.toContain("555-123-4567");
      expect(sanitized).not.toContain("123-45-6789");
      expect(sanitized).toContain("[EMAIL]");
      expect(sanitized).toContain("[PHONE]");
      expect(sanitized).toContain("[SSN]");
    });
  });

  describe("Singleton Pattern", () => {
    it("returns same instance from getQualityGateService", () => {
      const instance1 = getQualityGateService();
      const instance2 = getQualityGateService();

      expect(instance1).toBe(instance2);
    });

    it("creates new instance after reset", () => {
      const instance1 = getQualityGateService();
      resetQualityGateService();
      const instance2 = getQualityGateService();

      expect(instance1).not.toBe(instance2);
    });
  });
});
