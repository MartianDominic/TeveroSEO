/**
 * Tests for ContentHasher service.
 * Phase 40: Keyword Intelligence - Fix 1 (Split Content Hash)
 *
 * Verifies that:
 * - Price changes do NOT affect seoContentHash
 * - Stock changes do NOT affect seoContentHash
 * - Name/description changes DO affect seoContentHash
 * - All fields affect fullContentHash
 * - Hashes are deterministic and collision-resistant
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ContentHasher } from "./ContentHasher";
import type { ProductData, HashResult } from "../types/hashing";
import { ChangeType } from "../types/hashing";

describe("ContentHasher", () => {
  let hasher: ContentHasher;

  const baseProduct: ProductData = {
    url: "https://example.com/product/shampoo-1",
    name: "L'Oreal Serie Expert Vitamino Color Shampoo",
    description: "Professional shampoo for colored hair protection",
    categories: ["Hair Care", "Shampoos", "For Colored Hair"],
    brand: "L'Oreal",
    sku: "LOR-VIT-300",
    price: 29.99,
    currency: "EUR",
    inStock: true,
  };

  beforeEach(() => {
    hasher = new ContentHasher();
  });

  describe("computeHashes", () => {
    it("returns all three hash types", () => {
      const result = hasher.computeHashes(baseProduct);

      expect(result).toHaveProperty("seoContentHash");
      expect(result).toHaveProperty("inventoryHash");
      expect(result).toHaveProperty("fullContentHash");
    });

    it("returns 16-character hex strings for all hashes", () => {
      const result = hasher.computeHashes(baseProduct);

      expect(result.seoContentHash).toMatch(/^[a-f0-9]{16}$/);
      expect(result.inventoryHash).toMatch(/^[a-f0-9]{16}$/);
      expect(result.fullContentHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("handles product with only required url field", () => {
      const minimalProduct: ProductData = { url: "https://example.com/minimal" };
      const result = hasher.computeHashes(minimalProduct);

      expect(result.seoContentHash).toMatch(/^[a-f0-9]{16}$/);
      expect(result.inventoryHash).toMatch(/^[a-f0-9]{16}$/);
      expect(result.fullContentHash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe("seoContentHash - price changes do NOT affect it", () => {
    it("is unchanged when only price changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const priceChanged: ProductData = {
        ...baseProduct,
        price: 39.99, // Price doubled
      };
      const afterPriceChange = hasher.computeHashes(priceChanged);

      expect(afterPriceChange.seoContentHash).toBe(original.seoContentHash);
    });

    it("is unchanged when price changes drastically", () => {
      const original = hasher.computeHashes(baseProduct);

      const priceChanged: ProductData = {
        ...baseProduct,
        price: 0.01, // Price dropped to near zero
      };
      const afterPriceChange = hasher.computeHashes(priceChanged);

      expect(afterPriceChange.seoContentHash).toBe(original.seoContentHash);
    });

    it("is unchanged when price is removed", () => {
      const original = hasher.computeHashes(baseProduct);

      const { price: _, ...withoutPrice } = baseProduct;
      const afterPriceRemoved = hasher.computeHashes(withoutPrice);

      expect(afterPriceRemoved.seoContentHash).toBe(original.seoContentHash);
    });
  });

  describe("seoContentHash - stock changes do NOT affect it", () => {
    it("is unchanged when inStock changes from true to false", () => {
      const original = hasher.computeHashes(baseProduct);

      const stockChanged: ProductData = {
        ...baseProduct,
        inStock: false,
      };
      const afterStockChange = hasher.computeHashes(stockChanged);

      expect(afterStockChange.seoContentHash).toBe(original.seoContentHash);
    });

    it("is unchanged when inStock is removed", () => {
      const original = hasher.computeHashes(baseProduct);

      const { inStock: _, ...withoutStock } = baseProduct;
      const afterStockRemoved = hasher.computeHashes(withoutStock);

      expect(afterStockRemoved.seoContentHash).toBe(original.seoContentHash);
    });
  });

  describe("seoContentHash - SKU changes do NOT affect it", () => {
    it("is unchanged when SKU changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const skuChanged: ProductData = {
        ...baseProduct,
        sku: "NEW-SKU-999",
      };
      const afterSkuChange = hasher.computeHashes(skuChanged);

      expect(afterSkuChange.seoContentHash).toBe(original.seoContentHash);
    });
  });

  describe("seoContentHash - name changes DO affect it", () => {
    it("changes when product name changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const nameChanged: ProductData = {
        ...baseProduct,
        name: "L'Oreal Serie Expert Vitamino Color Shampoo NEW FORMULA",
      };
      const afterNameChange = hasher.computeHashes(nameChanged);

      expect(afterNameChange.seoContentHash).not.toBe(original.seoContentHash);
    });

    it("changes even for minor name changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const nameChanged: ProductData = {
        ...baseProduct,
        name: "L'Oreal Serie Expert Vitamino Color Shampoos", // Added 's'
      };
      const afterNameChange = hasher.computeHashes(nameChanged);

      expect(afterNameChange.seoContentHash).not.toBe(original.seoContentHash);
    });
  });

  describe("seoContentHash - description changes DO affect it", () => {
    it("changes when description changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const descChanged: ProductData = {
        ...baseProduct,
        description: "Updated professional shampoo for colored and damaged hair",
      };
      const afterDescChange = hasher.computeHashes(descChanged);

      expect(afterDescChange.seoContentHash).not.toBe(original.seoContentHash);
    });

    it("changes when description is added to product without one", () => {
      const withoutDesc: ProductData = {
        ...baseProduct,
        description: undefined,
      };
      const original = hasher.computeHashes(withoutDesc);

      const withDesc: ProductData = {
        ...withoutDesc,
        description: "New description added",
      };
      const afterDescAdded = hasher.computeHashes(withDesc);

      expect(afterDescAdded.seoContentHash).not.toBe(original.seoContentHash);
    });
  });

  describe("seoContentHash - category changes DO affect it", () => {
    it("changes when categories change", () => {
      const original = hasher.computeHashes(baseProduct);

      const categoriesChanged: ProductData = {
        ...baseProduct,
        categories: ["Hair Care", "Professional", "Salon Products"],
      };
      const afterCatChange = hasher.computeHashes(categoriesChanged);

      expect(afterCatChange.seoContentHash).not.toBe(original.seoContentHash);
    });

    it("changes when category is added", () => {
      const original = hasher.computeHashes(baseProduct);

      const categoryAdded: ProductData = {
        ...baseProduct,
        categories: [...baseProduct.categories!, "Professional"],
      };
      const afterCatAdded = hasher.computeHashes(categoryAdded);

      expect(afterCatAdded.seoContentHash).not.toBe(original.seoContentHash);
    });
  });

  describe("seoContentHash - brand changes DO affect it", () => {
    it("changes when brand changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const brandChanged: ProductData = {
        ...baseProduct,
        brand: "Kerastase",
      };
      const afterBrandChange = hasher.computeHashes(brandChanged);

      expect(afterBrandChange.seoContentHash).not.toBe(original.seoContentHash);
    });
  });

  describe("inventoryHash - changes with price/stock/sku", () => {
    it("changes when price changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const priceChanged: ProductData = {
        ...baseProduct,
        price: 49.99,
      };
      const afterPriceChange = hasher.computeHashes(priceChanged);

      expect(afterPriceChange.inventoryHash).not.toBe(original.inventoryHash);
    });

    it("changes when stock changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const stockChanged: ProductData = {
        ...baseProduct,
        inStock: false,
      };
      const afterStockChange = hasher.computeHashes(stockChanged);

      expect(afterStockChange.inventoryHash).not.toBe(original.inventoryHash);
    });

    it("changes when SKU changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const skuChanged: ProductData = {
        ...baseProduct,
        sku: "NEW-SKU-123",
      };
      const afterSkuChange = hasher.computeHashes(skuChanged);

      expect(afterSkuChange.inventoryHash).not.toBe(original.inventoryHash);
    });

    it("is unchanged when only SEO content changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const nameChanged: ProductData = {
        ...baseProduct,
        name: "Completely Different Product Name",
        description: "New description here",
      };
      const afterSeoChange = hasher.computeHashes(nameChanged);

      expect(afterSeoChange.inventoryHash).toBe(original.inventoryHash);
    });
  });

  describe("fullContentHash - changes with ANY field change", () => {
    it("changes when price changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const priceChanged: ProductData = {
        ...baseProduct,
        price: 49.99,
      };
      const afterChange = hasher.computeHashes(priceChanged);

      expect(afterChange.fullContentHash).not.toBe(original.fullContentHash);
    });

    it("changes when name changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const nameChanged: ProductData = {
        ...baseProduct,
        name: "New Product Name",
      };
      const afterChange = hasher.computeHashes(nameChanged);

      expect(afterChange.fullContentHash).not.toBe(original.fullContentHash);
    });

    it("changes when stock changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const stockChanged: ProductData = {
        ...baseProduct,
        inStock: false,
      };
      const afterChange = hasher.computeHashes(stockChanged);

      expect(afterChange.fullContentHash).not.toBe(original.fullContentHash);
    });

    it("changes when any field changes", () => {
      const original = hasher.computeHashes(baseProduct);

      const currencyChanged: ProductData = {
        ...baseProduct,
        currency: "USD",
      };
      const afterChange = hasher.computeHashes(currencyChanged);

      expect(afterChange.fullContentHash).not.toBe(original.fullContentHash);
    });
  });

  describe("hash determinism", () => {
    it("produces same hash for same input", () => {
      const result1 = hasher.computeHashes(baseProduct);
      const result2 = hasher.computeHashes(baseProduct);

      expect(result1.seoContentHash).toBe(result2.seoContentHash);
      expect(result1.inventoryHash).toBe(result2.inventoryHash);
      expect(result1.fullContentHash).toBe(result2.fullContentHash);
    });

    it("produces same hash regardless of object creation order", () => {
      const product1: ProductData = {
        url: "https://example.com/test",
        name: "Test",
        price: 10,
        brand: "Brand",
      };

      const product2: ProductData = {
        brand: "Brand",
        price: 10,
        url: "https://example.com/test",
        name: "Test",
      };

      const result1 = hasher.computeHashes(product1);
      const result2 = hasher.computeHashes(product2);

      expect(result1.seoContentHash).toBe(result2.seoContentHash);
      expect(result1.inventoryHash).toBe(result2.inventoryHash);
      expect(result1.fullContentHash).toBe(result2.fullContentHash);
    });

    it("is case-insensitive for strings", () => {
      const lowercase: ProductData = {
        url: "https://example.com/test",
        name: "test product",
        brand: "test brand",
      };

      const uppercase: ProductData = {
        url: "https://example.com/test",
        name: "TEST PRODUCT",
        brand: "TEST BRAND",
      };

      const result1 = hasher.computeHashes(lowercase);
      const result2 = hasher.computeHashes(uppercase);

      expect(result1.seoContentHash).toBe(result2.seoContentHash);
    });

    it("trims whitespace from strings", () => {
      const trimmed: ProductData = {
        url: "https://example.com/test",
        name: "Test Product",
      };

      const withWhitespace: ProductData = {
        url: "https://example.com/test",
        name: "  Test Product  ",
      };

      const result1 = hasher.computeHashes(trimmed);
      const result2 = hasher.computeHashes(withWhitespace);

      expect(result1.seoContentHash).toBe(result2.seoContentHash);
    });

    it("sorts categories for consistent hashing", () => {
      const orderedCategories: ProductData = {
        url: "https://example.com/test",
        categories: ["Alpha", "Beta", "Gamma"],
      };

      const unorderedCategories: ProductData = {
        url: "https://example.com/test",
        categories: ["Gamma", "Alpha", "Beta"],
      };

      const result1 = hasher.computeHashes(orderedCategories);
      const result2 = hasher.computeHashes(unorderedCategories);

      expect(result1.seoContentHash).toBe(result2.seoContentHash);
    });
  });

  describe("hash uniqueness", () => {
    it("produces different hashes for different products", () => {
      const product1: ProductData = {
        url: "https://example.com/product-1",
        name: "Product One",
        price: 10,
      };

      const product2: ProductData = {
        url: "https://example.com/product-2",
        name: "Product Two",
        price: 20,
      };

      const result1 = hasher.computeHashes(product1);
      const result2 = hasher.computeHashes(product2);

      expect(result1.seoContentHash).not.toBe(result2.seoContentHash);
      expect(result1.inventoryHash).not.toBe(result2.inventoryHash);
      expect(result1.fullContentHash).not.toBe(result2.fullContentHash);
    });

    it("produces different fullContentHash for same name but different URLs", () => {
      const product1: ProductData = {
        url: "https://example.com/product-1",
        name: "Same Name",
      };

      const product2: ProductData = {
        url: "https://example.com/product-2",
        name: "Same Name",
      };

      const result1 = hasher.computeHashes(product1);
      const result2 = hasher.computeHashes(product2);

      // SEO hashes should be same (URL is not part of SEO content)
      expect(result1.seoContentHash).toBe(result2.seoContentHash);
      // Full content hash includes URL
      expect(result1.fullContentHash).not.toBe(result2.fullContentHash);
    });
  });

  describe("detectChange", () => {
    it("returns ADD when old hashes are null", () => {
      const newHashes = hasher.computeHashes(baseProduct);
      const changeType = hasher.detectChange(null, newHashes);

      expect(changeType).toBe(ChangeType.ADD);
    });

    it("returns SEO_MODIFY when seoContentHash differs", () => {
      const oldProduct = baseProduct;
      const newProduct: ProductData = {
        ...baseProduct,
        name: "Different Name",
      };

      const oldHashes = hasher.computeHashes(oldProduct);
      const newHashes = hasher.computeHashes(newProduct);
      const changeType = hasher.detectChange(oldHashes, newHashes);

      expect(changeType).toBe(ChangeType.SEO_MODIFY);
    });

    it("returns PRICE_UPDATE when only inventoryHash differs", () => {
      const oldProduct = baseProduct;
      const newProduct: ProductData = {
        ...baseProduct,
        price: 49.99,
      };

      const oldHashes = hasher.computeHashes(oldProduct);
      const newHashes = hasher.computeHashes(newProduct);
      const changeType = hasher.detectChange(oldHashes, newHashes);

      expect(changeType).toBe(ChangeType.PRICE_UPDATE);
    });

    it("returns UNCHANGED when both hashes match", () => {
      const oldHashes = hasher.computeHashes(baseProduct);
      const newHashes = hasher.computeHashes(baseProduct);
      const changeType = hasher.detectChange(oldHashes, newHashes);

      expect(changeType).toBe(ChangeType.UNCHANGED);
    });

    it("prioritizes SEO_MODIFY over PRICE_UPDATE when both change", () => {
      const oldProduct = baseProduct;
      const newProduct: ProductData = {
        ...baseProduct,
        name: "New Name",
        price: 99.99,
      };

      const oldHashes = hasher.computeHashes(oldProduct);
      const newHashes = hasher.computeHashes(newProduct);
      const changeType = hasher.detectChange(oldHashes, newHashes);

      expect(changeType).toBe(ChangeType.SEO_MODIFY);
    });
  });

  describe("custom field configuration", () => {
    it("allows custom SEO fields", () => {
      const customHasher = new ContentHasher({
        seoFields: ["name"], // Only name in SEO hash
        inventoryFields: ["price", "sku", "inStock"],
      });

      const original = customHasher.computeHashes(baseProduct);

      // Description change should NOT affect SEO hash with custom config
      const descChanged: ProductData = {
        ...baseProduct,
        description: "New description",
      };
      const afterChange = customHasher.computeHashes(descChanged);

      expect(afterChange.seoContentHash).toBe(original.seoContentHash);
    });

    it("allows custom inventory fields", () => {
      const customHasher = new ContentHasher({
        seoFields: ["name", "description", "categories", "brand"],
        inventoryFields: ["price"], // Only price in inventory hash
      });

      const original = customHasher.computeHashes(baseProduct);

      // SKU change should NOT affect inventory hash with custom config
      const skuChanged: ProductData = {
        ...baseProduct,
        sku: "NEW-SKU",
      };
      const afterChange = customHasher.computeHashes(skuChanged);

      expect(afterChange.inventoryHash).toBe(original.inventoryHash);
    });
  });

  describe("edge cases", () => {
    it("handles empty categories array", () => {
      const withEmptyCategories: ProductData = {
        url: "https://example.com/test",
        name: "Test",
        categories: [],
      };

      const result = hasher.computeHashes(withEmptyCategories);
      expect(result.seoContentHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("handles undefined optional fields", () => {
      const sparse: ProductData = {
        url: "https://example.com/test",
        name: undefined,
        description: undefined,
        categories: undefined,
        brand: undefined,
        sku: undefined,
        price: undefined,
        inStock: undefined,
      };

      const result = hasher.computeHashes(sparse);
      expect(result.seoContentHash).toMatch(/^[a-f0-9]{16}$/);
      expect(result.inventoryHash).toMatch(/^[a-f0-9]{16}$/);
      expect(result.fullContentHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("handles attributes field", () => {
      const withAttributes: ProductData = {
        url: "https://example.com/test",
        name: "Test",
        attributes: {
          size: "300ml",
          colorCode: "6/0",
        },
      };

      const result = hasher.computeHashes(withAttributes);
      expect(result.fullContentHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("handles price of zero", () => {
      const zeroPrice: ProductData = {
        ...baseProduct,
        price: 0,
      };

      const result = hasher.computeHashes(zeroPrice);
      expect(result.inventoryHash).toMatch(/^[a-f0-9]{16}$/);

      // Should be different from undefined price
      const noPrice: ProductData = {
        ...baseProduct,
        price: undefined,
      };
      const resultNoPrice = hasher.computeHashes(noPrice);

      expect(result.inventoryHash).not.toBe(resultNoPrice.inventoryHash);
    });

    it("handles very long description", () => {
      const longDesc: ProductData = {
        url: "https://example.com/test",
        name: "Test",
        description: "A".repeat(10000),
      };

      const result = hasher.computeHashes(longDesc);
      expect(result.seoContentHash).toMatch(/^[a-f0-9]{16}$/);
    });

    it("handles Unicode characters in name and description", () => {
      const withUnicode: ProductData = {
        url: "https://example.com/test",
        name: "Šampūnas dažytiems plaukams",
        description: "Profesionalus šampūnas su vitaminu kompleksu",
        categories: ["Plaukų priežiūra", "Šampūnai"],
        brand: "L'Oréal",
      };

      const result = hasher.computeHashes(withUnicode);
      expect(result.seoContentHash).toMatch(/^[a-f0-9]{16}$/);
    });
  });
});
