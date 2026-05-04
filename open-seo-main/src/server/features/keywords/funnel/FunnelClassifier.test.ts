import { describe, it, expect } from "vitest";
import { FunnelClassifier, createFunnelClassifier } from "./FunnelClassifier";
import type { KeywordIntent } from "@/types/keywords";

describe("FunnelClassifier", () => {
  const classifier = createFunnelClassifier();

  describe("Pattern-based classification", () => {
    it("should classify BOFU purchase patterns with high confidence", () => {
      const result = classifier.classify("pirkti šampūną");
      expect(result.stage).toBe("bofu");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.signals.patternMatch).toBe(true);
      expect(result.signals.patternType).toBe("purchase");
    });

    it("should classify MOFU comparison patterns with high confidence", () => {
      const result = classifier.classify("geriausi šampūnai 2024");
      expect(result.stage).toBe("mofu");
      expect(result.confidence).toBeGreaterThanOrEqual(0.80);
      expect(result.signals.patternMatch).toBe(true);
      expect(result.signals.patternType).toBe("comparison");
    });

    it("should classify TOFU learning patterns with high confidence", () => {
      const result = classifier.classify("kas yra hialurono rūgštis");
      expect(result.stage).toBe("tofu");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.signals.patternMatch).toBe(true);
      expect(result.signals.patternType).toBe("learning");
    });
  });

  describe("DataForSEO intent signal", () => {
    it("should classify transactional as BOFU", () => {
      const result = classifier.classify("šampūnas", {
        dataForSeoIntent: "transactional",
      });
      expect(result.stage).toBe("bofu");
      expect(result.confidence).toBe(0.75);
      expect(result.signals.dataForSeoIntent).toBe("transactional");
    });

    it("should classify informational as TOFU", () => {
      const result = classifier.classify("plaukų priežiūra", {
        dataForSeoIntent: "informational",
      });
      expect(result.stage).toBe("tofu");
      expect(result.confidence).toBe(0.80);
      expect(result.signals.dataForSeoIntent).toBe("informational");
    });

    it("should classify commercial as MOFU by default", () => {
      const result = classifier.classify("šampūnas", {
        dataForSeoIntent: "commercial",
      });
      expect(result.stage).toBe("mofu");
      expect(result.confidence).toBe(0.65);
    });
  });

  describe("Business context boost", () => {
    it("should boost commercial + city + service to BOFU", () => {
      const result = classifier.classify("plovykla vilniuje", {
        dataForSeoIntent: "commercial",
        businessContext: {
          services: ["plovykla", "detailing"],
          cities: ["vilnius"],
          isServiceBusiness: true,
        },
      });
      expect(result.stage).toBe("bofu");
      expect(result.confidence).toBe(0.70);
      expect(result.signals.businessContextBoost).toBe(true);
    });

    it("should detect city patterns without explicit cities list", () => {
      const result = classifier.classify("kaune specializuota įmonė", {
        businessContext: {
          services: ["įmonė"],
          isServiceBusiness: true,
        },
      });
      expect(result.stage).toBe("bofu");
      expect(result.signals.businessContextBoost).toBe(true);
    });
  });

  describe("Fallback behavior", () => {
    it("should fallback to MOFU with low confidence for unknown keywords", () => {
      const result = classifier.classify("random keyword");
      expect(result.stage).toBe("mofu");
      expect(result.confidence).toBe(0.40);
      expect(result.signals.patternMatch).toBe(false);
    });
  });

  describe("Batch classification", () => {
    it("should classify multiple keywords and track stats", () => {
      const keywords = [
        "pirkti šampūną",
        "geriausi šampūnai",
        "kas yra kolagenas",
        "random text",
      ];

      const result = classifier.classifyBatch(keywords);

      expect(result.classifications).toHaveLength(4);
      expect(result.stats.total).toBe(4);
      expect(result.stats.bofu).toBe(1);
      expect(result.stats.mofu).toBe(2);
      expect(result.stats.tofu).toBe(1);
    });

    it("should track high confidence keywords", () => {
      const keywords = ["pirkti šampūną", "random text"];
      const result = classifier.classifyBatch(keywords);

      expect(result.stats.highConfidence).toBe(1); // Only "pirkti šampūną" >= 0.80
      expect(result.stats.lowConfidence).toBe(1); // "random text" < 0.60
    });
  });

  describe("Low confidence detection", () => {
    it("should identify keywords needing LLM review", () => {
      const keywords = ["pirkti šampūną", "random text", "another random"];
      const result = classifier.classifyBatch(keywords);

      const lowConfidence = classifier.getLowConfidenceKeywords(result);
      expect(lowConfidence).toHaveLength(2);
      expect(lowConfidence).toContain("random text");
      expect(lowConfidence).toContain("another random");
    });
  });

  describe("Priority order", () => {
    it("should prioritize pattern match over DataForSEO intent", () => {
      const result = classifier.classify("pirkti šampūną", {
        dataForSeoIntent: "informational", // Conflicting signal
      });
      expect(result.stage).toBe("bofu"); // Pattern wins
      expect(result.confidence).toBeGreaterThan(0.80);
    });
  });
});
