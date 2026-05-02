import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiClassifier, CircuitOpenError } from "./GeminiClassifier";
import type { BusinessContext } from "./types";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GeminiClassifier", () => {
  let classifier: GeminiClassifier;
  const testContext: BusinessContext = {
    businessName: "TestCo",
    industry: "E-commerce",
    services: ["Product Sales", "Consulting"],
    targetAudience: "Small businesses",
  };

  beforeEach(() => {
    classifier = new GeminiClassifier("test-api-key");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("classify", () => {
    it("should classify keywords successfully", async () => {
      const mockResponse = {
        classifications: [
          {
            keyword: "test keyword",
            include: true,
            confidence: 0.95,
            type: "product",
            reasoning: "Relevant to business",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockResponse) }] } }],
        }),
      });

      const result = await classifier.classify(["test keyword"], testContext);

      expect(result).toHaveLength(1);
      expect(result[0].keyword).toBe("test keyword");
      expect(result[0].include).toBe(true);
      expect(result[0].confidence).toBe(0.95);
      expect(result[0].type).toBe("product");
    });

    it("should handle API errors and trigger circuit breaker", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      // First 3 failures should open circuit
      for (let i = 0; i < 3; i++) {
        await expect(classifier.classify(["test"], testContext)).rejects.toThrow();
      }

      // Circuit should now be open
      expect(classifier.isCircuitOpen).toBe(true);
      await expect(classifier.classify(["test"], testContext)).rejects.toThrow(CircuitOpenError);
    });

    it("should validate response with Zod schema", async () => {
      const invalidResponse = {
        classifications: [
          {
            keyword: "test",
            // Missing required fields
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(invalidResponse) }] } }],
        }),
      });

      await expect(classifier.classify(["test"], testContext)).rejects.toThrow("Invalid Gemini response");
    });

    it("should reset circuit breaker", async () => {
      // Open circuit
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Error",
      });

      for (let i = 0; i < 3; i++) {
        await expect(classifier.classify(["test"], testContext)).rejects.toThrow();
      }

      expect(classifier.isCircuitOpen).toBe(true);

      // Reset
      classifier.resetCircuit();
      expect(classifier.isCircuitOpen).toBe(false);
    });

    it("should handle batching for large keyword lists", async () => {
      const mockResponse = {
        classifications: Array(50).fill(null).map((_, i) => ({
          keyword: `keyword${i}`,
          include: true,
          confidence: 0.9,
          type: "product" as const,
          reasoning: "Test",
        })),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockResponse) }] } }],
        }),
      });

      const keywords = Array(100).fill(null).map((_, i) => `keyword${i}`);
      const result = await classifier.classify(keywords, testContext);

      // Should have made 2 batch calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(100);
    });
  });
});
