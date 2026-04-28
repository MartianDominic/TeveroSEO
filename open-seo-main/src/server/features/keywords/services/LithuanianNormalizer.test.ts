import { describe, it, expect, beforeEach } from "vitest";
import {
  LithuanianNormalizer,
  lithuanianNormalizer,
  type LemmatizationResult,
} from "./LithuanianNormalizer";
import { getLemmaMapStats } from "../data/lithuanian-lemmas";

describe("LithuanianNormalizer", () => {
  let normalizer: LithuanianNormalizer;

  beforeEach(() => {
    normalizer = new LithuanianNormalizer();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const instance = new LithuanianNormalizer();
      expect(instance).toBeInstanceOf(LithuanianNormalizer);
    });

    it("should accept custom lemmas", () => {
      const instance = new LithuanianNormalizer({
        customLemmas: {
          testolemma: "testas",
        },
      });
      expect(instance.getLemma("testolemma")).toBe("testas");
    });

    it("should merge custom lemmas with defaults", () => {
      const instance = new LithuanianNormalizer({
        customLemmas: {
          customword: "baseform",
        },
      });
      // Check default lemma still works
      expect(instance.getLemma("plaukams")).toBe("plaukai");
      // Check custom lemma works
      expect(instance.getLemma("customword")).toBe("baseform");
    });
  });

  describe("lemmatize", () => {
    describe("dative plural to nominative singular", () => {
      it('should convert "dažytiems plaukams" to "dažytas plaukai"', () => {
        expect(normalizer.lemmatize("dažytiems plaukams")).toBe(
          "dažytas plaukai"
        );
      });

      it('should convert "sausiems plaukams" to "sausas plaukai"', () => {
        expect(normalizer.lemmatize("sausiems plaukams")).toBe("sausas plaukai");
      });

      it('should convert "riebiems plaukams" to "riebus plaukai"', () => {
        expect(normalizer.lemmatize("riebiems plaukams")).toBe("riebus plaukai");
      });

      it('should convert "pažeistiems plaukams" to "pažeistas plaukai"', () => {
        expect(normalizer.lemmatize("pažeistiems plaukams")).toBe(
          "pažeistas plaukai"
        );
      });

      it('should convert "normaliems plaukams" to "normalus plaukai"', () => {
        expect(normalizer.lemmatize("normaliems plaukams")).toBe(
          "normalus plaukai"
        );
      });

      it('should convert "garbanotiems plaukams" to "garbanotas plaukai"', () => {
        expect(normalizer.lemmatize("garbanotiems plaukams")).toBe(
          "garbanotas plaukai"
        );
      });
    });

    describe("product plurals to singular", () => {
      it('should convert "šampūnai" to "šampūnas"', () => {
        expect(normalizer.lemmatize("šampūnai")).toBe("šampūnas");
      });

      it('should convert "kondicionieriai" to "kondicionierius"', () => {
        expect(normalizer.lemmatize("kondicionieriai")).toBe("kondicionierius");
      });

      it('should convert "kaukės" to "kaukė"', () => {
        expect(normalizer.lemmatize("kaukės")).toBe("kaukė");
      });

      it('should convert "aliejai" to "aliejus"', () => {
        expect(normalizer.lemmatize("aliejai")).toBe("aliejus");
      });

      it('should convert "serumai" to "serumas"', () => {
        expect(normalizer.lemmatize("serumai")).toBe("serumas");
      });

      it('should convert "balzamai" to "balzamas"', () => {
        expect(normalizer.lemmatize("balzamai")).toBe("balzamas");
      });

      it('should convert "geliai" to "gelis"', () => {
        expect(normalizer.lemmatize("geliai")).toBe("gelis");
      });
    });

    describe("actions and treatments", () => {
      it('should convert "priežiūrai" to "priežiūra"', () => {
        expect(normalizer.lemmatize("priežiūrai")).toBe("priežiūra");
      });

      it('should convert "stiprinimui" to "stiprinimas"', () => {
        expect(normalizer.lemmatize("stiprinimui")).toBe("stiprinimas");
      });

      it('should convert "drėkinimui" to "drėkinimas"', () => {
        expect(normalizer.lemmatize("drėkinimui")).toBe("drėkinimas");
      });

      it('should convert "atstatymui" to "atstatymas"', () => {
        expect(normalizer.lemmatize("atstatymui")).toBe("atstatymas");
      });

      it('should convert "apsaugai" to "apsauga"', () => {
        expect(normalizer.lemmatize("apsaugai")).toBe("apsauga");
      });

      it('should convert "formavimui" to "formavimas"', () => {
        expect(normalizer.lemmatize("formavimui")).toBe("formavimas");
      });
    });

    describe("body parts", () => {
      it('should convert "plaukų" to "plaukai"', () => {
        expect(normalizer.lemmatize("plaukų")).toBe("plaukai");
      });

      it('should convert "galvos" to "galva"', () => {
        expect(normalizer.lemmatize("galvos")).toBe("galva");
      });

      it('should convert "odos" to "oda"', () => {
        expect(normalizer.lemmatize("odos")).toBe("oda");
      });

      it('should convert "šaknų" to "šaknis"', () => {
        expect(normalizer.lemmatize("šaknų")).toBe("šaknis");
      });

      it('should convert "galiukų" to "galiukas"', () => {
        expect(normalizer.lemmatize("galiukų")).toBe("galiukas");
      });
    });

    describe("unknown words passthrough", () => {
      it("should pass through unknown words unchanged (lowercased)", () => {
        expect(normalizer.lemmatize("unknownword")).toBe("unknownword");
      });

      it("should handle mixed known and unknown words", () => {
        expect(normalizer.lemmatize("šampūnai profesionalus xyz")).toBe(
          "šampūnas profesionalus xyz"
        );
      });

      it("should preserve spacing with unknown words", () => {
        const result = normalizer.lemmatize("one two three");
        expect(result).toBe("one two three");
      });
    });

    describe("edge cases", () => {
      it("should handle empty string", () => {
        expect(normalizer.lemmatize("")).toBe("");
      });

      it("should handle whitespace only", () => {
        expect(normalizer.lemmatize("   ")).toBe("");
      });

      it("should handle null/undefined gracefully", () => {
        // @ts-expect-error - testing runtime behavior
        expect(normalizer.lemmatize(null)).toBe("");
        // @ts-expect-error - testing runtime behavior
        expect(normalizer.lemmatize(undefined)).toBe("");
      });

      it("should handle single word", () => {
        expect(normalizer.lemmatize("šampūnai")).toBe("šampūnas");
      });

      it("should normalize to lowercase", () => {
        expect(normalizer.lemmatize("ŠAMPŪNAI")).toBe("šampūnas");
      });

      it("should handle mixed case", () => {
        expect(normalizer.lemmatize("DažytIEMS PlauKAMS")).toBe(
          "dažytas plaukai"
        );
      });

      it("should trim leading/trailing whitespace", () => {
        expect(normalizer.lemmatize("  šampūnai  ")).toBe("šampūnas");
      });

      it("should collapse multiple spaces", () => {
        expect(normalizer.lemmatize("šampūnai    kondicionieriai")).toBe(
          "šampūnas kondicionierius"
        );
      });
    });
  });

  describe("lemmatizeWithStats", () => {
    it("should return stats with lemmatization result", () => {
      const result: LemmatizationResult =
        normalizer.lemmatizeWithStats("dažytiems plaukams");

      expect(result.text).toBe("dažytas plaukai");
      expect(result.method).toBe("rules");
      expect(result.stats.total).toBe(2);
      expect(result.stats.lemmatized).toBe(2);
      expect(result.stats.passedThrough).toBe(0);
    });

    it("should track passed-through words", () => {
      const result = normalizer.lemmatizeWithStats("šampūnai unknown xyz");

      expect(result.stats.total).toBe(3);
      expect(result.stats.lemmatized).toBe(1);
      expect(result.stats.passedThrough).toBe(2);
    });

    it("should handle empty string", () => {
      const result = normalizer.lemmatizeWithStats("");

      expect(result.text).toBe("");
      expect(result.method).toBe("passthrough");
      expect(result.stats.total).toBe(0);
    });
  });

  describe("normalizeForSearch", () => {
    it('should convert "šampūnas" to "sampunas"', () => {
      expect(normalizer.normalizeForSearch("šampūnas")).toBe("sampunas");
    });

    it('should convert "dažytiems plaukams" to "dazytas plaukai"', () => {
      expect(normalizer.normalizeForSearch("dažytiems plaukams")).toBe(
        "dazytas plaukai"
      );
    });

    it("should remove all Lithuanian diacritics", () => {
      // Test all diacritics: ą č ę ė į š ų ū ž
      expect(normalizer.normalizeForSearch("ąčęėįšųūž")).toBe("aceeisuuz");
    });

    it("should handle uppercase diacritics", () => {
      expect(normalizer.normalizeForSearch("ĄČĘĖĮŠŲŪŽ")).toBe("aceeisuuz");
    });

    it("should handle empty string", () => {
      expect(normalizer.normalizeForSearch("")).toBe("");
    });

    it("should handle complex category names", () => {
      expect(
        normalizer.normalizeForSearch("Plaukų priežiūrai ir stiprinimui")
      ).toBe("plaukai prieziura ir stiprinimas");
    });
  });

  describe("removeDiacritics", () => {
    it("should remove ą", () => {
      expect(normalizer.removeDiacritics("ą")).toBe("a");
    });

    it("should remove č", () => {
      expect(normalizer.removeDiacritics("č")).toBe("c");
    });

    it("should remove ę", () => {
      expect(normalizer.removeDiacritics("ę")).toBe("e");
    });

    it("should remove ė", () => {
      expect(normalizer.removeDiacritics("ė")).toBe("e");
    });

    it("should remove į", () => {
      expect(normalizer.removeDiacritics("į")).toBe("i");
    });

    it("should remove š", () => {
      expect(normalizer.removeDiacritics("š")).toBe("s");
    });

    it("should remove ų", () => {
      expect(normalizer.removeDiacritics("ų")).toBe("u");
    });

    it("should remove ū", () => {
      expect(normalizer.removeDiacritics("ū")).toBe("u");
    });

    it("should remove ž", () => {
      expect(normalizer.removeDiacritics("ž")).toBe("z");
    });

    it("should handle uppercase diacritics", () => {
      expect(normalizer.removeDiacritics("Š")).toBe("S");
      expect(normalizer.removeDiacritics("Ž")).toBe("Z");
    });

    it("should handle text without diacritics", () => {
      expect(normalizer.removeDiacritics("hello")).toBe("hello");
    });

    it("should handle empty string", () => {
      expect(normalizer.removeDiacritics("")).toBe("");
    });
  });

  describe("extractBrandAliases", () => {
    it("should generate aliases for L'Oréal", () => {
      const aliases = normalizer.extractBrandAliases("L'Oréal");

      expect(aliases).toContain("l'oréal");
      expect(aliases).toContain("loreal");
      expect(aliases).toContain("l'oreal");
      expect(aliases).toContain("loréal");
    });

    it("should generate aliases for Schwarzkopf", () => {
      const aliases = normalizer.extractBrandAliases("Schwarzkopf");

      expect(aliases).toContain("schwarzkopf");
      // No special characters to remove, but should have lowercase
      expect(aliases.length).toBeGreaterThan(0);
    });

    it("should handle brands with Lithuanian characters", () => {
      const aliases = normalizer.extractBrandAliases("Švarumas");

      expect(aliases).toContain("švarumas");
      expect(aliases).toContain("svarumas");
    });

    it("should remove apostrophe variations", () => {
      const aliases = normalizer.extractBrandAliases("O'Brien");

      expect(aliases).toContain("obrien");
      expect(aliases).toContain("o'brien");
    });

    it("should return empty array for empty input", () => {
      expect(normalizer.extractBrandAliases("")).toEqual([]);
    });

    it("should return empty array for null/undefined", () => {
      // @ts-expect-error - testing runtime behavior
      expect(normalizer.extractBrandAliases(null)).toEqual([]);
      // @ts-expect-error - testing runtime behavior
      expect(normalizer.extractBrandAliases(undefined)).toEqual([]);
    });

    it("should return unique aliases", () => {
      const aliases = normalizer.extractBrandAliases("Test");
      const uniqueAliases = [...new Set(aliases)];
      expect(aliases.length).toBe(uniqueAliases.length);
    });

    it("should not include empty strings in aliases", () => {
      const aliases = normalizer.extractBrandAliases("L'Oréal");
      expect(aliases).not.toContain("");
    });

    it("should preserve brand casing when option is enabled", () => {
      const preservingNormalizer = new LithuanianNormalizer({
        preserveBrandCasing: true,
      });
      const aliases = preservingNormalizer.extractBrandAliases("L'Oréal");

      expect(aliases).toContain("L'Oréal");
    });
  });

  describe("hasLemma", () => {
    it("should return true for known words", () => {
      expect(normalizer.hasLemma("plaukams")).toBe(true);
      expect(normalizer.hasLemma("šampūnai")).toBe(true);
      expect(normalizer.hasLemma("dažytiems")).toBe(true);
    });

    it("should return false for unknown words", () => {
      expect(normalizer.hasLemma("unknownword")).toBe(false);
      expect(normalizer.hasLemma("xyz")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(normalizer.hasLemma("PLAUKAMS")).toBe(true);
      expect(normalizer.hasLemma("Plaukams")).toBe(true);
    });

    it("should handle empty/null input", () => {
      expect(normalizer.hasLemma("")).toBe(false);
      // @ts-expect-error - testing runtime behavior
      expect(normalizer.hasLemma(null)).toBe(false);
    });
  });

  describe("getLemma", () => {
    it("should return lemma for known words", () => {
      expect(normalizer.getLemma("plaukams")).toBe("plaukai");
      expect(normalizer.getLemma("šampūnai")).toBe("šampūnas");
    });

    it("should return lowercase word for unknown words", () => {
      expect(normalizer.getLemma("unknown")).toBe("unknown");
      expect(normalizer.getLemma("UNKNOWN")).toBe("unknown");
    });

    it("should handle empty input", () => {
      expect(normalizer.getLemma("")).toBe("");
    });
  });

  describe("getStats", () => {
    it("should return lemma count", () => {
      const stats = normalizer.getStats();
      expect(stats.totalLemmas).toBeGreaterThan(100);
      expect(stats.hasStanza).toBe(false); // Stanza not available in pure TS
    });
  });

  describe("addLemmas", () => {
    it("should add new lemmas at runtime", () => {
      normalizer.addLemmas({
        naujaforma: "naujas",
      });

      expect(normalizer.getLemma("naujaforma")).toBe("naujas");
    });

    it("should override existing lemmas", () => {
      const original = normalizer.getLemma("plaukams");
      expect(original).toBe("plaukai");

      normalizer.addLemmas({
        plaukams: "customlemma",
      });

      expect(normalizer.getLemma("plaukams")).toBe("customlemma");
    });
  });

  describe("tokenize", () => {
    it("should split text into words", () => {
      expect(normalizer.tokenize("one two three")).toEqual([
        "one",
        "two",
        "three",
      ]);
    });

    it("should lowercase tokens", () => {
      expect(normalizer.tokenize("ONE TWO")).toEqual(["one", "two"]);
    });

    it("should handle multiple spaces", () => {
      expect(normalizer.tokenize("one   two")).toEqual(["one", "two"]);
    });

    it("should return empty array for empty input", () => {
      expect(normalizer.tokenize("")).toEqual([]);
    });
  });

  describe("normalizeCategoryPath", () => {
    it("should lemmatize all categories in path", () => {
      const path = ["Plaukų priežiūra", "Šampūnai", "Dažytiems plaukams"];

      const result = normalizer.normalizeCategoryPath(path);

      expect(result).toEqual([
        "plaukai priežiūra",
        "šampūnas",
        "dažytas plaukai",
      ]);
    });

    it("should handle empty array", () => {
      expect(normalizer.normalizeCategoryPath([])).toEqual([]);
    });

    it("should handle non-array input gracefully", () => {
      // @ts-expect-error - testing runtime behavior
      expect(normalizer.normalizeCategoryPath(null)).toEqual([]);
    });
  });

  describe("singleton export", () => {
    it("should export a default instance", () => {
      expect(lithuanianNormalizer).toBeInstanceOf(LithuanianNormalizer);
    });

    it("should be usable directly", () => {
      expect(lithuanianNormalizer.lemmatize("šampūnai")).toBe("šampūnas");
    });
  });
});

describe("lithuanian-lemmas data", () => {
  describe("getLemmaMapStats", () => {
    it("should have at least 100 total terms", () => {
      const stats = getLemmaMapStats();
      expect(stats.total).toBeGreaterThanOrEqual(100);
    });

    it("should have terms in all categories", () => {
      const stats = getLemmaMapStats();

      expect(stats.byCategory.hairTypes).toBeGreaterThan(0);
      expect(stats.byCategory.productTypes).toBeGreaterThan(0);
      expect(stats.byCategory.actions).toBeGreaterThan(0);
      expect(stats.byCategory.bodyParts).toBeGreaterThan(0);
      expect(stats.byCategory.ingredients).toBeGreaterThan(0);
      expect(stats.byCategory.descriptors).toBeGreaterThan(0);
      expect(stats.byCategory.brandTerms).toBeGreaterThan(0);
    });

    it("should have meaningful distribution across categories", () => {
      const stats = getLemmaMapStats();

      // Hair types and product types should be well-populated
      expect(stats.byCategory.hairTypes).toBeGreaterThanOrEqual(30);
      expect(stats.byCategory.productTypes).toBeGreaterThanOrEqual(40);
      expect(stats.byCategory.actions).toBeGreaterThanOrEqual(30);
    });
  });
});

describe("real-world scenarios", () => {
  let normalizer: LithuanianNormalizer;

  beforeEach(() => {
    normalizer = new LithuanianNormalizer();
  });

  it("should normalize a typical product category hierarchy", () => {
    const input = "Šampūnai dažytiems plaukams";
    const expected = "sampunas dazytas plaukai";

    expect(normalizer.normalizeForSearch(input)).toBe(expected);
  });

  it("should handle a full product name", () => {
    const input = "L'Oreal Professionnel šampūnas pažeistiems plaukams 300ml";

    // lemmatize preserves Lithuanian characters
    const lemmatized = normalizer.lemmatize(input);
    expect(lemmatized).toContain("šampūnas");
    expect(lemmatized).toContain("pažeistas");
    expect(lemmatized).toContain("plaukai");

    // normalizeForSearch removes diacritics
    const normalized = normalizer.normalizeForSearch(input);
    expect(normalized).not.toContain("š");
    expect(normalized).not.toContain("ė");
  });

  it("should handle action-based categories", () => {
    const input = "Plaukų stiprinimui ir drėkinimui";
    const lemmatized = normalizer.lemmatize(input);

    expect(lemmatized).toContain("stiprinimas");
    expect(lemmatized).toContain("drėkinimas");
  });

  it("should handle ingredient-focused descriptions", () => {
    const input = "Su keratino ir argano aliejumi";
    const lemmatized = normalizer.lemmatize(input);

    expect(lemmatized).toContain("keratinas");
    expect(lemmatized).toContain("aliejus");
  });
});
