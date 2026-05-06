/**
 * ReadabilityScorer Tests
 * Phase 92: On-Page SEO Mastery
 *
 * Tests for: OPM-14 (readability scoring)
 * TDD: RED phase - write failing tests first
 */

import { describe, it, expect } from "vitest";
import {
  analyzeReadability,
  getVerticalReadabilityThreshold,
  type ReadabilityScores,
} from "./ReadabilityScorer";

describe("ReadabilityScorer", () => {
  describe("analyzeReadability", () => {
    it("should return low grade for simple sentences", () => {
      // Very simple text should have low grade level
      const text = "The cat sat. The dog ran. Birds fly. Fish swim. It is good.";
      const result = analyzeReadability(text);

      expect(result.gradeLevel).toBeLessThan(5);
      expect(result.fleschEase).toBeGreaterThan(80); // Very easy
      expect(result.isAccessible).toBe(true);
    });

    it("should return high grade for complex sentences", () => {
      // Complex academic text should have high grade level
      const text = `
        The implementation of sophisticated algorithmic methodologies necessitates
        comprehensive understanding of computational paradigms and their epistemological
        implications within the broader context of technological advancement.
        Furthermore, the interdisciplinary nature of contemporary research demands
        rigorous analytical frameworks that can accommodate multifaceted variables
        and nuanced interpretations of empirical data.
      `;
      const result = analyzeReadability(text);

      expect(result.gradeLevel).toBeGreaterThan(12);
      expect(result.isAccessible).toBe(false);
    });

    it("should return all required scores", () => {
      const text = "This is a test sentence for readability analysis. It contains multiple sentences. Each sentence is moderately complex.";
      const result = analyzeReadability(text);

      expect(result).toHaveProperty("fleschEase");
      expect(result).toHaveProperty("gradeLevel");
      expect(result).toHaveProperty("gunningFog");
      expect(result).toHaveProperty("smog");
      expect(result).toHaveProperty("ari");
      expect(result).toHaveProperty("recommendation");
      expect(result).toHaveProperty("isAccessible");
    });

    it("should handle short text gracefully", () => {
      // Text with fewer than 20 words
      const text = "Short text here. Just a few words.";
      const result = analyzeReadability(text);

      // Should return default values for short text
      expect(result.recommendation).toContain("too short");
      expect(result.isAccessible).toBe(true);
    });

    it("should provide appropriate recommendation for college-level text", () => {
      // This complex academic text actually grades at graduate/professional level
      const text = `
        The epistemological foundations of cognitive neuroscience necessitate
        a rigorous examination of phenomenological constructs and their
        neurobiological correlates. Contemporary interdisciplinary methodologies
        facilitate comprehensive analyses of consciousness and subjective experience.
      `;
      const result = analyzeReadability(text);

      // Text is so complex it grades above college level
      expect(result.recommendation).toMatch(/college|graduate|professional/);
    });

    it("should mark text as accessible when grade <= 8", () => {
      // Simple text at elementary school level
      const text = "The boy went to the store. He bought some milk. The milk was cold. He drank it at home. It was very good.";
      const result = analyzeReadability(text);

      expect(result.gradeLevel).toBeLessThanOrEqual(8);
      expect(result.isAccessible).toBe(true);
    });

    it("should calculate Gunning Fog index", () => {
      const text = "This is a test sentence with some words. Testing the readability scoring system.";
      const result = analyzeReadability(text);

      expect(typeof result.gunningFog).toBe("number");
      expect(result.gunningFog).toBeGreaterThanOrEqual(0);
    });

    it("should calculate SMOG index", () => {
      const text = `
        First sentence here. Second sentence here. Third sentence here.
        Fourth sentence with more words. Fifth sentence continues on.
        Sixth sentence for SMOG. Seventh sentence needed. Eighth one too.
        Ninth sentence required. Tenth sentence minimum. More sentences needed.
      `;
      const result = analyzeReadability(text);

      expect(typeof result.smog).toBe("number");
      expect(result.smog).toBeGreaterThanOrEqual(0);
    });

    it("should calculate Automated Readability Index", () => {
      const text = "This is a test. It has multiple sentences. Each one is counted. The result should be valid.";
      const result = analyzeReadability(text);

      expect(typeof result.ari).toBe("number");
    });
  });

  describe("getVerticalReadabilityThreshold", () => {
    it("should return lower threshold for YMYL content", () => {
      const ymylThreshold = getVerticalReadabilityThreshold("general", true);
      const normalThreshold = getVerticalReadabilityThreshold("general", false);

      expect(ymylThreshold).toBeLessThanOrEqual(normalThreshold);
    });

    it("should return threshold of 10 for healthcare vertical", () => {
      const threshold = getVerticalReadabilityThreshold("healthcare", false);
      expect(threshold).toBe(10);
    });

    it("should return threshold of 12 for legal vertical", () => {
      const threshold = getVerticalReadabilityThreshold("legal", false);
      expect(threshold).toBe(12);
    });

    it("should return threshold of 10 for financial vertical", () => {
      const threshold = getVerticalReadabilityThreshold("financial", false);
      expect(threshold).toBe(10);
    });

    it("should return higher threshold for saas vertical", () => {
      // Technical audience can handle more complex text
      const threshold = getVerticalReadabilityThreshold("saas", false);
      expect(threshold).toBe(14);
    });

    it("should return default threshold of 12 for unknown vertical", () => {
      const threshold = getVerticalReadabilityThreshold("unknown", false);
      expect(threshold).toBe(12);
    });

    it("should cap YMYL content at grade 10", () => {
      // Even for technical verticals, YMYL should be accessible
      const threshold = getVerticalReadabilityThreshold("saas", true);
      expect(threshold).toBe(10);
    });
  });
});
