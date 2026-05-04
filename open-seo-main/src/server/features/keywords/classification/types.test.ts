import { describe, test, expect } from "vitest";
import type {
  ClassifiedKeyword,
  GeoClassification,
  GeoConstraints,
} from "./types";

describe("Classification Types - Phase 77 Geo Integration", () => {
  describe("GeoClassification re-export", () => {
    test("GeoClassification type is exported from classification/types", () => {
      // Type-only test - if this compiles, the export works
      const geoClass: GeoClassification = {
        hasExplicitCity: true,
        city: "vilnius",
        isNearMe: false,
        isGeneric: false,
        passesGeoFilter: true,
        geoScore: 1.0,
        reason: "Target city: vilnius",
      };

      expect(geoClass).toBeDefined();
      expect(geoClass.city).toBe("vilnius");
    });

    test("GeoConstraints type is exported from classification/types", () => {
      // Type-only test - if this compiles, the export works
      const constraints: GeoConstraints = {
        includeCities: ["vilnius"],
        excludeCities: ["kaunas"],
        nearMeAllowed: true,
        genericAllowed: false,
      };

      expect(constraints).toBeDefined();
      expect(constraints.includeCities).toContain("vilnius");
    });
  });

  describe("ClassifiedKeyword with geoClassification", () => {
    test("ClassifiedKeyword can have optional geoClassification field", () => {
      const classifiedKeyword: ClassifiedKeyword = {
        keyword: "plovykla vilniuje",
        include: true,
        confidence: 0.95,
        type: "local",
        reasoning: "Local service keyword",
        pass: 1,
        geoClassification: {
          hasExplicitCity: true,
          city: "vilnius",
          isNearMe: false,
          isGeneric: false,
          passesGeoFilter: true,
          geoScore: 1.0,
          reason: "Target city: vilnius",
        },
      };

      expect(classifiedKeyword.geoClassification).toBeDefined();
      expect(classifiedKeyword.geoClassification?.city).toBe("vilnius");
      expect(classifiedKeyword.geoClassification?.geoScore).toBe(1.0);
    });

    test("ClassifiedKeyword geoClassification is optional (backward compat)", () => {
      const classifiedKeyword: ClassifiedKeyword = {
        keyword: "plovykla",
        include: true,
        confidence: 0.8,
        type: "product",
        reasoning: "Generic keyword",
        pass: 1,
        // No geoClassification field
      };

      expect(classifiedKeyword.geoClassification).toBeUndefined();
    });

    test("geoClassification with excluded city", () => {
      const classifiedKeyword: ClassifiedKeyword = {
        keyword: "plovykla kaune",
        include: false,
        confidence: 0.9,
        type: "local",
        reasoning: "Wrong city",
        pass: 1,
        geoClassification: {
          hasExplicitCity: true,
          city: "kaunas",
          isNearMe: false,
          isGeneric: false,
          passesGeoFilter: false,
          geoScore: 0.0,
          reason: "City kaunas not in target list",
        },
      };

      expect(classifiedKeyword.geoClassification?.passesGeoFilter).toBe(false);
      expect(classifiedKeyword.geoClassification?.geoScore).toBe(0.0);
    });
  });
});
