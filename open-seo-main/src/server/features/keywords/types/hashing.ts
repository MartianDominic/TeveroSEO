/**
 * Content hashing types for delta crawling optimization.
 * Phase 40: Keyword Intelligence - Fix 1
 *
 * Separates SEO-stable content from volatile inventory data to prevent
 * false "modified" detections during crawls. Price/stock changes should
 * NOT trigger expensive re-embedding, only actual SEO content changes should.
 *
 * @see .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md - Fix 1
 */

/**
 * Raw product data extracted from e-commerce pages.
 * All fields are optional except url since extraction may be partial.
 */
export interface ProductData {
  /** Original product URL */
  readonly url: string;

  /** Product name as displayed on the page */
  readonly name?: string;

  /** Full product description text */
  readonly description?: string;

  /** Category hierarchy (e.g., ["Hair Care", "Shampoos", "For Colored Hair"]) */
  readonly categories?: readonly string[];

  /** Canonical brand name */
  readonly brand?: string;

  /** Product SKU/code */
  readonly sku?: string;

  /** Current price in store currency */
  readonly price?: number;

  /** Currency code (e.g., "EUR") */
  readonly currency?: string;

  /** Whether product is in stock */
  readonly inStock?: boolean;

  /** Product variant attributes (size, color code, etc.) */
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/**
 * Result of computing content hashes for a product.
 *
 * Three separate hashes serve different purposes:
 * - seoContentHash: For delta crawling cascade (stable, excludes price/stock)
 * - inventoryHash: For lightweight price/stock updates (volatile)
 * - fullContentHash: For debugging and audit trail
 */
export interface HashResult {
  /**
   * Hash of SEO-relevant content only.
   * Includes: name, description, categories, brand.
   * Excludes: price, stock, sku (volatile inventory data).
   *
   * Used at L2 of delta crawling cascade to determine if
   * full re-extraction + re-embedding is needed.
   */
  readonly seoContentHash: string;

  /**
   * Hash of volatile inventory data only.
   * Includes: price, stock, sku.
   *
   * When this changes but seoContentHash doesn't, we only
   * update node properties in the graph - no NLP/embedding.
   */
  readonly inventoryHash: string;

  /**
   * Hash of all product data combined.
   * For debugging and audit trail purposes.
   */
  readonly fullContentHash: string;
}

/**
 * Type of change detected between two entity snapshots.
 *
 * Change detection algorithm:
 * 1. If no previous snapshot exists -> ADD
 * 2. If seoContentHash differs -> SEO_MODIFY (full re-extraction + re-embedding)
 * 3. If only inventoryHash differs -> PRICE_UPDATE (update node properties only)
 * 4. If both hashes match -> UNCHANGED
 */
export enum ChangeType {
  /** New entity, not seen before */
  ADD = "add",

  /**
   * SEO content changed (name, description, categories, brand).
   * Requires full re-extraction and re-embedding.
   */
  SEO_MODIFY = "seo_modify",

  /**
   * Only price/stock/sku changed.
   * Just update node properties, skip NLP/embedding.
   */
  PRICE_UPDATE = "price_update",

  /** No changes detected */
  UNCHANGED = "unchanged",
}

/**
 * Configuration for which fields to include in each hash type.
 */
export interface HashFieldConfig {
  /** Fields to include in SEO content hash */
  readonly seoFields: readonly (keyof ProductData)[];

  /** Fields to include in inventory hash */
  readonly inventoryFields: readonly (keyof ProductData)[];
}

/**
 * Default field configuration following the design in IMPLEMENTATION-FIXES.md.
 */
export const DEFAULT_HASH_FIELD_CONFIG: HashFieldConfig = {
  seoFields: ["name", "description", "categories", "brand"],
  inventoryFields: ["price", "sku", "inStock"],
};
