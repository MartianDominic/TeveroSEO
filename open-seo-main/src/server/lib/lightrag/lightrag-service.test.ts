/**
 * LightRAG Service Tests
 *
 * Tests for HTTP client communicating with the LightRAG Python service.
 * Uses fetch mocking to simulate API responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LightRAGService, getLightRAGService } from "./lightrag-service";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("LightRAGService", () => {
  let service: LightRAGService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new LightRAGService({
      baseUrl: "http://localhost:8100",
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTenantRAG", () => {
    it("returns RAG instance config for tenant", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tenant_id: "tenant-123",
          working_dir: "./data/lightrag/tenant-123",
          status: "ready",
        }),
      });

      const config = await service.getTenantConfig("tenant-123");

      expect(config).toEqual({
        tenant_id: "tenant-123",
        working_dir: "./data/lightrag/tenant-123",
        status: "ready",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8100/tenants/tenant-123/config",
        expect.objectContaining({
          method: "GET",
        })
      );
    });
  });

  describe("insertDocuments", () => {
    it("queues documents for extraction", async () => {
      const documents = [
        { id: "doc-1", content: "Product content", url: "https://example.com/product" },
        { id: "doc-2", content: "Another product", url: "https://example.com/product2" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { documentId: "doc-1", chunksProcessed: 5, entitiesExtracted: 3 },
          { documentId: "doc-2", chunksProcessed: 3, entitiesExtracted: 2 },
        ],
      });

      const results = await service.insertDocuments("tenant-123", documents);

      expect(results).toHaveLength(2);
      expect(results[0].documentId).toBe("doc-1");
      expect(results[0].entitiesExtracted).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8100/tenants/tenant-123/documents",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documents }),
        })
      );
    });
  });

  describe("queryRAG", () => {
    it("returns entities and relations for query text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: "Shampoo is a product for hair care.",
          entities: [
            { type: "product", name: "Shampoo", normalizedName: "shampoo", confidence: 0.9 },
          ],
          relations: [
            { sourceEntity: "Shampoo", targetEntity: "Hair Care", relationType: "belongs_to" },
          ],
          context: ["Product content from page..."],
        }),
      });

      const result = await service.queryRAG("tenant-123", "What is shampoo?");

      expect(result.answer).toContain("Shampoo");
      expect(result.entities).toHaveLength(1);
      expect(result.relations).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8100/tenants/tenant-123/query",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ query: "What is shampoo?", mode: "hybrid" }),
        })
      );
    });

    it("supports different query modes (hybrid, local, global)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: "Local answer",
          entities: [],
          relations: [],
          context: [],
        }),
      });

      await service.queryRAG("tenant-123", "test query", "local");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ query: "test query", mode: "local" }),
        })
      );
    });
  });

  describe("healthCheck", () => {
    it("returns service status when healthy", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ healthy: true }),
      });

      const status = await service.healthCheck();

      expect(status.healthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8100/health",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("returns tenant initialization status when tenant specified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ healthy: true, tenant_initialized: true }),
      });

      const status = await service.healthCheck("tenant-123");

      expect(status.healthy).toBe(true);
      expect(status.tenantInitialized).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8100/health?tenant_id=tenant-123",
        expect.any(Object)
      );
    });

    it("returns unhealthy when service is down", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const status = await service.healthCheck();

      expect(status.healthy).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws error when service returns non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Internal Server Error",
      });

      await expect(service.insertDocuments("tenant-123", [])).rejects.toThrow(
        /Failed to insert documents/
      );
    });

    it("handles network errors gracefully in healthCheck", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const status = await service.healthCheck();

      expect(status.healthy).toBe(false);
    });

    it("throws when query fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Query timeout",
      });

      await expect(service.queryRAG("tenant-123", "test")).rejects.toThrow(
        /Query failed/
      );
    });
  });

  describe("singleton pattern", () => {
    it("getLightRAGService returns same instance", () => {
      const instance1 = getLightRAGService();
      const instance2 = getLightRAGService();

      expect(instance1).toBe(instance2);
    });
  });

  describe("configuration", () => {
    it("uses LIGHTRAG_SERVICE_URL environment variable", () => {
      const original = process.env.LIGHTRAG_SERVICE_URL;
      process.env.LIGHTRAG_SERVICE_URL = "http://custom-host:9000";

      const customService = new LightRAGService();

      // Access private config for verification
      expect((customService as unknown as { config: { baseUrl: string } }).config.baseUrl).toBe(
        "http://custom-host:9000"
      );

      process.env.LIGHTRAG_SERVICE_URL = original;
    });

    it("defaults to localhost:8100 when env not set", () => {
      const original = process.env.LIGHTRAG_SERVICE_URL;
      delete process.env.LIGHTRAG_SERVICE_URL;

      const defaultService = new LightRAGService();

      expect((defaultService as unknown as { config: { baseUrl: string } }).config.baseUrl).toBe(
        "http://localhost:8100"
      );

      process.env.LIGHTRAG_SERVICE_URL = original;
    });
  });
});
