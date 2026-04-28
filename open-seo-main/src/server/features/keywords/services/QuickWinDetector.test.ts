/**
 * QuickWinDetector Tests
 * Phase 43-04: Prioritization Engine + UI
 *
 * TDD Tests for quick win detection: striking distance, low hanging fruit, fresh opportunity
 */

import { describe, it, expect } from "vitest";
import {
  QuickWinDetector,
  DEFAULT_QUICK_WIN_CRITERIA,
  type QuickWinResult,
} from "./QuickWinDetector";

describe("QuickWinDetector", () => {
  const detector = new QuickWinDetector();

  describe("Striking Distance", () => {
    it("detects striking distance: position 11-30, volume >= 200, competition <= 0.7", () => {
      const result = detector.detect({
        currentPosition: 15,
        searchVolume: 500,
        competition: 0.5,
        relevanceScore: 0.7,
      });

      expect(result.type).toBe("striking_distance");
      expect(result.multiplier).toBe(1.3);
    });

    it("returns striking distance for position at boundary (11)", () => {
      const result = detector.detect({
        currentPosition: 11,
        searchVolume: 200,
        competition: 0.7,
        relevanceScore: 0.5,
      });

      expect(result.type).toBe("striking_distance");
    });

    it("returns striking distance for position at boundary (30)", () => {
      const result = detector.detect({
        currentPosition: 30,
        searchVolume: 200,
        competition: 0.7,
        relevanceScore: 0.5,
      });

      expect(result.type).toBe("striking_distance");
    });

    it("rejects position outside striking distance range (position 10)", () => {
      const result = detector.detect({
        currentPosition: 10,
        searchVolume: 500,
        competition: 0.5,
        relevanceScore: 0.7,
      });

      // Position 10 is low hanging, not striking distance
      expect(result.type).not.toBe("striking_distance");
    });

    it("rejects volume below threshold (volume 199)", () => {
      const result = detector.detect({
        currentPosition: 15,
        searchVolume: 199,
        competition: 0.5,
        relevanceScore: 0.7,
      });

      expect(result.type).not.toBe("striking_distance");
    });

    it("rejects competition above threshold (competition 0.71)", () => {
      const result = detector.detect({
        currentPosition: 15,
        searchVolume: 500,
        competition: 0.71,
        relevanceScore: 0.7,
      });

      expect(result.type).not.toBe("striking_distance");
    });
  });

  describe("Low Hanging Fruit", () => {
    it("detects low hanging fruit: position 4-10, competition <= 0.5, volume >= 100", () => {
      const result = detector.detect({
        currentPosition: 7,
        searchVolume: 150,
        competition: 0.3,
        relevanceScore: 0.6,
      });

      expect(result.type).toBe("low_hanging");
      expect(result.multiplier).toBe(1.2);
    });

    it("returns low hanging for position at boundary (4)", () => {
      const result = detector.detect({
        currentPosition: 4,
        searchVolume: 100,
        competition: 0.5,
        relevanceScore: 0.5,
      });

      expect(result.type).toBe("low_hanging");
    });

    it("returns low hanging for position at boundary (10)", () => {
      const result = detector.detect({
        currentPosition: 10,
        searchVolume: 100,
        competition: 0.5,
        relevanceScore: 0.5,
      });

      expect(result.type).toBe("low_hanging");
    });

    it("rejects position outside low hanging range (position 3)", () => {
      const result = detector.detect({
        currentPosition: 3,
        searchVolume: 150,
        competition: 0.3,
        relevanceScore: 0.6,
      });

      expect(result.type).not.toBe("low_hanging");
    });

    it("rejects competition above threshold (competition 0.51)", () => {
      const result = detector.detect({
        currentPosition: 7,
        searchVolume: 150,
        competition: 0.51,
        relevanceScore: 0.6,
      });

      expect(result.type).not.toBe("low_hanging");
    });

    it("rejects volume below threshold (volume 99)", () => {
      const result = detector.detect({
        currentPosition: 7,
        searchVolume: 99,
        competition: 0.3,
        relevanceScore: 0.6,
      });

      expect(result.type).not.toBe("low_hanging");
    });
  });

  describe("Fresh Opportunity", () => {
    it("detects fresh opportunity: not ranking, relevance >= 0.9, volume >= 500, competition <= 0.4", () => {
      const result = detector.detect({
        currentPosition: null,
        searchVolume: 1000,
        competition: 0.3,
        relevanceScore: 0.95,
      });

      expect(result.type).toBe("fresh_opportunity");
      expect(result.multiplier).toBe(1.15);
    });

    it("returns fresh opportunity at relevance boundary (0.9)", () => {
      const result = detector.detect({
        currentPosition: null,
        searchVolume: 500,
        competition: 0.4,
        relevanceScore: 0.9,
      });

      expect(result.type).toBe("fresh_opportunity");
    });

    it("rejects when ranking (position is not null)", () => {
      const result = detector.detect({
        currentPosition: 50, // Has a position, not fresh
        searchVolume: 1000,
        competition: 0.3,
        relevanceScore: 0.95,
      });

      expect(result.type).not.toBe("fresh_opportunity");
    });

    it("rejects relevance below threshold (relevance 0.89)", () => {
      const result = detector.detect({
        currentPosition: null,
        searchVolume: 1000,
        competition: 0.3,
        relevanceScore: 0.89,
      });

      expect(result.type).not.toBe("fresh_opportunity");
    });

    it("rejects volume below threshold (volume 499)", () => {
      const result = detector.detect({
        currentPosition: null,
        searchVolume: 499,
        competition: 0.3,
        relevanceScore: 0.95,
      });

      expect(result.type).not.toBe("fresh_opportunity");
    });

    it("rejects competition above threshold (competition 0.41)", () => {
      const result = detector.detect({
        currentPosition: null,
        searchVolume: 1000,
        competition: 0.41,
        relevanceScore: 0.95,
      });

      expect(result.type).not.toBe("fresh_opportunity");
    });
  });

  describe("No Quick Win", () => {
    it("returns null type and 1.0x multiplier when no criteria met", () => {
      const result = detector.detect({
        currentPosition: 50, // Too low
        searchVolume: 50, // Too low
        competition: 0.9, // Too high
        relevanceScore: 0.3, // Too low
      });

      expect(result.type).toBeNull();
      expect(result.multiplier).toBe(1.0);
    });

    it("handles null values gracefully", () => {
      const result = detector.detect({
        currentPosition: null,
        searchVolume: null,
        competition: null,
        relevanceScore: null,
      });

      expect(result.type).toBeNull();
      expect(result.multiplier).toBe(1.0);
    });
  });

  describe("Priority Selection (Highest Multiplier Wins)", () => {
    it("returns striking distance (1.3x) when both striking and low hanging match", () => {
      // Edge case: position 11 with volume 200, competition 0.5
      // Could match low_hanging (position 4-10) but position is 11, so only striking
      // Actually, position 11 doesn't match low_hanging (4-10), so this won't overlap

      // Create a custom detector with overlapping ranges for testing
      const customDetector = new QuickWinDetector({
        strikingDistance: {
          positionMin: 5,
          positionMax: 15,
          volumeMin: 100,
          competitionMax: 0.7,
          multiplier: 1.3,
        },
        lowHanging: {
          positionMin: 4,
          positionMax: 10,
          competitionMax: 0.5,
          volumeMin: 100,
          multiplier: 1.2,
        },
        freshOpportunity: {
          relevanceMin: 0.9,
          volumeMin: 500,
          competitionMax: 0.4,
          multiplier: 1.15,
        },
      });

      // Position 7 matches both striking (5-15) and low_hanging (4-10)
      const result = customDetector.detect({
        currentPosition: 7,
        searchVolume: 200,
        competition: 0.4,
        relevanceScore: 0.7,
      });

      // Should pick striking distance (1.3x) over low hanging (1.2x)
      expect(result.type).toBe("striking_distance");
      expect(result.multiplier).toBe(1.3);
    });

    it("prefers single matching quick win when only one matches", () => {
      const result = detector.detect({
        currentPosition: 7, // Low hanging range (4-10)
        searchVolume: 150, // Meets low hanging but not fresh (< 500)
        competition: 0.3, // Meets low hanging
        relevanceScore: 0.5, // Doesn't meet fresh opportunity (< 0.9)
      });

      expect(result.type).toBe("low_hanging");
      expect(result.multiplier).toBe(1.2);
    });
  });

  describe("Custom Criteria", () => {
    it("uses custom criteria when provided", () => {
      const customDetector = new QuickWinDetector({
        strikingDistance: {
          positionMin: 20,
          positionMax: 50,
          volumeMin: 100,
          competitionMax: 0.8,
          multiplier: 1.5,
        },
        lowHanging: {
          positionMin: 5,
          positionMax: 15,
          competitionMax: 0.6,
          volumeMin: 50,
          multiplier: 1.3,
        },
        freshOpportunity: {
          relevanceMin: 0.8,
          volumeMin: 300,
          competitionMax: 0.5,
          multiplier: 1.2,
        },
      });

      const result = customDetector.detect({
        currentPosition: 25,
        searchVolume: 100,
        competition: 0.5,
        relevanceScore: 0.6,
      });

      expect(result.type).toBe("striking_distance");
      expect(result.multiplier).toBe(1.5);
    });
  });

  describe("detectBatch", () => {
    it("processes multiple keywords and returns map with results", () => {
      const keywords = [
        {
          id: "kw-1",
          prospectId: "p-1",
          keyword: "test",
          normalizedKeyword: "test",
          source: "manual" as const,
          sourceMetadata: null,
          searchVolume: 500,
          keywordDifficulty: null,
          cpc: null,
          competition: 0.5,
          currentPosition: 15,
          currentUrl: null,
          enrichmentStatus: "enriched" as const,
          enrichmentCostCents: 0,
          enrichedAt: null,
          tier: null,
          quickWinType: null,
          compositeScore: null,
          relevanceScore: 0.7,
          mappedUrl: null,
          mappedAction: null,
          mappingConfidence: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "kw-2",
          prospectId: "p-1",
          keyword: "test2",
          normalizedKeyword: "test2",
          source: "manual" as const,
          sourceMetadata: null,
          searchVolume: 150,
          keywordDifficulty: null,
          cpc: null,
          competition: 0.3,
          currentPosition: 7,
          currentUrl: null,
          enrichmentStatus: "enriched" as const,
          enrichmentCostCents: 0,
          enrichedAt: null,
          tier: null,
          quickWinType: null,
          compositeScore: null,
          relevanceScore: 0.6,
          mappedUrl: null,
          mappedAction: null,
          mappingConfidence: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const results = detector.detectBatch(keywords);

      expect(results.size).toBe(2);
      expect(results.get("kw-1")?.type).toBe("striking_distance");
      expect(results.get("kw-2")?.type).toBe("low_hanging");
    });
  });
});
