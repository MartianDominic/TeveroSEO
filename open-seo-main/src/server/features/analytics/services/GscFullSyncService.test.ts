/**
 * GscFullSyncService Tests
 * Phase 96-01 Task 3: Full GSC sync orchestration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GscFullSyncService } from "./GscFullSyncService";
import type { GscPaginationService } from "./GscPaginationService";
import type { QueryAnalyticsRepository } from "../repositories/QueryAnalyticsRepository";
import type { GscBridgeService } from "@/server/services/GscBridgeService";
import { DIMENSION_COMBINATIONS } from "../types";

// Mock dependencies
const mockPaginationService = {
  paginateGscQuery: vi.fn(),
} as unknown as GscPaginationService;

const mockRepository = {
  insertBatch: vi.fn(),
  getRowCountForDate: vi.fn(),
} as unknown as QueryAnalyticsRepository;

const mockGscBridge = {
  getClientGscCredentials: vi.fn(),
  fetchRankings: vi.fn(),
} as unknown as GscBridgeService;

const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
} as any;

describe("GscFullSyncService", () => {
  let service: GscFullSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GscFullSyncService(
      mockPaginationService,
      mockRepository,
      mockGscBridge,
      mockRedis
    );
  });

  describe("fullSyncSite", () => {
    it("should iterate all 4 dimension combinations", async () => {
      // Mock credentials check
      mockGscBridge.getClientGscCredentials = vi.fn().mockResolvedValue({
        hasCredentials: true,
        siteUrl: "https://example.com",
      });

      // Mock pagination - return single batch per dimension
      const mockBatch = [
        {
          query: "test query",
          clicks: 10,
          impressions: 100,
          ctr: 0.1,
          position: 5.5,
        },
      ];

      async function* mockGenerator() {
        yield mockBatch;
      }

      mockPaginationService.paginateGscQuery = vi.fn().mockImplementation(() => mockGenerator());
      mockRepository.insertBatch = vi.fn().mockResolvedValue(1);

      await service.fullSyncSite("site-123", "https://example.com");

      // Should call pagination for all 4 dimension combinations
      expect(mockPaginationService.paginateGscQuery).toHaveBeenCalledTimes(4);

      // Verify each dimension combination was called
      const calls = (mockPaginationService.paginateGscQuery as any).mock.calls;
      expect(calls[0][0].dimensions).toEqual(DIMENSION_COMBINATIONS[0]); // ["query"]
      expect(calls[1][0].dimensions).toEqual(DIMENSION_COMBINATIONS[1]); // ["query", "page"]
      expect(calls[2][0].dimensions).toEqual(DIMENSION_COMBINATIONS[2]); // ["query", "country"]
      expect(calls[3][0].dimensions).toEqual(DIMENSION_COMBINATIONS[3]); // ["page"]
    });

    it("should call paginateGscQuery with correct dimensions for each combo", async () => {
      mockGscBridge.getClientGscCredentials = vi.fn().mockResolvedValue({
        hasCredentials: true,
        siteUrl: "https://example.com",
      });

      async function* emptyGenerator() {
        // No data
      }

      mockPaginationService.paginateGscQuery = vi.fn().mockImplementation(() => emptyGenerator());

      await service.fullSyncSite("site-123", "https://example.com");

      // Verify call structure
      const firstCall = (mockPaginationService.paginateGscQuery as any).mock.calls[0][0];
      expect(firstCall).toMatchObject({
        siteId: "site-123",
        siteUrl: "https://example.com",
        dimensions: ["query"],
      });
      expect(firstCall.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(firstCall.endDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("should insert batches via QueryAnalyticsRepository.insertBatch()", async () => {
      mockGscBridge.getClientGscCredentials = vi.fn().mockResolvedValue({
        hasCredentials: true,
        siteUrl: "https://example.com",
      });

      const mockBatch = [
        {
          query: "test query",
          clicks: 10,
          impressions: 100,
          ctr: 0.1,
          position: 5.5,
        },
      ];

      async function* mockGenerator() {
        yield mockBatch;
        yield mockBatch;
      }

      mockPaginationService.paginateGscQuery = vi.fn().mockImplementation(() => mockGenerator());
      mockRepository.insertBatch = vi.fn().mockResolvedValue(1);

      await service.fullSyncSite("site-123", "https://example.com");

      // Should insert batches for all dimension combinations
      // 4 dimensions * 2 batches each = 8 insert calls
      expect(mockRepository.insertBatch).toHaveBeenCalledTimes(8);

      // Verify insert call structure
      const firstInsert = (mockRepository.insertBatch as any).mock.calls[0];
      expect(firstInsert[0]).toBe("site-123");
      expect(firstInsert[1]).toEqual(mockBatch);
      expect(firstInsert[2]).toBeInstanceOf(Date);
    });

    it("should update lastSyncedAt timestamp (stubbed for now)", async () => {
      mockGscBridge.getClientGscCredentials = vi.fn().mockResolvedValue({
        hasCredentials: true,
        siteUrl: "https://example.com",
      });

      async function* emptyGenerator() {}
      mockPaginationService.paginateGscQuery = vi.fn().mockImplementation(() => emptyGenerator());

      const result = await service.fullSyncSite("site-123", "https://example.com");

      // Verify sync completed
      expect(result).toMatchObject({
        siteId: "site-123",
        rowsInserted: 0,
      });
      // durationMs can be 0 in fast test environments
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should increment Redis quota counter per site per day", async () => {
      mockGscBridge.getClientGscCredentials = vi.fn().mockResolvedValue({
        hasCredentials: true,
        siteUrl: "https://example.com",
      });

      const mockBatch = [{ query: "test", clicks: 1, impressions: 10, ctr: 0.1, position: 5 }];

      async function* mockGenerator() {
        yield mockBatch;
      }

      mockPaginationService.paginateGscQuery = vi.fn().mockImplementation(() => mockGenerator());
      mockRepository.insertBatch = vi.fn().mockResolvedValue(1);
      mockRedis.incr = vi.fn().mockResolvedValue(1);
      mockRedis.expire = vi.fn().mockResolvedValue(1);

      await service.fullSyncSite("site-123", "https://example.com");

      // Verify Redis quota tracking
      expect(mockRedis.incr).toHaveBeenCalled();
      const incrCall = (mockRedis.incr as any).mock.calls[0][0];
      expect(incrCall).toMatch(/^gsc:quota:site-123:\d{4}-\d{2}-\d{2}$/);
    });

    it("should skip sites without GSC credentials", async () => {
      mockGscBridge.getClientGscCredentials = vi.fn().mockResolvedValue({
        hasCredentials: false,
        siteUrl: null,
      });

      const result = await service.fullSyncSite("site-123", "https://example.com");

      // Should not call pagination
      expect(mockPaginationService.paginateGscQuery).not.toHaveBeenCalled();

      // Should return zero rows
      expect(result.rowsInserted).toBe(0);
      expect(result.dimensionCounts).toEqual({});
    });
  });
});
