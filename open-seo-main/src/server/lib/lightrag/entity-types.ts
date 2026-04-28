/**
 * E-commerce entity types for LightRAG knowledge graph extraction.
 *
 * These map to the addon_params.entity_types in LightRAG configuration.
 * Per ADR-001: LightRAG uses NetworkX + NanoVectorDB per tenant with
 * working directory pattern: ./data/lightrag/{tenant_id}
 */

export const ECOMMERCE_ENTITY_TYPES = [
  "product", // Individual products with SKU, name, price
  "category", // Product categories and subcategories
  "brand", // Product brands
  "attribute", // Product attributes (color, size, material)
  "material", // Materials (cotton, leather, etc.)
  "occasion", // Usage occasions (wedding, casual, sport)
  "audience", // Target audience (men, women, children)
] as const;

export type EntityType = (typeof ECOMMERCE_ENTITY_TYPES)[number];

/**
 * An entity extracted from page content via LightRAG.
 */
export interface ExtractedEntity {
  /** The type of entity (product, category, brand, etc.) */
  type: EntityType;
  /** The raw name as extracted */
  name: string;
  /** Normalized name (lowercase, lemmatized for Lithuanian) */
  normalizedName: string;
  /** Additional attributes extracted for this entity */
  attributes: Record<string, string>;
  /** Source URL where this entity was found */
  sourceUrl: string;
  /** Confidence score from extraction (0-1) */
  confidence: number;
}

/**
 * A relationship between two entities in the knowledge graph.
 */
export interface EntityRelation {
  /** Name of the source entity */
  sourceEntity: string;
  /** Name of the target entity */
  targetEntity: string;
  /** Type of relationship */
  relationType:
    | "belongs_to"
    | "has_attribute"
    | "made_of"
    | "for_audience"
    | "for_occasion";
  /** Confidence score for this relation (0-1) */
  confidence: number;
}

/**
 * Result of extracting entities from a single document.
 */
export interface ExtractionResult {
  /** Entities extracted from the document */
  entities: ExtractedEntity[];
  /** Relations between entities */
  relations: EntityRelation[];
  /** ID of the source document */
  documentId: string;
  /** Time taken for extraction in milliseconds */
  extractionTimeMs: number;
}
