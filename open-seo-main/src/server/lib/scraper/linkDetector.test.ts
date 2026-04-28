/**
 * Tests for detectBusinessLinks function.
 */

import { describe, it, expect } from "vitest";
import { detectBusinessLinks } from "./linkDetector";

describe("detectBusinessLinks", () => {
  const baseUrl = "https://example.com";

  it("finds /products page from link list", () => {
    const links = [
      "/",
      "/products",
      "/about",
      "/contact",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.products).toBe("https://example.com/products");
    expect(result.about).toBe("https://example.com/about");
    expect(result.contact).toBe("https://example.com/contact");
  });

  it("handles URL variants (/about-us, /about/)", () => {
    const links = [
      "/about-us",
      "/products/",
      "/contact-us",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.about).toBe("https://example.com/about-us");
    expect(result.products).toBe("https://example.com/products/");
    expect(result.contact).toBe("https://example.com/contact-us");
  });

  it("returns null for missing page types", () => {
    const links = [
      "/",
      "/blog",
      "/faq",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.products).toBeNull();
    expect(result.about).toBeNull();
    expect(result.services).toBeNull();
    expect(result.contact).toBeNull();
    expect(result.categories).toEqual([]);
  });

  it("finds category pages", () => {
    const links = [
      "/",
      "/category/electronics",
      "/categories/clothing",
      "/collections/home-decor",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.categories).toContain("https://example.com/category/electronics");
    expect(result.categories).toContain("https://example.com/categories/clothing");
    expect(result.categories).toContain("https://example.com/collections/home-decor");
    expect(result.categories).toHaveLength(3);
  });

  it("prioritizes exact matches over variants", () => {
    const links = [
      "/about-us",
      "/about",
      "/products",
      "/shop",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    // Exact match /about should be preferred over /about-us
    expect(result.about).toBe("https://example.com/about");
    // Exact match /products should be preferred over /shop
    expect(result.products).toBe("https://example.com/products");
  });

  it("is case-insensitive", () => {
    const links = [
      "/PRODUCTS",
      "/About-Us",
      "/SERVICES",
      "/Contact",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.products).toBe("https://example.com/PRODUCTS");
    expect(result.about).toBe("https://example.com/About-Us");
    expect(result.services).toBe("https://example.com/SERVICES");
    expect(result.contact).toBe("https://example.com/Contact");
  });

  it("normalizes query params and trailing slashes", () => {
    const links = [
      "/products?sort=price",
      "/about/?ref=footer",
      "/services#offerings",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    // Should keep query params and fragments as-is
    expect(result.products).toBe("https://example.com/products?sort=price");
    expect(result.about).toBe("https://example.com/about/?ref=footer");
    expect(result.services).toBe("https://example.com/services#offerings");
  });

  it("filters external domains", () => {
    const links = [
      "/products",
      "https://external.com/products",
      "http://other.com/about",
      "/about",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    // Should only detect internal links
    expect(result.products).toBe("https://example.com/products");
    expect(result.about).toBe("https://example.com/about");
  });

  it("handles absolute internal URLs", () => {
    const links = [
      "https://example.com/products",
      "https://example.com/about",
      "/services",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.products).toBe("https://example.com/products");
    expect(result.about).toBe("https://example.com/about");
    expect(result.services).toBe("https://example.com/services");
  });

  it("handles base URL with trailing slash", () => {
    const baseWithSlash = "https://example.com/";
    const links = ["/products", "/about"];

    const result = detectBusinessLinks(links, baseWithSlash);

    expect(result.products).toBe("https://example.com/products");
    expect(result.about).toBe("https://example.com/about");
  });

  it("detects shop, store, catalog as product pages", () => {
    const links = ["/shop", "/store", "/catalog"];

    const result = detectBusinessLinks(links, baseUrl);

    // Should find /shop first
    expect(result.products).toBe("https://example.com/shop");
  });

  it("detects company, who-we-are, our-story as about pages", () => {
    const links = ["/company", "/who-we-are", "/our-story"];

    const result = detectBusinessLinks(links, baseUrl);

    // Should find /company first
    expect(result.about).toBe("https://example.com/company");
  });

  it("detects what-we-do, solutions, offerings as service pages", () => {
    const links = ["/what-we-do", "/solutions", "/offerings"];

    const result = detectBusinessLinks(links, baseUrl);

    // Should find /what-we-do first
    expect(result.services).toBe("https://example.com/what-we-do");
  });

  it("detects get-in-touch as contact pages", () => {
    const links = ["/get-in-touch"];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.contact).toBe("https://example.com/get-in-touch");
  });

  it("filters dangerous URL schemes (javascript:, data:, vbscript:, mailto:)", () => {
    const links = [
      "javascript:alert('xss')",
      "data:text/html,<script>alert('xss')</script>",
      "vbscript:msgbox('xss')",
      "mailto:test@example.com",
      "/products",
      "/about",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    // Should only detect safe internal links
    expect(result.products).toBe("https://example.com/products");
    expect(result.about).toBe("https://example.com/about");
  });

  it("filters dangerous schemes in category links", () => {
    const links = [
      "javascript:void(0)",
      "/category/electronics",
      "data:text/html,malicious",
      "/category/clothing",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    // Should only include safe category links
    expect(result.categories).toHaveLength(2);
    expect(result.categories).toContain("https://example.com/category/electronics");
    expect(result.categories).toContain("https://example.com/category/clothing");
  });

  it("filters dangerous schemes case-insensitively", () => {
    const links = [
      "JAVASCRIPT:alert('xss')",
      "JavaScript:void(0)",
      "DATA:text/html,test",
      "MAILTO:test@example.com",
      "/products",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.products).toBe("https://example.com/products");
  });

  it("rejects dangerous schemes even if pathname matches patterns", () => {
    // These URLs have pathnames that would match patterns but use dangerous schemes
    const links = [
      "javascript:/products",
      "data:/about",
      "vbscript:/services",
      "mailto:/contact",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    // All should be null because the schemes are dangerous
    expect(result.products).toBeNull();
    expect(result.about).toBeNull();
    expect(result.services).toBeNull();
    expect(result.contact).toBeNull();
  });

  it("limits categories to first 3 found", () => {
    const links = [
      "/category/a",
      "/category/b",
      "/category/c",
      "/category/d",
      "/category/e",
    ];

    const result = detectBusinessLinks(links, baseUrl);

    expect(result.categories).toHaveLength(3);
    expect(result.categories[0]).toBe("https://example.com/category/a");
    expect(result.categories[1]).toBe("https://example.com/category/b");
    expect(result.categories[2]).toBe("https://example.com/category/c");
  });
});
