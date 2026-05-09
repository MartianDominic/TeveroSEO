/**
 * Tests for ScoreExplanationTranslations
 * Phase 85-01 Task 1: Bilingual translation strings
 *
 * TDD RED: Tests written before implementation.
 */

import { describe, it, expect } from "vitest";

import {
  translations,
  getScoreExplanation,
  getRelevanceLevel,
  getVolumeLevel,
  getGeoLevel,
  getFunnelExplanation,
  type Locale,
  type ScoreTranslations,
} from "./ScoreExplanationTranslations";

describe("ScoreExplanationTranslations", () => {
  describe("translations object", () => {
    it("should have both EN and LT locales", () => {
      expect(translations).toHaveProperty("en");
      expect(translations).toHaveProperty("lt");
    });

    it("should have all required fields in EN", () => {
      const en = translations.en;
      expect(en).toHaveProperty("title");
      expect(en).toHaveProperty("factor");
      expect(en).toHaveProperty("value");
      expect(en).toHaveProperty("contribution");
      expect(en).toHaveProperty("baseScore");
      expect(en).toHaveProperty("finalScore");
      expect(en).toHaveProperty("relevance");
      expect(en).toHaveProperty("funnel");
      expect(en).toHaveProperty("geo");
      expect(en).toHaveProperty("volume");
      expect(en).toHaveProperty("priorityBoost");
      expect(en).toHaveProperty("quickWin");
    });

    it("should have all required fields in LT", () => {
      const lt = translations.lt;
      expect(lt).toHaveProperty("title");
      expect(lt).toHaveProperty("factor");
      expect(lt).toHaveProperty("value");
      expect(lt).toHaveProperty("contribution");
      expect(lt).toHaveProperty("baseScore");
      expect(lt).toHaveProperty("finalScore");
      expect(lt).toHaveProperty("relevance");
      expect(lt).toHaveProperty("funnel");
      expect(lt).toHaveProperty("geo");
      expect(lt).toHaveProperty("volume");
      expect(lt).toHaveProperty("priorityBoost");
      expect(lt).toHaveProperty("quickWin");
    });

    it("should have nested explanation levels for relevance", () => {
      expect(translations.en.relevance).toHaveProperty("label");
      expect(translations.en.relevance).toHaveProperty("high");
      expect(translations.en.relevance).toHaveProperty("medium");
      expect(translations.en.relevance).toHaveProperty("low");
    });

    it("should have nested funnel stage explanations", () => {
      expect(translations.en.funnel).toHaveProperty("label");
      expect(translations.en.funnel).toHaveProperty("bofu");
      expect(translations.en.funnel).toHaveProperty("mofu");
      expect(translations.en.funnel).toHaveProperty("tofu");
    });

    it("should have nested geo match explanations", () => {
      expect(translations.en.geo).toHaveProperty("label");
      expect(translations.en.geo).toHaveProperty("exact");
      expect(translations.en.geo).toHaveProperty("regional");
      expect(translations.en.geo).toHaveProperty("national");
    });

    it("should have nested volume level explanations", () => {
      expect(translations.en.volume).toHaveProperty("label");
      expect(translations.en.volume).toHaveProperty("high");
      expect(translations.en.volume).toHaveProperty("medium");
      expect(translations.en.volume).toHaveProperty("low");
    });

    it("should have template strings for bonuses", () => {
      expect(translations.en.priorityBoost).toHaveProperty("label");
      expect(translations.en.priorityBoost).toHaveProperty("template");
      expect(translations.en.quickWin).toHaveProperty("label");
      expect(translations.en.quickWin).toHaveProperty("template");
    });
  });

  describe("getScoreExplanation", () => {
    it("should return EN title by default", () => {
      const result = getScoreExplanation("en", "title");
      expect(result).toBe("Why this score?");
    });

    it("should return LT title when locale is lt", () => {
      const result = getScoreExplanation("lt", "title");
      expect(result).toBe("Kodėl toks balas?");
    });

    it("should return factor label in EN", () => {
      const result = getScoreExplanation("en", "factor");
      expect(result).toBe("Factor");
    });

    it("should return factor label in LT", () => {
      const result = getScoreExplanation("lt", "factor");
      expect(result).toBe("Faktorius");
    });
  });

  describe("getRelevanceLevel", () => {
    it("should return high for score >= 0.7 in EN", () => {
      const result = getRelevanceLevel("en", 0.85);
      expect(result).toBe("High semantic match to your business");
    });

    it("should return medium for score 0.4-0.7 in EN", () => {
      const result = getRelevanceLevel("en", 0.55);
      expect(result).toBe("Moderate relevance match");
    });

    it("should return low for score < 0.4 in EN", () => {
      const result = getRelevanceLevel("en", 0.3);
      expect(result).toBe("Weak relevance match");
    });

    it("should return high in LT", () => {
      const result = getRelevanceLevel("lt", 0.85);
      expect(result).toBe("Aukštas semantinis atitikimas jūsų verslui");
    });
  });

  describe("getVolumeLevel", () => {
    it("should return high for volume >= 1000 in EN", () => {
      const result = getVolumeLevel("en", 5000);
      expect(result).toBe("High traffic potential");
    });

    it("should return medium for volume 100-1000 in EN", () => {
      const result = getVolumeLevel("en", 320);
      expect(result).toBe("Moderate traffic potential");
    });

    it("should return low for volume < 100 in EN", () => {
      const result = getVolumeLevel("en", 50);
      expect(result).toBe("Low traffic potential");
    });

    it("should return high in LT", () => {
      const result = getVolumeLevel("lt", 5000);
      expect(result).toBe("Didelis srauto potencialas");
    });
  });

  describe("getGeoLevel", () => {
    it("should return exact for geoScore >= 0.9 in EN", () => {
      const result = getGeoLevel("en", 1.0);
      expect(result).toBe("Exact city match");
    });

    it("should return regional for geoScore 0.5-0.9 in EN", () => {
      const result = getGeoLevel("en", 0.7);
      expect(result).toBe("Regional match");
    });

    it("should return national for geoScore < 0.5 in EN", () => {
      const result = getGeoLevel("en", 0.3);
      expect(result).toBe("National/generic");
    });

    it("should return exact in LT", () => {
      const result = getGeoLevel("lt", 1.0);
      expect(result).toBe("Tikslus miesto atitikimas");
    });
  });

  describe("getFunnelExplanation", () => {
    it("should return BOFU explanation in EN", () => {
      const result = getFunnelExplanation("en", "BOFU");
      expect(result).toBe("Ready-to-buy intent");
    });

    it("should return MOFU explanation in EN", () => {
      const result = getFunnelExplanation("en", "MOFU");
      expect(result).toBe("Considering options");
    });

    it("should return TOFU explanation in EN", () => {
      const result = getFunnelExplanation("en", "TOFU");
      expect(result).toBe("Awareness stage");
    });

    it("should return BOFU explanation in LT", () => {
      const result = getFunnelExplanation("lt", "BOFU");
      expect(result).toBe("Pirkimo ketinimas");
    });

    it("should return MOFU explanation in LT", () => {
      const result = getFunnelExplanation("lt", "MOFU");
      expect(result).toBe("Svarsto galimybes");
    });

    it("should return TOFU explanation in LT", () => {
      const result = getFunnelExplanation("lt", "TOFU");
      expect(result).toBe("Sužinojimo etapas");
    });
  });
});
