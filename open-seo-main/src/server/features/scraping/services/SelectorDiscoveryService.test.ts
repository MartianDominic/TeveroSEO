/**
 * Tests for SelectorDiscoveryService
 * Phase 43: Prospect Keyword Pipeline - AI Selector Discovery
 *
 * TDD RED Phase: Write failing tests first
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SelectorDiscoveryService,
  type SelectorDiscoveryResult,
} from "./SelectorDiscoveryService";

// Mock Anthropic client with hoisted mock function
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
      };
    },
  };
});

// Sample HTML fixtures
const SHOPIFY_PRODUCT_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="shopify-checkout-api-token" content="abc123">
  <script src="https://cdn.shopify.com/s/files/1/theme.js"></script>
</head>
<body>
  <nav class="breadcrumb">
    <a href="/">Home</a> / <a href="/collections/hair-color">Hair Color</a>
  </nav>
  <h1 class="product-single__title">L'Oreal Majirel 6/0</h1>
  <span class="product__price" data-product-price>24,99 EUR</span>
  <div class="product-vendor">L'Oreal Professionnel</div>
  <span class="sku-value">MAJ-6-0</span>
  <div class="product-description">
    Professional permanent hair color with ionene G and incell technology.
  </div>
</body>
</html>
`;

const WOOCOMMERCE_PRODUCT_HTML = `
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/wp-content/plugins/woocommerce/assets/css/style.css">
</head>
<body class="woocommerce single-product">
  <nav class="woocommerce-breadcrumb">
    <a href="/">Home</a> / <a href="/product-category/hair-care">Hair Care</a>
  </nav>
  <h1 class="product_title entry-title">Schwarzkopf IGORA Royal 7-0</h1>
  <span class="woocommerce-Price-amount">
    <span class="woocommerce-Price-currencySymbol">EUR</span>18,50
  </span>
  <span class="posted_in">
    Category: <a href="/product-category/hair-color">Hair Color</a>
  </span>
  <span class="sku">SKU: IGORA-7-0</span>
</body>
</html>
`;

const MAGENTO_PRODUCT_HTML = `
<!DOCTYPE html>
<html>
<head>
  <script src="/static/frontend/Magento/theme/js/main.js"></script>
</head>
<body class="catalog-product-view">
  <div class="breadcrumbs">
    <a href="/">Home</a> / <a href="/hair-products">Hair Products</a>
  </div>
  <h1 class="page-title"><span>Goldwell Topchic 9N</span></h1>
  <div class="price-box">
    <span class="price">21.99 EUR</span>
  </div>
  <div class="product attribute sku">
    <span class="value">GW-TC-9N</span>
  </div>
</body>
</html>
`;

const BLOG_HTML = `
<!DOCTYPE html>
<html>
<head><title>Our Blog</title></head>
<body>
  <article>
    <h1>10 Tips for Healthy Hair</h1>
    <p>Learn how to maintain beautiful hair...</p>
  </article>
</body>
</html>
`;

describe("SelectorDiscoveryService", () => {
  let service: SelectorDiscoveryService;

  beforeEach(() => {
    mockCreate.mockReset();
    service = new SelectorDiscoveryService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverSelectors", () => {
    it("should return selectors for product name, price, category, brand", async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              platform: "shopify",
              platformConfidence: 0.95,
              selectors: [
                {
                  field: "product_name",
                  selector: ".product-single__title",
                  fallback: "h1",
                  confidence: 98,
                  sampleValue: "L'Oreal Majirel 6/0",
                  type: "text",
                },
                {
                  field: "price",
                  selector: ".product__price",
                  fallback: "[data-product-price]",
                  confidence: 95,
                  sampleValue: "24,99 EUR",
                  type: "text",
                },
                {
                  field: "category",
                  selector: "nav.breadcrumb a:last-child",
                  fallback: null,
                  confidence: 85,
                  sampleValue: "Hair Color",
                  type: "text",
                },
                {
                  field: "brand",
                  selector: ".product-vendor",
                  fallback: null,
                  confidence: 90,
                  sampleValue: "L'Oreal Professionnel",
                  type: "text",
                },
              ],
            }),
          },
        ],
      });

      // Act
      const result = await service.discoverSelectors(
        SHOPIFY_PRODUCT_HTML,
        "https://example.com/products/loreal-majirel-6-0",
      );

      // Assert
      expect(result.selectors).toHaveLength(4);
      expect(result.selectors.map((s) => s.field)).toContain("product_name");
      expect(result.selectors.map((s) => s.field)).toContain("price");
      expect(result.selectors.map((s) => s.field)).toContain("category");
      expect(result.selectors.map((s) => s.field)).toContain("brand");
    });

    it("should return confidence scores between 0-100 for each selector", async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              platform: "shopify",
              platformConfidence: 0.95,
              selectors: [
                {
                  field: "product_name",
                  selector: ".product-single__title",
                  fallback: "h1",
                  confidence: 98,
                  sampleValue: "L'Oreal Majirel 6/0",
                  type: "text",
                },
                {
                  field: "price",
                  selector: ".product__price",
                  fallback: null,
                  confidence: 72,
                  sampleValue: "24,99 EUR",
                  type: "text",
                },
              ],
            }),
          },
        ],
      });

      // Act
      const result = await service.discoverSelectors(
        SHOPIFY_PRODUCT_HTML,
        "https://example.com/products/test",
      );

      // Assert
      for (const selector of result.selectors) {
        expect(selector.confidence).toBeGreaterThanOrEqual(0);
        expect(selector.confidence).toBeLessThanOrEqual(100);
      }
    });

    it("should provide fallback selectors when confidence < 90", async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              platform: "custom",
              platformConfidence: 0.5,
              selectors: [
                {
                  field: "product_name",
                  selector: ".custom-title",
                  fallback: "h1",
                  confidence: 75,
                  sampleValue: "Product Name",
                  type: "text",
                },
                {
                  field: "price",
                  selector: ".price-display",
                  fallback: ".amount",
                  confidence: 65,
                  sampleValue: "19.99",
                  type: "text",
                },
              ],
            }),
          },
        ],
      });

      // Act
      const result = await service.discoverSelectors(
        "<html><body><h1>Test</h1></body></html>",
        "https://example.com/product/1",
      );

      // Assert
      const lowConfidenceSelectors = result.selectors.filter(
        (s) => s.confidence < 90,
      );
      for (const selector of lowConfidenceSelectors) {
        expect(selector.fallback).not.toBeNull();
      }
    });

    it("should detect Shopify platform correctly", async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              platform: "shopify",
              platformConfidence: 0.95,
              selectors: [
                {
                  field: "product_name",
                  selector: ".product-single__title",
                  fallback: null,
                  confidence: 98,
                  sampleValue: "Test",
                  type: "text",
                },
              ],
            }),
          },
        ],
      });

      // Act
      const result = await service.discoverSelectors(
        SHOPIFY_PRODUCT_HTML,
        "https://example.com/products/test",
      );

      // Assert
      expect(result.platform).toBe("shopify");
      expect(result.platformConfidence).toBeGreaterThan(0.9);
    });

    it("should detect WooCommerce platform correctly", async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              platform: "woocommerce",
              platformConfidence: 0.95,
              selectors: [
                {
                  field: "product_name",
                  selector: ".product_title",
                  fallback: null,
                  confidence: 95,
                  sampleValue: "Schwarzkopf IGORA Royal 7-0",
                  type: "text",
                },
              ],
            }),
          },
        ],
      });

      // Act
      const result = await service.discoverSelectors(
        WOOCOMMERCE_PRODUCT_HTML,
        "https://example.com/product/test",
      );

      // Assert
      expect(result.platform).toBe("woocommerce");
    });

    it("should handle HTML without product page structure gracefully", async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              platform: "custom",
              platformConfidence: 0.3,
              selectors: [],
            }),
          },
        ],
      });

      // Act
      const result = await service.discoverSelectors(
        BLOG_HTML,
        "https://example.com/blog/tips",
      );

      // Assert
      expect(result.platform).toBe("custom");
      expect(result.selectors).toEqual([]);
    });
  });

  describe("detectPlatform", () => {
    it("should detect Shopify from cdn.shopify.com references", async () => {
      const result = await service.detectPlatform(SHOPIFY_PRODUCT_HTML);
      expect(result.platform).toBe("shopify");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should detect WooCommerce from woocommerce class", async () => {
      const result = await service.detectPlatform(WOOCOMMERCE_PRODUCT_HTML);
      expect(result.platform).toBe("woocommerce");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should detect Magento from mage script references", async () => {
      const result = await service.detectPlatform(MAGENTO_PRODUCT_HTML);
      expect(result.platform).toBe("magento");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should return custom platform for unrecognized sites", async () => {
      const result = await service.detectPlatform(BLOG_HTML);
      expect(result.platform).toBe("custom");
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });
});
