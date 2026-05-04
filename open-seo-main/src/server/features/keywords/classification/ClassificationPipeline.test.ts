import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClassificationPipeline } from "./ClassificationPipeline";
import type { BusinessContext } from "./types";

// Mock database and cost tracker to avoid DATABASE_URL requirement
vi.mock("@/db/index", () => ({
  db: {},
}));

vi.mock("../services/CostTracker", () => ({
  getCostTracker: vi.fn(() => ({
    record: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@/db/api-costs-schema", () => ({
  API_SERVICES: { GROK: "grok", GEMINI: "gemini", CLAUDE: "claude" },
  API_OPERATIONS: { CLASSIFY: "classify" },
  estimateTokens: vi.fn(() => 100),
  calculateCostCents: vi.fn(() => 1),
}));

// Mock RAG context retrieval
vi.mock("./rag-context", () => ({
  getClassificationContext: vi.fn().mockResolvedValue({
    entities: [],
    relations: [],
    relevantCategories: [],
    confidence: 0,
  }),
}));

// Shared mock state
const mockClassify = vi.fn();
const mockClassifyBatch = vi.fn().mockResolvedValue([]);
let mockIsCircuitOpen = false;

// Mock dependencies using class syntax
vi.mock("./GeminiClassifier", () => {
  return {
    GeminiClassifier: class MockGeminiClassifier {
      classify = mockClassify;
      get isCircuitOpen() {
        return mockIsCircuitOpen;
      }
      resetCircuit = vi.fn();
    },
  };
});

vi.mock("../services/ResilientClassifier", () => {
  return {
    ResilientClassifier: class MockResilientClassifier {
      classifyBatch = mockClassifyBatch;
      getCircuitStates = () => ({ claude: "closed", openai: "closed" });
    },
  };
});

describe("ClassificationPipeline", () => {
  let pipeline: ClassificationPipeline;

  const testContext: BusinessContext = {
    businessName: "TestCo",
    industry: "E-commerce",
    services: ["Product Sales", "Consulting"],
    targetAudience: "Small businesses",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCircuitOpen = false;
    mockClassifyBatch.mockResolvedValue([]);

    pipeline = new ClassificationPipeline({
      geminiApiKey: "test-gemini-key",
      claudeApiKey: "test-claude-key",
      enableRAG: false, // Disable RAG for existing tests
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("classify", () => {
    it("should resolve high-confidence keywords in Pass 1", async () => {
      mockClassify.mockResolvedValueOnce([
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
      mockClassify.mockResolvedValueOnce([
        { keyword: "kw1", include: true, confidence: 0.95, type: "product", reasoning: "Relevant" },
        { keyword: "kw2", include: true, confidence: 0.60, type: null, reasoning: "Uncertain" },
      ]);

      mockClassifyBatch.mockResolvedValueOnce([
        { keyword: "kw2", confidence: 0.75, category: "Product Sales", reasoning: "Matches service" },
      ]);

      const result = await pipeline.classify(["kw1", "kw2"], testContext);

      expect(result.stats.pass1Resolved).toBe(1);
      expect(result.stats.pass2Resolved).toBe(1);
      expect(mockClassifyBatch).toHaveBeenCalledWith(["kw2"], testContext.services);
    });

    it("should calculate pass1Rate correctly", async () => {
      mockClassify.mockResolvedValueOnce([
        { keyword: "kw1", include: true, confidence: 0.95, type: "product", reasoning: "R1" },
        { keyword: "kw2", include: true, confidence: 0.90, type: "product", reasoning: "R2" },
        { keyword: "kw3", include: true, confidence: 0.85, type: "product", reasoning: "R3" },
        { keyword: "kw4", include: true, confidence: 0.86, type: "product", reasoning: "R4" },
        { keyword: "kw5", include: true, confidence: 0.50, type: null, reasoning: "Uncertain" },
      ]);

      mockClassifyBatch.mockResolvedValueOnce([
        { keyword: "kw5", confidence: 0.6, category: "X", reasoning: "OK" },
      ]);

      const result = await pipeline.classify(["kw1", "kw2", "kw3", "kw4", "kw5"], testContext);

      // 4 out of 5 resolved in Pass 1 = 80%
      expect(result.stats.pass1Rate).toBe(80);
      expect(result.stats.pass1Resolved).toBe(4);
      expect(result.stats.pass2Resolved).toBe(1);
    });

    it("should use defaults when Gemini fails", async () => {
      mockClassify.mockRejectedValueOnce(new Error("API Error"));

      mockClassifyBatch.mockResolvedValueOnce([
        { keyword: "kw1", confidence: 0.8, category: "X", reasoning: "OK" },
      ]);

      const result = await pipeline.classify(["kw1"], testContext);

      // Default confidence is 0.5, below threshold, so goes to Pass 2
      expect(result.stats.pass2Resolved).toBe(1);
    });

    it("should filter excluded keywords from output", async () => {
      mockClassify.mockResolvedValueOnce([
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
      expect(mockClassify).not.toHaveBeenCalled();
    });
  });

  describe("RAG integration", () => {
    let ragEnabledPipeline: ClassificationPipeline;
    let mockGetClassificationContext: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      // Get the mocked function
      const ragModule = await import("./rag-context");
      mockGetClassificationContext = ragModule.getClassificationContext as ReturnType<typeof vi.fn>;

      ragEnabledPipeline = new ClassificationPipeline({
        geminiApiKey: "test-gemini-key",
        claudeApiKey: "test-claude-key",
        enableRAG: true,
      });
    });

    it("should retrieve RAG context when tenantId and pageContent provided", async () => {
      mockGetClassificationContext.mockResolvedValueOnce({
        entities: [
          { type: "category", name: "Electronics", normalizedName: "electronics", confidence: 0.9, attributes: {}, sourceUrl: "" },
        ],
        relations: [],
        relevantCategories: ["Electronics"],
        confidence: 0.9,
      });

      mockClassify.mockResolvedValueOnce([
        { keyword: "laptop", include: true, confidence: 0.95, type: "product", reasoning: "Relevant" },
      ]);

      const result = await ragEnabledPipeline.classify(
        ["laptop"],
        testContext,
        undefined,
        { tenantId: "tenant-123", pageContent: "Buy electronics and laptops" }
      );

      expect(mockGetClassificationContext).toHaveBeenCalledWith("tenant-123", "Buy electronics and laptops");
      expect(result.stats.ragContextUsed).toBe(true);
      expect(result.stats.ragConfidence).toBe(0.9);
      expect(result.stats.ragEntityCount).toBe(1);
      expect(result.stats.ragCategoryCount).toBe(1);
    });

    it("should include RAG context in enhanced business context", async () => {
      mockGetClassificationContext.mockResolvedValueOnce({
        entities: [
          { type: "category", name: "Outerwear", normalizedName: "outerwear", confidence: 0.9, attributes: {}, sourceUrl: "" },
          { type: "brand", name: "Nike", normalizedName: "nike", confidence: 0.85, attributes: {}, sourceUrl: "" },
        ],
        relations: [],
        relevantCategories: ["Outerwear"],
        confidence: 0.875,
      });

      mockClassify.mockResolvedValueOnce([
        { keyword: "jacket", include: true, confidence: 0.95, type: "product", reasoning: "Match" },
      ]);

      await ragEnabledPipeline.classify(
        ["jacket"],
        testContext,
        undefined,
        { tenantId: "tenant-123", pageContent: "Nike jackets for winter" }
      );

      // Check that classify was called with enhanced context containing RAG data
      expect(mockClassify).toHaveBeenCalled();
      const callArgs = mockClassify.mock.calls[0];
      const enhancedContext = callArgs[1] as BusinessContext;

      // Enhanced services should contain RAG context
      expect(enhancedContext.services.some((s: string) => s.includes("[RAG Context]"))).toBe(true);
      expect(enhancedContext.services.some((s: string) => s.includes("Outerwear"))).toBe(true);
      expect(enhancedContext.services.some((s: string) => s.includes("Nike"))).toBe(true);
    });

    it("should not call RAG when tenantId or pageContent missing", async () => {
      mockClassify.mockResolvedValueOnce([
        { keyword: "test", include: true, confidence: 0.95, type: "product", reasoning: "OK" },
      ]);

      await ragEnabledPipeline.classify(["test"], testContext);

      expect(mockGetClassificationContext).not.toHaveBeenCalled();
    });

    it("should continue classification when RAG fails", async () => {
      mockGetClassificationContext.mockRejectedValueOnce(new Error("RAG service down"));

      mockClassify.mockResolvedValueOnce([
        { keyword: "test", include: true, confidence: 0.95, type: "product", reasoning: "OK" },
      ]);

      const result = await ragEnabledPipeline.classify(
        ["test"],
        testContext,
        undefined,
        { tenantId: "tenant-123", pageContent: "test content" }
      );

      // Classification should still work
      expect(result.keywords).toHaveLength(1);
      expect(result.stats.ragContextUsed).toBe(false);
      expect(result.stats.ragError).toBe("RAG service down");
    });

    it("should mark ragContextUsed false when no entities returned", async () => {
      mockGetClassificationContext.mockResolvedValueOnce({
        entities: [],
        relations: [],
        relevantCategories: [],
        confidence: 0,
      });

      mockClassify.mockResolvedValueOnce([
        { keyword: "test", include: true, confidence: 0.95, type: "product", reasoning: "OK" },
      ]);

      const result = await ragEnabledPipeline.classify(
        ["test"],
        testContext,
        undefined,
        { tenantId: "tenant-123", pageContent: "test content" }
      );

      expect(result.stats.ragContextUsed).toBe(false);
      expect(result.stats.ragEntityCount).toBe(0);
    });

    it("should set ragContextUsed on classified keywords when RAG used", async () => {
      mockGetClassificationContext.mockResolvedValueOnce({
        entities: [
          { type: "category", name: "Tech", normalizedName: "tech", confidence: 0.9, attributes: {}, sourceUrl: "" },
        ],
        relations: [],
        relevantCategories: ["Tech"],
        confidence: 0.9,
      });

      mockClassify.mockResolvedValueOnce([
        { keyword: "phone", include: true, confidence: 0.95, type: "product", reasoning: "Match" },
      ]);

      const result = await ragEnabledPipeline.classify(
        ["phone"],
        testContext,
        undefined,
        { tenantId: "tenant-123", pageContent: "Smartphones and tech" }
      );

      expect(result.keywords[0].ragContextUsed).toBe(true);
    });
  });
});
