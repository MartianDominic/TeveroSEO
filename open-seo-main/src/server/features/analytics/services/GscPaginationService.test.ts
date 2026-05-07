/**
 * GscPaginationService Tests
 * Phase 96-01 Task 2: AsyncGenerator pagination for 25K row extraction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GscPaginationService } from "./GscPaginationService";
import type { GscBridgeService, GscQuery } from "@/server/services/GscBridgeService";
import type { GscQueryRow } from "../types";

// Mock GscBridgeService
const mockGscBridge = {
  fetchRankings: vi.fn(),
  getClientGscCredentials: vi.fn(),
} as unknown as GscBridgeService;

describe("GscPaginationService", () => {
  let service: GscPaginationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GscPaginationService(mockGscBridge);
  });

  describe("paginateGscQuery", () => {
    it("should yield batches of up to 25,000 rows until exhausted", async () => {
      // Mock: First call returns 25K rows, second returns 15K rows, third returns empty
      const batch1 = Array.from({ length: 25000 }, (_, i) => ({
        keys: [`query${i}`],
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 5.5,
      }));

      const batch2 = Array.from({ length: 15000 }, (_, i) => ({
        keys: [`query${i + 25000}`],
        clicks: 5,
        impressions: 50,
        ctr: 0.1,
        position: 10.5,
      }));

      mockGscBridge.fetchRankings = vi
        .fn()
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      const options = {
        siteId: "site-123",
        siteUrl: "https://example.com",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        dimensions: ["query"],
        rowLimit: 25000,
      };

      const batches: GscQueryRow[][] = [];
      for await (const batch of service.paginateGscQuery(options)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(25000);
      expect(batches[1]).toHaveLength(15000);
      expect(mockGscBridge.fetchRankings).toHaveBeenCalledTimes(2);
    });

    it("should stop when batch length < rowLimit (partial page)", async () => {
      // Mock: Returns 5000 rows (less than rowLimit of 25000)
      const partialBatch = Array.from({ length: 5000 }, (_, i) => ({
        keys: [`query${i}`],
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 5.5,
      }));

      mockGscBridge.fetchRankings = vi.fn().mockResolvedValueOnce(partialBatch);

      const options = {
        siteId: "site-123",
        siteUrl: "https://example.com",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        dimensions: ["query"],
        rowLimit: 25000,
      };

      const batches: GscQueryRow[][] = [];
      for await (const batch of service.paginateGscQuery(options)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(5000);
      expect(mockGscBridge.fetchRankings).toHaveBeenCalledTimes(1);
    });

    it("should stop when total rows reach 50,000 (daily API limit)", async () => {
      // Mock: Each call returns 25K rows
      const batch1 = Array.from({ length: 25000 }, (_, i) => ({
        keys: [`query${i}`],
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 5.5,
      }));

      const batch2 = Array.from({ length: 25000 }, (_, i) => ({
        keys: [`query${i + 25000}`],
        clicks: 5,
        impressions: 50,
        ctr: 0.1,
        position: 10.5,
      }));

      mockGscBridge.fetchRankings = vi
        .fn()
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      const options = {
        siteId: "site-123",
        siteUrl: "https://example.com",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        dimensions: ["query"],
        rowLimit: 25000,
      };

      const batches: GscQueryRow[][] = [];
      for await (const batch of service.paginateGscQuery(options)) {
        batches.push(batch);
      }

      // Should stop at 50K total rows (GSC daily limit)
      expect(batches).toHaveLength(2);
      expect(batches[0].length + batches[1].length).toBe(50000);
      expect(mockGscBridge.fetchRankings).toHaveBeenCalledTimes(2);
    });

    it("should yield nothing when GSC API returns empty response", async () => {
      mockGscBridge.fetchRankings = vi.fn().mockResolvedValueOnce([]);

      const options = {
        siteId: "site-123",
        siteUrl: "https://example.com",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        dimensions: ["query"],
        rowLimit: 25000,
      };

      const batches: GscQueryRow[][] = [];
      for await (const batch of service.paginateGscQuery(options)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(0);
      expect(mockGscBridge.fetchRankings).toHaveBeenCalledTimes(1);
    });

    it("should yield nothing when GSC API error occurs (graceful degradation)", async () => {
      mockGscBridge.fetchRankings = vi
        .fn()
        .mockRejectedValueOnce(new Error("GSC API unavailable"));

      const options = {
        siteId: "site-123",
        siteUrl: "https://example.com",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        dimensions: ["query"],
        rowLimit: 25000,
      };

      const batches: GscQueryRow[][] = [];
      for await (const batch of service.paginateGscQuery(options)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(0);
      expect(mockGscBridge.fetchRankings).toHaveBeenCalledTimes(1);
    });

    it("should transform dimension fields based on keys array", async () => {
      // Mock: Return row with query+page dimensions
      const batch = [
        {
          keys: ["keyword search", "https://example.com/page1"],
          clicks: 10,
          impressions: 100,
          ctr: 0.1,
          position: 5.5,
        },
      ];

      mockGscBridge.fetchRankings = vi.fn().mockResolvedValueOnce(batch);

      const options = {
        siteId: "site-123",
        siteUrl: "https://example.com",
        startDate: "2024-01-01",
        endDate: "2024-01-07",
        dimensions: ["query", "page"],
        rowLimit: 25000,
      };

      const batches: GscQueryRow[][] = [];
      for await (const batch of service.paginateGscQuery(options)) {
        batches.push(batch);
      }

      expect(batches[0][0]).toEqual({
        query: "keyword search",
        pageUrl: "https://example.com/page1",
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 5.5,
      });
    });
  });
});
