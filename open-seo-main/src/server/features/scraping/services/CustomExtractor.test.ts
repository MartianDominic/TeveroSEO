/**
 * Tests for CustomExtractor
 * Phase 43: Prospect Keyword Pipeline - Rule-based extraction
 *
 * TDD RED Phase: Write failing tests first
 */
import { describe, it, expect, beforeEach } from "vitest";
import { CustomExtractor, extractWithRules } from "./CustomExtractor";
import type { ExtractionRule } from "@/db/prospect-scrape-config-schema";

// Sample HTML for testing
const PRODUCT_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Product Page</title></head>
<body>
  <nav class="breadcrumb">
    <a href="/">Home</a> /
    <a href="/hair-color">Hair Color</a> /
    <span>Professional</span>
  </nav>
  <h1 class="product-title">L'Oreal Majirel 6/0 Professional Hair Color</h1>
  <div class="product-brand">L'Oreal Professionnel</div>
  <span class="product-price">24,99 EUR</span>
  <span class="sku-value" data-sku="MAJ-6-0">MAJ-6-0</span>
  <div class="product-description">
    <p>Professional permanent hair color with ionene G technology.</p>
  </div>
  <a class="product-link" href="/products/loreal-majirel">View Product</a>
</body>
</html>
`;

const CATEGORY_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Hair Color Category</title></head>
<body>
  <h1 class="category-title">Hair Color</h1>
  <div class="product-count">42 products</div>
  <nav class="subcategories">
    <a href="/permanent">Permanent</a>
    <a href="/semi-permanent">Semi-Permanent</a>
  </nav>
</body>
</html>
`;

const BLOG_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Hair Tips Blog</title></head>
<body>
  <article>
    <h1 class="article-title">10 Tips for Healthy Hair</h1>
    <p>Learn how to maintain beautiful hair...</p>
  </article>
</body>
</html>
`;

// Test extraction rules
const productRule: ExtractionRule = {
  id: "rule-1",
  name: "Product Pages",
  urlPattern: "/products/*",
  pageType: "product",
  enabled: true,
  fields: [
    {
      name: "title",
      selectors: [".product-title", "h1"],
      type: "text",
      transform: "trim",
    },
    {
      name: "price",
      selectors: [".product-price", ".price"],
      type: "text",
      transform: "price",
    },
    {
      name: "brand",
      selectors: [".product-brand", ".brand"],
      type: "text",
      transform: "trim",
    },
    {
      name: "sku",
      selectors: ["[data-sku]", ".sku-value"],
      type: "attribute",
      attribute: "data-sku",
    },
    {
      name: "description",
      selectors: [".product-description"],
      type: "html",
    },
    {
      name: "link",
      selectors: [".product-link"],
      type: "attribute",
      attribute: "href",
    },
  ],
};

const categoryRule: ExtractionRule = {
  id: "rule-2",
  name: "Category Pages",
  urlPattern: "/collections/*",
  pageType: "category",
  enabled: true,
  fields: [
    {
      name: "name",
      selectors: [".category-title", "h1"],
      type: "text",
      transform: "trim",
    },
    {
      name: "productCount",
      selectors: [".product-count"],
      type: "text",
      transform: "number",
    },
  ],
};

const disabledRule: ExtractionRule = {
  id: "rule-3",
  name: "Disabled Rule",
  urlPattern: "/products/*",
  pageType: "product",
  enabled: false,
  fields: [
    {
      name: "title",
      selectors: ["h1"],
      type: "text",
    },
  ],
};

describe("CustomExtractor", () => {
  let extractor: CustomExtractor;

  beforeEach(() => {
    extractor = new CustomExtractor([productRule, categoryRule, disabledRule]);
  });

  describe("extract", () => {
    it("should apply rules matching URL pattern", () => {
      const result = extractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/loreal-majirel",
      );

      expect(result).not.toBeNull();
      expect(result!.matchedRule).toBe("Product Pages");
      expect(result!.pageType).toBe("product");
      expect(result!.url).toBe("https://example.com/products/loreal-majirel");
    });

    it("should use fallback selectors when primary fails", () => {
      const htmlWithFallback = `
        <!DOCTYPE html>
        <html>
        <body>
          <h1>Fallback Product Title</h1>
          <span class="price">19.99 EUR</span>
        </body>
        </html>
      `;

      const result = extractor.extract(
        htmlWithFallback,
        "https://example.com/products/test",
      );

      expect(result).not.toBeNull();
      // Primary selector .product-title not found, but h1 (fallback) should work
      expect(result!.fields.title).toBe("Fallback Product Title");
      expect(result!.fields.price).toBe("19.99");
    });

    it("should apply transform functions correctly", () => {
      const result = extractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      expect(result).not.toBeNull();
      // trim transform
      expect(result!.fields.title).toBe(
        "L'Oreal Majirel 6/0 Professional Hair Color",
      );
      // price transform (extracts numeric value, handles EUR format)
      expect(result!.fields.price).toBe("24.99");
    });

    it("should apply multiple rules in order and return first match", () => {
      // Product rule should match /products/*
      const productResult = extractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/item",
      );
      expect(productResult!.matchedRule).toBe("Product Pages");

      // Category rule should match /collections/*
      const categoryResult = extractor.extract(
        CATEGORY_PAGE_HTML,
        "https://example.com/collections/hair-color",
      );
      expect(categoryResult!.matchedRule).toBe("Category Pages");
    });

    it("should skip non-matching rules", () => {
      const result = extractor.extract(
        BLOG_PAGE_HTML,
        "https://example.com/blog/tips",
      );

      // Neither /products/* nor /collections/* matches /blog/tips
      expect(result).toBeNull();
    });

    it("should skip disabled rules", () => {
      // Create extractor with only the disabled rule
      const disabledExtractor = new CustomExtractor([disabledRule]);
      const result = disabledExtractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      // Disabled rule should be skipped
      expect(result).toBeNull();
    });

    it("should extract attribute type correctly", () => {
      const result = extractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      expect(result).not.toBeNull();
      // Attribute extraction with data-sku
      expect(result!.fields.sku).toBe("MAJ-6-0");
      // Attribute extraction with href
      expect(result!.fields.link).toBe("/products/loreal-majirel");
    });

    it("should extract HTML type correctly", () => {
      const result = extractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      expect(result).not.toBeNull();
      expect(result!.fields.description).toContain(
        "<p>Professional permanent hair color",
      );
    });

    it("should apply number transform correctly", () => {
      const result = extractor.extract(
        CATEGORY_PAGE_HTML,
        "https://example.com/collections/hair-color",
      );

      expect(result).not.toBeNull();
      // number transform extracts numeric value from "42 products"
      expect(result!.fields.productCount).toBe("42");
    });

    it("should apply lowercase transform correctly", () => {
      const lowercaseRule: ExtractionRule = {
        id: "rule-lowercase",
        name: "Lowercase Test",
        urlPattern: "/products/*",
        pageType: "product",
        enabled: true,
        fields: [
          {
            name: "brand",
            selectors: [".product-brand"],
            type: "text",
            transform: "lowercase",
          },
        ],
      };

      const lowercaseExtractor = new CustomExtractor([lowercaseRule]);
      const result = lowercaseExtractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      expect(result).not.toBeNull();
      expect(result!.fields.brand).toBe("l'oreal professionnel");
    });

    it("should return null for fields with no matching elements", () => {
      const missingFieldRule: ExtractionRule = {
        id: "rule-missing",
        name: "Missing Field Test",
        urlPattern: "/products/*",
        pageType: "product",
        enabled: true,
        fields: [
          {
            name: "nonexistent",
            selectors: [".does-not-exist", ".also-missing"],
            type: "text",
          },
        ],
      };

      const missingExtractor = new CustomExtractor([missingFieldRule]);
      const result = missingExtractor.extract(
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      expect(result).not.toBeNull();
      expect(result!.fields.nonexistent).toBeNull();
    });
  });

  describe("testRule", () => {
    it("should test rule against sample URL and HTML", () => {
      const result = extractor.testRule(
        productRule,
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      expect(result.matched).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data!.title).toBe(
        "L'Oreal Majirel 6/0 Professional Hair Color",
      );
    });

    it("should return matched=false for non-matching URL", () => {
      const result = extractor.testRule(
        productRule,
        PRODUCT_PAGE_HTML,
        "https://example.com/blog/article",
      );

      expect(result.matched).toBe(false);
      expect(result.data).toBeNull();
    });
  });

  describe("extractWithRules helper function", () => {
    it("should work as standalone function", () => {
      const result = extractWithRules(
        [productRule, categoryRule],
        PRODUCT_PAGE_HTML,
        "https://example.com/products/test",
      );

      expect(result).not.toBeNull();
      expect(result!.matchedRule).toBe("Product Pages");
    });
  });
});
