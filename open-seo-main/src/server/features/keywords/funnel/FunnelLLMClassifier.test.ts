import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FunnelLLMClassifier, CircuitOpenError } from "./FunnelLLMClassifier";

// Mock OpenAI client
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

const mockValidResponse = {
  classifications: [
    {
      keyword: "šampūnas plaukams",
      stage: "mofu",
      confidence: 0.75,
      reasoning: "Product search, comparing options",
    },
    {
      keyword: "unknown keyword",
      stage: "tofu",
      confidence: 0.60,
      reasoning: "General information seeking",
    },
  ],
};

describe("FunnelLLMClassifier", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.XAI_API_KEY = "test-xai-key";

    const OpenAI = vi.mocked((await import("openai")).default);
    mockCreate = vi.fn();
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }) as unknown as InstanceType<typeof OpenAI>);
  });

  afterEach(() => {
    delete process.env.XAI_API_KEY;
  });

  describe("constructor", () => {
    it("throws if XAI_API_KEY not configured", () => {
      delete process.env.XAI_API_KEY;
      expect(() => new FunnelLLMClassifier()).toThrow("XAI_API_KEY not configured");
    });

    it("accepts explicit API key", () => {
      delete process.env.XAI_API_KEY;
      const classifier = new FunnelLLMClassifier({ apiKey: "explicit-key" });
      expect(classifier).toBeDefined();
    });
  });

  describe("classifyBatch", () => {
    it("returns FunnelClassification[] on success", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockValidResponse),
            },
          },
        ],
      });

      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });
      const result = await classifier.classifyBatch([
        "šampūnas plaukams",
        "unknown keyword",
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        keyword: "šampūnas plaukams",
        stage: "mofu",
        confidence: 0.75,
      });
      expect(result[0].signals.patternMatch).toBe(false);
      expect(result[0].reasoning).toContain("LLM:");
    });

    it("returns empty array for empty input", async () => {
      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });
      const result = await classifier.classifyBatch([]);

      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("validates response with Zod", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: [
                  {
                    keyword: "test",
                    stage: "invalid_stage", // Invalid
                    confidence: 0.9,
                    reasoning: "test",
                  },
                ],
              }),
            },
          },
        ],
      });

      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });

      await expect(
        classifier.classifyBatch(["test"])
      ).rejects.toThrow("Invalid LLM response");
    });

    it("rejects invalid JSON", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "Not JSON",
            },
          },
        ],
      });

      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });

      await expect(
        classifier.classifyBatch(["test"])
      ).rejects.toThrow("Invalid JSON response");
    });
  });

  describe("batching", () => {
    it("splits large batches into chunks of 100", async () => {
      const keywords = Array.from({ length: 150 }, (_, i) => `keyword-${i}`);

      // Mock responses for both batches
      const batchResponse = (count: number) => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: Array.from({ length: count }, (_, i) => ({
                  keyword: `keyword-${i}`,
                  stage: "mofu",
                  confidence: 0.7,
                  reasoning: "test",
                })),
              }),
            },
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(batchResponse(100))
        .mockResolvedValueOnce(batchResponse(50));

      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });
      const result = await classifier.classifyBatch(keywords);

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(150);
    });
  });

  describe("circuit breaker", () => {
    it("opens after 3 failures", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });

      for (let i = 0; i < 3; i++) {
        await expect(classifier.classifyBatch(["test"])).rejects.toThrow("API Error");
      }

      expect(classifier.isCircuitOpen).toBe(true);
    });

    it("throws CircuitOpenError when circuit is open", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });

      for (let i = 0; i < 3; i++) {
        await expect(classifier.classifyBatch(["test"])).rejects.toThrow();
      }

      await expect(
        classifier.classifyBatch(["test"])
      ).rejects.toThrow(CircuitOpenError);
    });

    it("resets circuit manually", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const classifier = new FunnelLLMClassifier({ apiKey: "test-key" });

      for (let i = 0; i < 3; i++) {
        await expect(classifier.classifyBatch(["test"])).rejects.toThrow();
      }

      expect(classifier.isCircuitOpen).toBe(true);
      classifier.resetCircuit();
      expect(classifier.isCircuitOpen).toBe(false);
    });
  });
});
