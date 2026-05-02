/**
 * GrokClassifier tests for Phase 63 Keyword Intelligence.
 *
 * Tests cover:
 * - Successful classification with mocked xAI responses
 * - Circuit breaker behavior after failures
 * - Zod validation rejection of malformed responses
 * - Batching for large keyword sets
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GrokClassifier, CircuitOpenError } from "./GrokClassifier";
import type { BusinessContext } from "./types";

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

// Test fixtures
const mockContext: BusinessContext = {
  businessName: "Plaukų Studija",
  industry: "Hair Care",
  services: ["šampūnai", "kondicionieriai", "plaukų dažai"],
  targetAudience: "Salonai ir profesionalai",
  negativeAssociations: {
    notServices: ["kirpykla paslaugos"],
    competitors: ["Schwarzkopf", "Wella"],
    adjacentVerticals: ["grožio salonai"],
    wrongIntent: ["nemokamas", "DIY"],
  },
};

const mockValidResponse = {
  classifications: [
    {
      keyword: "šampūnas plaukams",
      include: true,
      confidence: 0.95,
      type: "product",
      reasoning: "Direct product match",
    },
    {
      keyword: "kirpykla vilnius",
      include: false,
      confidence: 0.88,
      type: "local",
      reasoning: "Adjacent vertical - salon services, not products",
    },
  ],
};

describe("GrokClassifier", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up env var
    process.env.XAI_API_KEY = "test-xai-key";

    // Get reference to the mocked create function
    const OpenAI = vi.mocked(
      (await import("openai")).default
    );
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

      expect(() => new GrokClassifier()).toThrow("XAI_API_KEY not configured");
    });

    it("accepts explicit API key", () => {
      delete process.env.XAI_API_KEY;

      const classifier = new GrokClassifier("explicit-key");
      expect(classifier).toBeDefined();
    });
  });

  describe("classify", () => {
    it("returns array of ClassificationItem on success", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockValidResponse),
            },
          },
        ],
      });

      const classifier = new GrokClassifier("test-key");
      const result = await classifier.classify(
        ["šampūnas plaukams", "kirpykla vilnius"],
        mockContext
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        keyword: "šampūnas plaukams",
        include: true,
        confidence: 0.95,
        type: "product",
      });
      expect(result[1]).toMatchObject({
        keyword: "kirpykla vilnius",
        include: false,
        confidence: 0.88,
        type: "local",
      });
    });

    it("returns empty array for empty input", async () => {
      const classifier = new GrokClassifier("test-key");
      const result = await classifier.classify([], mockContext);

      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("validates response with Zod and rejects malformed responses", async () => {
      // Missing required 'include' field
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: [
                  {
                    keyword: "test",
                    confidence: 0.9,
                    // missing: include
                    type: "product",
                    reasoning: "test",
                  },
                ],
              }),
            },
          },
        ],
      });

      const classifier = new GrokClassifier("test-key");

      await expect(
        classifier.classify(["test"], mockContext)
      ).rejects.toThrow("Invalid Grok response");
    });

    it("rejects invalid JSON responses", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "This is not JSON",
            },
          },
        ],
      });

      const classifier = new GrokClassifier("test-key");

      await expect(
        classifier.classify(["test"], mockContext)
      ).rejects.toThrow("Invalid JSON response");
    });
  });

  describe("circuit breaker", () => {
    it("opens after 3 failures", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const classifier = new GrokClassifier("test-key");

      // First 3 failures
      for (let i = 0; i < 3; i++) {
        await expect(
          classifier.classify(["test"], mockContext)
        ).rejects.toThrow("API Error");
      }

      // Circuit should be open now
      expect(classifier.isCircuitOpen).toBe(true);
    });

    it("throws CircuitOpenError when circuit is open", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const classifier = new GrokClassifier("test-key");

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          classifier.classify(["test"], mockContext)
        ).rejects.toThrow();
      }

      // Next call should throw CircuitOpenError
      await expect(
        classifier.classify(["test"], mockContext)
      ).rejects.toThrow(CircuitOpenError);
    });

    it("resets circuit manually", async () => {
      mockCreate.mockRejectedValue(new Error("API Error"));

      const classifier = new GrokClassifier("test-key");

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          classifier.classify(["test"], mockContext)
        ).rejects.toThrow();
      }

      expect(classifier.isCircuitOpen).toBe(true);

      // Reset
      classifier.resetCircuit();
      expect(classifier.isCircuitOpen).toBe(false);
    });
  });

  describe("batching", () => {
    it("batches keywords when exceeding BATCH_SIZE", async () => {
      // Generate 60 keywords (more than BATCH_SIZE of 50)
      const keywords = Array.from({ length: 60 }, (_, i) => `keyword-${i}`);

      // Mock response for each batch
      const batchResponse = (kws: string[]) => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                classifications: kws.map((k) => ({
                  keyword: k,
                  include: true,
                  confidence: 0.9,
                  type: "product",
                  reasoning: "test",
                })),
              }),
            },
          },
        ],
      });

      // First batch (50 keywords)
      mockCreate.mockResolvedValueOnce(batchResponse(keywords.slice(0, 50)));
      // Second batch (10 keywords)
      mockCreate.mockResolvedValueOnce(batchResponse(keywords.slice(50)));

      const classifier = new GrokClassifier("test-key");
      const result = await classifier.classify(keywords, mockContext);

      // Should have called API twice
      expect(mockCreate).toHaveBeenCalledTimes(2);

      // Should return all 60 results
      expect(result).toHaveLength(60);
    });
  });

  describe("negative associations", () => {
    it("includes negative associations in prompt", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify(mockValidResponse),
            },
          },
        ],
      });

      const classifier = new GrokClassifier("test-key");
      await classifier.classify(["test"], mockContext);

      // Verify the prompt includes negative associations
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === "user"
      );

      expect(userMessage.content).toContain("kirpykla paslaugos");
      expect(userMessage.content).toContain("Adjacent verticals to EXCLUDE");
      expect(userMessage.content).toContain("Wrong intent signals");
    });
  });
});
