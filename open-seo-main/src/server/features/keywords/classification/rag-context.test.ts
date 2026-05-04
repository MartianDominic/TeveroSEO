import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getClassificationContext, type RAGContext } from "./rag-context";
import type { ExtractedEntity, EntityRelation } from "@/server/lib/lightrag/entity-types";

// Mock LightRAG service
vi.mock("@/server/lib/lightrag/lightrag-service", () => ({
  getLightRAGService: vi.fn(() => ({
    queryRAG: vi.fn(),
    healthCheck: vi.fn(),
  })),
}));

import { getLightRAGService } from "@/server/lib/lightrag/lightrag-service";

describe("rag-context", () => {
  const mockQueryRAG = vi.fn();
  const mockHealthCheck = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (getLightRAGService as ReturnType<typeof vi.fn>).mockReturnValue({
      queryRAG: mockQueryRAG,
      healthCheck: mockHealthCheck,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getClassificationContext", () => {
    const tenantId = "tenant-123";
    const pageContent = "Men's leather jackets for winter occasions. Premium quality coats.";

    it("should retrieve relevant entities from LightRAG", async () => {
      const mockEntities: ExtractedEntity[] = [
        {
          type: "category",
          name: "Men's Clothing",
          normalizedName: "mens_clothing",
          attributes: {},
          sourceUrl: "https://example.com/mens",
          confidence: 0.95,
        },
        {
          type: "material",
          name: "Leather",
          normalizedName: "leather",
          attributes: {},
          sourceUrl: "https://example.com/materials",
          confidence: 0.90,
        },
      ];

      const mockRelations: EntityRelation[] = [
        {
          sourceEntity: "Men's Clothing",
          targetEntity: "Leather",
          relationType: "has_attribute",
          confidence: 0.85,
        },
      ];

      mockHealthCheck.mockResolvedValueOnce({ healthy: true, tenantInitialized: true });
      mockQueryRAG.mockResolvedValueOnce({
        answer: "Men's leather jackets are a category of outerwear.",
        entities: mockEntities,
        relations: mockRelations,
        context: ["Men's fashion context"],
      });

      const result = await getClassificationContext(tenantId, pageContent);

      expect(result).toBeDefined();
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].name).toBe("Men's Clothing");
      expect(result.relations).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockQueryRAG).toHaveBeenCalledWith(tenantId, expect.any(String), "hybrid");
    });

    it("should return low confidence when no entities found", async () => {
      mockHealthCheck.mockResolvedValueOnce({ healthy: true, tenantInitialized: true });
      mockQueryRAG.mockResolvedValueOnce({
        answer: "",
        entities: [],
        relations: [],
        context: [],
      });

      const result = await getClassificationContext(tenantId, pageContent);

      expect(result).toBeDefined();
      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.relevantCategories).toHaveLength(0);
    });

    it("should extract relevant categories from entities", async () => {
      const mockEntities: ExtractedEntity[] = [
        {
          type: "category",
          name: "Outerwear",
          normalizedName: "outerwear",
          attributes: {},
          sourceUrl: "https://example.com/cat",
          confidence: 0.95,
        },
        {
          type: "category",
          name: "Winter Clothing",
          normalizedName: "winter_clothing",
          attributes: {},
          sourceUrl: "https://example.com/cat2",
          confidence: 0.88,
        },
        {
          type: "product",
          name: "Leather Jacket Model X",
          normalizedName: "leather_jacket_x",
          attributes: {},
          sourceUrl: "https://example.com/prod",
          confidence: 0.80,
        },
      ];

      mockHealthCheck.mockResolvedValueOnce({ healthy: true, tenantInitialized: true });
      mockQueryRAG.mockResolvedValueOnce({
        answer: "Category context",
        entities: mockEntities,
        relations: [],
        context: [],
      });

      const result = await getClassificationContext(tenantId, pageContent);

      // Should only include category-type entities in relevantCategories
      expect(result.relevantCategories).toContain("Outerwear");
      expect(result.relevantCategories).toContain("Winter Clothing");
      expect(result.relevantCategories).not.toContain("Leather Jacket Model X");
    });

    it("should calculate confidence based on entity scores", async () => {
      const mockEntities: ExtractedEntity[] = [
        {
          type: "category",
          name: "Category A",
          normalizedName: "cat_a",
          attributes: {},
          sourceUrl: "https://example.com",
          confidence: 0.90,
        },
        {
          type: "brand",
          name: "Brand B",
          normalizedName: "brand_b",
          attributes: {},
          sourceUrl: "https://example.com",
          confidence: 0.80,
        },
      ];

      mockHealthCheck.mockResolvedValueOnce({ healthy: true, tenantInitialized: true });
      mockQueryRAG.mockResolvedValueOnce({
        answer: "Some answer",
        entities: mockEntities,
        relations: [],
        context: ["context1"],
      });

      const result = await getClassificationContext(tenantId, pageContent);

      // Confidence should be average of entity confidences
      expect(result.confidence).toBeCloseTo(0.85, 2); // (0.90 + 0.80) / 2
    });

    it("should return empty context when tenant not initialized", async () => {
      mockHealthCheck.mockResolvedValueOnce({ healthy: true, tenantInitialized: false });

      const result = await getClassificationContext(tenantId, pageContent);

      expect(result.entities).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(mockQueryRAG).not.toHaveBeenCalled();
    });

    it("should handle RAG service failure gracefully", async () => {
      mockHealthCheck.mockResolvedValueOnce({ healthy: true, tenantInitialized: true });
      mockQueryRAG.mockRejectedValueOnce(new Error("LightRAG service unavailable"));

      const result = await getClassificationContext(tenantId, pageContent);

      expect(result).toBeDefined();
      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.error).toBe("LightRAG service unavailable");
    });

    it("should handle unhealthy service gracefully", async () => {
      mockHealthCheck.mockResolvedValueOnce({ healthy: false });

      const result = await getClassificationContext(tenantId, pageContent);

      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.error).toContain("unhealthy");
    });

    it("should truncate page content for query efficiency", async () => {
      const longContent = "x".repeat(5000); // Very long content

      mockHealthCheck.mockResolvedValueOnce({ healthy: true, tenantInitialized: true });
      mockQueryRAG.mockResolvedValueOnce({
        answer: "",
        entities: [],
        relations: [],
        context: [],
      });

      await getClassificationContext(tenantId, longContent);

      // Should truncate to reasonable length (2000 chars)
      expect(mockQueryRAG).toHaveBeenCalledWith(
        tenantId,
        expect.stringMatching(/^.{1,2000}$/),
        "hybrid"
      );
    });
  });
});
