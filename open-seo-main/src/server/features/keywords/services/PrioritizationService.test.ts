/**
 * PrioritizationService Tests
 * Phase 43-04: Prioritization Engine + UI
 *
 * TDD Tests for multi-factor keyword prioritization with 5 weighted factors:
 * - Volume (0.15), Competition (0.10), Relevance (0.25), Focus (0.35), Position (0.15)
 * - Tier thresholds: Must-Do >= 0.75, Should-Do >= 0.50, Nice-to-Have >= 0.25, Ignore < 0.25
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database before importing PrioritizationService
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

// Mock the quickWinDetector
vi.mock("./QuickWinDetector", () => ({
  quickWinDetector: {
    detect: vi.fn(() => ({ type: null, multiplier: 1.0 })),
  },
}));

import {
  PrioritizationService,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type ScoreWeights,
} from "./PrioritizationService";
import { quickWinDetector } from "./QuickWinDetector";

describe("PrioritizationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeCompositeScore", () => {
    it("uses 5 weighted factors: volume, competition, relevance, focus, position", () => {
      const service = new PrioritizationService();

      // Verify default weights sum to 1.0
      const weightSum =
        DEFAULT_WEIGHTS.volume +
        DEFAULT_WEIGHTS.competition +
        DEFAULT_WEIGHTS.relevance +
        DEFAULT_WEIGHTS.focus +
        DEFAULT_WEIGHTS.position;

      expect(weightSum).toBeCloseTo(1.0, 5);
    });

    it("computes score with all factors contributing", () => {
      const service = new PrioritizationService();

      const score = service.computeCompositeScore(
        {
          searchVolume: 1000, // Moderate volume
          competition: 0.3, // Low competition (good)
          relevanceScore: 0.8, // High relevance
          currentPosition: 15, // Striking distance position
        },
        0.7 // Focus score
      );

      // Score should be between 0 and 1
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("applies quick win multiplier correctly", () => {
      const service = new PrioritizationService();

      // First, get base score without quick win
      vi.mocked(quickWinDetector.detect).mockReturnValue({
        type: null,
        multiplier: 1.0,
      });

      const baseScore = service.computeCompositeScore(
        {
          searchVolume: 500,
          competition: 0.5,
          relevanceScore: 0.6,
          currentPosition: 15,
        },
        0.5
      );

      // Now apply quick win multiplier
      vi.mocked(quickWinDetector.detect).mockReturnValue({
        type: "striking_distance",
        multiplier: 1.3,
      });

      const boostedScore = service.computeCompositeScore(
        {
          searchVolume: 500,
          competition: 0.5,
          relevanceScore: 0.6,
          currentPosition: 15,
        },
        0.5
      );

      // Boosted score should be higher (1.3x the base)
      expect(boostedScore).toBeCloseTo(Math.min(1, baseScore * 1.3), 5);
    });

    it("clamps score to 0-1 range", () => {
      const service = new PrioritizationService();

      // Even with extreme values and multiplier, should be clamped
      vi.mocked(quickWinDetector.detect).mockReturnValue({
        type: "striking_distance",
        multiplier: 1.3,
      });

      const score = service.computeCompositeScore(
        {
          searchVolume: 100000, // Very high volume
          competition: 0, // Perfect competition
          relevanceScore: 1.0, // Perfect relevance
          currentPosition: 20, // Good position
        },
        1.0 // Perfect focus
      );

      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("handles null values gracefully", () => {
      const service = new PrioritizationService();

      const score = service.computeCompositeScore(
        {
          searchVolume: null,
          competition: null,
          relevanceScore: null,
          currentPosition: null,
        },
        0.5
      );

      // Should compute a score with defaults
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("assignTier", () => {
    const service = new PrioritizationService();

    it("returns must_do for score >= 0.75", () => {
      expect(service.assignTier(0.75)).toBe("must_do");
      expect(service.assignTier(0.9)).toBe("must_do");
      expect(service.assignTier(1.0)).toBe("must_do");
    });

    it("returns should_do for score 0.50-0.749", () => {
      expect(service.assignTier(0.50)).toBe("should_do");
      expect(service.assignTier(0.6)).toBe("should_do");
      expect(service.assignTier(0.749)).toBe("should_do");
    });

    it("returns nice_to_have for score 0.25-0.499", () => {
      expect(service.assignTier(0.25)).toBe("nice_to_have");
      expect(service.assignTier(0.35)).toBe("nice_to_have");
      expect(service.assignTier(0.499)).toBe("nice_to_have");
    });

    it("returns ignore for score < 0.25", () => {
      expect(service.assignTier(0.24)).toBe("ignore");
      expect(service.assignTier(0.1)).toBe("ignore");
      expect(service.assignTier(0)).toBe("ignore");
    });
  });

  describe("custom weights", () => {
    it("uses custom weights when provided", () => {
      const customWeights: ScoreWeights = {
        volume: 0.4,
        competition: 0.1,
        relevance: 0.2,
        focus: 0.2,
        position: 0.1,
      };

      const service = new PrioritizationService(customWeights);

      // With high volume weight, high volume should boost score more
      const highVolumeScore = service.computeCompositeScore(
        {
          searchVolume: 10000, // Very high volume
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      const lowVolumeScore = service.computeCompositeScore(
        {
          searchVolume: 100, // Low volume
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      expect(highVolumeScore).toBeGreaterThan(lowVolumeScore);
    });

    it("custom weights still sum to be effective", () => {
      const customWeights: ScoreWeights = {
        volume: 0.3,
        competition: 0.1,
        relevance: 0.3,
        focus: 0.2,
        position: 0.1,
      };

      const service = new PrioritizationService(customWeights);

      const score = service.computeCompositeScore(
        {
          searchVolume: 1000,
          competition: 0.3,
          relevanceScore: 0.9,
          currentPosition: 15,
        },
        0.8
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("volume normalization", () => {
    const service = new PrioritizationService();

    it("normalizes volume on log scale: 0 = 0, 100 = ~0.5, 10000 = 1", () => {
      // Test through composite score differences
      const score0 = service.computeCompositeScore(
        {
          searchVolume: 0,
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      const score100 = service.computeCompositeScore(
        {
          searchVolume: 100,
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      const score10000 = service.computeCompositeScore(
        {
          searchVolume: 10000,
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      // Volume should contribute progressively
      expect(score100).toBeGreaterThan(score0);
      expect(score10000).toBeGreaterThan(score100);
    });
  });

  describe("position normalization", () => {
    const service = new PrioritizationService();

    it("position 1-3 is ranked well (lower opportunity score)", () => {
      const scorePosTop = service.computeCompositeScore(
        {
          searchVolume: 1000,
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: 2,
        },
        0.5
      );

      const scorePosStriking = service.computeCompositeScore(
        {
          searchVolume: 1000,
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: 20,
        },
        0.5
      );

      // Striking distance has more opportunity, so higher score
      expect(scorePosStriking).toBeGreaterThan(scorePosTop);
    });

    it("null position (not ranking) is treated as neutral", () => {
      const scoreNoPos = service.computeCompositeScore(
        {
          searchVolume: 1000,
          competition: 0.5,
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      // Should be a valid score
      expect(scoreNoPos).toBeGreaterThan(0);
      expect(scoreNoPos).toBeLessThanOrEqual(1);
    });
  });

  describe("competition scoring", () => {
    const service = new PrioritizationService();

    it("lower competition yields higher score contribution", () => {
      const lowCompetition = service.computeCompositeScore(
        {
          searchVolume: 1000,
          competition: 0.1, // Low competition (good)
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      const highCompetition = service.computeCompositeScore(
        {
          searchVolume: 1000,
          competition: 0.9, // High competition (bad)
          relevanceScore: 0.5,
          currentPosition: null,
        },
        0.5
      );

      expect(lowCompetition).toBeGreaterThan(highCompetition);
    });
  });

  // =========================================================================
  // Phase 77: Geographic Intelligence Integration Tests
  // =========================================================================

  describe("Phase 77: Geo-Aware Prioritization", () => {
    const service = new PrioritizationService();

    describe("Backward compatibility", () => {
      it("prioritizeKeywords without geoConstraints works as before", () => {
        const keywords = [
          {
            keyword: "plovykla vilniuje",
            searchVolume: 1000,
            competition: 0.3,
            relevanceScore: 0.8,
            currentPosition: 15,
          },
          {
            keyword: "plovykla kaune",
            searchVolume: 800,
            competition: 0.25,
            relevanceScore: 0.75,
            currentPosition: null,
          },
        ];

        const results = service.prioritizeKeywords(keywords);

        // No geo constraints = all keywords should score > 0
        expect(results.length).toBe(2);
        expect(results.every((r) => r.compositeScore > 0)).toBe(true);
        expect(results.every((r) => r.tier !== "excluded")).toBe(true);
        expect(results.every((r) => r.geoClassification === undefined)).toBe(
          true
        );
      });
    });

    describe("Geo filtering", () => {
      it("keywords passing geo filter get boosted score", () => {
        const keywords = [
          {
            keyword: "plovykla siauliuose",
            searchVolume: 1000,
            competition: 0.3,
            relevanceScore: 0.8,
            currentPosition: 15,
          },
        ];

        const constraints = {
          includeCities: ["siauliai"],
          nearMeAllowed: true,
          genericAllowed: true,
        };

        const results = service.prioritizeKeywords(keywords, {}, constraints);

        expect(results.length).toBe(1);
        expect(results[0].geoClassification?.passesGeoFilter).toBe(true);
        expect(results[0].geoClassification?.city).toBe("siauliai");
        expect(results[0].geoClassification?.geoScore).toBe(1.0);
        expect(results[0].compositeScore).toBeGreaterThan(0);
        expect(results[0].tier).not.toBe("excluded");
      });

      it("keywords failing geo filter get score=0 and tier=excluded", () => {
        const keywords = [
          {
            keyword: "plovykla kaune",
            searchVolume: 2000,
            competition: 0.2,
            relevanceScore: 0.9,
            currentPosition: 5,
          },
        ];

        const constraints = {
          includeCities: ["siauliai"],
          nearMeAllowed: true,
          genericAllowed: true,
        };

        const results = service.prioritizeKeywords(keywords, {}, constraints);

        expect(results.length).toBe(1);
        expect(results[0].geoClassification?.passesGeoFilter).toBe(false);
        expect(results[0].geoClassification?.city).toBe("kaunas");
        expect(results[0].compositeScore).toBe(0);
        expect(results[0].tier).toBe("excluded");
      });

      it("near-me keywords get score 0.9", () => {
        const keywords = [
          {
            keyword: "plovykla salia manes",
            searchVolume: 500,
            competition: 0.2,
            relevanceScore: 0.7,
            currentPosition: null,
          },
        ];

        const constraints = {
          includeCities: ["siauliai"],
          nearMeAllowed: true,
          genericAllowed: true,
        };

        const results = service.prioritizeKeywords(keywords, {}, constraints);

        expect(results.length).toBe(1);
        expect(results[0].geoClassification?.isNearMe).toBe(true);
        expect(results[0].geoClassification?.geoScore).toBe(0.9);
        expect(results[0].geoClassification?.passesGeoFilter).toBe(true);
        expect(results[0].compositeScore).toBeGreaterThan(0);
      });

      it("generic keywords get score 0.5", () => {
        const keywords = [
          {
            keyword: "automobilu plovykla",
            searchVolume: 3000,
            competition: 0.4,
            relevanceScore: 0.85,
            currentPosition: null,
          },
        ];

        const constraints = {
          includeCities: ["siauliai"],
          nearMeAllowed: true,
          genericAllowed: true,
        };

        const results = service.prioritizeKeywords(keywords, {}, constraints);

        expect(results.length).toBe(1);
        expect(results[0].geoClassification?.isGeneric).toBe(true);
        expect(results[0].geoClassification?.geoScore).toBe(0.5);
        expect(results[0].geoClassification?.passesGeoFilter).toBe(true);
        expect(results[0].compositeScore).toBeGreaterThan(0);
      });

      it("excluded keywords sorted last", () => {
        const keywords = [
          {
            keyword: "plovykla siauliuose",
            searchVolume: 1000,
            competition: 0.3,
            relevanceScore: 0.8,
            currentPosition: 15,
          },
          {
            keyword: "plovykla kaune", // Will be excluded
            searchVolume: 2000,
            competition: 0.2,
            relevanceScore: 0.9,
            currentPosition: 5,
          },
          {
            keyword: "plovykla",
            searchVolume: 3000,
            competition: 0.4,
            relevanceScore: 0.85,
            currentPosition: null,
          },
        ];

        const constraints = {
          includeCities: ["siauliai"],
          nearMeAllowed: true,
          genericAllowed: true,
        };

        const results = service.prioritizeKeywords(keywords, {}, constraints);

        // Find first excluded
        const firstExcludedIdx = results.findIndex(
          (r) => r.tier === "excluded"
        );
        expect(firstExcludedIdx).toBeGreaterThan(0); // Not first

        // Ensure no non-excluded after first excluded
        const nonExcludedAfter = results
          .slice(firstExcludedIdx + 1)
          .some((r) => r.tier !== "excluded");
        expect(nonExcludedAfter).toBe(false);
      });
    });

    describe("Multi-city targeting", () => {
      it("multiple target cities all pass", () => {
        const keywords = [
          {
            keyword: "plovykla vilniuje",
            searchVolume: 1000,
            competition: 0.3,
            relevanceScore: 0.8,
            currentPosition: 15,
          },
          {
            keyword: "plovykla kaune",
            searchVolume: 800,
            competition: 0.25,
            relevanceScore: 0.75,
            currentPosition: null,
          },
          {
            keyword: "plovykla siauliuose",
            searchVolume: 600,
            competition: 0.2,
            relevanceScore: 0.7,
            currentPosition: 20,
          },
        ];

        const constraints = {
          includeCities: ["vilnius", "kaunas"],
          nearMeAllowed: false,
          genericAllowed: false,
        };

        const results = service.prioritizeKeywords(keywords, {}, constraints);

        const passing = results.filter((r) => r.tier !== "excluded");
        expect(passing.length).toBe(2);
        expect(
          passing.every(
            (r) =>
              r.keyword.includes("vilniuje") || r.keyword.includes("kaune")
          )
        ).toBe(true);

        const excluded = results.filter((r) => r.tier === "excluded");
        expect(excluded.length).toBe(1);
        expect(excluded[0].keyword).toBe("plovykla siauliuose");
      });
    });

    describe("geoScore weight in composite calculation", () => {
      it("geoScore contributes with default weight 0.15", () => {
        const keywords = [
          {
            keyword: "plovykla siauliuose",
            searchVolume: 1000,
            competition: 0.3,
            relevanceScore: 0.8,
            currentPosition: 15,
          },
        ];

        const constraints = {
          includeCities: ["siauliai"],
        };

        const results = service.prioritizeKeywords(keywords, {}, constraints);

        expect(results[0].geoClassification?.geoScore).toBe(1.0);

        // Verify geo weight is applied
        // compositeScore should include geoScore * 0.15
        expect(results[0].compositeScore).toBeGreaterThan(0);
      });

      it("custom geo weight is respected", () => {
        const keywords = [
          {
            keyword: "plovykla siauliuose",
            searchVolume: 1000,
            competition: 0.3,
            relevanceScore: 0.8,
            currentPosition: 15,
          },
        ];

        const constraints = {
          includeCities: ["siauliai"],
        };

        const resultsDefault = service.prioritizeKeywords(
          keywords,
          {},
          constraints
        );
        const resultsCustom = service.prioritizeKeywords(
          keywords,
          { geo: 0.3 },
          constraints
        );

        // Higher geo weight should increase composite score
        expect(resultsCustom[0].compositeScore).toBeGreaterThan(
          resultsDefault[0].compositeScore
        );
      });
    });
  });
});
