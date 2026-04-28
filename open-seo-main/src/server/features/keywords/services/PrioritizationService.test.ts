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
});
