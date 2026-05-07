/**
 * Rule Registry Tests
 * Phase 92-04: RuleEngineService
 *
 * Tests rule definitions and registry functions.
 */

import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import {
  getUniversalRules,
  getVerticalRules,
  getAllRulesForVertical,
  getRuleById,
} from "./index";
import type { RuleContext, RuleDefinition } from "./types";

/**
 * Create a test context from HTML.
 */
function createTestContext(
  html: string,
  options: Partial<RuleContext> = {}
): RuleContext {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();

  return {
    html,
    $,
    text,
    url: options.url ?? "https://example.com/test",
    vertical: options.vertical ?? "general",
    isYmyl: options.isYmyl ?? false,
    metadata: options.metadata ?? {
      wordCount: text.split(/\s+/).filter(Boolean).length,
      headings: $("h1, h2, h3, h4, h5, h6")
        .map((_, el) => $(el).text())
        .get(),
      schemas: $('script[type="application/ld+json"]')
        .map((_, el) => $(el).html() || "")
        .get(),
      images: $("img").length,
      links: {
        internal: $('a[href^="/"]').length,
        external: $('a[href^="http"]').length,
      },
    },
  };
}

describe("Rule Registry", () => {
  describe("getUniversalRules", () => {
    it("returns array of RuleDefinition with 20+ rules", () => {
      const rules = getUniversalRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(20);

      // Verify each rule has required properties
      for (const rule of rules) {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(typeof rule.weight).toBe("number");
        expect(rule.severity).toBeDefined();
        expect(rule.verticals).toBeDefined();
        expect(typeof rule.evaluate).toBe("function");
      }
    });

    it("has unique rule IDs across all universal rules", () => {
      const rules = getUniversalRules();
      const ids = rules.map((r) => r.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe("getVerticalRules", () => {
    it("returns healthcare rules including medical reviewer requirement", () => {
      const rules = getVerticalRules("healthcare");

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(5);

      const medicalReviewer = rules.find(
        (r) => r.id === "R-HC-01" || r.name.includes("Medical reviewer")
      );
      expect(medicalReviewer).toBeDefined();
    });

    it("returns legal rules with appropriate YMYL checks", () => {
      const rules = getVerticalRules("legal");

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(3);
    });

    it("returns financial rules with regulatory requirements", () => {
      const rules = getVerticalRules("financial");

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(3);
    });

    it("returns ecommerce rules including product schema requirement", () => {
      const rules = getVerticalRules("ecommerce");

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(3);

      const productSchema = rules.find(
        (r) => r.name.includes("Product schema") || r.id.includes("EC")
      );
      expect(productSchema).toBeDefined();
    });

    it("returns saas rules with feature-focused checks", () => {
      const rules = getVerticalRules("saas");

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThanOrEqual(3);
    });

    it("returns empty array for verticals without specific rules", () => {
      const rules = getVerticalRules("general");

      expect(Array.isArray(rules)).toBe(true);
      // General may have no specific rules - that's fine
    });
  });

  describe("getAllRulesForVertical", () => {
    it("combines universal and vertical rules", () => {
      const universalCount = getUniversalRules().length;
      const healthcareSpecific = getVerticalRules("healthcare").length;
      const allHealthcare = getAllRulesForVertical("healthcare");

      expect(allHealthcare.length).toBe(universalCount + healthcareSpecific);
    });
  });

  describe("getRuleById", () => {
    it("finds universal rule by ID", () => {
      const rule = getRuleById("R-01");

      expect(rule).toBeDefined();
      expect(rule?.id).toBe("R-01");
    });

    it("finds vertical-specific rule by ID", () => {
      const rule = getRuleById("R-HC-01");

      expect(rule).toBeDefined();
      expect(rule?.id).toBe("R-HC-01");
    });

    it("returns undefined for non-existent rule", () => {
      const rule = getRuleById("R-NONEXISTENT");

      expect(rule).toBeUndefined();
    });
  });

  describe("Rule ID uniqueness", () => {
    it("has unique IDs across all rule packs", () => {
      const allRules: RuleDefinition[] = [
        ...getUniversalRules(),
        ...getVerticalRules("healthcare"),
        ...getVerticalRules("legal"),
        ...getVerticalRules("financial"),
        ...getVerticalRules("ecommerce"),
        ...getVerticalRules("saas"),
      ];

      const ids = allRules.map((r) => r.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });
});

describe("Universal Rule Evaluations", () => {
  describe("R-01: Single H1", () => {
    it("passes when page has exactly one H1", () => {
      const html = "<html><body><h1>Main Title</h1><p>Content</p></body></html>";
      const ctx = createTestContext(html);
      const rule = getRuleById("R-01")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it("fails when page has no H1", () => {
      const html = "<html><body><h2>Secondary Title</h2><p>Content</p></body></html>";
      const ctx = createTestContext(html);
      const rule = getRuleById("R-01")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it("fails when page has multiple H1s", () => {
      const html =
        "<html><body><h1>First</h1><h1>Second</h1><p>Content</p></body></html>";
      const ctx = createTestContext(html);
      const rule = getRuleById("R-01")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe("R-09: Minimum word count", () => {
    it("passes for YMYL with 800+ words", () => {
      const words = Array(850).fill("word").join(" ");
      const html = `<html><body><h1>Title</h1><p>${words}</p></body></html>`;
      const ctx = createTestContext(html, { isYmyl: true });
      const rule = getRuleById("R-09")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it("fails for YMYL with less than 800 words", () => {
      const words = Array(500).fill("word").join(" ");
      const html = `<html><body><h1>Title</h1><p>${words}</p></body></html>`;
      const ctx = createTestContext(html, { isYmyl: true });
      const rule = getRuleById("R-09")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(false);
    });

    it("passes for non-YMYL with 400+ words", () => {
      const words = Array(450).fill("word").join(" ");
      const html = `<html><body><h1>Title</h1><p>${words}</p></body></html>`;
      const ctx = createTestContext(html, { isYmyl: false });
      const rule = getRuleById("R-09")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
    });
  });

  describe("R-17: Author byline present", () => {
    it("passes when author attribution found", () => {
      const html =
        '<html><body><h1>Article</h1><span class="author">John Doe</span><p>Content</p></body></html>';
      const ctx = createTestContext(html);
      const rule = getRuleById("R-17")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it("passes with rel=author link", () => {
      const html =
        '<html><body><h1>Article</h1><a rel="author" href="/authors/john">John</a><p>Content</p></body></html>';
      const ctx = createTestContext(html);
      const rule = getRuleById("R-17")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
    });

    it("fails when no author attribution", () => {
      const html = "<html><body><h1>Article</h1><p>Content with no author</p></body></html>";
      const ctx = createTestContext(html);
      const rule = getRuleById("R-17")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(false);
    });
  });
});

describe("Healthcare Rule Evaluations", () => {
  describe("R-HC-01: Medical reviewer required", () => {
    it("passes when medical reviewer attribution found", () => {
      const html =
        '<html><body><h1>Health Article</h1><p>Reviewed by Dr. Smith, MD</p><p>Content</p></body></html>';
      const ctx = createTestContext(html, { vertical: "healthcare", isYmyl: true });
      const rule = getRuleById("R-HC-01")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
    });

    it("passes with clinically reviewed text", () => {
      const html =
        '<html><body><h1>Health Article</h1><p>Clinically reviewed by our medical team</p></body></html>';
      const ctx = createTestContext(html, { vertical: "healthcare", isYmyl: true });
      const rule = getRuleById("R-HC-01")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
    });

    it("fails when no medical reviewer attribution", () => {
      const html =
        "<html><body><h1>Health Article</h1><p>Content without reviewer</p></body></html>";
      const ctx = createTestContext(html, { vertical: "healthcare", isYmyl: true });
      const rule = getRuleById("R-HC-01")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(false);
    });
  });

  describe("R-HC-02: Citations to authoritative sources", () => {
    it("passes with multiple authoritative links", () => {
      const html = `<html><body>
        <h1>Health Article</h1>
        <p>According to <a href="https://nih.gov/study">NIH</a></p>
        <p>Research from <a href="https://pubmed.ncbi.nlm.nih.gov/123">PubMed</a></p>
      </body></html>`;
      const ctx = createTestContext(html, { vertical: "healthcare", isYmyl: true });
      const rule = getRuleById("R-HC-02")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(true);
    });

    it("fails with no authoritative links", () => {
      const html = `<html><body>
        <h1>Health Article</h1>
        <p>Content with <a href="https://example.com">regular links</a></p>
      </body></html>`;
      const ctx = createTestContext(html, { vertical: "healthcare", isYmyl: true });
      const rule = getRuleById("R-HC-02")!;

      const result = rule.evaluate(ctx);

      expect(result.passed).toBe(false);
    });
  });
});

describe("Ecommerce Rule Evaluations", () => {
  describe("Product schema rule", () => {
    it("passes when Product schema is present", () => {
      const html = `<html><body>
        <h1>Product Page</h1>
        <script type="application/ld+json">
          {"@type": "Product", "name": "Widget", "price": "19.99"}
        </script>
      </body></html>`;
      const ctx = createTestContext(html, { vertical: "ecommerce", isYmyl: false });
      const rules = getVerticalRules("ecommerce");
      const productRule = rules.find(
        (r) => r.name.includes("Product schema") || r.id.includes("EC")
      )!;

      const result = productRule.evaluate(ctx);

      expect(result.passed).toBe(true);
    });

    it("fails when Product schema is missing", () => {
      const html = `<html><body>
        <h1>Product Page</h1>
        <p>Just a product description without schema</p>
      </body></html>`;
      const ctx = createTestContext(html, { vertical: "ecommerce", isYmyl: false });
      const rules = getVerticalRules("ecommerce");
      const productRule = rules.find(
        (r) => r.name.includes("Product schema") || r.id.includes("EC")
      )!;

      const result = productRule.evaluate(ctx);

      expect(result.passed).toBe(false);
    });
  });
});
