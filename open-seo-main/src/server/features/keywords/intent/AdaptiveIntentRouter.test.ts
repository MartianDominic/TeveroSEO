/**
 * AdaptiveIntentRouter Tests
 *
 * TDD tests for adaptive intent detection and routing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AdaptiveIntentRouter,
  type AnalysisInput,
  type RouterConfig,
} from "./AdaptiveIntentRouter";
import type { BusinessContext } from "../classification/types";

// Mock dependencies using class-based mocks
vi.mock("../classification/ClassificationPipeline", () => {
  return {
    ClassificationPipeline: class MockClassificationPipeline {
      async classify() {
        return {
          keywords: [
            {
              keyword: "test keyword",
              include: true,
              confidence: 0.9,
              type: "product",
              reasoning: "Test reasoning",
              pass: 1 as const,
            },
          ],
          stats: {
            totalInput: 1,
            pass1Resolved: 1,
            pass2Resolved: 0,
            excluded: 0,
            included: 1,
            pass1Rate: 100,
          },
        };
      }
    },
  };
});

vi.mock("../universe/KeywordUniverseBuilder", () => {
  return {
    KeywordUniverseBuilder: class MockKeywordUniverseBuilder {
      async expand() {
        return [
          "expanded keyword 1",
          "expanded keyword 2",
          "expanded keyword 3",
        ];
      }
    },
  };
});

vi.mock("../context/NegativeAssociationExtractor", () => {
  return {
    NegativeAssociationExtractor: class MockNegativeAssociationExtractor {
      async extract() {
        return {
          notServices: [],
          competitors: [],
          adjacentVerticals: [],
          wrongIntent: [],
        };
      }
    },
  };
});

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("AdaptiveIntentRouter", () => {
  const mockBusinessContext: BusinessContext = {
    businessName: "Test Company",
    industry: "Technology",
    services: ["Software Development", "Consulting"],
    targetAudience: "B2B enterprises",
  };

  const mockConfig: RouterConfig = {
    claudeApiKey: "test-claude-key",
    geminiApiKey: "test-gemini-key",
    quickCheckThreshold: 10,
  };

  let router: AdaptiveIntentRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new AdaptiveIntentRouter(mockConfig);
  });

  describe("detectIntent", () => {
    it("returns quick_check for <= 10 keywords without seeds", () => {
      const input: AnalysisInput = {
        keywords: ["keyword1", "keyword2", "keyword3"],
        businessContext: mockBusinessContext,
      };

      expect(router.detectIntent(input)).toBe("quick_check");
    });

    it("returns quick_check for exactly 10 keywords", () => {
      const keywords = Array.from({ length: 10 }, (_, i) => `keyword${i}`);
      const input: AnalysisInput = {
        keywords,
        businessContext: mockBusinessContext,
      };

      expect(router.detectIntent(input)).toBe("quick_check");
    });

    it("returns full_analysis for > 10 keywords", () => {
      const keywords = Array.from({ length: 11 }, (_, i) => `keyword${i}`);
      const input: AnalysisInput = {
        keywords,
        businessContext: mockBusinessContext,
      };

      expect(router.detectIntent(input)).toBe("full_analysis");
    });

    it("returns full_analysis when seedKeywords provided", () => {
      const input: AnalysisInput = {
        keywords: ["keyword1", "keyword2"],
        seedKeywords: ["seed1"],
        businessContext: mockBusinessContext,
      };

      expect(router.detectIntent(input)).toBe("full_analysis");
    });

    it("returns full_analysis for large keyword set with seeds", () => {
      const keywords = Array.from({ length: 50 }, (_, i) => `keyword${i}`);
      const input: AnalysisInput = {
        keywords,
        seedKeywords: ["seed1", "seed2"],
        businessContext: mockBusinessContext,
      };

      expect(router.detectIntent(input)).toBe("full_analysis");
    });

    it("respects forceIntent override to quick_check", () => {
      const keywords = Array.from({ length: 50 }, (_, i) => `keyword${i}`);
      const input: AnalysisInput = {
        keywords,
        businessContext: mockBusinessContext,
        forceIntent: "quick_check",
      };

      expect(router.detectIntent(input)).toBe("quick_check");
    });

    it("respects forceIntent override to full_analysis", () => {
      const input: AnalysisInput = {
        keywords: ["keyword1"],
        businessContext: mockBusinessContext,
        forceIntent: "full_analysis",
      };

      expect(router.detectIntent(input)).toBe("full_analysis");
    });
  });

  describe("analyze", () => {
    it("runs quick_check for small keyword sets", async () => {
      const input: AnalysisInput = {
        keywords: ["keyword1", "keyword2"],
        businessContext: mockBusinessContext,
      };

      const result = await router.analyze(input);

      expect(result.intent).toBe("quick_check");
      expect(result.keywords).toHaveLength(1);
      expect(result.stats.totalInput).toBe(2);
    });

    it("includes duration in stats", async () => {
      const input: AnalysisInput = {
        keywords: ["keyword1"],
        businessContext: mockBusinessContext,
      };

      const result = await router.analyze(input);

      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("returns correct stats structure", async () => {
      const input: AnalysisInput = {
        keywords: ["keyword1", "keyword2", "keyword3"],
        businessContext: mockBusinessContext,
      };

      const result = await router.analyze(input);

      expect(result.stats).toHaveProperty("totalInput");
      expect(result.stats).toHaveProperty("included");
      expect(result.stats).toHaveProperty("excluded");
      expect(result.stats).toHaveProperty("pass1Rate");
      expect(result.stats).toHaveProperty("durationMs");
    });
  });

  describe("configuration", () => {
    it("uses default quickCheckThreshold of 10", () => {
      const configWithoutThreshold: RouterConfig = {
        claudeApiKey: "test-key",
      };
      const routerDefault = new AdaptiveIntentRouter(configWithoutThreshold);

      const input: AnalysisInput = {
        keywords: Array.from({ length: 10 }, (_, i) => `kw${i}`),
        businessContext: mockBusinessContext,
      };

      expect(routerDefault.detectIntent(input)).toBe("quick_check");
    });

    it("respects custom quickCheckThreshold", () => {
      const configCustom: RouterConfig = {
        claudeApiKey: "test-key",
        quickCheckThreshold: 5,
      };
      const routerCustom = new AdaptiveIntentRouter(configCustom);

      const inputSmall: AnalysisInput = {
        keywords: Array.from({ length: 5 }, (_, i) => `kw${i}`),
        businessContext: mockBusinessContext,
      };
      const inputLarge: AnalysisInput = {
        keywords: Array.from({ length: 6 }, (_, i) => `kw${i}`),
        businessContext: mockBusinessContext,
      };

      expect(routerCustom.detectIntent(inputSmall)).toBe("quick_check");
      expect(routerCustom.detectIntent(inputLarge)).toBe("full_analysis");
    });
  });

  describe("edge cases", () => {
    it("handles empty keywords array", async () => {
      const input: AnalysisInput = {
        keywords: [],
        businessContext: mockBusinessContext,
      };

      // Should detect as quick_check (0 <= 10)
      expect(router.detectIntent(input)).toBe("quick_check");
    });

    it("handles undefined keywords with seeds", async () => {
      const input: AnalysisInput = {
        seedKeywords: ["seed1"],
        businessContext: mockBusinessContext,
      };

      expect(router.detectIntent(input)).toBe("full_analysis");
    });
  });
});
