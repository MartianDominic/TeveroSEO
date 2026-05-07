/**
 * ClusterContractMapper Tests
 * Phase 86-10: Final Integration
 *
 * Tests for mapping clusters to contracted_keywords table.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ClusterContractMapper,
  mapClustersToContract,
  type GscPositionService,
  type MappableCluster,
} from "./ClusterContractMapper";
import type { ClusteringInput, ScoredCluster } from "../clustering/types";

// ============================================================================
// Mock Setup
// ============================================================================

// Mock database with transaction support
const createMockDb = () => {
  const insertedValues: any[] = [];

  const mockTx = {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((data: any) => {
        insertedValues.push(data);
        return Promise.resolve([data]);
      }),
    })),
  };

  return {
    transaction: vi.fn().mockImplementation(async (callback: (tx: any) => Promise<void>) => {
      await callback(mockTx);
    }),
    _insertedValues: insertedValues,
    _mockTx: mockTx,
  };
};

// Mock GSC service
const createMockGscService = (): GscPositionService => ({
  getPosition: vi.fn().mockResolvedValue(null),
});

// Helper to create test clustering input
const createTestKeyword = (
  keyword: string,
  overrides: Partial<ClusteringInput> = {}
): ClusteringInput => ({
  keyword,
  embedding: Array(768).fill(0.1),
  volume: 1000,
  difficulty: 30,
  funnelStage: "mofu",
  funnelConfidence: 0.8,
  geoCity: null,
  compositeScore: 0.75,
  position: null,
  ...overrides,
});

// Helper to create test cluster
const createTestCluster = (
  id: number,
  keywords: ClusteringInput[],
  selectedKeywords: ClusteringInput[] = []
): ScoredCluster => ({
  clusterId: id,
  keywords,
  selectedKeywords,
  centroid: Array(768).fill(0.1),
  totalVolume: keywords.reduce((sum, k) => sum + k.volume, 0),
  averageDifficulty: 30,
  dominantFunnel: "mofu",
  funnelBreakdown: { bofu: 0.2, mofu: 0.6, tofu: 0.2 },
  labelLt: "Test Cluster",
  labelEn: "Test Cluster",
  suggestedUrl: "/test-cluster",
  labelConfidence: 0.85,
  labelMethod: "centroid_nearest",
  tier: "pillar",
  parentId: null,
  childIds: [],
  rankabilityScore: 0.8,
  backfillKeywords: [],
});

// ============================================================================
// Tests
// ============================================================================

describe("ClusterContractMapper", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockGscService: GscPositionService;
  let mapper: ClusterContractMapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockGscService = createMockGscService();
    mapper = new ClusterContractMapper(mockDb as any, mockGscService);
  });

  describe("mapClustersToContract", () => {
    it("should create contracted_keywords from cluster keywords", async () => {
      const keywords = [
        createTestKeyword("sampunas plaukams", { volume: 2000, funnelStage: "bofu" }),
        createTestKeyword("kondicionierius", { volume: 1000, funnelStage: "mofu" }),
      ];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      const result = await mapper.mapClustersToContract(
        "contract-123",
        "client-456",
        clusters
      );

      expect(result.keywordsLocked).toBe(2);
      expect(result.clustersMapped).toBe(1);
      expect(result.contractId).toBe("contract-123");
      expect(result.lockedAt).toBeInstanceOf(Date);
    });

    it("should snapshot current GSC position as baselinePosition", async () => {
      const keywords = [createTestKeyword("test keyword")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      // Mock GSC returns position 23
      vi.mocked(mockGscService.getPosition).mockResolvedValue(23);

      await mapper.mapClustersToContract("contract-1", "client-1", clusters);

      expect(mockGscService.getPosition).toHaveBeenCalledWith("test keyword");
      expect(mockDb._insertedValues[0].baselinePosition).toBe(23);
    });

    it("should handle null GSC position gracefully", async () => {
      const keywords = [createTestKeyword("new keyword")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      // Mock GSC returns null (not ranking)
      vi.mocked(mockGscService.getPosition).mockResolvedValue(null);

      const result = await mapper.mapClustersToContract(
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(1);
      expect(mockDb._insertedValues[0].baselinePosition).toBeNull();
    });

    it("should work without GSC service", async () => {
      // Create mapper without GSC service
      const mapperNoGsc = new ClusterContractMapper(mockDb as any);

      const keywords = [createTestKeyword("test keyword")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      const result = await mapperNoGsc.mapClustersToContract(
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(1);
      expect(mockDb._insertedValues[0].baselinePosition).toBeNull();
    });

    it("should store funnel stage in uppercase", async () => {
      const keywords = [
        createTestKeyword("bofu keyword", { funnelStage: "bofu" }),
        createTestKeyword("mofu keyword", { funnelStage: "mofu" }),
        createTestKeyword("tofu keyword", { funnelStage: "tofu" }),
      ];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      await mapper.mapClustersToContract("contract-1", "client-1", clusters);

      expect(mockDb._insertedValues[0].funnelStage).toBe("BOFU");
      expect(mockDb._insertedValues[1].funnelStage).toBe("MOFU");
      expect(mockDb._insertedValues[2].funnelStage).toBe("TOFU");
    });

    it("should prefer selectedKeywords over all keywords", async () => {
      const allKeywords = [
        createTestKeyword("keyword1"),
        createTestKeyword("keyword2"),
        createTestKeyword("keyword3"),
      ];
      const selectedKeywords = [createTestKeyword("keyword1")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, allKeywords, selectedKeywords),
      ];

      const result = await mapper.mapClustersToContract(
        "contract-1",
        "client-1",
        clusters
      );

      // Should only lock the selected keyword, not all 3
      expect(result.keywordsLocked).toBe(1);
      expect(mockDb._insertedValues[0].keywordText).toBe("keyword1");
    });

    it("should fall back to all keywords if selectedKeywords empty", async () => {
      const allKeywords = [
        createTestKeyword("keyword1"),
        createTestKeyword("keyword2"),
      ];
      const clusters: MappableCluster[] = [
        createTestCluster(1, allKeywords, []), // Empty selectedKeywords
      ];

      const result = await mapper.mapClustersToContract(
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(2);
    });

    it("should use transaction for atomicity", async () => {
      const keywords = [createTestKeyword("test")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      await mapper.mapClustersToContract("contract-1", "client-1", clusters);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple clusters", async () => {
      const cluster1Keywords = [createTestKeyword("cluster1-kw1")];
      const cluster2Keywords = [
        createTestKeyword("cluster2-kw1"),
        createTestKeyword("cluster2-kw2"),
      ];
      const clusters: MappableCluster[] = [
        createTestCluster(1, cluster1Keywords, cluster1Keywords),
        createTestCluster(2, cluster2Keywords, cluster2Keywords),
      ];

      const result = await mapper.mapClustersToContract(
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(3);
      expect(result.clustersMapped).toBe(2);
    });

    it("should skip empty clusters", async () => {
      const emptyCluster = createTestCluster(1, [], []);
      const nonEmptyCluster = createTestCluster(
        2,
        [createTestKeyword("test")],
        [createTestKeyword("test")]
      );
      const clusters: MappableCluster[] = [emptyCluster, nonEmptyCluster];

      const result = await mapper.mapClustersToContract(
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(1);
      expect(result.clustersMapped).toBe(1); // Empty cluster not counted
    });

    it("should handle GSC service errors gracefully", async () => {
      const keywords = [createTestKeyword("test keyword")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      // Mock GSC throws error
      vi.mocked(mockGscService.getPosition).mockRejectedValue(
        new Error("GSC API error")
      );

      // Should not throw, should continue with null position
      const result = await mapper.mapClustersToContract(
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(1);
      expect(mockDb._insertedValues[0].baselinePosition).toBeNull();
    });

    it("should store volume and difficulty from keywords", async () => {
      const keywords = [
        createTestKeyword("high volume", { volume: 5000, difficulty: 45 }),
      ];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      await mapper.mapClustersToContract("contract-1", "client-1", clusters);

      expect(mockDb._insertedValues[0].searchVolume).toBe(5000);
      expect(mockDb._insertedValues[0].difficulty).toBe(45);
    });

    it("should set status to active for all keywords", async () => {
      const keywords = [
        createTestKeyword("kw1"),
        createTestKeyword("kw2"),
      ];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      await mapper.mapClustersToContract("contract-1", "client-1", clusters);

      expect(mockDb._insertedValues[0].status).toBe("active");
      expect(mockDb._insertedValues[1].status).toBe("active");
    });
  });

  describe("mapClustersToContract factory function", () => {
    it("should work as a standalone function", async () => {
      const keywords = [createTestKeyword("factory test")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      const result = await mapClustersToContract(
        mockDb as any,
        mockGscService,
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(1);
      expect(result.clustersMapped).toBe(1);
    });

    it("should work without GSC service", async () => {
      const keywords = [createTestKeyword("no gsc test")];
      const clusters: MappableCluster[] = [
        createTestCluster(1, keywords, keywords),
      ];

      const result = await mapClustersToContract(
        mockDb as any,
        undefined, // No GSC service
        "contract-1",
        "client-1",
        clusters
      );

      expect(result.keywordsLocked).toBe(1);
    });
  });
});
