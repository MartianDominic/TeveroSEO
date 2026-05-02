/**
 * NegativeAssociationExtractor tests for Phase 63 Keyword Intelligence.
 *
 * Tests cover:
 * - Successful extraction with mocked Claude responses
 * - Graceful degradation on missing context
 * - Zod validation of responses
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NegativeAssociationExtractor, negativeAssociationExtractor } from "./NegativeAssociationExtractor";
import type { BusinessContextInput } from "./NegativeAssociationExtractor";

// Mock Anthropic client
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

// Test fixtures
const validContext: BusinessContextInput = {
  businessName: "Plaukų Studija",
  industry: "Hair Care Products",
  services: ["šampūnai", "kondicionieriai", "plaukų dažai"],
  description: "Professional hair care products for salons",
  targetAudience: "Hair salons and stylists",
};

const mockValidResponse = {
  notServices: ["kirpykla paslaugos", "plaukų transplantacija"],
  competitors: ["Schwarzkopf", "L'Oreal Professional"],
  adjacentVerticals: ["grožio salonai", "makiažo paslaugos"],
  wrongIntent: ["nemokamas", "DIY", "namuose"],
};

describe("NegativeAssociationExtractor", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

    // Get reference to mocked create function
    const Anthropic = vi.mocked(
      (await import("@anthropic-ai/sdk")).default
    );
    mockCreate = vi.fn();
    Anthropic.mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    }) as unknown as InstanceType<typeof Anthropic>);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe("constructor", () => {
    it("throws if ANTHROPIC_API_KEY not configured", () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new NegativeAssociationExtractor()).toThrow(
        "ANTHROPIC_API_KEY not configured"
      );
    });

    it("accepts explicit API key", () => {
      delete process.env.ANTHROPIC_API_KEY;

      const extractor = new NegativeAssociationExtractor("explicit-key");
      expect(extractor).toBeDefined();
    });
  });

  describe("extract", () => {
    it("returns NegativeAssociations on success", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockValidResponse),
          },
        ],
      });

      const extractor = new NegativeAssociationExtractor("test-key");
      const result = await extractor.extract(validContext);

      expect(result.notServices).toContain("kirpykla paslaugos");
      expect(result.competitors).toContain("Schwarzkopf");
      expect(result.adjacentVerticals).toContain("grožio salonai");
      expect(result.wrongIntent).toContain("DIY");
    });

    it("handles markdown code blocks in response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "```json\n" + JSON.stringify(mockValidResponse) + "\n```",
          },
        ],
      });

      const extractor = new NegativeAssociationExtractor("test-key");
      const result = await extractor.extract(validContext);

      expect(result.notServices).toHaveLength(2);
      expect(result.competitors).toHaveLength(2);
    });

    it("returns empty result for missing businessName", async () => {
      const extractor = new NegativeAssociationExtractor("test-key");
      const result = await extractor.extract({
        businessName: "",
        industry: "Test",
        services: [],
      });

      expect(result).toEqual({
        notServices: [],
        competitors: [],
        adjacentVerticals: [],
        wrongIntent: [],
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns empty result for missing industry", async () => {
      const extractor = new NegativeAssociationExtractor("test-key");
      const result = await extractor.extract({
        businessName: "Test",
        industry: "",
        services: [],
      });

      expect(result).toEqual({
        notServices: [],
        competitors: [],
        adjacentVerticals: [],
        wrongIntent: [],
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns empty result on API error", async () => {
      mockCreate.mockRejectedValueOnce(new Error("API Error"));

      const extractor = new NegativeAssociationExtractor("test-key");
      const result = await extractor.extract(validContext);

      expect(result).toEqual({
        notServices: [],
        competitors: [],
        adjacentVerticals: [],
        wrongIntent: [],
      });
    });

    it("returns empty result on invalid JSON", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "This is not JSON",
          },
        ],
      });

      const extractor = new NegativeAssociationExtractor("test-key");
      const result = await extractor.extract(validContext);

      expect(result).toEqual({
        notServices: [],
        competitors: [],
        adjacentVerticals: [],
        wrongIntent: [],
      });
    });

    it("uses defaults for missing fields in response", async () => {
      // Response missing some fields
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              notServices: ["test"],
              // missing: competitors, adjacentVerticals, wrongIntent
            }),
          },
        ],
      });

      const extractor = new NegativeAssociationExtractor("test-key");
      const result = await extractor.extract(validContext);

      expect(result.notServices).toEqual(["test"]);
      expect(result.competitors).toEqual([]);
      expect(result.adjacentVerticals).toEqual([]);
      expect(result.wrongIntent).toEqual([]);
    });
  });

  describe("negativeAssociationExtractor singleton", () => {
    it("provides extract function", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify(mockValidResponse),
          },
        ],
      });

      const result = await negativeAssociationExtractor.extract(validContext);

      expect(result.notServices).toHaveLength(2);
    });
  });
});
