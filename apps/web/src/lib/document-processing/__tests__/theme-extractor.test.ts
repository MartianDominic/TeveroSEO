/**
 * Theme Extractor Tests
 * Phase 102-11: Task 2 - TDD tests for theme extraction
 *
 * Tests color, font, and voice attribute extraction from documents.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the database and AI
vi.mock("@/db", () => ({
  db: {
    query: {
      uploadedDocuments: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      tone: ["professional", "technical"],
      vocabulary: ["SEO", "optimization", "rankings"],
      patterns: ["we deliver", "proven results"],
    }),
  }),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn().mockReturnValue("mocked-model"),
}));

import { extractTheme, classifyFonts, calculateConfidence } from "../theme-extractor";
import { db } from "@/db";

describe("theme-extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractTheme", () => {
    test("extracts colors from document metadata", async () => {
      const mockDoc = {
        id: "doc-123",
        workspaceId: "ws-1",
        extractedMetadata: {
          colors: ["#FF5733", "#3498DB", "#2ECC71"],
          fonts: [{ font: "Arial", size: 12, usage: 500 }],
        },
        extractedText: { text: "This is a sample document with enough text to analyze." },
      };

      (db.query.uploadedDocuments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockDoc);

      const result = await extractTheme("doc-123");

      expect(result.colors).toEqual(["#FF5733", "#3498DB", "#2ECC71"]);
      expect(result.primaryColor).toBe("#FF5733");
      expect(result.secondaryColor).toBe("#3498DB");
    });

    test("identifies heading vs body fonts", async () => {
      const mockDoc = {
        id: "doc-123",
        workspaceId: "ws-1",
        extractedMetadata: {
          colors: [],
          fonts: [
            { font: "Georgia", size: 24, usage: 100 },
            { font: "Arial", size: 12, usage: 5000 },
            { font: "Verdana", size: 14, usage: 200 },
          ],
        },
        extractedText: { text: "This is sample text for analysis with enough content." },
      };

      (db.query.uploadedDocuments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockDoc);

      const result = await extractTheme("doc-123");

      // Georgia (size 24) should be heading
      const headingFont = result.fonts.find((f) => f.usage === "heading");
      expect(headingFont?.name).toBe("Georgia");

      // Arial (most usage) should be body
      const bodyFont = result.fonts.find((f) => f.usage === "body");
      expect(bodyFont?.name).toBe("Arial");
    });

    test("uses AI to analyze voice/tone", async () => {
      const mockDoc = {
        id: "doc-123",
        workspaceId: "ws-1",
        extractedMetadata: { colors: [], fonts: [] },
        extractedText: {
          text: "This is a professional document with enough content to warrant voice analysis. We deliver proven results through our SEO optimization strategies.",
        },
      };

      (db.query.uploadedDocuments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockDoc);

      const result = await extractTheme("doc-123");

      expect(result.voiceAttributes.tone).toContain("professional");
      expect(result.voiceAttributes.vocabulary).toContain("SEO");
    });

    test("returns BrandTheme with all attributes", async () => {
      const mockDoc = {
        id: "doc-123",
        workspaceId: "ws-1",
        extractedMetadata: {
          colors: ["#000", "#FFF"],
          fonts: [{ font: "Helvetica", size: 14, usage: 1000 }],
        },
        extractedText: { text: "Sample text for complete theme extraction test." },
      };

      (db.query.uploadedDocuments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockDoc);

      const result = await extractTheme("doc-123");

      expect(result).toHaveProperty("colors");
      expect(result).toHaveProperty("primaryColor");
      expect(result).toHaveProperty("secondaryColor");
      expect(result).toHaveProperty("fonts");
      expect(result).toHaveProperty("headingFont");
      expect(result).toHaveProperty("bodyFont");
      expect(result).toHaveProperty("voiceAttributes");
      expect(result).toHaveProperty("confidence");
    });

    test("handles documents with minimal styling gracefully", async () => {
      const mockDoc = {
        id: "doc-123",
        workspaceId: "ws-1",
        extractedMetadata: { colors: [], fonts: [] },
        extractedText: { text: "Short" }, // Too short for voice analysis
      };

      (db.query.uploadedDocuments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockDoc);

      const result = await extractTheme("doc-123");

      // Should not throw, return empty/defaults
      expect(result.colors).toEqual([]);
      expect(result.fonts).toEqual([]);
      expect(result.primaryColor).toBeUndefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe("classifyFonts", () => {
    test("classifies large fonts as headings", () => {
      const fonts = [
        { font: "Times New Roman", size: 28, usage: 50 },
        { font: "Arial", size: 11, usage: 2000 },
      ];

      const result = classifyFonts(fonts);

      expect(result.find((f) => f.name === "Times New Roman")?.usage).toBe("heading");
    });

    test("classifies most-used font as body", () => {
      const fonts = [
        { font: "Georgia", size: 12, usage: 5000 },
        { font: "Verdana", size: 10, usage: 200 },
      ];

      const result = classifyFonts(fonts);

      expect(result.find((f) => f.name === "Georgia")?.usage).toBe("body");
    });
  });

  describe("calculateConfidence", () => {
    test("returns higher confidence with more data", () => {
      const fullConfidence = calculateConfidence(
        ["#000", "#FFF", "#333"],
        [{ name: "Arial", usage: "body" }, { name: "Georgia", usage: "heading" }],
        { tone: ["professional"], vocabulary: ["term1"], patterns: [] }
      );

      const lowConfidence = calculateConfidence([], [], { tone: [], vocabulary: [], patterns: [] });

      expect(fullConfidence).toBeGreaterThan(lowConfidence);
    });

    test("caps at 100", () => {
      const result = calculateConfidence(
        ["#1", "#2", "#3", "#4", "#5"],
        [{ name: "A", usage: "body" }, { name: "B", usage: "heading" }, { name: "C", usage: "accent" }],
        { tone: ["a", "b"], vocabulary: ["x", "y", "z"], patterns: ["p1"] }
      );

      expect(result).toBeLessThanOrEqual(100);
    });
  });
});
