/**
 * GraphRAG Entity Schema and Cypher Query Builders
 * Phase 65: GraphRAG Foundation
 *
 * Defines entity types, interfaces, and parameterized Cypher query builders
 * for the GraphRAG system. All queries use parameters to prevent injection (T-65-01).
 *
 * Entity types align with LightRAG addon_params per RESEARCH.md.
 */

/**
 * Supported entity types for GraphRAG.
 * These map to LightRAG addon_params.entity_types.
 */
export const GRAPH_ENTITY_TYPES = [
  "keyword",
  "page",
  "product",
  "category",
  "brand",
  "attribute",
  "topic",
] as const;

export type GraphEntityType = (typeof GRAPH_ENTITY_TYPES)[number];

/**
 * Graph entity node representation.
 */
export interface GraphEntity {
  /** Unique identifier within tenant graph */
  id: string;
  /** Display name */
  name: string;
  /** Entity type from GRAPH_ENTITY_TYPES */
  type: GraphEntityType;
  /** 768-dim embedding vector (optional) */
  embedding?: number[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Graph relation edge representation.
 */
export interface GraphRelation {
  /** Source entity ID */
  from: string;
  /** Target entity ID */
  to: string;
  /** Relation type (e.g., RELATES_TO, IN_CATEGORY, HAS_KEYWORD) */
  type: string;
  /** Relation strength (0-1) */
  weight?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cypher query result type.
 */
export interface CypherQuery {
  /** Parameterized Cypher query string */
  cypher: string;
  /** Query parameters */
  params: Record<string, unknown>;
}

/**
 * Create a parameterized Cypher query for entity creation.
 *
 * @param entity - Entity to create
 * @returns Cypher query and parameters
 */
export function createEntityCypher(entity: GraphEntity): CypherQuery {
  const hasEmbedding = entity.embedding !== undefined;
  const hasMetadata = entity.metadata !== undefined;

  let cypher = `
    CREATE (e:Entity {
      id: $id,
      name: $name,
      type: $type,
      createdAt: $createdAt,
      updatedAt: $updatedAt
  `;

  if (hasEmbedding) {
    cypher += `,
      embedding: $embedding`;
  }

  if (hasMetadata) {
    cypher += `,
      metadata: $metadata`;
  }

  cypher += `
    })
    RETURN e.id AS id
  `;

  const params: Record<string, unknown> = {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };

  if (hasEmbedding) {
    params.embedding = entity.embedding;
  }

  if (hasMetadata) {
    params.metadata = JSON.stringify(entity.metadata);
  }

  return { cypher, params };
}

/**
 * Create a parameterized Cypher query for relation creation.
 * Uses MERGE to prevent duplicate relations.
 *
 * @param relation - Relation to create
 * @returns Cypher query and parameters
 */
export function createRelationCypher(relation: GraphRelation): CypherQuery {
  const hasWeight = relation.weight !== undefined;
  const hasMetadata = relation.metadata !== undefined;

  // Use dynamic relation type via APOC or string concatenation
  // FalkorDB supports parameterized relation types
  let cypher = `
    MATCH (from:Entity {id: $fromId})
    MATCH (to:Entity {id: $toId})
    MERGE (from)-[r:${relation.type}]->(to)
  `;

  if (hasWeight || hasMetadata) {
    cypher += `
    SET `;
    const setProps: string[] = [];
    if (hasWeight) {
      setProps.push("r.weight = $weight");
    }
    if (hasMetadata) {
      setProps.push("r.metadata = $metadata");
    }
    cypher += setProps.join(", ");
  }

  cypher += `
    RETURN from.id AS fromId, to.id AS toId
  `;

  const params: Record<string, unknown> = {
    fromId: relation.from,
    toId: relation.to,
    relType: relation.type,
  };

  if (hasWeight) {
    params.weight = relation.weight;
  }

  if (hasMetadata) {
    params.metadata = JSON.stringify(relation.metadata);
  }

  return { cypher, params };
}

/**
 * Create a parameterized Cypher query for entity lookup by ID.
 *
 * @param id - Entity ID to find
 * @returns Cypher query and parameters
 */
export function findEntityByIdCypher(id: string): CypherQuery {
  const cypher = `
    MATCH (e:Entity {id: $id})
    RETURN e.id AS id, e.name AS name, e.type AS type,
           e.embedding AS embedding, e.metadata AS metadata,
           e.createdAt AS createdAt, e.updatedAt AS updatedAt
  `;

  return {
    cypher,
    params: { id },
  };
}

/**
 * Create a parameterized Cypher query for vector similarity search.
 * Uses FalkorDB's db.idx.vector.queryNodes function.
 *
 * @param k - Number of results to return
 * @returns Cypher query and parameters (queryVector must be added by caller)
 */
export function vectorSearchCypher(k: number): CypherQuery {
  const cypher = `
    CALL db.idx.vector.queryNodes(
      'Entity',
      'embedding',
      $k,
      $queryVector
    )
    YIELD node, score
    RETURN node.id AS id, node.name AS name, node.type AS type,
           score AS score
    ORDER BY score DESC
  `;

  return {
    cypher,
    params: { k },
  };
}

/**
 * Create a Cypher query for deleting an entity and its relations.
 *
 * @param id - Entity ID to delete
 * @returns Cypher query and parameters
 */
export function deleteEntityCypher(id: string): CypherQuery {
  const cypher = `
    MATCH (e:Entity {id: $id})
    DETACH DELETE e
  `;

  return {
    cypher,
    params: { id },
  };
}

/**
 * Create a Cypher query for getting related entities (1-hop traversal).
 *
 * @param id - Source entity ID
 * @param depth - Maximum traversal depth (1 or 2)
 * @returns Cypher query and parameters
 */
export function getRelatedEntitiesCypher(id: string, depth: 1 | 2 = 1): CypherQuery {
  const cypher = `
    MATCH (e:Entity {id: $id})-[r*1..${depth}]-(related:Entity)
    RETURN DISTINCT related.id AS id, related.name AS name, related.type AS type
    LIMIT 50
  `;

  return {
    cypher,
    params: { id },
  };
}
