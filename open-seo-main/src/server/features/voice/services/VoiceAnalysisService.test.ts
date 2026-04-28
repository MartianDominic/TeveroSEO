/**
 * VoiceAnalysisService Tests
 * Phase 37-05: Gap Closure - Voice Learning
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoiceAnalysisService } from "./VoiceAnalysisService";
import type { VoiceExtractionResult } from "../types";
import type { PageAnalysis } from "@/server/lib/audit/types";

// Mock dependencies
vi.mock("@/server/features/voice/services/VoiceAnalyzer", () => ({
  analyzePageVoice: vi.fn(),
  aggregateVoiceResults: vi.fn(),
}));

vi.mock("@/server/lib/scraper/dataforseoScraper", () => ({
  scrapeProspectPage: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("@/db/voice-schema", () => ({
  voiceAnalysis: {},
  voiceProfiles: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { analyzePageVoice, aggregateVoiceResults } from "@/server/features/voice/services/VoiceAnalyzer";
import { scrapeProspectPage } from "@/server/lib/scraper/dataforseoScraper";
import { db } from "@/db";

describe("VoiceAnalysisService", () => {
  let service: VoiceAnalysisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VoiceAnalysisService();
  });

  describe("analyzePages", () => {
    it("should scrape 5 URLs and aggregate voice dimensions", async () => {
      // Arrange
      const profileId = "profile-123";
      const urls = [
        "https://example.com/page1",
        "https://example.com/page2",
        "https://example.com/page3",
        "https://example.com/page4",
        "https://example.com/page5",
      ];

      const mockPageAnalysis: PageAnalysis = {
        url: "",
        statusCode: 200,
        redirectUrl: null,
        responseTimeMs: 100,
        title: "Test Page",
        metaDescription: "Test description",
        canonical: null,
        robotsMeta: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        h1s: ["Heading 1"],
        headingOrder: [1, 2],
        wordCount: 500,
        images: [],
        internalLinks: [],
        externalLinks: [],
        hasStructuredData: false,
        hreflangTags: [],
      };

      const mockVoiceResult: VoiceExtractionResult = {
        dimensions: {
          tone_primary: "professional",
          tone_secondary: null,
          formality_level: 7,
          personality_traits: ["trustworthy", "innovative"],
          archetype: "professional",
          sentence_length_avg: 18,
          paragraph_length_avg: 3,
          contraction_usage: "sometimes",
          vocabulary_patterns: { preferred: ["innovative"], avoided: ["cheap"] },
          signature_phrases: ["excellence in action"],
          forbidden_phrases: [],
          heading_style: "title_case",
        },
        confidence: 85,
        sample_sentences: ["We deliver excellence."],
        reasoning: "Professional tone detected",
      };

      vi.mocked(scrapeProspectPage).mockResolvedValue({
        success: true,
        page: mockPageAnalysis,
        costCents: 1,
      });

      vi.mocked(analyzePageVoice).mockResolvedValue(mockVoiceResult);

      vi.mocked(aggregateVoiceResults).mockReturnValue(mockVoiceResult.dimensions);

      // Act
      const result = await service.analyzePages(profileId, urls);

      // Assert
      expect(scrapeProspectPage).toHaveBeenCalledTimes(5);
      expect(analyzePageVoice).toHaveBeenCalledTimes(5);
      expect(aggregateVoiceResults).toHaveBeenCalledWith(
        expect.arrayContaining([mockVoiceResult])
      );
      expect(result.dimensions).toEqual(mockVoiceResult.dimensions);
      expect(result.avgConfidence).toBe(85);
    });

    it("should save individual analyses to voiceAnalysis table", async () => {
      // Arrange
      const profileId = "profile-123";
      const urls = ["https://example.com/page1"];

      const mockPageAnalysis: PageAnalysis = {
        url: urls[0],
        title: "Test Page",
        metaDescription: "Test description",
        statusCode: 200,
        redirectUrl: null,
        responseTimeMs: 100,
        canonical: null,
        robotsMeta: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        h1s: ["Heading 1"],
        headingOrder: [1],
        wordCount: 500,
        images: [],
        internalLinks: [],
        externalLinks: [],
        hasStructuredData: false,
        hreflangTags: [],
      };

      const mockVoiceResult: VoiceExtractionResult = {
        dimensions: {
          tone_primary: "friendly",
          tone_secondary: null,
          formality_level: 5,
          personality_traits: ["warm"],
          archetype: "friendly",
          sentence_length_avg: 15,
          paragraph_length_avg: 3,
          contraction_usage: "frequently",
          vocabulary_patterns: { preferred: [], avoided: [] },
          signature_phrases: [],
          forbidden_phrases: [],
          heading_style: "sentence_case",
        },
        confidence: 75,
        sample_sentences: ["We're here to help!"],
        reasoning: "Friendly tone",
      };

      vi.mocked(scrapeProspectPage).mockResolvedValue({
        success: true,
        page: mockPageAnalysis,
        costCents: 1,
      });

      vi.mocked(analyzePageVoice).mockResolvedValue(mockVoiceResult);
      vi.mocked(aggregateVoiceResults).mockReturnValue(mockVoiceResult.dimensions);

      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "analysis-1" }]),
        })),
      }));
      vi.mocked(db.insert).mockImplementation(mockInsert as any);

      // Act
      await service.analyzePages(profileId, urls);

      // Assert
      expect(db.insert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId,
          url: urls[0],
          extractedTone: "friendly",
          extractedFormality: 5,
        })
      );
    });

    it("should update voiceProfiles with aggregated results", async () => {
      // Arrange
      const profileId = "profile-123";
      const urls = ["https://example.com/page1"];

      const mockPageAnalysis: PageAnalysis = {
        url: urls[0],
        title: "Test Page",
        metaDescription: "Test description",
        statusCode: 200,
        redirectUrl: null,
        responseTimeMs: 100,
        canonical: null,
        robotsMeta: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        h1s: ["Heading 1"],
        headingOrder: [1],
        wordCount: 500,
        images: [],
        internalLinks: [],
        externalLinks: [],
        hasStructuredData: false,
        hreflangTags: [],
      };

      const mockVoiceResult: VoiceExtractionResult = {
        dimensions: {
          tone_primary: "authoritative",
          tone_secondary: "professional",
          formality_level: 8,
          personality_traits: ["expert", "commanding"],
          archetype: "authoritative",
          sentence_length_avg: 20,
          paragraph_length_avg: 4,
          contraction_usage: "never",
          vocabulary_patterns: { preferred: ["proven"], avoided: ["maybe"] },
          signature_phrases: ["industry leading"],
          forbidden_phrases: ["cheap"],
          heading_style: "title_case",
        },
        confidence: 90,
        sample_sentences: ["We are the industry leader."],
        reasoning: "Authoritative tone",
      };

      vi.mocked(scrapeProspectPage).mockResolvedValue({
        success: true,
        page: mockPageAnalysis,
        costCents: 1,
      });

      vi.mocked(analyzePageVoice).mockResolvedValue(mockVoiceResult);
      vi.mocked(aggregateVoiceResults).mockReturnValue(mockVoiceResult.dimensions);

      const mockUpdate = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));
      vi.mocked(db.update).mockImplementation(mockUpdate as any);

      // Act
      await service.analyzePages(profileId, urls);

      // Assert
      expect(db.update).toHaveBeenCalled();
      const setCall = mockUpdate.mock.results[0].value;
      expect(setCall.set).toHaveBeenCalledWith(
        expect.objectContaining({
          tonePrimary: "authoritative",
          toneSecondary: "professional",
          formalityLevel: 8,
          archetype: "authoritative",
          confidenceScore: 90,
        })
      );
    });

    it("should return aggregated dimensions with confidence score", async () => {
      // Arrange
      const profileId = "profile-123";
      const urls = [
        "https://example.com/page1",
        "https://example.com/page2",
      ];

      const mockPageAnalysis: PageAnalysis = {
        url: "",
        title: "Test Page",
        metaDescription: "Test description",
        statusCode: 200,
        redirectUrl: null,
        responseTimeMs: 100,
        canonical: null,
        robotsMeta: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        h1s: ["Heading 1"],
        headingOrder: [1],
        wordCount: 500,
        images: [],
        internalLinks: [],
        externalLinks: [],
        hasStructuredData: false,
        hreflangTags: [],
      };

      const mockVoiceResult1: VoiceExtractionResult = {
        dimensions: {
          tone_primary: "professional",
          tone_secondary: null,
          formality_level: 7,
          personality_traits: ["trustworthy"],
          archetype: "professional",
          sentence_length_avg: 18,
          paragraph_length_avg: 3,
          contraction_usage: "sometimes",
          vocabulary_patterns: { preferred: [], avoided: [] },
          signature_phrases: [],
          forbidden_phrases: [],
          heading_style: "title_case",
        },
        confidence: 80,
        sample_sentences: [],
        reasoning: "Professional",
      };

      const mockVoiceResult2: VoiceExtractionResult = {
        dimensions: {
          tone_primary: "professional",
          tone_secondary: null,
          formality_level: 8,
          personality_traits: ["trustworthy"],
          archetype: "professional",
          sentence_length_avg: 18,
          paragraph_length_avg: 3,
          contraction_usage: "sometimes",
          vocabulary_patterns: { preferred: [], avoided: [] },
          signature_phrases: [],
          forbidden_phrases: [],
          heading_style: "title_case",
        },
        confidence: 90,
        sample_sentences: [],
        reasoning: "Professional",
      };

      vi.mocked(scrapeProspectPage).mockResolvedValue({
        success: true,
        page: mockPageAnalysis,
        costCents: 1,
      });

      vi.mocked(analyzePageVoice)
        .mockResolvedValueOnce(mockVoiceResult1)
        .mockResolvedValueOnce(mockVoiceResult2);

      vi.mocked(aggregateVoiceResults).mockReturnValue(mockVoiceResult1.dimensions);

      // Act
      const result = await service.analyzePages(profileId, urls);

      // Assert
      expect(result.avgConfidence).toBe(85); // (80 + 90) / 2
      expect(result.dimensions).toEqual(mockVoiceResult1.dimensions);
    });
  });
});
