/**
 * Tests for ranking-processor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Job } from "bullmq";
import type { RankingJobData } from "@/server/queues/rankingQueue";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Mock the DataForSEO client
vi.mock("@/server/lib/dataforseo", () => ({
  fetchLiveSerpItemsRaw: vi.fn(),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock rank events service
vi.mock("@/services/rank-events", () => ({
  recordDropEvent: vi.fn().mockResolvedValue(undefined),
}));

// Import modules after mocks are set up
import { db } from "@/db";
import { fetchLiveSerpItemsRaw } from "@/server/lib/dataforseo";
import processRankingJob from "./ranking-processor";

/**
 * Helper to set up mock db.select chain for keyword queries.
 * Handles two query patterns:
 * 1. Batch query: select().from().innerJoin().where().limit().offset()
 * 2. getPreviousPosition: select().from().where().orderBy().limit()
 */
function setupSelectMock(keywordsBatches: Array<unknown[]>) {
  let batchIndex = 0;

  // For batch query: limit().offset() returns results
  const mockOffset = vi.fn().mockImplementation(() => {
    const result = keywordsBatches[batchIndex] ?? [];
    batchIndex++;
    return Promise.resolve(result);
  });

  // Create a limit mock that works for both patterns:
  // - When called from batch query path (via innerJoin), return { offset }
  // - When called from getPreviousPosition path (via orderBy), return empty array Promise
  const mockLimitForBatch = vi.fn().mockReturnValue({ offset: mockOffset });
  const mockLimitForPreviousPosition = vi.fn().mockResolvedValue([]);

  // orderBy is only called by getPreviousPosition, so its limit returns a Promise
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimitForPreviousPosition });

  // where can be called from both paths
  const mockWhereForBatch = vi.fn().mockReturnValue({ limit: mockLimitForBatch });
  const mockWhereForPreviousPosition = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

  // innerJoin is only called by batch query
  const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhereForBatch });

  // from: innerJoin path for batch, where path for getPreviousPosition
  const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin, where: mockWhereForPreviousPosition });

  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);
  return { mockLimit: mockLimitForBatch, mockOffset };
}

/**
 * Helper to set up mock db.insert chain.
 */
function setupInsertMock(captureArray?: unknown[]) {
  const mockValues = vi.fn().mockImplementation((values) => {
    captureArray?.push(values);
    return Promise.resolve([{}]);
  });
  vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);
  return { mockValues };
}

describe("ranking-processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("processRankingJob", () => {
    it("should query savedKeywords where trackingEnabled=true", async () => {
      setupSelectMock([[]]);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      expect(db.select).toHaveBeenCalled();
    });

    it("should process keywords in batches of 100", async () => {
      const { mockLimit } = setupSelectMock([[]]);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it("should call fetchLiveSerpItemsRaw for each keyword", async () => {
      const mockKeywords = [
        {
          id: "kw-1",
          keyword: "seo tools",
          locationCode: 2840,
          languageCode: "en",
          projectDomain: "example.com",
          projectId: "proj-1",
          clientId: "client-1",
          dropAlertThreshold: 5,
        },
      ];

      setupSelectMock([mockKeywords, []]);
      setupInsertMock();

      vi.mocked(fetchLiveSerpItemsRaw).mockResolvedValue({
        data: [
          { type: "organic", rank_absolute: 5, url: "https://example.com/page", domain: "example.com" },
        ],
        billing: { path: ["serp"], costUsd: 0.01, resultCount: 1 },
      });

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      expect(fetchLiveSerpItemsRaw).toHaveBeenCalledWith("seo tools", 2840, "en");
    });

    it("should extract position from organic results matching domain", async () => {
      const mockKeywords = [
        {
          id: "kw-1",
          keyword: "seo tools",
          locationCode: 2840,
          languageCode: "en",
          projectDomain: "example.com",
          projectId: "proj-1",
          clientId: "client-1",
          dropAlertThreshold: 5,
        },
      ];

      // Keywords batch, then empty (end loop), then getPreviousPosition returns empty
      setupSelectMock([mockKeywords, [], []]);

      vi.mocked(fetchLiveSerpItemsRaw).mockResolvedValue({
        data: [
          { type: "featured_snippet", rank_absolute: 1 },
          { type: "organic", rank_absolute: 3, url: "https://other.com", domain: "other.com" },
          { type: "organic", rank_absolute: 5, url: "https://example.com/page", domain: "example.com" },
        ],
        billing: { path: ["serp"], costUsd: 0.01, resultCount: 3 },
      });

      const insertedValues: unknown[] = [];
      setupInsertMock(insertedValues);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      expect(insertedValues[0]).toMatchObject({
        position: 5,
        url: "https://example.com/page",
      });
    });

    it("should extract SERP features from result types", async () => {
      const mockKeywords = [
        {
          id: "kw-1",
          keyword: "seo tools",
          locationCode: 2840,
          languageCode: "en",
          projectDomain: "example.com",
          projectId: "proj-1",
          clientId: "client-1",
          dropAlertThreshold: 5,
        },
      ];

      setupSelectMock([mockKeywords, [], []]);

      vi.mocked(fetchLiveSerpItemsRaw).mockResolvedValue({
        data: [
          { type: "featured_snippet", rank_absolute: 1 },
          { type: "local_pack", rank_absolute: 2 },
          { type: "organic", rank_absolute: 5, url: "https://example.com/page", domain: "example.com" },
        ],
        billing: { path: ["serp"], costUsd: 0.01, resultCount: 3 },
      });

      const insertedValues: unknown[] = [];
      setupInsertMock(insertedValues);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      const inserted = insertedValues[0] as { serpFeatures: string[] };
      expect(inserted.serpFeatures).toContain("featured_snippet");
      expect(inserted.serpFeatures).toContain("local_pack");
    });

    it("should handle API errors gracefully and continue to next keyword", async () => {
      const mockKeywords = [
        { id: "kw-1", keyword: "fail keyword", locationCode: 2840, languageCode: "en", projectDomain: "example.com", projectId: "proj-1", clientId: "client-1", dropAlertThreshold: 5 },
        { id: "kw-2", keyword: "success keyword", locationCode: 2840, languageCode: "en", projectDomain: "example.com", projectId: "proj-1", clientId: "client-1", dropAlertThreshold: 5 },
      ];

      // Keywords batch, then empty (end loop), then getPreviousPosition for kw-2
      setupSelectMock([mockKeywords, [], []]);
      setupInsertMock();

      // First call fails, second succeeds
      vi.mocked(fetchLiveSerpItemsRaw)
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({
          data: [{ type: "organic", rank_absolute: 3, url: "https://example.com", domain: "example.com" }],
          billing: { path: ["serp"], costUsd: 0.01, resultCount: 1 },
        });

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      // Should not throw
      await expect(processRankingJob(job)).resolves.not.toThrow();

      // Should have called API for both keywords
      expect(fetchLiveSerpItemsRaw).toHaveBeenCalledTimes(2);
      // Should have inserted only for the successful one
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });
});
