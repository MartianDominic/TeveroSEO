/**
 * Tests for ConversationExtractor.
 * Phase 56: Prospect Input Excellence
 *
 * Test coverage:
 * - Extraction from sales transcript returns valid data
 * - Confidence score is between 0-100
 * - Empty content throws validation error
 * - Content too short throws validation error
 * - Zod validation catches malformed AI response
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks to top level
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

// Mock Anthropic SDK using a class
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

// Mock PlatformDetector
vi.mock("@/server/features/connections/services/PlatformDetector", () => ({
  detectPlatform: vi.fn(),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks are set up
import { extractFromConversation } from "./ConversationExtractor";

describe("ConversationExtractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("extracts business info from sales transcript", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            businessName: "Acme Consulting",
            industry: "Business Consulting",
            services: ["Strategy", "Operations"],
            keywords: ["business consulting", "strategy consulting"],
            targetAudience: "SMBs",
            location: "Chicago, IL",
            confidence: 85,
          }),
        },
      ],
    });

    const result = await extractFromConversation({
      content:
        "Meeting with John from Acme Consulting. They're a business consulting firm in Chicago helping SMBs with strategy and operations...",
      inputMode: "conversation",
    });

    expect(result.businessName).toBe("Acme Consulting");
    expect(result.industry).toBe("Business Consulting");
    expect(result.services).toContain("Strategy");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("throws on empty content", async () => {
    await expect(
      extractFromConversation({ content: "", inputMode: "conversation" }),
    ).rejects.toThrow("Content is required");
  });

  it("throws on content too short", async () => {
    await expect(
      extractFromConversation({ content: "Hi there", inputMode: "conversation" }),
    ).rejects.toThrow("at least 50 characters");
  });

  it("validates AI response with Zod schema", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ invalid: "response" }) }],
    });

    const result = await extractFromConversation({
      content:
        "A valid long conversation text that meets the minimum character requirement for processing.",
      inputMode: "conversation",
    });

    // Should return a result with confidence 0 when validation fails
    expect(result.confidence).toBe(0);
  });

  it("returns confidence score in valid range", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            businessName: "Tech Corp",
            confidence: 95,
          }),
        },
      ],
    });

    const result = await extractFromConversation({
      content:
        "Conversation about Tech Corp, a technology company with strong market presence and innovative solutions.",
      inputMode: "conversation",
    });

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.confidence).toBe(95);
  });
});
