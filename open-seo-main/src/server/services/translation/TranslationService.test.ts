/**
 * Unit Tests for TranslationService
 * Phase 55: Full Platform Internationalization (i18n)
 *
 * Tests translation service functionality with mocked Gemini API and database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TranslationRequest } from "./types";

// Create mock function at module level
const mockGenerateContent = vi.fn();

// Mock @google/generative-ai with proper class-like structure
vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_apiKey: string) {
        // Constructor doesn't need to do anything
      }
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
  };
});

// Mock database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  translationCache: {
    id: "id",
    sourceHash: "source_hash",
    targetLang: "target_lang",
    contextType: "context_type",
    formality: "formality",
    useCount: "use_count",
  },
  workspaceTranslationOverrides: {
    workspaceId: "workspace_id",
    messageKey: "message_key",
    language: "language",
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("test-nanoid-123"),
}));

describe("TranslationService", () => {
  // Import dynamically to allow mocks to be set up first
  let TranslationService: typeof import("./TranslationService").TranslationService;
  let service: InstanceType<typeof TranslationService>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set required env var
    process.env.GEMINI_API_KEY = "test-api-key";

    // Set up default mock response
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Sveiki, pasauli!",
      },
    });

    // Import the module after mocks are set up
    const module = await import("./TranslationService");
    TranslationService = module.TranslationService;

    service = new TranslationService();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.restoreAllMocks();
  });

  describe("translate", () => {
    it("should return original text when source === target language", async () => {
      const request: TranslationRequest = {
        text: "Hello, world!",
        sourceLang: "en",
        targetLang: "en",
        context: {
          type: "ui",
          formality: "formal",
        },
      };

      const result = await service.translate(request);

      expect(result.text).toBe("Hello, world!");
      expect(result.cached).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it("should translate text to Lithuanian via Gemini API", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => "Sveiki, pasauli!",
        },
      });

      const request: TranslationRequest = {
        text: "Hello, world!",
        sourceLang: "en",
        targetLang: "lt",
        context: {
          type: "ui",
          formality: "formal",
        },
      };

      const result = await service.translate(request);

      expect(result.text).toBe("Sveiki, pasauli!");
      expect(result.cached).toBe(false);
      // Confidence should be >0 due to Lithuanian chars in translation
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should preserve placeholders in translation", async () => {
      // Mock translation that preserves placeholders
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => "Sveiki, {{name}}! Jus turite {count} pranesimu.",
        },
      });

      const request: TranslationRequest = {
        text: "Hello, {{name}}! You have {count} messages.",
        sourceLang: "en",
        targetLang: "lt",
        context: {
          type: "ui",
          formality: "formal",
        },
        preservePlaceholders: true,
      };

      const result = await service.translate(request);

      // Verify placeholders are preserved
      expect(result.text).toContain("{{name}}");
      expect(result.text).toContain("{count}");
    });
  });

  describe("calculateQualityScore", () => {
    it("should give high score for good Lithuanian translation", () => {
      const source = "Hello, world!";
      const translation = "Sveiki, pasauli!"; // Good Lithuanian
      const request: TranslationRequest = {
        text: source,
        sourceLang: "en",
        targetLang: "lt",
        context: { type: "ui", formality: "formal" },
      };

      const score = service.calculateQualityScore(source, translation, request);

      // Should be relatively high due to:
      // - Reasonable length ratio
      // - Lithuanian characters present
      expect(score).toBeGreaterThanOrEqual(0.6);
    });

    it("should detect missing placeholders and reduce score", () => {
      const source = "Hello, {{name}}!";
      const translation = "Sveiki!"; // Missing placeholder
      const request: TranslationRequest = {
        text: source,
        sourceLang: "en",
        targetLang: "lt",
        context: { type: "ui", formality: "formal" },
      };

      const score = service.calculateQualityScore(source, translation, request);

      // Should be lower due to missing placeholder
      expect(score).toBeLessThan(0.8);
    });

    it("should penalize translation exceeding maxLength", () => {
      const source = "Save";
      const translation = "Issaugoti visus pakeitimus ir uzdaryti"; // Way too long
      const request: TranslationRequest = {
        text: source,
        sourceLang: "en",
        targetLang: "lt",
        context: { type: "ui", formality: "formal" },
        maxLength: 10,
      };

      const score = service.calculateQualityScore(source, translation, request);

      // Should be penalized for exceeding length
      expect(score).toBeLessThan(0.7);
    });
  });

  describe("validatePlaceholders", () => {
    it("should return translation unchanged when placeholders preserved", () => {
      const source = "Hello, {{name}}! Value: {0}";
      const translation = "Sveiki, {{name}}! Reiksme: {0}";

      const result = service.validatePlaceholders(source, translation);

      expect(result).toBe(translation);
    });

    it("should log warning when placeholder is missing", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const source = "Hello, {{name}}!";
      const translation = "Sveiki!"; // Missing {{name}}

      service.validatePlaceholders(source, translation);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("{{name}}")
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle %s placeholders", () => {
      const source = "Error: %s occurred";
      const translation = "Klaida: %s ivyko";

      const result = service.validatePlaceholders(source, translation);

      expect(result).toBe(translation);
    });
  });
});

describe("TranslationService constructor", () => {
  it("should throw error when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    vi.resetModules();

    // Re-import to get fresh module
    const { TranslationService } = await import("./TranslationService");

    expect(() => new TranslationService()).toThrow("GEMINI_API_KEY");
  });
});
