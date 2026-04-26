/**
 * Product Catalog Graph Schema
 *
 * Defines TypeScript types for graph nodes and Cypher query templates
 * for product catalog operations in FalkorDB.
 *
 * @see .planning/keyword-intelligence/IMPLEMENTATION-FIXES.md (Fix 1 - split hashes)
 * @see .planning/keyword-intelligence/ARCHITECTURE-DECISIONS.md (ADR-002 - 384-dim)
 */

import type { FalkorDBClient } from "./falkordb-client";

/**
 * Product node in the knowledge graph.
 *
 * Uses split hashes per Fix 1 to enable proper delta detection:
 * - seoContentHash: name + description + categories (stable, for delta crawling)
 * - inventoryHash: price + stock (volatile, for inventory tracking)
 */
export interface ProductNode {
  /** Stock Keeping Unit - unique product identifier */
  sku: string;

  /** Normalized product name (lowercase, trimmed) */
  name: string;

  /** Original product name with casing preserved */
  nameOriginal: string;

  /** Product URL on the site */
  url: string;

  /** Product description text */
  description: string;

  /** Product price (null if not available) */
  price: number | null;

  /** Whether product is in stock */
  inStock: boolean;

  /**
   * Hash of SEO-relevant content: name + description + categories
   * Stable across price changes - used for delta crawling at L2
   */
  seoContentHash: string;

  /**
   * Hash of volatile inventory data: price + stock
   * Triggers lightweight price updates, not full re-extraction
   */
  inventoryHash: string;

  /**
   * 384-dimensional embedding vector (ADR-002)
   * Null if not yet computed
   */
  embedding: number[] | null;

  /** Unix timestamp of creation */
  createdAt: number;

  /** Unix timestamp of last update */
  updatedAt: number;
}

/**
 * Category node in the knowledge graph.
 *
 * Supports hierarchical category structure via parentSlug.
 */
export interface CategoryNode {
  /** URL-safe category identifier */
  slug: string;

  /** Normalized category name (lowercase) */
  name: string;

  /** Original category name with casing */
  nameOriginal: string;

  /** Parent category slug (null for root categories) */
  parentSlug: string | null;

  /** Depth level: 0 = root, 1 = child, etc. */
  level: number;

  /** Number of products in this category */
  productCount: number;
}

/**
 * Brand node in the knowledge graph.
 */
export interface BrandNode {
  /** Brand name as displayed */
  name: string;

  /** Normalized name: lowercase, no diacritics */
  normalized: string;

  /** Number of products from this brand */
  productCount: number;
}

/**
 * Cypher query templates for product catalog operations.
 *
 * All queries use parameterized Cypher ($param) to prevent injection.
 * Never interpolate user input directly into query strings.
 */
export const CATALOG_QUERIES = {
  /**
   * Create or update product with delta detection.
   *
   * Uses MERGE to upsert, with split hash comparison to detect
   * whether SEO content changed (requiring re-embedding) vs
   * just inventory changed (lightweight update).
   */
  upsertProduct: `
    MERGE (p:Product {sku: $sku})
    ON CREATE SET
      p = $props,
      p.createdAt = timestamp()
    ON MATCH SET
      p.updatedAt = timestamp(),
      p.seoContentHash = CASE
        WHEN p.seoContentHash <> $props.seoContentHash
        THEN $props.seoContentHash
        ELSE p.seoContentHash
      END,
      p.inventoryHash = $props.inventoryHash,
      p.price = $props.price,
      p.inStock = $props.inStock
    RETURN p, p.seoContentHash <> $props.seoContentHash AS seoChanged
  `,

  /**
   * Link product to category with IN_CATEGORY relationship.
   */
  linkProductToCategory: `
    MATCH (p:Product {sku: $sku})
    MATCH (c:Category {slug: $categorySlug})
    MERGE (p)-[:IN_CATEGORY]->(c)
  `,

  /**
   * Find products by category with limit.
   * Returns products sorted by name.
   */
  findProductsByCategory: `
    MATCH (p:Product)-[:IN_CATEGORY]->(c:Category {slug: $slug})
    RETURN p
    ORDER BY p.name
    LIMIT $limit
  `,

  /**
   * Get category hierarchy path from root to target.
   * Uses variable-length traversal via HAS_CHILD relationship.
   */
  findCategoryPath: `
    MATCH path = (root:Category {parentSlug: null})-[:HAS_CHILD*0..10]->(c:Category {slug: $slug})
    RETURN [n IN nodes(path) | n.name] AS path
  `,

  /**
   * Keyword classification: find matching categories.
   *
   * Searches category names for keyword matches and returns
   * the category plus its children for context.
   */
  classifyKeyword: `
    MATCH (c:Category)
    WHERE c.name CONTAINS $keyword OR c.normalized CONTAINS $normalizedKeyword
    OPTIONAL MATCH (c)-[:HAS_CHILD*0..3]->(child:Category)
    RETURN c.slug, c.name, collect(DISTINCT child.slug) AS children
    LIMIT 5
  `,

  /**
   * Get products changed since last sync (delta detection).
   * Returns products with updatedAt > sinceTimestamp.
   */
  getChangedProducts: `
    MATCH (p:Product)
    WHERE p.updatedAt > $sinceTimestamp
    RETURN p.sku, p.seoContentHash, p.inventoryHash
  `,

  /**
   * Create or update category with hierarchy.
   */
  upsertCategory: `
    MERGE (c:Category {slug: $slug})
    ON CREATE SET
      c.name = $name,
      c.nameOriginal = $nameOriginal,
      c.parentSlug = $parentSlug,
      c.level = $level,
      c.productCount = 0
    ON MATCH SET
      c.name = $name,
      c.nameOriginal = $nameOriginal
    RETURN c
  `,

  /**
   * Link parent-child category relationship.
   */
  linkCategoryToParent: `
    MATCH (parent:Category {slug: $parentSlug})
    MATCH (child:Category {slug: $childSlug})
    MERGE (parent)-[:HAS_CHILD]->(child)
  `,

  /**
   * Link product to brand.
   */
  linkProductToBrand: `
    MATCH (p:Product {sku: $sku})
    MERGE (b:Brand {normalized: $normalizedBrand})
    ON CREATE SET b.name = $brandName, b.productCount = 0
    MERGE (p)-[:MADE_BY]->(b)
  `,

  /**
   * Update product count for category.
   */
  updateCategoryProductCount: `
    MATCH (c:Category {slug: $slug})
    OPTIONAL MATCH (p:Product)-[:IN_CATEGORY]->(c)
    WITH c, count(p) AS cnt
    SET c.productCount = cnt
    RETURN c
  `,
};

/**
 * Create and initialize a product catalog graph schema for a tenant.
 *
 * Sets up the tenant graph with required indexes and returns the graph handle.
 *
 * @param client - FalkorDB client instance
 * @param tenantId - Tenant identifier
 * @returns The initialized graph handle
 */
export async function createProductCatalogSchema(
  client: FalkorDBClient,
  tenantId: string
): Promise<void> {
  // Create the tenant graph with indexes
  await client.createTenantGraph(tenantId);

  // Get the graph handle for additional setup if needed
  const graph = client.getTenantGraph(tenantId);

  // Create additional relationship indexes if needed
  // (The base indexes are created by createTenantGraph)

  // Return void as the graph is now ready
  return;
}

/**
 * Compute SEO content hash from product data.
 *
 * Hashes: name + description + categories (stable, for delta crawling)
 */
export function computeSeoContentHash(
  name: string,
  description: string,
  categories: string[]
): string {
  const content = [name, description, ...categories].filter(Boolean).join("|");

  // Simple hash using string reduce
  // In production, use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Compute inventory hash from product data.
 *
 * Hashes: price + stock (volatile, triggers lightweight updates)
 */
export function computeInventoryHash(
  price: number | null,
  inStock: boolean,
  sku: string
): string {
  const content = [String(price ?? ""), String(inStock), sku].join("|");

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
