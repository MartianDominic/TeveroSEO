/**
 * Tests for content brief schema types and validation.
 * Phase 36: Content Brief Generation
 */
import { describe, it, expect } from "vitest";
import {
  BRIEF_STATUSES,
  VOICE_MODES,
  contentBriefs,
  type ContentBriefSelect,
  type ContentBriefInsert,
  type SerpAnalysisData,
  type BriefStatus,
  type VoiceMode,
} from "./brief-schema";

describe("BriefSchema Types", () => {
  describe("BRIEF_STATUSES", () => {
    it("should contain all required status values", () => {
      expect(BRIEF_STATUSES).toEqual([
        "draft",
        "ready",
        "generating",
        "published",
      ]);
    });

    it("should accept valid status values", () => {
      const validStatuses: BriefStatus[] = [
        "draft",
        "ready",
        "generating",
        "published",
      ];

      validStatuses.forEach((status) => {
        expect(BRIEF_STATUSES).toContain(status);
      });
    });
  });

  describe("VOICE_MODES", () => {
    it("should contain all required voice mode values", () => {
      expect(VOICE_MODES).toEqual([
        "preservation",
        "application",
        "best_practices",
      ]);
    });

    it("should accept valid voice mode values", () => {
      const validModes: VoiceMode[] = [
        "preservation",
        "application",
        "best_practices",
      ];

      validModes.forEach((mode) => {
        expect(VOICE_MODES).toContain(mode);
      });
    });
  });

  describe("contentBriefs table", () => {
    it("should have required column structure", () => {
      const columns = contentBriefs;

      expect(columns).toBeDefined();
      expect(columns.id).toBeDefined();
      expect(columns.mappingId).toBeDefined();
      expect(columns.keyword).toBeDefined();
      expect(columns.targetWordCount).toBeDefined();
      expect(columns.voiceMode).toBeDefined();
      expect(columns.status).toBeDefined();
      expect(columns.serpAnalysis).toBeDefined();
      expect(columns.articleId).toBeDefined();
      expect(columns.createdAt).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
    });
  });

  describe("SerpAnalysisData interface", () => {
    it("should accept valid SERP analysis data", () => {
      const validAnalysis: SerpAnalysisData = {
        commonH2s: [
          { heading: "What is SEO", frequency: 5 },
          { heading: "SEO Best Practices", frequency: 3 },
        ],
        paaQuestions: [
          "What is SEO?",
          "How does SEO work?",
          "Why is SEO important?",
        ],
        competitorWordCounts: [1200, 1500, 1800, 2000, 2200],
        metaLengths: { title: 60, description: 155 },
        analyzedAt: new Date().toISOString(),
        location: "United States",
      };

      expect(validAnalysis.commonH2s).toHaveLength(2);
      expect(validAnalysis.paaQuestions).toHaveLength(3);
      expect(validAnalysis.competitorWordCounts).toHaveLength(5);
      expect(validAnalysis.metaLengths.title).toBeGreaterThan(0);
      expect(validAnalysis.metaLengths.description).toBeGreaterThan(0);
    });

    it("should handle empty SERP analysis data", () => {
      const emptyAnalysis: SerpAnalysisData = {
        commonH2s: [],
        paaQuestions: [],
        competitorWordCounts: [],
        metaLengths: { title: 0, description: 0 },
        analyzedAt: new Date().toISOString(),
        location: "United States",
      };

      expect(emptyAnalysis.commonH2s).toHaveLength(0);
      expect(emptyAnalysis.paaQuestions).toHaveLength(0);
      expect(emptyAnalysis.competitorWordCounts).toHaveLength(0);
    });
  });

  describe("ContentBriefInsert type", () => {
    it("should require all mandatory fields", () => {
      const validInsert: ContentBriefInsert = {
        id: "brief_123",
        mappingId: "mapping_456",
        keyword: "seo tools",
        targetWordCount: 1500,
        voiceMode: "preservation",
        status: "draft",
      };

      expect(validInsert.id).toBe("brief_123");
      expect(validInsert.mappingId).toBe("mapping_456");
      expect(validInsert.keyword).toBe("seo tools");
      expect(validInsert.targetWordCount).toBe(1500);
      expect(validInsert.voiceMode).toBe("preservation");
      expect(validInsert.status).toBe("draft");
    });

    it("should accept optional serpAnalysis field", () => {
      const insertWithAnalysis: ContentBriefInsert = {
        id: "brief_123",
        mappingId: "mapping_456",
        keyword: "seo tools",
        targetWordCount: 1500,
        voiceMode: "application",
        status: "ready",
        serpAnalysis: {
          commonH2s: [{ heading: "SEO Basics", frequency: 4 }],
          paaQuestions: ["What is SEO?"],
          competitorWordCounts: [1200, 1500],
          metaLengths: { title: 60, description: 155 },
          analyzedAt: new Date().toISOString(),
          location: "United States",
        },
      };

      expect(insertWithAnalysis.serpAnalysis).toBeDefined();
      expect(insertWithAnalysis.serpAnalysis?.commonH2s).toHaveLength(1);
    });
  });
});
