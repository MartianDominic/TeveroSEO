/**
 * Tests for Tier 2 Content Quality Metrics (T2-01 to T2-05)
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as cheerio from "cheerio";
import { clearRegistry, getCheckById } from "../registry";

// Import to register checks
import "./content-quality";

describe("Tier 2 Content Quality Metrics", () => {
  beforeEach(() => {
    // Registry is populated on import, no need to clear for these tests
  });

  describe("T2-01: Reading level <= Grade 9", () => {
    it("should pass for simple text", async () => {
      const check = getCheckById("T2-01");
      expect(check).toBeDefined();

      // Simple text at ~6th grade level
      const simpleText = "The cat sat on the mat. The dog ran in the park. ".repeat(20);
      const html = `<html><body><p>${simpleText}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-01");
      expect(result.passed).toBe(true);
      expect(result.details?.gradeLevel).toBeLessThanOrEqual(9);
    });

    it("should handle empty content gracefully", async () => {
      const check = getCheckById("T2-01");
      const html = `<html><body></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });

    it("should fail for complex academic text", async () => {
      const check = getCheckById("T2-01");

      // Complex text with long sentences and multi-syllable words
      const complexText =
        "The implementation of sophisticated methodological paradigms necessitates comprehensive understanding of epistemological frameworks. Furthermore, the ramifications of anthropological investigations demonstrate multifaceted correlations. ".repeat(
          10
        );
      const html = `<html><body><p>${complexText}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-01");
      expect(result.passed).toBe(false);
      expect(result.details?.gradeLevel).toBeGreaterThan(9);
    });

    it("should skip for very short content", async () => {
      const check = getCheckById("T2-01");

      const html = `<html><body><p>Short text here.</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });
  });

  describe("T2-02: Keyword density < 3%", () => {
    it("should pass for normal keyword usage", async () => {
      const check = getCheckById("T2-02");
      expect(check).toBeDefined();

      // 100 words with keyword appearing twice (2%)
      const words = "word ".repeat(98) + "keyword keyword";
      const html = `<html><body><p>${words}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com",
        keyword: "keyword",
      });

      expect(result.checkId).toBe("T2-02");
      expect(result.passed).toBe(true);
      expect(result.details?.density).toBeLessThan(3);
    });

    it("should fail for over-optimized content", async () => {
      const check = getCheckById("T2-02");

      // 100 words with keyword appearing 5 times (5%)
      const words = "word ".repeat(95) + "seo seo seo seo seo";
      const html = `<html><body><p>${words}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({
        $,
        html,
        url: "https://example.com",
        keyword: "seo",
      });

      expect(result.checkId).toBe("T2-02");
      expect(result.passed).toBe(false);
      expect(result.details?.density).toBeGreaterThanOrEqual(3);
    });

    it("should skip when no keyword provided", async () => {
      const check = getCheckById("T2-02");

      const html = `<html><body><p>${"word ".repeat(100)}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });
  });

  describe("T2-03: Word count by query type", () => {
    it("should pass for content within default range", async () => {
      const check = getCheckById("T2-03");
      expect(check).toBeDefined();

      // 1000 words (within default 800-1800 range)
      const html = `<html><body><p>${"word ".repeat(1000)}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-03");
      expect(result.passed).toBe(true);
    });

    it("should pass for 1500 words within default range", async () => {
      const check = getCheckById("T2-03");

      // 1500 words (within default 800-1800 range)
      const html = `<html><body><p>${"word ".repeat(1500)}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-03");
      expect(result.passed).toBe(true);
      expect(result.details?.wordCount).toBe(1500);
    });

    it("should fail for content below minimum", async () => {
      const check = getCheckById("T2-03");

      // 200 words (below default 800 minimum)
      const html = `<html><body><p>${"word ".repeat(200)}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-03");
      expect(result.passed).toBe(false);
      expect(result.details?.wordCount as number).toBeLessThan(result.details?.minWords as number);
    });

    it("should handle empty content", async () => {
      const check = getCheckById("T2-03");

      const html = `<html><body></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-03");
      expect(result.passed).toBe(false);
      expect(result.details?.wordCount).toBe(0);
    });
  });

  describe("T2-04: Statistics every 150-200 words", () => {
    it("should pass for content with statistics", async () => {
      const check = getCheckById("T2-04");
      expect(check).toBeDefined();

      // 500 words with 3 statistics (need 3 for 500 words)
      const text =
        "This is some text with 50% improvement rate. " +
        "word ".repeat(150) +
        "We saw a 3x increase in traffic. " +
        "word ".repeat(150) +
        "Revenue grew to $1,000,000 this year. " +
        "word ".repeat(100);
      const html = `<html><body><p>${text}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-04");
      expect(result.passed).toBe(true);
    });

    it("should fail for content without statistics", async () => {
      const check = getCheckById("T2-04");

      // 500 words with no statistics
      const html = `<html><body><p>${"word ".repeat(500)}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-04");
      expect(result.passed).toBe(false);
      expect(result.details?.statisticsFound as number).toBeLessThan(result.details?.expectedStatistics as number);
    });

    it("should skip for short content", async () => {
      const check = getCheckById("T2-04");

      const html = `<html><body><p>Short text only.</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });
  });

  describe("T2-05: Section word count 167-278", () => {
    it("should pass when sections are in range", async () => {
      const check = getCheckById("T2-05");
      expect(check).toBeDefined();

      // Create sections with ~200 words each (within 167-278)
      const section1 = "word ".repeat(200);
      const section2 = "word ".repeat(220);
      const section3 = "word ".repeat(190);
      const html = `
        <html><body>
          <h2>Section 1</h2>
          <p>${section1}</p>
          <h2>Section 2</h2>
          <p>${section2}</p>
          <h2>Section 3</h2>
          <p>${section3}</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-05");
      expect(result.passed).toBe(true);
    });

    it("should fail when sections are too short", async () => {
      const check = getCheckById("T2-05");

      // Create sections with only 50 words each (below 167)
      const shortSection = "word ".repeat(50);
      const html = `
        <html><body>
          <h2>Section 1</h2>
          <p>${shortSection}</p>
          <h2>Section 2</h2>
          <p>${shortSection}</p>
          <h2>Section 3</h2>
          <p>${shortSection}</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-05");
      expect(result.passed).toBe(false);
    });

    it("should skip when no H2 sections", async () => {
      const check = getCheckById("T2-05");

      const html = `<html><body><p>${"word ".repeat(500)}</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.skipped).toBe(true);
    });

    it("should handle single-section content", async () => {
      const check = getCheckById("T2-05");

      // Single section with 200 words (within 167-278)
      const section = "word ".repeat(200);
      const html = `
        <html><body>
          <h2>Only Section</h2>
          <p>${section}</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-05");
      expect(result.passed).toBe(true);
    });

    it("should handle empty sections", async () => {
      const check = getCheckById("T2-05");

      // Sections with no content between them
      const html = `
        <html><body>
          <h2>Section 1</h2>
          <h2>Section 2</h2>
          <h2>Section 3</h2>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-05");
      // Empty sections should fail the word count check
      expect(result.passed).toBe(false);
    });
  });
});
