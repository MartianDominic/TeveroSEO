/**
 * Product Catalog Schema Tests
 *
 * Tests for graph node types and Cypher query templates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ProductNode,
  CategoryNode,
  BrandNode,
} from "./product-catalog-schema";
import {
  CATALOG_QUERIES,
  createProductCatalogSchema,
} from "./product-catalog-schema";
import { FalkorDBClient } from "./falkordb-client";

describe("Product Catalog Schema", () => {
  describe("ProductNode type", () => {
    it("has required fields: sku, name, url, seoContentHash, inventoryHash", () => {
      // Type test - this compiles if the type is correct
      const product: ProductNode = {
        sku: "PROD-001",
        name: "test product",
        nameOriginal: "Test Product",
        url: "https://example.com/product/001",
        description: "A test product",
        price: 99.99,
        inStock: true,
        seoContentHash: "abc123def456", // SEO-stable hash
        inventoryHash: "xyz789", // Volatile hash for price/stock
        embedding: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(product.sku).toBe("PROD-001");
      expect(product.seoContentHash).toBe("abc123def456");
      expect(product.inventoryHash).toBe("xyz789");
    });

    it("supports optional embedding field for vectors", () => {
      const productWithEmbedding: ProductNode = {
        sku: "PROD-002",
        name: "embedded product",
        nameOriginal: "Embedded Product",
        url: "https://example.com/product/002",
        description: "A product with embedding",
        price: 49.99,
        inStock: true,
        seoContentHash: "hash1",
        inventoryHash: "hash2",
        embedding: new Array(384).fill(0.1), // 384-dim per ADR-002
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(productWithEmbedding.embedding).toHaveLength(384);
    });
  });

  describe("CategoryNode type", () => {
    it("has required fields: slug, name, parentSlug", () => {
      const category: CategoryNode = {
        slug: "electronics",
        name: "electronics",
        nameOriginal: "Electronics",
        parentSlug: null, // Root category
        level: 0,
        productCount: 100,
      };

      expect(category.slug).toBe("electronics");
      expect(category.parentSlug).toBeNull();
      expect(category.level).toBe(0);
    });

    it("supports nested categories with parentSlug", () => {
      const subcategory: CategoryNode = {
        slug: "laptops",
        name: "laptops",
        nameOriginal: "Laptops",
        parentSlug: "electronics",
        level: 1,
        productCount: 50,
      };

      expect(subcategory.parentSlug).toBe("electronics");
      expect(subcategory.level).toBe(1);
    });
  });

  describe("BrandNode type", () => {
    it("has required fields: name, normalized", () => {
      const brand: BrandNode = {
        name: "Apple Inc.",
        normalized: "apple",
        productCount: 200,
      };

      expect(brand.name).toBe("Apple Inc.");
      expect(brand.normalized).toBe("apple");
    });
  });

  describe("CATALOG_QUERIES", () => {
    it("findProductsByCategory returns valid Cypher", () => {
      expect(CATALOG_QUERIES.findProductsByCategory).toContain("MATCH");
      expect(CATALOG_QUERIES.findProductsByCategory).toContain(
        "(p:Product)-[:IN_CATEGORY]->(c:Category"
      );
      expect(CATALOG_QUERIES.findProductsByCategory).toContain("$slug");
      expect(CATALOG_QUERIES.findProductsByCategory).toContain("$limit");
    });

    it("findCategoryPath returns valid Cypher for hierarchy traversal", () => {
      expect(CATALOG_QUERIES.findCategoryPath).toContain("MATCH");
      expect(CATALOG_QUERIES.findCategoryPath).toContain(":HAS_CHILD");
      expect(CATALOG_QUERIES.findCategoryPath).toContain("$slug");
      expect(CATALOG_QUERIES.findCategoryPath).toContain("nodes(path)");
    });

    it("upsertProduct handles delta detection via seoContentHash", () => {
      expect(CATALOG_QUERIES.upsertProduct).toContain("MERGE");
      expect(CATALOG_QUERIES.upsertProduct).toContain("(p:Product {sku: $sku})");
      expect(CATALOG_QUERIES.upsertProduct).toContain("seoContentHash");
      expect(CATALOG_QUERIES.upsertProduct).toContain("ON CREATE SET");
      expect(CATALOG_QUERIES.upsertProduct).toContain("ON MATCH SET");
    });

    it("classifyKeyword finds matching categories", () => {
      expect(CATALOG_QUERIES.classifyKeyword).toContain("MATCH");
      expect(CATALOG_QUERIES.classifyKeyword).toContain("(c:Category)");
      expect(CATALOG_QUERIES.classifyKeyword).toContain("$keyword");
    });

    it("linkProductToCategory connects products to categories", () => {
      expect(CATALOG_QUERIES.linkProductToCategory).toContain("MATCH");
      expect(CATALOG_QUERIES.linkProductToCategory).toContain(
        "(p:Product {sku: $sku})"
      );
      expect(CATALOG_QUERIES.linkProductToCategory).toContain(
        "(c:Category {slug: $categorySlug})"
      );
      expect(CATALOG_QUERIES.linkProductToCategory).toContain(":IN_CATEGORY");
    });

    it("getChangedProducts returns products modified since timestamp", () => {
      expect(CATALOG_QUERIES.getChangedProducts).toContain("MATCH");
      expect(CATALOG_QUERIES.getChangedProducts).toContain("(p:Product)");
      expect(CATALOG_QUERIES.getChangedProducts).toContain("$sinceTimestamp");
      expect(CATALOG_QUERIES.getChangedProducts).toContain("seoContentHash");
      expect(CATALOG_QUERIES.getChangedProducts).toContain("inventoryHash");
    });
  });

  describe("createProductCatalogSchema", () => {
    it("creates graph with tenant ID and indexes", async () => {
      const mockGraph = {
        query: vi.fn().mockResolvedValue({ data: [] }),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const mockDb = {
        selectGraph: vi.fn().mockReturnValue(mockGraph),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const client = new FalkorDBClient({ host: "localhost", port: 6379 });
      (client as unknown as { db: typeof mockDb }).db = mockDb;

      await createProductCatalogSchema(client, "tenant-123");

      // Should create indexes
      expect(mockGraph.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX")
      );
    });
  });
});
