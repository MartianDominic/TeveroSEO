import { describe, test, expect } from "vitest";
import { GeoClassifier, geoClassifier } from "./GeoClassifier";
import type { GeoConstraints } from "./types";

describe("GeoClassifier", () => {
  describe("Target City: Siauliai", () => {
    const constraints: Partial<GeoConstraints> = { includeCities: ["siauliai"] };

    test.each([
      ["automobilu plovykla siauliuose", true, "siauliai", 1.0],
      ["plovykla siauliuose kaina", true, "siauliai", 1.0],
      ["automobilu plovykla kaune", false, "kaunas", 0.0],
      ["detailing vilniuje", false, "vilnius", 0.0],
    ])("classify(%s) -> pass:%s, city:%s, score:%s", (kw, pass, city, score) => {
      const result = geoClassifier.classify(kw, constraints);
      expect(result.passesGeoFilter).toBe(pass);
      expect(result.city).toBe(city);
      expect(result.geoScore).toBe(score);
    });
  });

  describe("Multiple Target Cities: Vilnius + Kaunas", () => {
    const constraints: Partial<GeoConstraints> = { includeCities: ["vilnius", "kaunas"] };

    test("plovykla vilniuje -> PASS", () => {
      const result = geoClassifier.classify("plovykla vilniuje", constraints);
      expect(result.passesGeoFilter).toBe(true);
      expect(result.city).toBe("vilnius");
      expect(result.geoScore).toBe(1.0);
    });

    test("plovykla kaune -> PASS", () => {
      const result = geoClassifier.classify("plovykla kaune", constraints);
      expect(result.passesGeoFilter).toBe(true);
      expect(result.city).toBe("kaunas");
      expect(result.geoScore).toBe(1.0);
    });

    test("plovykla siauliuose -> FAIL", () => {
      const result = geoClassifier.classify("plovykla siauliuose", constraints);
      expect(result.passesGeoFilter).toBe(false);
      expect(result.city).toBe("siauliai");
    });
  });

  describe("Near Me Patterns", () => {
    test("salia manes with nearMeAllowed=true -> PASS, score 0.9", () => {
      const result = geoClassifier.classify("plovykla salia manes", { nearMeAllowed: true });
      expect(result.passesGeoFilter).toBe(true);
      expect(result.isNearMe).toBe(true);
      expect(result.geoScore).toBe(0.9);
    });

    test("salia manes with nearMeAllowed=false -> FAIL", () => {
      const result = geoClassifier.classify("plovykla salia manes", { nearMeAllowed: false });
      expect(result.passesGeoFilter).toBe(false);
      expect(result.isNearMe).toBe(true);
      expect(result.geoScore).toBe(0.0);
    });

    test("netoli with nearMeAllowed=true -> PASS", () => {
      const result = geoClassifier.classify("plovykla netoli", { nearMeAllowed: true });
      expect(result.passesGeoFilter).toBe(true);
      expect(result.isNearMe).toBe(true);
    });

    test("near me (English) with nearMeAllowed=true -> PASS", () => {
      const result = geoClassifier.classify("car wash near me", { nearMeAllowed: true });
      expect(result.passesGeoFilter).toBe(true);
      expect(result.isNearMe).toBe(true);
    });
  });

  describe("Generic Keywords", () => {
    test("no city with genericAllowed=true -> PASS, score 0.5", () => {
      const result = geoClassifier.classify("automobilu plovykla", { genericAllowed: true });
      expect(result.passesGeoFilter).toBe(true);
      expect(result.isGeneric).toBe(true);
      expect(result.geoScore).toBe(0.5);
    });

    test("no city with genericAllowed=false -> FAIL", () => {
      const result = geoClassifier.classify("automobilu plovykla", { genericAllowed: false });
      expect(result.passesGeoFilter).toBe(false);
      expect(result.isGeneric).toBe(true);
      expect(result.geoScore).toBe(0.0);
    });
  });

  describe("Edge Cases", () => {
    test("vilniaus g. plovykla -> generic (street reference)", () => {
      const result = geoClassifier.classify("vilniaus g. plovykla", { includeCities: ["siauliai"] });
      expect(result.hasExplicitCity).toBe(false);
      expect(result.isGeneric).toBe(true);
    });

    test("vilniaus gatve plovykla -> generic (street reference)", () => {
      const result = geoClassifier.classify("vilniaus gatve plovykla", { includeCities: ["siauliai"] });
      expect(result.hasExplicitCity).toBe(false);
      expect(result.isGeneric).toBe(true);
    });

    test("kaunietiksas stilius -> generic (not a city reference)", () => {
      const result = geoClassifier.classify("kaunietiksas stilius", { includeCities: ["kaunas"] });
      expect(result.hasExplicitCity).toBe(false);
      expect(result.isGeneric).toBe(true);
    });

    test("empty keyword -> generic", () => {
      const result = geoClassifier.classify("", { includeCities: ["vilnius"] });
      expect(result.isGeneric).toBe(true);
    });
  });

  describe("Exclude Cities", () => {
    test("excludeCities overrides includeCities", () => {
      const result = geoClassifier.classify("plovykla kaune", {
        includeCities: ["vilnius", "kaunas"],
        excludeCities: ["kaunas"],
      });
      expect(result.passesGeoFilter).toBe(false);
      expect(result.city).toBe("kaunas");
    });

    test("excluded city gets score 0.0", () => {
      const result = geoClassifier.classify("plovykla vilniuje", {
        excludeCities: ["vilnius"],
      });
      expect(result.geoScore).toBe(0.0);
    });
  });

  describe("Classification Properties", () => {
    test("city match has hasExplicitCity=true", () => {
      const result = geoClassifier.classify("plovykla kaune", {});
      expect(result.hasExplicitCity).toBe(true);
      expect(result.isNearMe).toBe(false);
      expect(result.isGeneric).toBe(false);
    });

    test("near me has isNearMe=true", () => {
      const result = geoClassifier.classify("plovykla salia manes", {});
      expect(result.hasExplicitCity).toBe(false);
      expect(result.isNearMe).toBe(true);
      expect(result.isGeneric).toBe(false);
    });

    test("generic has isGeneric=true", () => {
      const result = geoClassifier.classify("automobilu plovykla", {});
      expect(result.hasExplicitCity).toBe(false);
      expect(result.isNearMe).toBe(false);
      expect(result.isGeneric).toBe(true);
    });

    test("reason field is populated", () => {
      const result = geoClassifier.classify("plovykla siauliuose", { includeCities: ["siauliai"] });
      expect(result.reason).toBeTruthy();
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    test("classifyBatch handles 1000 keywords in <1 second", () => {
      const keywords = Array.from({ length: 1000 }, (_, i) =>
        i % 3 === 0 ? "plovykla vilniuje" :
        i % 3 === 1 ? "plovykla salia manes" :
        "automobilu plovykla"
      );
      const start = performance.now();
      geoClassifier.classifyBatch(keywords, { includeCities: ["vilnius"] });
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    test("classifyBatch returns correct number of results", () => {
      const keywords = ["plovykla vilniuje", "plovykla kaune", "automobilu plovykla"];
      const results = geoClassifier.classifyBatch(keywords, { includeCities: ["vilnius"] });
      expect(results).toHaveLength(3);
    });
  });
});
