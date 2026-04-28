/**
 * Content hasher service for delta crawling optimization.
 * Phase 40: Keyword Intelligence - Fix 1 (Split Content Hash)
 *
 * Computes THREE separate hashes to enable smart change detection:
 * 1. seoContentHash - name + description + categories + brand (stable, for delta crawling)
 * 2. inventoryHash - price + stock + sku (volatile, for inventory tracking)
 * 3. fullContentHash - everything (for debugging/audit trail)
 *
 * This separation is CRITICAL for achieving 65-80% cache savings in delta crawling.
 * Without it, constant price changes would trigger false "modified" on every crawl,
 * defeating the entire delta crawling strategy.
 *
 * @see .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md - Fix 1
 * @see docs/infra-research/crawling-10-5000-tasks-day.md - Delta crawling section
 */

import { createHash } from "crypto";
import type {
  ProductData,
  HashResult,
  ChangeType,
  HashFieldConfig,
} from "../types/hashing";
import { DEFAULT_HASH_FIELD_CONFIG } from "../types/hashing";

/**
 * ContentHasher computes separate hashes for SEO content vs inventory data.
 *
 * The key insight is that e-commerce product pages have two types of content:
 * - SEO-relevant: name, description, categories, brand (changes rarely)
 * - Volatile inventory: price, stock, sku (changes constantly)
 *
 * By hashing them separately, we can detect what type of change occurred
 * and respond appropriately - only triggering expensive re-embedding
 * when SEO content actually changes.
 */
export class ContentHasher {
  /** Hash truncation length (16 hex chars = 64 bits, sufficient for collision resistance at our scale) */
  private static readonly HASH_LENGTH = 16;

  private readonly fieldConfig: HashFieldConfig;

  /**
   * Create a ContentHasher with optional custom field configuration.
   *
   * @param fieldConfig - Override default fields for each hash type
   */
  constructor(fieldConfig?: HashFieldConfig) {
    this.fieldConfig = fieldConfig ?? DEFAULT_HASH_FIELD_CONFIG;
  }

  /**
   * Compute all three hashes for a product.
   *
   * @param product - Product data extracted from crawl
   * @returns HashResult with seoContentHash, inventoryHash, and fullContentHash
   */
  computeHashes(product: ProductData): HashResult {
    return {
      seoContentHash: this.computeSeoContentHash(product),
      inventoryHash: this.computeInventoryHash(product),
      fullContentHash: this.computeFullContentHash(product),
    };
  }

  /**
   * Detect the type of change between old and new hash results.
   *
   * The detection priority is:
   * 1. If seoContentHash differs -> SEO_MODIFY (full re-processing needed)
   * 2. If only inventoryHash differs -> PRICE_UPDATE (lightweight update)
   * 3. If both match -> UNCHANGED
   *
   * This ordering ensures we always prioritize SEO changes, which require
   * more expensive processing (re-embedding, NLP, etc.).
   *
   * @param oldHashes - Previous hash result (null if new entity)
   * @param newHashes - Current hash result
   * @returns The type of change detected
   */
  detectChange(oldHashes: HashResult | null, newHashes: HashResult): ChangeType {
    if (oldHashes === null) {
      return "add" as ChangeType;
    }

    if (oldHashes.seoContentHash !== newHashes.seoContentHash) {
      return "seo_modify" as ChangeType;
    }

    if (oldHashes.inventoryHash !== newHashes.inventoryHash) {
      return "price_update" as ChangeType;
    }

    return "unchanged" as ChangeType;
  }

  /**
   * Compute hash of SEO-relevant content only.
   * Used by delta crawling cascade at L2.
   *
   * EXCLUDES price/stock to prevent false positives from inventory changes.
   */
  private computeSeoContentHash(product: ProductData): string {
    const parts = this.extractFieldValues(product, this.fieldConfig.seoFields);
    return this.hashParts(parts);
  }

  /**
   * Compute hash of volatile inventory data only.
   * Triggers lightweight price updates, not full re-extraction.
   */
  private computeInventoryHash(product: ProductData): string {
    const parts = this.extractFieldValues(product, this.fieldConfig.inventoryFields);
    return this.hashParts(parts);
  }

  /**
   * Compute hash of all product data for audit trail.
   * Uses JSON serialization with sorted keys for determinism.
   */
  private computeFullContentHash(product: ProductData): string {
    const normalized = this.normalizeProduct(product);
    const json = JSON.stringify(normalized, Object.keys(normalized).sort());
    return this.sha256Truncated(json);
  }

  /**
   * Extract and normalize values for specified fields.
   */
  private extractFieldValues(
    product: ProductData,
    fields: readonly (keyof ProductData)[]
  ): string[] {
    const parts: string[] = [];

    for (const field of fields) {
      const value = product[field];
      if (value === undefined || value === null) {
        continue;
      }

      const normalized = this.normalizeValue(value);
      if (normalized !== "") {
        parts.push(`${field}:${normalized}`);
      }
    }

    return parts;
  }

  /**
   * Normalize a value for hashing.
   * - Strings: lowercase, trimmed
   * - Arrays: sorted, joined with pipe
   * - Numbers/booleans: converted to string
   * - Objects: JSON with sorted keys
   */
  private normalizeValue(value: unknown): string {
    if (typeof value === "string") {
      return value.toLowerCase().trim();
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      const normalized = value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.toLowerCase().trim())
        .sort();
      return normalized.join("|");
    }

    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value, Object.keys(value as object).sort());
    }

    return "";
  }

  /**
   * Normalize entire product for full content hash.
   */
  private normalizeProduct(product: ProductData): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(product)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === "string") {
        normalized[key] = value.toLowerCase().trim();
      } else if (Array.isArray(value)) {
        normalized[key] = [...value]
          .map((v) => (typeof v === "string" ? v.toLowerCase().trim() : v))
          .sort();
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  /**
   * Hash an array of parts with pipe separator.
   */
  private hashParts(parts: string[]): string {
    const content = parts.join("|");
    return this.sha256Truncated(content);
  }

  /**
   * Compute SHA256 hash truncated to 16 hex characters.
   * 16 chars = 64 bits, providing ~10^19 possible values.
   * Collision probability is negligible at our scale (<1M products per tenant).
   */
  private sha256Truncated(content: string): string {
    const hash = createHash("sha256").update(content, "utf8").digest("hex");
    return hash.slice(0, ContentHasher.HASH_LENGTH);
  }
}
