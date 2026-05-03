/**
 * GraphService Integration Tests
 * Phase 65: GraphRAG Foundation (65-04)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GraphService } from "./graph-service";
import type { TenantGraphManager } from "@/server/lib/graph";
import type { GraphEntity } from "@/server/lib/graph";

describe("GraphService", () => {
  let service: GraphService;
  let mockManager: Partial<TenantGraphManager>;
  let mockGraph: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGraph = {
      query: vi.fn().mockResolvedValue({ data: [] }),
    };

    mockManager = {
      getGraph: vi.fn().mockResolvedValue(mockGraph),
      initializeTenant: vi.fn().mockResolvedValue(undefined),
      deleteTenant: vi.fn().mockResolvedValue(undefined),
    };

    service = new GraphService(mockManager as TenantGraphManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initializeTenant", () => {
    it("should call manager.initializeTenant", async () => {
      await service.initializeTenant("tenant-123");
      expect(mockManager.initializeTenant).toHaveBeenCalledWith("tenant-123");
    });

    it("should handle multiple tenants independently", async () => {
      await service.initializeTenant("tenant-a");
      await service.initializeTenant("tenant-b");

      expect(mockManager.initializeTenant).toHaveBeenCalledTimes(2);
      expect(mockManager.initializeTenant).toHaveBeenCalledWith("tenant-a");
      expect(mockManager.initializeTenant).toHaveBeenCalledWith("tenant-b");
    });
  });

  describe("addEntity", () => {
    it("should execute Cypher query for entity creation", async () => {
      const entity: GraphEntity = {
        id: "entity-1",
        name: "Test Entity",
        type: "keyword",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.addEntity("tenant-123", entity);

      expect(mockManager.getGraph).toHaveBeenCalledWith("tenant-123");
      expect(mockGraph.query).toHaveBeenCalled();

      const [cypher] = mockGraph.query.mock.calls[0];
      expect(cypher).toContain("CREATE");
      expect(cypher).toContain("Entity");
    });

    it("should include embedding in Cypher when provided", async () => {
      const entity: GraphEntity = {
        id: "entity-2",
        name: "Embedded Entity",
        type: "product",
        embedding: Array(768).fill(0.1),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.addEntity("tenant-123", entity);

      const [cypher, options] = mockGraph.query.mock.calls[0];
      expect(cypher).toContain("embedding");
      expect(options.params.embedding).toHaveLength(768);
    });
  });

  describe("addRelation", () => {
    it("should create relation between entities", async () => {
      const relation = {
        from: "entity-1",
        to: "entity-2",
        type: "RELATES_TO",
      };

      await service.addRelation("tenant-123", relation);

      expect(mockManager.getGraph).toHaveBeenCalledWith("tenant-123");
      expect(mockGraph.query).toHaveBeenCalled();

      const [cypher] = mockGraph.query.mock.calls[0];
      expect(cypher).toContain("MATCH");
      expect(cypher).toContain("MERGE");
      expect(cypher).toContain("RELATES_TO");
    });

    it("should include weight when provided", async () => {
      const relation = {
        from: "entity-1",
        to: "entity-2",
        type: "HAS_ATTRIBUTE",
        weight: 0.85,
      };

      await service.addRelation("tenant-123", relation);

      const [cypher, options] = mockGraph.query.mock.calls[0];
      expect(cypher).toContain("weight");
      expect(options.params.weight).toBe(0.85);
    });
  });

  describe("deleteTenant", () => {
    it("should call manager.deleteTenant", async () => {
      await service.deleteTenant("tenant-123");
      expect(mockManager.deleteTenant).toHaveBeenCalledWith("tenant-123");
    });
  });

  describe("hasTenantData", () => {
    it("should return true when graph has nodes", async () => {
      mockGraph.query.mockResolvedValueOnce({ data: [{ count: 10 }] });

      const hasData = await service.hasTenantData("tenant-123");
      expect(hasData).toBe(true);
    });

    it("should return false when graph is empty", async () => {
      mockGraph.query.mockResolvedValueOnce({ data: [{ count: 0 }] });

      const hasData = await service.hasTenantData("tenant-123");
      expect(hasData).toBe(false);
    });

    it("should return false when query fails", async () => {
      mockGraph.query.mockRejectedValueOnce(new Error("Graph not found"));

      const hasData = await service.hasTenantData("tenant-123");
      expect(hasData).toBe(false);
    });
  });
});
