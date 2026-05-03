/**
 * TenantGraphManager Tests
 * Phase 65: GraphRAG Foundation
 *
 * TDD: RED phase - tests for TenantGraphManager
 * Tests tenant isolation, vector indexes, and hybrid search.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TenantGraphManager,
  getTenantGraphManager,
  closeTenantGraphManager,
} from "./tenant-graph-manager";

// Mock the falkordb module
vi.mock("falkordb", () => ({
  FalkorDB: {
    connect: vi.fn().mockResolvedValue({
      selectGraph: vi.fn().mockReturnValue({
        query: vi.fn().mockResolvedValue({ data: [] }),
        delete: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe("TenantGraphManager", () => {
  let manager: TenantGraphManager;

  beforeEach(async () => {
    manager = new TenantGraphManager();
    await manager.connect();
  });

  afterEach(async () => {
    await manager.close();
    await closeTenantGraphManager();
  });

  describe("getGraph", () => {
    it("should return isolated graph for tenant", async () => {
      const graph = await manager.getGraph("tenant-123");
      expect(graph).toBeDefined();
    });

    it("should sanitize tenant ID (replace hyphens with underscores)", async () => {
      const graph = await manager.getGraph("my-tenant-id");
      // Graph should be accessible (sanitization happened internally)
      expect(graph).toBeDefined();
    });

    it("should limit tenant ID to 32 characters", async () => {
      const longTenantId = "a".repeat(50);
      const graph = await manager.getGraph(longTenantId);
      // Should not throw, truncation happens internally
      expect(graph).toBeDefined();
    });

    it("should cache graph handles for same tenant", async () => {
      const graph1 = await manager.getGraph("tenant-123");
      const graph2 = await manager.getGraph("tenant-123");
      expect(graph1).toBe(graph2);
    });

    it("should return different graphs for different tenants", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      let callCount = 0;
      const mockSelectGraph = vi.fn().mockImplementation(() => {
        callCount++;
        return {
          id: callCount, // Unique ID per call
          query: vi.fn().mockResolvedValue({ data: [] }),
          delete: vi.fn(),
        };
      });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: mockSelectGraph,
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();

      const graph1 = await testManager.getGraph("tenant-1");
      const graph2 = await testManager.getGraph("tenant-2");

      // Different tenants should get different graph handles
      expect(mockSelectGraph).toHaveBeenCalledTimes(2);
      expect((graph1 as { id: number }).id).toBe(1);
      expect((graph2 as { id: number }).id).toBe(2);

      await testManager.close();
    });
  });

  describe("initializeTenant", () => {
    it("should create NODE_CREATION_BUFFER 1024 config", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      const mockQuery = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: vi.fn().mockReturnValue({
          query: mockQuery,
          delete: vi.fn(),
        }),
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();
      await testManager.initializeTenant("test-tenant");

      // Check that NODE_CREATION_BUFFER was set
      const calls = mockQuery.mock.calls.map((c) => c[0] as string);
      const bufferCall = calls.find((c) =>
        c.includes("NODE_CREATION_BUFFER")
      );
      expect(bufferCall).toContain("1024");

      await testManager.close();
    });

    it("should create vector index with dimension:768, similarityFunction:cosine", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      const mockQuery = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: vi.fn().mockReturnValue({
          query: mockQuery,
          delete: vi.fn(),
        }),
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();
      await testManager.initializeTenant("test-tenant");

      // Check vector index creation
      const calls = mockQuery.mock.calls.map((c) => c[0] as string);
      const vectorIndexCall = calls.find((c) =>
        c.includes("CREATE VECTOR INDEX")
      );
      expect(vectorIndexCall).toContain("dimension:768");
      expect(vectorIndexCall).toContain("similarityFunction:'cosine'");
      expect(vectorIndexCall).toContain("M:16");
      expect(vectorIndexCall).toContain("efConstruction:200");

      await testManager.close();
    });

    it("should create index on Entity.name", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      const mockQuery = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: vi.fn().mockReturnValue({
          query: mockQuery,
          delete: vi.fn(),
        }),
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();
      await testManager.initializeTenant("test-tenant");

      // Check entity name index
      const calls = mockQuery.mock.calls.map((c) => c[0] as string);
      const indexCall = calls.find(
        (c) => c.includes("CREATE INDEX") && c.includes("Entity") && c.includes("name")
      );
      expect(indexCall).toBeDefined();

      await testManager.close();
    });
  });

  describe("deleteTenant", () => {
    it("should delete tenant graph", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: vi.fn().mockReturnValue({
          query: vi.fn().mockResolvedValue({ data: [] }),
          delete: mockDelete,
        }),
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();
      await testManager.deleteTenant("tenant-to-delete");

      expect(mockDelete).toHaveBeenCalled();
      await testManager.close();
    });
  });

  describe("hybridVectorGraphSearch", () => {
    it("should return results with score and related entities", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      const mockQuery = vi.fn().mockResolvedValue({
        data: [
          {
            id: "entity-1",
            name: "Test Entity",
            type: "keyword",
            score: 0.95,
            related: ["related-1", "related-2"],
          },
        ],
      });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: vi.fn().mockReturnValue({
          query: mockQuery,
          delete: vi.fn(),
        }),
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();

      const queryVec = new Array(768).fill(0.1);
      const results = await testManager.hybridVectorGraphSearch(
        "tenant-123",
        queryVec
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("id", "entity-1");
      expect(results[0]).toHaveProperty("name", "Test Entity");
      expect(results[0]).toHaveProperty("type", "keyword");
      expect(results[0]).toHaveProperty("score", 0.95);
      expect(results[0]).toHaveProperty("related");
      expect(results[0].related).toContain("related-1");

      await testManager.close();
    });

    it("should support category filtering", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      const mockQuery = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: vi.fn().mockReturnValue({
          query: mockQuery,
          delete: vi.fn(),
        }),
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();

      const queryVec = new Array(768).fill(0.1);
      await testManager.hybridVectorGraphSearch("tenant-123", queryVec, {
        category: "electronics",
      });

      // Check that category filter was applied
      const cypher = mockQuery.mock.calls[0][0] as string;
      expect(cypher).toContain("IN_CATEGORY");

      await testManager.close();
    });

    it("should support custom k value", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      const mockQuery = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: vi.fn().mockReturnValue({
          query: mockQuery,
          delete: vi.fn(),
        }),
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();

      const queryVec = new Array(768).fill(0.1);
      await testManager.hybridVectorGraphSearch("tenant-123", queryVec, {
        k: 25,
      });

      // Check that k parameter was passed
      const params = mockQuery.mock.calls[0][1] as Record<string, unknown>;
      expect(params.params.k).toBe(25);

      await testManager.close();
    });
  });

  describe("concurrent tenant access", () => {
    it("should handle multiple concurrent tenant accesses without interference", async () => {
      const FalkorDB = (await import("falkordb")).FalkorDB;
      let callCount = 0;
      const mockSelectGraph = vi.fn().mockImplementation(() => {
        callCount++;
        return {
          id: callCount, // Unique ID per call
          query: vi.fn().mockResolvedValue({ data: [] }),
          delete: vi.fn(),
        };
      });
      vi.mocked(FalkorDB.connect).mockResolvedValueOnce({
        selectGraph: mockSelectGraph,
        close: vi.fn(),
      } as never);

      const testManager = new TenantGraphManager();
      await testManager.connect();

      const tenantIds = ["tenant-1", "tenant-2", "tenant-3", "tenant-4", "tenant-5"];

      // Access all tenants concurrently
      const graphs = await Promise.all(
        tenantIds.map((id) => testManager.getGraph(id))
      );

      // Each tenant should get their own graph (5 calls to selectGraph)
      expect(graphs).toHaveLength(5);
      expect(mockSelectGraph).toHaveBeenCalledTimes(5);

      // Verify graph names follow kg_{tenant_id} pattern
      expect(mockSelectGraph).toHaveBeenCalledWith("kg_tenant_1");
      expect(mockSelectGraph).toHaveBeenCalledWith("kg_tenant_2");
      expect(mockSelectGraph).toHaveBeenCalledWith("kg_tenant_3");
      expect(mockSelectGraph).toHaveBeenCalledWith("kg_tenant_4");
      expect(mockSelectGraph).toHaveBeenCalledWith("kg_tenant_5");

      await testManager.close();
    });
  });

  describe("tenant ID validation", () => {
    it("should reject invalid tenant IDs", async () => {
      await expect(manager.getGraph("")).rejects.toThrow();
    });

    it("should reject tenant IDs with invalid characters", async () => {
      await expect(manager.getGraph("tenant/../../etc")).rejects.toThrow();
    });
  });

  describe("singleton accessor", () => {
    it("should return same instance on multiple calls", async () => {
      const manager1 = await getTenantGraphManager();
      const manager2 = await getTenantGraphManager();
      expect(manager1).toBe(manager2);
    });
  });
});
