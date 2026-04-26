/**
 * ColumnDetector Tests
 *
 * Tests for smart CSV column detection supporting Ahrefs, SEMrush, Moz formats.
 */

import { describe, it, expect } from "vitest";
import {
  ColumnDetector,
  columnDetector,
  type DetectedFormat,
} from "./ColumnDetector";

describe("ColumnDetector", () => {
  describe("detectFormat", () => {
    // Test 1: Ahrefs detection
    it('identifies Ahrefs export by "Keyword Difficulty" column', () => {
      const headers = ["Keyword", "Difficulty", "Volume", "CPC", "Traffic"];
      const sampleRow = ["seo tools", "34", "12000", "2.50", "5400"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      expect(result.detectedFormat).toBe("ahrefs");
      expect(result.hasMetrics.volume).toBe(true);
      expect(result.hasMetrics.difficulty).toBe(true);
      expect(result.enrichmentNeeded).toBe(false);
    });

    // Test 2: SEMrush detection
    it('identifies SEMrush export by "Keyword" + "Search Volume" columns', () => {
      const headers = [
        "Keyword",
        "Search Volume",
        "Keyword Difficulty",
        "CPC",
        "Competition",
      ];
      const sampleRow = ["digital marketing", "22000", "67", "3.20", "0.89"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      expect(result.detectedFormat).toBe("semrush");
      expect(result.hasMetrics.volume).toBe(true);
      expect(result.hasMetrics.difficulty).toBe(true);
    });

    // Test 3: Moz detection
    it('identifies Moz export by "Keyword" + "Monthly Volume" columns', () => {
      const headers = ["Keyword", "Monthly Volume", "Difficulty", "CTR", "Priority"];
      const sampleRow = ["content marketing", "9800", "45", "0.42", "72"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      expect(result.detectedFormat).toBe("moz");
    });

    // Test 4: Keywords-only detection
    it('returns "keywords_only" if only keyword column found', () => {
      const headers = ["Keywords", "Notes"];
      const sampleRow = ["buy shoes online", "from client"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      expect(result.detectedFormat).toBe("keywords_only");
      expect(result.hasMetrics.volume).toBe(false);
      expect(result.hasMetrics.difficulty).toBe(false);
      expect(result.enrichmentNeeded).toBe(true);
    });

    // Test 5: hasAllMetrics check
    it("hasAllMetrics returns true when volume + difficulty present", () => {
      const headers = ["Keyword", "Volume", "KD"];
      const sampleRow = ["test keyword", "1000", "30"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      expect(result.hasMetrics.volume).toBe(true);
      expect(result.hasMetrics.difficulty).toBe(true);
      expect(result.enrichmentNeeded).toBe(false);
    });

    // Test 6: Lithuanian column names
    it("recognizes Lithuanian column names (raktazodis, paieskos)", () => {
      const headers = ["Raktazodis", "Paieskos", "Sunkumas", "Kaina"];
      const sampleRow = ["plauku dazai", "2400", "34", "0.45"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      expect(result.detectedFormat).toBe("generic");
      expect(result.hasMetrics.volume).toBe(true);
      expect(result.hasMetrics.difficulty).toBe(true);
      expect(result.enrichmentNeeded).toBe(false);
    });
  });

  describe("column mapping", () => {
    it("generates correct mappings for detected columns", () => {
      const headers = ["Keyword", "Volume", "KD", "CPC", "Position"];
      const sampleRow = ["test keyword", "1000", "30", "1.50", "15"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      // Check mappings
      const keywordMapping = result.mappings.find(
        (m) => m.sourceColumn === "Keyword"
      );
      expect(keywordMapping?.targetField).toBe("keyword");
      expect(keywordMapping?.confidence).toBeGreaterThanOrEqual(0.8);

      const volumeMapping = result.mappings.find(
        (m) => m.sourceColumn === "Volume"
      );
      expect(volumeMapping?.targetField).toBe("volume");

      const difficultyMapping = result.mappings.find(
        (m) => m.sourceColumn === "KD"
      );
      expect(difficultyMapping?.targetField).toBe("difficulty");

      const positionMapping = result.mappings.find(
        (m) => m.sourceColumn === "Position"
      );
      expect(positionMapping?.targetField).toBe("position");
    });

    it("marks unknown columns as ignore", () => {
      const headers = ["Keyword", "Traffic", "Random Column"];
      const sampleRow = ["test", "5000", "abc"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      const randomMapping = result.mappings.find(
        (m) => m.sourceColumn === "Random Column"
      );
      expect(randomMapping?.targetField).toBe("ignore");
    });
  });

  describe("parseNumericValue", () => {
    it("parses plain numbers", () => {
      const detector = new ColumnDetector();
      expect(detector.parseNumericValue("1234")).toBe(1234);
      expect(detector.parseNumericValue("56.78")).toBe(56.78);
    });

    it("handles comma-separated thousands", () => {
      const detector = new ColumnDetector();
      expect(detector.parseNumericValue("1,234")).toBe(1234);
      expect(detector.parseNumericValue("1,234,567")).toBe(1234567);
    });

    it("handles currency symbols", () => {
      const detector = new ColumnDetector();
      expect(detector.parseNumericValue("$2.50")).toBe(2.5);
      expect(detector.parseNumericValue("2.50")).toBe(2.5);
    });

    it("handles percentage signs", () => {
      const detector = new ColumnDetector();
      expect(detector.parseNumericValue("45%")).toBe(45);
    });

    it("returns null for N/A values", () => {
      const detector = new ColumnDetector();
      expect(detector.parseNumericValue("-")).toBeNull();
      expect(detector.parseNumericValue("n/a")).toBeNull();
      expect(detector.parseNumericValue("N/A")).toBeNull();
      expect(detector.parseNumericValue("")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("throws error when no keyword column detected", () => {
      const headers = ["Volume", "Difficulty", "CPC"];
      const sampleRow = ["1000", "30", "2.50"];

      expect(() => columnDetector.detectFormat(headers, sampleRow)).toThrow(
        "No keyword column detected"
      );
    });

    it("handles case-insensitive column matching", () => {
      const headers = ["KEYWORD", "VOLUME", "DIFFICULTY"];
      const sampleRow = ["test", "1000", "30"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      expect(result.hasMetrics.volume).toBe(true);
      expect(result.hasMetrics.difficulty).toBe(true);
    });

    it("estimates cost based on row count", () => {
      const headers = ["Keyword"];
      const sampleRow = ["test keyword"];

      const result = columnDetector.detectFormat(headers, sampleRow);

      // Single keyword without metrics should estimate cost
      expect(result.estimatedCost).toBeGreaterThan(0);
    });
  });
});
