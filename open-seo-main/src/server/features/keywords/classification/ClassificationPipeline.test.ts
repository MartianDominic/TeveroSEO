import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClassificationPipeline } from "./ClassificationPipeline";
import type { BusinessContext } from "./types";

// Mock dependencies
vi.mock("./GeminiClassifier", () => ({
  GeminiClassifier: vi.fn().mockImplementation(() => ({
    classify: vi.fn(),
    isCircuitOpen: false,
    resetCircuit: vi.fn(),
  })),
}));

vi.mock("../services/ResilientClassifier", () => ({
  ResilientClassifier: vi.fn().mockImplementation(() => ({
    classifyBatch: vi.fn().mockResolvedValue([]),
    getCircuitStates: vi.fn().mockReturnValue({ claude: "closed", openai: "closed" }),
  })),
}));

import { GeminiClassifier } from "./GeminiClassifier";
import { ResilientClassifier } from "../services/ResilientClassifier";

describe("ClassificationPipeline", () => {
  let pipeline: ClassificationPipeline;
  let mockGemini: { classify: ReturnType<typeof vi.fn>; isCircuitOpen: boolean };
  let mockClaude: { classifyBatch: ReturnType<typeof vi.fn> };

  const testContext: BusinessContext = {
    businessName: "TestCo",
    industry: "E-commerce",
    services: ["Product Sales", "Consulting"],
    targetAudience: "Small businesses",
  };

  beforeEach(() => {
    mockGemini = {
      classify: vi.fn(),
      isCircuitOpen: false,
    };
    mockClaude = {
      classifyBatch: vi.fn().mockResolvedValue([]),
    };

    (GeminiClassifier as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockGemini);
    (ResilientClassifier as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      ...mockClaude,
      getCircuitStates: () => ({ claude: "closed", openai: "closed" }),
    }));

    pipeline = new ClassificationPipeline({
      geminiApiKey: "test-gemini-key",
      claudeApiKey: "test-claude-key",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("classify", () => {
    it("should resolve high-confidence keywords in Pass 1", async () => {
      mockGemini.classify.mockResolvedValueOnce([
        { keyword: "kw1", include: true, confidence: 0.95, type: "product", reasoning: "Relevant" },
        { keyword: "kw2", include: false, confidence: 0.90, type: null, reasoning: "Not relevant" },
      ]);

      const result = await pipeline.classify(["kw1", "kw2"], testContext);

      expect(result.stats.pass1Resolved).toBe(2);
      expect(result.stats.pass2Resolved).toBe(0);
      expect(result.stats.included).toBe(1);
      expect(result.stats.excluded).toBe(1);
      expect(result.keywords).toHaveLength(1);
      expect(result.keywords[0].pass).toBe(1);
    });

    it("should send uncertain keywords to Pass 2", async () => {
      mockGemini.classify.mockResolvedValueOnce([
        { keyword: "kw1", include: true, confidence: 0.95, type: "product", reasoning: "Relevant" },
        { keyword: "kw2", include: true, confidence: 0.60, type: null, reasoning: "Uncertain" },
      ]);

      mockClaude.classifyBatch.mockResolvedValueOnce([
        { keyword: "kw2", confidence: 0.75, category: "Product Sales", reasoning: "Matches service" },
      ]);

      const result = await pipeline.classify(["kw1", "kw2"], testContext);

      expect(result.stats.pass1Resolved).toBe(1);
      expect(result.stats.pass2Resolved).toBe(1);
      expect(mockClaude.classifyBatch).toHaveBeenCalledWith(["kw2"], testContext.services);
    });

    it("should calculate pass1Rate correctly", async () => {
      mockGemini.classify.mockResolvedValueOnce([
        { keyword: "kw1", include: true, confidence: 0.95, type: "product", reasoning: "R1" },
        { keyword: "kw2", include: true, confidence: 0.90, type: "product", reasoning: "R2" },
        { keyword: "kw3", include: true, confidence: 0.85, type: "product", reasoning: "R3" },
        { keyword: "kw4", include: true, confidence: 0.86, type: "product", reasoning: "R4" },
        { keyword: "kw5", include: true, confidence: 0.50, type: null, reasoning: "Uncertain" },
      ]);

      mockClaude.classifyBatch.mockResolvedValueOnce([
        { keyword: "kw5", confidence: 0.6, category: "X", reasoning: "OK" },
      ]);

      const result = await pipeline.classify(["kw1", "kw2", "kw3", "kw4", "kw5"], testContext);

      // 4 out of 5 resolved in Pass 1 = 80%
      expect(result.stats.pass1Rate).toBe(80);
      expect(result.stats.pass1Resolved).toBe(4);
      expect(result.stats.pass2Resolved).toBe(1);
    });

    it("should use defaults when Gemini fails", async () => {
      mockGemini.classify.mockRejectedValueOnce(new Error("API Error"));

      mockClaude.classifyBatch.mockResolvedValueOnce([
        { keyword: "kw1", confidence: 0.8, category: "X", reasoning: "OK" },
      ]);

      const result = await pipeline.classify(["kw1"], testContext);

      // Default confidence is 0.5, below threshold, so goes to Pass 2
      expect(result.stats.pass2Resolved).toBe(1);
    });

    it("should filter excluded keywords from output", async () => {
      mockGemini.classify.mockResolvedValueOnce([
        { keyword: "kw1", include: true, confidence: 0.95, type: "product", reasoning: "Include" },
        { keyword: "kw2", include: false, confidence: 0.95, type: null, reasoning: "Exclude" },
        { keyword: "kw3", include: true, confidence: 0.90, type: "product", reasoning: "Include" },
      ]);

      const result = await pipeline.classify(["kw1", "kw2", "kw3"], testContext);

      expect(result.keywords).toHaveLength(2);
      expect(result.keywords.map(k => k.keyword)).toEqual(["kw1", "kw3"]);
      expect(result.stats.included).toBe(2);
      expect(result.stats.excluded).toBe(1);
    });

    it("should handle empty keyword list", async () => {
      const result = await pipeline.classify([], testContext);

      expect(result.keywords).toHaveLength(0);
      expect(result.stats.totalInput).toBe(0);
      expect(mockGemini.classify).not.toHaveBeenCalled();
    });
  });
});
