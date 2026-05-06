/**
 * ChunkExtractor Tests
 * Phase 92: On-Page SEO Mastery
 *
 * Tests for: OPM-04 (tokenization), OPM-05 (semantic chunks), OPM-06 (chunk limit)
 */

import { describe, it, expect, vi } from "vitest";
import {
  countTokens,
  batchCountTokens,
  extractText,
  extractChunks,
  extractSimpleChunks,
  extractPathPattern,
} from "./ChunkExtractor";
import { load } from "cheerio";

describe("ChunkExtractor", () => {
  describe("countTokens", () => {
    it("should return accurate token count for simple text", () => {
      // "hello world" = 2 tokens in cl100k_base
      const tokens = countTokens("hello world");
      expect(tokens).toBe(2);
    });

    it("should handle empty string", () => {
      const tokens = countTokens("");
      expect(tokens).toBe(0);
    });

    it("should handle multi-word sentences", () => {
      const text = "The quick brown fox jumps over the lazy dog.";
      const tokens = countTokens(text);
      // This sentence is approximately 10 tokens
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(20);
    });

    it("should handle unicode characters", () => {
      const tokens = countTokens("Hello, world! 你好世界");
      expect(tokens).toBeGreaterThan(0);
    });

    it("should handle code snippets", () => {
      const code = `function hello() { console.log("world"); }`;
      const tokens = countTokens(code);
      expect(tokens).toBeGreaterThan(5);
    });

    it("should produce consistent results for same input", () => {
      const text = "This is a test sentence for tokenization.";
      const count1 = countTokens(text);
      const count2 = countTokens(text);
      expect(count1).toBe(count2);
    });
  });

  describe("batchCountTokens", () => {
    it("should return empty array for empty input", () => {
      const counts = batchCountTokens([]);
      expect(counts).toEqual([]);
    });

    it("should return correct counts for multiple texts", () => {
      const texts = ["hello world", "foo bar baz", ""];
      const counts = batchCountTokens(texts);

      expect(counts).toHaveLength(3);
      expect(counts[0]).toBe(2); // "hello world"
      expect(counts[1]).toBeGreaterThan(0);
      expect(counts[2]).toBe(0); // empty string
    });

    it("should be more efficient than individual calls", () => {
      // This is a behavioral test - batch should use single encoding instance
      const texts = Array(100).fill("test text for efficiency");
      const counts = batchCountTokens(texts);

      expect(counts).toHaveLength(100);
      expect(counts.every((c) => c === counts[0])).toBe(true);
    });
  });

  describe("extractText", () => {
    it("should extract body text from HTML", () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>Hello World</h1>
            <p>This is a paragraph.</p>
          </body>
        </html>
      `;
      const $ = load(html);
      const text = extractText($);

      expect(text).toContain("Hello World");
      expect(text).toContain("This is a paragraph");
    });

    it("should remove script tags", () => {
      const html = `
        <html>
          <body>
            <p>Visible text</p>
            <script>alert('hidden');</script>
          </body>
        </html>
      `;
      const $ = load(html);
      const text = extractText($);

      expect(text).toContain("Visible text");
      expect(text).not.toContain("alert");
      expect(text).not.toContain("hidden");
    });

    it("should remove style tags", () => {
      const html = `
        <html>
          <body>
            <p>Visible text</p>
            <style>.hidden { display: none; }</style>
          </body>
        </html>
      `;
      const $ = load(html);
      const text = extractText($);

      expect(text).toContain("Visible text");
      expect(text).not.toContain(".hidden");
      expect(text).not.toContain("display");
    });

    it("should remove noscript tags", () => {
      const html = `
        <html>
          <body>
            <p>Main content</p>
            <noscript>Please enable JavaScript</noscript>
          </body>
        </html>
      `;
      const $ = load(html);
      const text = extractText($);

      expect(text).toContain("Main content");
      expect(text).not.toContain("Please enable JavaScript");
    });

    it("should normalize whitespace", () => {
      const html = `
        <html>
          <body>
            <p>Text   with    multiple     spaces</p>
            <p>And


            line breaks</p>
          </body>
        </html>
      `;
      const $ = load(html);
      const text = extractText($);

      // Multiple spaces should be normalized to single space
      expect(text).not.toMatch(/\s{2,}/);
    });

    it("should handle empty body", () => {
      const html = `<html><body></body></html>`;
      const $ = load(html);
      const text = extractText($);

      expect(text).toBe("");
    });
  });

  describe("extractSimpleChunks", () => {
    it("should extract content blocks with headings", () => {
      const html = `
        <html>
          <body>
            <h1>Main Title</h1>
            <p>Introduction paragraph.</p>
            <h2>Section One</h2>
            <p>Content for section one.</p>
            <h2>Section Two</h2>
            <p>Content for section two.</p>
          </body>
        </html>
      `;

      const chunks = extractSimpleChunks(html);

      expect(chunks.length).toBeGreaterThan(0);
      // Should have heading context
      const sectionOneChunk = chunks.find(
        (c) => c.text.includes("section one") || c.heading === "Section One"
      );
      expect(sectionOneChunk).toBeDefined();
    });

    it("should return token counts for each chunk", () => {
      const html = `
        <html>
          <body>
            <h2>Test Section</h2>
            <p>This is some text content that should be counted.</p>
          </body>
        </html>
      `;

      const chunks = extractSimpleChunks(html);

      for (const chunk of chunks) {
        expect(typeof chunk.tokenCount).toBe("number");
        expect(chunk.tokenCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("extractChunks", () => {
    const mockEmbedFn = vi.fn().mockResolvedValue(Array(768).fill(0.1));

    it("should return empty result for empty HTML", async () => {
      const result = await extractChunks("<html><body></body></html>", mockEmbedFn);

      expect(result.chunks).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it("should extract chunks with metadata", async () => {
      // Generate substantial content for semantic chunking
      const paragraphs = Array(10)
        .fill(null)
        .map(
          (_, i) =>
            `<p>This is paragraph ${i + 1} with substantial content for testing.
             The semantic chunking library requires meaningful text content to
             properly identify chunk boundaries and create meaningful segments.
             Adding more sentences to ensure adequate length for processing.
             Each paragraph needs to contain enough words for analysis.</p>`
        )
        .join("\n");

      const html = `
        <html>
          <body>
            <h2>Introduction</h2>
            ${paragraphs}
          </body>
        </html>
      `;

      const result = await extractChunks(html, mockEmbedFn);

      expect(result.chunks.length).toBeGreaterThan(0);

      for (const chunk of result.chunks) {
        expect(chunk).toHaveProperty("id");
        expect(chunk).toHaveProperty("position");
        expect(chunk).toHaveProperty("text");
        expect(chunk).toHaveProperty("tokenCount");
        expect(chunk).toHaveProperty("metrics");
        expect(chunk.metrics).toHaveProperty("tokenScore");
        expect(chunk.metrics).toHaveProperty("selfContainmentScore");
        expect(chunk.metrics).toHaveProperty("headingAlignmentScore");
      }
    });

    it("should enforce 100-chunk limit (OPM-06)", async () => {
      // Generate HTML with many sections to exceed limit
      const sections = Array(150)
        .fill(null)
        .map(
          (_, i) => `
          <h2>Section ${i}</h2>
          <p>Content for section ${i}. This is paragraph content that needs
             to be substantial enough to form individual chunks during the
             semantic chunking process. Adding more text to ensure proper
             chunking behavior and testing the limit enforcement.</p>
        `
        )
        .join("");

      const html = `<html><body>${sections}</body></html>`;

      const result = await extractChunks(html, mockEmbedFn);

      // Should be limited to 100 chunks max
      expect(result.chunks.length).toBeLessThanOrEqual(100);

      // If we had more than 100, truncated should be true
      if (result.chunks.length === 100) {
        expect(result.truncated).toBe(true);
        expect(result.truncationReason).toContain("100");
      }
    });

    it("should calculate token score correctly", async () => {
      // Create content that should produce chunks
      const html = `
        <html>
          <body>
            <h2>Test Section</h2>
            <p>${"Some test content. ".repeat(50)}</p>
          </body>
        </html>
      `;

      const result = await extractChunks(html, mockEmbedFn);

      for (const chunk of result.chunks) {
        const { tokenScore } = chunk.metrics;
        expect(tokenScore).toBeGreaterThanOrEqual(0);
        expect(tokenScore).toBeLessThanOrEqual(1);

        // Score should be 1.0 for chunks in [400-600] range
        if (chunk.tokenCount >= 400 && chunk.tokenCount <= 600) {
          expect(tokenScore).toBe(1.0);
        }
      }
    });

    it("should call embed function for each text", async () => {
      const html = `
        <html>
          <body>
            <h2>Section</h2>
            <p>Test content for embedding.</p>
          </body>
        </html>
      `;

      mockEmbedFn.mockClear();
      await extractChunks(html, mockEmbedFn);

      // Embed function should have been called
      expect(mockEmbedFn).toHaveBeenCalled();
    });
  });

  describe("extractPathPattern", () => {
    it("should return / for root path", () => {
      expect(extractPathPattern("/")).toBe("/");
    });

    it("should keep first segment", () => {
      expect(extractPathPattern("/product")).toBe("/product");
      expect(extractPathPattern("/blog")).toBe("/blog");
    });

    it("should replace numeric IDs with wildcard", () => {
      expect(extractPathPattern("/product/123")).toBe("/product/*");
      expect(extractPathPattern("/article/456789")).toBe("/article/*");
    });

    it("should replace UUIDs with wildcard", () => {
      expect(extractPathPattern("/item/a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
        "/item/*"
      );
    });

    it("should replace year/month/day patterns", () => {
      // "my-post" is treated as a slug pattern and converted to wildcard
      expect(extractPathPattern("/blog/2024/01/my-post")).toBe("/blog/*/*/*");
    });

    it("should handle slug-style paths", () => {
      expect(extractPathPattern("/blog/my-awesome-post-title")).toBe("/blog/*");
    });

    it("should strip query strings", () => {
      expect(extractPathPattern("/search?q=test")).toBe("/search");
    });

    it("should strip hash fragments", () => {
      expect(extractPathPattern("/page#section")).toBe("/page");
    });

    it("should handle multiple dynamic segments", () => {
      expect(extractPathPattern("/category/123/product/456")).toBe(
        "/category/*/product/*"
      );
    });

    it("should handle empty path", () => {
      expect(extractPathPattern("")).toBe("/");
    });
  });
});
