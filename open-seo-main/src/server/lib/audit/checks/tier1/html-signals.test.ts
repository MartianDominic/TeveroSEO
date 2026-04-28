/**
 * HTML Signals Checks Test Suite (T1-01 to T1-05)
 * Tests for Kyle Roof Group B/C secondary HTML signals
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as cheerio from "cheerio";
import { clearRegistry, getCheckById } from "../registry";

// Import the checks to register them
import "./html-signals";

/** Helper to run a check against HTML */
async function runCheck(checkId: string, html: string, url = "https://example.com", keyword?: string) {
  const check = getCheckById(checkId);
  if (!check) throw new Error(`Check ${checkId} not found`);
  const $ = cheerio.load(html);
  return check.run({ $, html, url, keyword });
}

describe("HTML Signal Checks (T1-01 to T1-05)", () => {
  describe("T1-01: Keyword in strong/bold", () => {
    it("should pass when keyword is in <strong> tag", async () => {
      const html = `<html><body><p>Learn about <strong>SEO optimization</strong> today.</p></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("found in strong/bold");
    });

    it("should pass when keyword is in <b> tag", async () => {
      const html = `<html><body><p>Learn about <b>SEO optimization</b> today.</p></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
    });

    it("should fail when keyword is not in strong/bold", async () => {
      const html = `<html><body><p>Learn about SEO optimization today.</p></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.autoEditable).toBe(true);
      expect(result.editRecipe).toContain("<strong>");
    });

    it("should pass when no keyword is provided", async () => {
      const html = `<html><body><p>No keyword test</p></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("No keyword");
    });

    it("should be case-insensitive", async () => {
      const html = `<html><body><p><strong>seo OPTIMIZATION</strong></p></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com", "SEO Optimization");
      expect(result.passed).toBe(true);
    });

    it("should match whole words only", async () => {
      const html = `<html><body><p><strong>SEO</strong> optimizer</p></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
    });
  });

  describe("T1-02: Keyword in em/italic", () => {
    it("should pass when keyword is in <em> tag", async () => {
      const html = `<html><body><p>Learn about <em>SEO optimization</em> today.</p></body></html>`;
      const result = await runCheck("T1-02", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("found in em/italic");
    });

    it("should pass when keyword is in <i> tag", async () => {
      const html = `<html><body><p>Learn about <i>SEO optimization</i> today.</p></body></html>`;
      const result = await runCheck("T1-02", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
    });

    it("should fail when keyword is not in em/italic", async () => {
      const html = `<html><body><p>Learn about SEO optimization today.</p></body></html>`;
      const result = await runCheck("T1-02", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.autoEditable).toBe(true);
      expect(result.editRecipe).toContain("<em>");
    });

    it("should pass when no keyword is provided", async () => {
      const html = `<html><body><p>No keyword test</p></body></html>`;
      const result = await runCheck("T1-02", html, "https://example.com");
      expect(result.passed).toBe(true);
    });
  });

  describe("T1-03: Keyword in link title attribute", () => {
    it("should pass when keyword is in <a title>", async () => {
      const html = `<html><body><a href="/page" title="SEO optimization guide">Link</a></body></html>`;
      const result = await runCheck("T1-03", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("found in link title");
    });

    it("should fail when no link has title with keyword", async () => {
      const html = `<html><body><a href="/page" title="Other topic">Link</a></body></html>`;
      const result = await runCheck("T1-03", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.autoEditable).toBe(true);
    });

    it("should fail when links have no title attribute", async () => {
      const html = `<html><body><a href="/page">Link</a></body></html>`;
      const result = await runCheck("T1-03", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
    });

    it("should pass when no keyword is provided", async () => {
      const html = `<html><body><a href="/page">Link</a></body></html>`;
      const result = await runCheck("T1-03", html, "https://example.com");
      expect(result.passed).toBe(true);
    });

    it("should find keyword in any link title", async () => {
      const html = `<html><body>
        <a href="/page1" title="first link">Link 1</a>
        <a href="/page2" title="SEO optimization tips">Link 2</a>
      </body></html>`;
      const result = await runCheck("T1-03", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
    });
  });

  describe("T1-04: Keyword in noscript", () => {
    it("should pass when keyword is in <noscript> tag", async () => {
      const html = `<html><body><noscript>SEO optimization content for non-JS browsers</noscript></body></html>`;
      const result = await runCheck("T1-04", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("found in noscript");
    });

    it("should fail when keyword is not in noscript", async () => {
      const html = `<html><body><noscript>Enable JavaScript</noscript><p>SEO optimization</p></body></html>`;
      const result = await runCheck("T1-04", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.autoEditable).toBe(true);
    });

    it("should fail when no noscript tag exists", async () => {
      const html = `<html><body><p>SEO optimization content</p></body></html>`;
      const result = await runCheck("T1-04", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
    });

    it("should pass when no keyword is provided", async () => {
      const html = `<html><body><noscript>Content</noscript></body></html>`;
      const result = await runCheck("T1-04", html, "https://example.com");
      expect(result.passed).toBe(true);
    });
  });

  describe("T1-05: Keyword in first paragraph", () => {
    it("should pass when keyword is in first <p> tag", async () => {
      const html = `<html><body>
        <p>SEO optimization is important for rankings.</p>
        <p>Second paragraph.</p>
      </body></html>`;
      const result = await runCheck("T1-05", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(true);
      expect(result.message).toContain("found in first paragraph");
    });

    it("should fail when keyword is only in second paragraph", async () => {
      const html = `<html><body>
        <p>Welcome to our site.</p>
        <p>SEO optimization is our specialty.</p>
      </body></html>`;
      const result = await runCheck("T1-05", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("medium");
      expect(result.autoEditable).toBe(true);
    });

    it("should fail when no paragraph exists", async () => {
      const html = `<html><body><div>SEO optimization content</div></body></html>`;
      const result = await runCheck("T1-05", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
    });

    it("should pass when no keyword is provided", async () => {
      const html = `<html><body><p>Some content</p></body></html>`;
      const result = await runCheck("T1-05", html, "https://example.com");
      expect(result.passed).toBe(true);
    });

    it("should handle empty first paragraph", async () => {
      const html = `<html><body>
        <p></p>
        <p>SEO optimization content</p>
      </body></html>`;
      const result = await runCheck("T1-05", html, "https://example.com", "SEO optimization");
      expect(result.passed).toBe(false);
    });
  });

  describe("Auto-editable and editRecipe verification", () => {
    it("T1-01 should have correct editRecipe when failing", async () => {
      const html = `<html><body><p>Text without keyword</p></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com", "test keyword");
      expect(result.autoEditable).toBe(true);
      expect(result.editRecipe).toBeDefined();
      expect(result.editRecipe).toContain("strong");
    });

    it("T1-02 should have correct editRecipe when failing", async () => {
      const html = `<html><body><p>Text without keyword</p></body></html>`;
      const result = await runCheck("T1-02", html, "https://example.com", "test keyword");
      expect(result.autoEditable).toBe(true);
      expect(result.editRecipe).toBeDefined();
      expect(result.editRecipe).toContain("em");
    });

    it("T1-03 should have correct editRecipe when failing", async () => {
      const html = `<html><body><a href="/">Link</a></body></html>`;
      const result = await runCheck("T1-03", html, "https://example.com", "test keyword");
      expect(result.autoEditable).toBe(true);
      expect(result.editRecipe).toBeDefined();
      expect(result.editRecipe).toContain("title");
    });

    it("T1-04 should have correct editRecipe when failing", async () => {
      const html = `<html><body><p>Content</p></body></html>`;
      const result = await runCheck("T1-04", html, "https://example.com", "test keyword");
      expect(result.autoEditable).toBe(true);
      expect(result.editRecipe).toBeDefined();
      expect(result.editRecipe).toContain("noscript");
    });

    it("T1-05 should have correct editRecipe when failing", async () => {
      const html = `<html><body><p>First paragraph</p></body></html>`;
      const result = await runCheck("T1-05", html, "https://example.com", "test keyword");
      expect(result.autoEditable).toBe(true);
      expect(result.editRecipe).toBeDefined();
      expect(result.editRecipe).toContain("first paragraph");
    });

    it("passing checks should not be auto-editable", async () => {
      const html = `<html><body><strong>SEO keyword</strong></body></html>`;
      const result = await runCheck("T1-01", html, "https://example.com", "SEO keyword");
      expect(result.passed).toBe(true);
      expect(result.autoEditable).toBe(false);
    });
  });
});
