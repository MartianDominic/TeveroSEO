/**
 * GraphRAG Entity Schema Tests
 * Phase 65: GraphRAG Foundation
 *
 * TDD: RED phase - tests for graph-schema.ts
 */
import { describe, it, expect } from "vitest";
import {
  GRAPH_ENTITY_TYPES,
  type GraphEntity,
  type GraphRelation,
  createEntityCypher,
  createRelationCypher,
  findEntityByIdCypher,
  vectorSearchCypher,
} from "./graph-schema";

describe("graph-schema", () => {
  describe("GRAPH_ENTITY_TYPES", () => {
    it("should contain required SEO entity types", () => {
      expect(GRAPH_ENTITY_TYPES).toContain("keyword");
      expect(GRAPH_ENTITY_TYPES).toContain("page");
      expect(GRAPH_ENTITY_TYPES).toContain("product");
      expect(GRAPH_ENTITY_TYPES).toContain("category");
      expect(GRAPH_ENTITY_TYPES).toContain("brand");
      expect(GRAPH_ENTITY_TYPES).toContain("topic");
    });

    it("should have attribute type for GraphRAG addon_params", () => {
      expect(GRAPH_ENTITY_TYPES).toContain("attribute");
    });
  });

  describe("GraphEntity interface", () => {
    it("should have required fields", () => {
      const entity: GraphEntity = {
        id: "test-id",
        name: "Test Entity",
        type: "keyword",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entity.id).toBe("test-id");
      expect(entity.name).toBe("Test Entity");
      expect(entity.type).toBe("keyword");
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it("should support optional embedding field", () => {
      const entity: GraphEntity = {
        id: "test-id",
        name: "Test Entity",
        type: "keyword",
        embedding: new Array(768).fill(0.1),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entity.embedding).toHaveLength(768);
    });

    it("should support optional metadata field", () => {
      const entity: GraphEntity = {
        id: "test-id",
        name: "Test Entity",
        type: "keyword",
        metadata: { volume: 1000, difficulty: 45 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(entity.metadata).toEqual({ volume: 1000, difficulty: 45 });
    });
  });

  describe("GraphRelation interface", () => {
    it("should have required fields", () => {
      const relation: GraphRelation = {
        from: "entity-1",
        to: "entity-2",
        type: "RELATES_TO",
      };

      expect(relation.from).toBe("entity-1");
      expect(relation.to).toBe("entity-2");
      expect(relation.type).toBe("RELATES_TO");
    });

    it("should support optional weight and metadata", () => {
      const relation: GraphRelation = {
        from: "entity-1",
        to: "entity-2",
        type: "HAS_KEYWORD",
        weight: 0.85,
        metadata: { confidence: 0.9 },
      };

      expect(relation.weight).toBe(0.85);
      expect(relation.metadata).toEqual({ confidence: 0.9 });
    });
  });

  describe("createEntityCypher", () => {
    it("should generate valid parameterized Cypher", () => {
      const entity: GraphEntity = {
        id: "entity-123",
        name: "SEO Keywords",
        type: "keyword",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const result = createEntityCypher(entity);

      expect(result.cypher).toContain("CREATE");
      expect(result.cypher).toContain("Entity");
      expect(result.cypher).toContain("$id");
      expect(result.cypher).toContain("$name");
      expect(result.cypher).toContain("$type");
      expect(result.params.id).toBe("entity-123");
      expect(result.params.name).toBe("SEO Keywords");
      expect(result.params.type).toBe("keyword");
    });

    it("should include embedding in params when present", () => {
      const embedding = new Array(768).fill(0.5);
      const entity: GraphEntity = {
        id: "entity-123",
        name: "Test",
        type: "page",
        embedding,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = createEntityCypher(entity);

      expect(result.cypher).toContain("embedding");
      expect(result.params.embedding).toEqual(embedding);
    });

    it("should not include embedding placeholder when not present", () => {
      const entity: GraphEntity = {
        id: "entity-123",
        name: "Test",
        type: "page",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = createEntityCypher(entity);

      expect(result.params.embedding).toBeUndefined();
    });
  });

  describe("createRelationCypher", () => {
    it("should generate valid parameterized Cypher", () => {
      const relation: GraphRelation = {
        from: "entity-1",
        to: "entity-2",
        type: "RELATES_TO",
      };

      const result = createRelationCypher(relation);

      expect(result.cypher).toContain("MATCH");
      expect(result.cypher).toContain("MERGE");
      expect(result.cypher).toContain("$fromId");
      expect(result.cypher).toContain("$toId");
      expect(result.params.fromId).toBe("entity-1");
      expect(result.params.toId).toBe("entity-2");
      expect(result.params.relType).toBe("RELATES_TO");
    });

    it("should include weight when present", () => {
      const relation: GraphRelation = {
        from: "entity-1",
        to: "entity-2",
        type: "HAS_KEYWORD",
        weight: 0.9,
      };

      const result = createRelationCypher(relation);

      expect(result.cypher).toContain("weight");
      expect(result.params.weight).toBe(0.9);
    });
  });

  describe("findEntityByIdCypher", () => {
    it("should generate valid lookup Cypher", () => {
      const result = findEntityByIdCypher("entity-123");

      expect(result.cypher).toContain("MATCH");
      expect(result.cypher).toContain("Entity");
      expect(result.cypher).toContain("$id");
      expect(result.params.id).toBe("entity-123");
    });
  });

  describe("vectorSearchCypher", () => {
    it("should use db.idx.vector.queryNodes for vector search", () => {
      const result = vectorSearchCypher(10);

      expect(result.cypher).toContain("db.idx.vector.queryNodes");
      expect(result.cypher).toContain("Entity");
      expect(result.cypher).toContain("embedding");
      expect(result.params.k).toBe(10);
    });

    it("should support different k values", () => {
      const result = vectorSearchCypher(20);

      expect(result.params.k).toBe(20);
    });
  });
});
