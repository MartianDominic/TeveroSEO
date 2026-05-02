/**
 * Singleflight Tests
 *
 * Tests for Redis-based singleflight pattern for crawl request deduplication.
 * Per 64-RESEARCH.md: Only one actual crawl executes per URL within TTL window.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before importing Singleflight
const mockPipeline = {
  set: vi.fn().mockReturnThis(),
  del: vi.fn().mockReturnThis(),
  publish: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

const mockSubscriber = {
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  publish: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
  duplicate: vi.fn(() => mockSubscriber),
};

vi.mock("@/server/lib/redis", () => ({
  getSharedBullMQConnection: vi.fn(() => mockRedis),
}));

// Import after mocking
import { Singleflight, createCrawlSingleflight } from "./singleflight";

describe("Singleflight", () => {
  let singleflight: Singleflight<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockPipeline.set.mockReturnThis();
    mockPipeline.del.mockReturnThis();
    mockPipeline.publish.mockReturnThis();
    mockPipeline.exec.mockResolvedValue([]);
    mockSubscriber.subscribe.mockResolvedValue(undefined);
    mockSubscriber.unsubscribe.mockResolvedValue(undefined);
    singleflight = new Singleflight<string>("crawl");
  });

  describe("deduplicates concurrent requests", () => {
    it("leader executes function and caches result", async () => {
      const fn = vi.fn(async () => "crawl-result");

      // No cached result, lock acquired
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce("OK");

      const result = await singleflight.execute("url-1", fn);

      expect(result.result).toBe("crawl-result");
      expect(result.shared).toBe(false); // Leader executed directly
      expect(fn).toHaveBeenCalledTimes(1);

      // Verify pipeline was used to store result
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.set).toHaveBeenCalledWith(
        "crawl:result:url-1",
        JSON.stringify("crawl-result"),
        "EX",
        3600
      );
      expect(mockPipeline.del).toHaveBeenCalledWith("crawl:lock:url-1");
      expect(mockPipeline.publish).toHaveBeenCalledWith(
        "crawl:done:url-1",
        "done"
      );
    });
  });

  describe("returns cached result on second call", () => {
    it("returns immediately when result is cached within TTL", async () => {
      const fn = vi.fn(async () => "fresh-result");

      // Simulate cached result exists
      mockRedis.get.mockResolvedValueOnce(JSON.stringify("cached-result"));

      const result = await singleflight.execute("url-cached", fn);

      expect(result.result).toBe("cached-result");
      expect(result.shared).toBe(true);
      expect(fn).not.toHaveBeenCalled(); // Function not executed
      expect(result.waitTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("leader failure cleans up lock", () => {
    it("cleans up lock when leader function throws", async () => {
      const error = new Error("Crawl failed");
      const fn = vi.fn(async () => {
        throw error;
      });

      // No cached result, lock acquired
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce("OK");
      mockRedis.del.mockResolvedValueOnce(1);
      mockRedis.publish.mockResolvedValueOnce(1);

      await expect(singleflight.execute("url-fail", fn)).rejects.toThrow(
        "Crawl failed"
      );

      // Verify lock was cleaned up
      expect(mockRedis.del).toHaveBeenCalledWith("crawl:lock:url-fail");
      expect(mockRedis.publish).toHaveBeenCalledWith(
        "crawl:done:url-fail",
        "fail"
      );
    });
  });

  describe("follower waits for result", () => {
    it("follower checks cache after subscribing to prevent lost wakeup", async () => {
      const fn = vi.fn(async () => "result");

      // Follower scenario - cache empty initially, lock not acquired, then cache populated
      mockRedis.get
        .mockResolvedValueOnce(null) // First check before lock
        .mockResolvedValueOnce(JSON.stringify("cached-from-leader")); // Check after subscribe

      mockRedis.set.mockResolvedValueOnce(null); // Lock not acquired (follower)

      const result = await singleflight.execute("url-race", fn);

      expect(result.result).toBe("cached-from-leader");
      expect(result.shared).toBe(true);
      expect(fn).not.toHaveBeenCalled(); // Follower didn't execute
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith(
        "crawl:done:url-race"
      );
    });
  });

  describe("atomic lock acquisition", () => {
    it("uses SET NX EX pattern for atomic lock", async () => {
      const fn = vi.fn(async () => "result");

      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce("OK");

      await singleflight.execute("url-atomic", fn);

      // Verify SET NX EX was used (atomic lock with TTL)
      expect(mockRedis.set).toHaveBeenCalledWith(
        "crawl:lock:url-atomic",
        expect.stringMatching(/^\d+:\d+$/), // workerId format: pid:timestamp
        "NX",
        "EX",
        300 // 5 minute TTL
      );
    });
  });

  describe("key prefixing", () => {
    it("uses correct key prefixes for lock, result, and channel", async () => {
      const fn = vi.fn(async () => "result");

      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce("OK");

      await singleflight.execute("my-key", fn);

      expect(mockRedis.get).toHaveBeenCalledWith("crawl:result:my-key");
      expect(mockRedis.set).toHaveBeenCalledWith(
        "crawl:lock:my-key",
        expect.any(String),
        "NX",
        "EX",
        300
      );
      expect(mockPipeline.publish).toHaveBeenCalledWith(
        "crawl:done:my-key",
        "done"
      );
    });
  });
});

describe("createCrawlSingleflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates tenant-prefixed singleflight instance", async () => {
    const fn = vi.fn(async () => "result");

    mockRedis.get.mockResolvedValueOnce(null);
    mockRedis.set.mockResolvedValueOnce("OK");
    mockPipeline.set.mockReturnThis();
    mockPipeline.del.mockReturnThis();
    mockPipeline.publish.mockReturnThis();
    mockPipeline.exec.mockResolvedValue([]);

    const tenantSingleflight = createCrawlSingleflight<string>("tenant-123");
    await tenantSingleflight.execute("url-1", fn);

    // Verify tenant prefix is used per T-64-01 threat mitigation
    expect(mockRedis.get).toHaveBeenCalledWith(
      "crawl:tenant-123:result:url-1"
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      "crawl:tenant-123:lock:url-1",
      expect.any(String),
      "NX",
      "EX",
      300
    );
  });
});
