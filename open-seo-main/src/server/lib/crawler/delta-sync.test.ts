/**
 * Delta Sync Service Tests
 *
 * Tests for split hash detection and change type classification.
 * Per IMPLEMENTATION-FIXES.md Fix 1: Split content hash for delta crawling.
 */

import { describe, it, expect } from "vitest";
import {
  computeHashes,
  detectChange,
  ChangeType,
  DeltaSyncService,
  type ProductData,
  type HashSet,
} from "./delta-sync";

describe("computeHashes", () => {
  it("returns separate seo, inventory, and full hashes", () => {
    const data: ProductData = {
      name: "Plaukų šampūnas",
      description: "Šampūnas pažeistiems plaukams",
      categories: ["Plaukų priežiūra", "Šampūnai"],
      brand: "TestBrand",
      price: 12.99,
      inStock: true,
      sku: "SKU-001",
    };

    const hashes = computeHashes(data);

    // All three hashes should be present and different
    expect(hashes.seoContentHash).toBeDefined();
    expect(hashes.inventoryHash).toBeDefined();
    expect(hashes.fullHash).toBeDefined();

    // Hashes should be 16 character hex strings
    expect(hashes.seoContentHash).toMatch(/^[a-f0-9]{16}$/);
    expect(hashes.inventoryHash).toMatch(/^[a-f0-9]{16}$/);
    expect(hashes.fullHash).toMatch(/^[a-f0-9]{16}$/);

    // seoContentHash and inventoryHash should be different
    expect(hashes.seoContentHash).not.toBe(hashes.inventoryHash);
  });

  it("seoContentHash excludes price and stock", () => {
    const data1: ProductData = {
      name: "Product A",
      description: "Description",
      categories: ["Cat1"],
      price: 10.0,
      inStock: true,
    };

    const data2: ProductData = {
      name: "Product A",
      description: "Description",
      categories: ["Cat1"],
      price: 20.0, // Different price
      inStock: false, // Different stock
    };

    const hashes1 = computeHashes(data1);
    const hashes2 = computeHashes(data2);

    // SEO content hash should be the same (excludes price/stock)
    expect(hashes1.seoContentHash).toBe(hashes2.seoContentHash);

    // Inventory hash should be different
    expect(hashes1.inventoryHash).not.toBe(hashes2.inventoryHash);
  });
});

describe("detectChange", () => {
  const baseData: ProductData = {
    name: "Test Product",
    description: "Test description",
    categories: ["Category A"],
    brand: "Brand X",
    price: 25.0,
    inStock: true,
    sku: "TEST-001",
  };

  it("returns UNCHANGED when seoContentHash matches", () => {
    const hashes = computeHashes(baseData);

    const result = detectChange(hashes, hashes);

    expect(result).toBe(ChangeType.UNCHANGED);
  });

  it("returns PRICE_UPDATE when only inventoryHash differs", () => {
    const oldData = { ...baseData };
    const newData = { ...baseData, price: 30.0 }; // Only price changed

    const oldHashes = computeHashes(oldData);
    const newHashes = computeHashes(newData);

    const result = detectChange(oldHashes, newHashes);

    expect(result).toBe(ChangeType.PRICE_UPDATE);
  });

  it("returns SEO_MODIFY when seoContentHash differs", () => {
    const oldData = { ...baseData };
    const newData = { ...baseData, name: "New Product Name" }; // Name changed

    const oldHashes = computeHashes(oldData);
    const newHashes = computeHashes(newData);

    const result = detectChange(oldHashes, newHashes);

    expect(result).toBe(ChangeType.SEO_MODIFY);
  });

  it("returns ADD when no previous snapshot", () => {
    const newHashes = computeHashes(baseData);

    const result = detectChange(null, newHashes);

    expect(result).toBe(ChangeType.ADD);
  });
});

describe("DeltaSyncService", () => {
  it("getUnchangedRatio returns > 0.8 for stable site", () => {
    const service = new DeltaSyncService();

    // Simulate 100 URLs where 85 are unchanged
    const changes = new Map<string, ChangeType>();
    for (let i = 0; i < 85; i++) {
      changes.set(`url-${i}`, ChangeType.UNCHANGED);
    }
    for (let i = 85; i < 95; i++) {
      changes.set(`url-${i}`, ChangeType.PRICE_UPDATE);
    }
    for (let i = 95; i < 100; i++) {
      changes.set(`url-${i}`, ChangeType.SEO_MODIFY);
    }

    const ratio = service.getUnchangedRatio(changes);

    expect(ratio).toBe(0.85);
    expect(ratio).toBeGreaterThan(0.8);
  });

  it("getUnchangedRatio returns 0 for empty map", () => {
    const service = new DeltaSyncService();

    const changes = new Map<string, ChangeType>();

    const ratio = service.getUnchangedRatio(changes);

    expect(ratio).toBe(0);
  });

  it("getUnchangedRatio handles all change types", () => {
    const service = new DeltaSyncService();

    const changes = new Map<string, ChangeType>([
      ["url-1", ChangeType.ADD],
      ["url-2", ChangeType.SEO_MODIFY],
      ["url-3", ChangeType.PRICE_UPDATE],
      ["url-4", ChangeType.DELETE],
      ["url-5", ChangeType.UNCHANGED],
    ]);

    const ratio = service.getUnchangedRatio(changes);

    expect(ratio).toBe(0.2); // 1 out of 5
  });
});
