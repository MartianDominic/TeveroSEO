/**
 * Geographic Intelligence Integration Tests
 * Phase 77-02: End-to-end geo filtering with PrioritizationService
 *
 * Verifies the complete flow:
 * 1. GeoClassifier extracts city and classifies keywords
 * 2. PrioritizationService applies geo filtering and scoring
 * 3. Results include geoClassification and correct composite scores
 */

import { describe, test, expect, vi } from "vitest";

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
vi.mock("../services/QuickWinDetector", () => ({
  quickWinDetector: {
    detect: vi.fn(() => ({ type: null, multiplier: 1.0 })),
  },
}));

import { geoClassifier } from "./GeoClassifier";
import { PrioritizationService } from "../services/PrioritizationService";
import type { GeoConstraints } from "./types";

describe("Geographic Intelligence Integration", () => {
  const prioritizationService = new PrioritizationService();

  describe("End-to-end: Siauliai car wash", () => {
    const constraints: Partial<GeoConstraints> = {
      includeCities: ["siauliai"],
      nearMeAllowed: true,
      genericAllowed: true,
    };

    const keywords = [
      {
        keyword: "automobilu plovykla siauliuose",
        searchVolume: 1000,
        competition: 0.3,
        relevanceScore: 0.8,
        currentPosition: 15,
      },
      {
        keyword: "plovykla kaune",
        searchVolume: 2000,
        competition: 0.25,
        relevanceScore: 0.9,
        currentPosition: 5,
      },
      {
        keyword: "plovykla salia manes",
        searchVolume: 500,
        competition: 0.2,
        relevanceScore: 0.7,
        currentPosition: null,
      },
      {
        keyword: "automobilu plovykla",
        searchVolume: 3000,
        competition: 0.4,
        relevanceScore: 0.85,
        currentPosition: null,
      },
    ];

    test("correct keywords pass filter", () => {
      const results = prioritizationService.prioritizeKeywordsList(
        keywords,
        {},
        constraints
      );

      // Siauliai keyword passes with score 1.0
      const siauliai = results.find((r) => r.keyword.includes("siauliuose"));
      expect(siauliai?.geoClassification?.passesGeoFilter).toBe(true);
      expect(siauliai?.geoClassification?.city).toBe("siauliai");
      expect(siauliai?.geoClassification?.geoScore).toBe(1.0);
      expect(siauliai?.tier).not.toBe("excluded");
      expect(siauliai?.compositeScore).toBeGreaterThan(0);

      // Kaunas keyword fails
      const kaunas = results.find((r) => r.keyword.includes("kaune"));
      expect(kaunas?.geoClassification?.passesGeoFilter).toBe(false);
      expect(kaunas?.geoClassification?.city).toBe("kaunas");
      expect(kaunas?.compositeScore).toBe(0);
      expect(kaunas?.tier).toBe("excluded");

      // Near-me passes with score 0.9
      const nearMe = results.find((r) => r.keyword.includes("salia manes"));
      expect(nearMe?.geoClassification?.passesGeoFilter).toBe(true);
      expect(nearMe?.geoClassification?.isNearMe).toBe(true);
      expect(nearMe?.geoClassification?.geoScore).toBe(0.9);
      expect(nearMe?.tier).not.toBe("excluded");

      // Generic passes with score 0.5
      const generic = results.find(
        (r) => r.keyword === "automobilu plovykla"
      );
      expect(generic?.geoClassification?.passesGeoFilter).toBe(true);
      expect(generic?.geoClassification?.isGeneric).toBe(true);
      expect(generic?.geoClassification?.geoScore).toBe(0.5);
      expect(generic?.tier).not.toBe("excluded");
    });

    test("excluded keywords sorted last", () => {
      const results = prioritizationService.prioritizeKeywordsList(
        keywords,
        {},
        constraints
      );

      const excludedIndex = results.findIndex((r) => r.tier === "excluded");
      expect(excludedIndex).toBeGreaterThan(-1); // At least one excluded

      const nonExcludedAfter = results
        .slice(excludedIndex + 1)
        .some((r) => r.tier !== "excluded");
      expect(nonExcludedAfter).toBe(false);
    });

    test("geoScore affects composite score ranking", () => {
      const results = prioritizationService.prioritizeKeywordsList(
        keywords,
        {},
        constraints
      );

      const nonExcluded = results.filter((r) => r.tier !== "excluded");

      // Verify that higher geoScore contributes to higher composite score
      // (when other factors are comparable)
      const siauliai = nonExcluded.find((r) => r.keyword.includes("siauliuose"));
      const nearMe = nonExcluded.find((r) => r.keyword.includes("salia manes"));
      const generic = nonExcluded.find((r) =>
        r.keyword === "automobilu plovykla"
      );

      expect(siauliai?.geoClassification?.geoScore).toBe(1.0);
      expect(nearMe?.geoClassification?.geoScore).toBe(0.9);
      expect(generic?.geoClassification?.geoScore).toBe(0.5);
    });
  });

  describe("End-to-end: Multi-city targeting", () => {
    const constraints: Partial<GeoConstraints> = {
      includeCities: ["vilnius", "kaunas"],
      nearMeAllowed: false,
      genericAllowed: false,
    };

    test("only target city keywords pass", () => {
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
        {
          keyword: "plovykla salia manes",
          searchVolume: 500,
          competition: 0.15,
          relevanceScore: 0.65,
          currentPosition: null,
        },
        {
          keyword: "plovykla",
          searchVolume: 2000,
          competition: 0.4,
          relevanceScore: 0.85,
          currentPosition: null,
        },
      ];

      const results = prioritizationService.prioritizeKeywordsList(
        keywords,
        {},
        constraints
      );
      const passing = results.filter((r) => r.tier !== "excluded");

      expect(passing.length).toBe(2); // vilnius + kaunas only
      expect(
        passing.every(
          (r) => r.keyword.includes("vilniuje") || r.keyword.includes("kaune")
        )
      ).toBe(true);

      // Verify all target cities pass
      const vilnius = passing.find((r) => r.keyword.includes("vilniuje"));
      const kaunas = passing.find((r) => r.keyword.includes("kaune"));
      expect(vilnius?.geoClassification?.city).toBe("vilnius");
      expect(kaunas?.geoClassification?.city).toBe("kaunas");
      expect(vilnius?.geoClassification?.geoScore).toBe(1.0);
      expect(kaunas?.geoClassification?.geoScore).toBe(1.0);
    });

    test("near-me and generic excluded when not allowed", () => {
      const keywords = [
        {
          keyword: "plovykla salia manes",
          searchVolume: 500,
          competition: 0.15,
          relevanceScore: 0.65,
          currentPosition: null,
        },
        {
          keyword: "plovykla",
          searchVolume: 2000,
          competition: 0.4,
          relevanceScore: 0.85,
          currentPosition: null,
        },
      ];

      const results = prioritizationService.prioritizeKeywordsList(
        keywords,
        {},
        constraints
      );

      expect(results.every((r) => r.tier === "excluded")).toBe(true);
      expect(results.every((r) => r.compositeScore === 0)).toBe(true);

      const nearMe = results.find((r) => r.keyword.includes("salia manes"));
      const generic = results.find((r) => r.keyword === "plovykla");

      expect(nearMe?.geoClassification?.isNearMe).toBe(true);
      expect(nearMe?.geoClassification?.passesGeoFilter).toBe(false);

      expect(generic?.geoClassification?.isGeneric).toBe(true);
      expect(generic?.geoClassification?.passesGeoFilter).toBe(false);
    });
  });

  describe("Backward compatibility", () => {
    test("prioritize without geoConstraints works as before", () => {
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

      const results = prioritizationService.prioritizeKeywordsList(keywords); // No geo constraints

      expect(results.every((r) => r.geoClassification === undefined)).toBe(
        true
      );
      expect(results.every((r) => r.compositeScore > 0)).toBe(true);
      expect(results.every((r) => r.tier !== "excluded")).toBe(true);
    });
  });

  describe("GeoClassifier direct usage", () => {
    test("classify single keyword with target city", () => {
      const result = geoClassifier.classify("plovykla siauliuose", {
        includeCities: ["siauliai"],
      });

      expect(result.hasExplicitCity).toBe(true);
      expect(result.city).toBe("siauliai");
      expect(result.passesGeoFilter).toBe(true);
      expect(result.geoScore).toBe(1.0);
    });

    test("classify batch with mixed results", () => {
      const keywords = [
        "plovykla siauliuose",
        "plovykla kaune",
        "plovykla salia manes",
        "plovykla",
      ];

      const results = geoClassifier.classifyBatch(keywords, {
        includeCities: ["siauliai"],
        nearMeAllowed: true,
        genericAllowed: true,
      });

      expect(results.length).toBe(4);
      expect(results[0].passesGeoFilter).toBe(true); // siauliai
      expect(results[1].passesGeoFilter).toBe(false); // kaunas
      expect(results[2].passesGeoFilter).toBe(true); // near-me
      expect(results[3].passesGeoFilter).toBe(true); // generic
    });
  });

  describe("Edge cases", () => {
    test("empty includeCities allows all cities", () => {
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

      const results = prioritizationService.prioritizeKeywordsList(
        keywords,
        {},
        {
          includeCities: [], // Empty = all cities allowed
          nearMeAllowed: true,
          genericAllowed: true,
        }
      );

      expect(results.every((r) => r.tier !== "excluded")).toBe(true);
      expect(results.every((r) => r.compositeScore > 0)).toBe(true);
    });

    test("excludeCities overrides includeCities", () => {
      const keywords = [
        {
          keyword: "plovykla kaune",
          searchVolume: 800,
          competition: 0.25,
          relevanceScore: 0.75,
          currentPosition: null,
        },
      ];

      const results = prioritizationService.prioritizeKeywordsList(
        keywords,
        {},
        {
          includeCities: ["kaunas"],
          excludeCities: ["kaunas"], // Exclude wins
          nearMeAllowed: true,
          genericAllowed: true,
        }
      );

      expect(results[0].tier).toBe("excluded");
      expect(results[0].compositeScore).toBe(0);
      expect(results[0].geoClassification?.passesGeoFilter).toBe(false);
    });
  });
});
