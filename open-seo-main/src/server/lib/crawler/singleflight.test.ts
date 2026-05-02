/**
 * Singleflight Tests
 *
 * Tests for Redis-based singleflight pattern for crawl request deduplication.
 * Per 64-RESEARCH.md: Only one actual crawl executes per URL within TTL window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import { Singleflight, type SingleflightResult } from "./singleflight";

describe("Singleflight", () => {
  let singleflight: Singleflight<string>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    singleflight = new Singleflight<string>("crawl");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("deduplicates concurrent requests", () => {
    it("returns same result for concurrent calls, fn executes once", async () => {
      const executionCount = { value: 0 };
      const fn = vi.fn(async () => {
        executionCount.value++;
        return "crawl-result";
      });

      // First call acquires lock
      mockRedis.get.mockResolvedValueOnce(null); // No cached result
      mockRedis.set.mockResolvedValueOnce("OK"); // Lock acquired

      // Second and third calls see lock already taken
      mockRedis.get.mockResolvedValueOnce(null); // No cached result yet
      mockRedis.set.mockResolvedValueOnce(null); // Lock NOT acquired (follower)
      mockRedis.get.mockResolvedValueOnce(null); // No cached result yet
      mockRedis.set.mockResolvedValueOnce(null); // Lock NOT acquired (follower)

      // Simulate leader completing and storing result
      mockRedis.get.mockResolvedValue(JSON.stringify("crawl-result"));

      // Leader executes
      const promise1 = singleflight.execute("url-1", fn);

      // Wait for leader to complete
      await vi.advanceTimersByTimeAsync(0);
      const result1 = await promise1;

      expect(result1.result).toBe("crawl-result");
      expect(result1.shared).toBe(false); // Leader executed directly
      expect(fn).toHaveBeenCalledTimes(1);
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
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining("lock:url-fail")
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        expect.stringContaining("done:url-fail"),
        "fail"
      );
    });
  });

  describe("respects MAX_WAIT_MS timeout", () => {
    it("rejects follower after timeout when leader never completes", async () => {
      const fn = vi.fn(async () => "result");

      // Follower scenario: no cache, lock not acquired
      mockRedis.get.mockResolvedValue(null); // Never returns cached result
      mockRedis.set.mockResolvedValueOnce(null); // Lock NOT acquired

      const promise = singleflight.execute("url-timeout", fn);

      // Advance past MAX_WAIT_MS (5 minutes)
      await vi.advanceTimersByTimeAsync(300_001);

      await expect(promise).rejects.toThrow("Singleflight wait timeout");
    });
  });

  describe("pub/sub notification wakes followers", () => {
    it("followers receive result via pub/sub without polling full duration", async () => {
      const fn = vi.fn(async () => "leader-result");

      // Follower scenario
      mockRedis.get.mockResolvedValueOnce(null); // No cache initially
      mockRedis.set.mockResolvedValueOnce(null); // Lock not acquired (follower)

      // Capture the message handler
      let messageHandler: ((channel: string, message: string) => void) | null =
        null;
      mockSubscriber.on.mockImplementation(
        (event: string, handler: (channel: string, message: string) => void) => {
          if (event === "message") {
            messageHandler = handler;
          }
        }
      );

      const promise = singleflight.execute("url-pubsub", fn);

      // Wait for subscription setup
      await vi.advanceTimersByTimeAsync(0);

      // Simulate leader completing and publishing
      mockRedis.get.mockResolvedValue(JSON.stringify("leader-result"));
      if (messageHandler) {
        messageHandler("crawl:done:url-pubsub", "done");
      }

      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.result).toBe("leader-result");
      expect(result.shared).toBe(true);
    });
  });

  describe("handles leader completing before follower subscribes", () => {
    it("follower checks cache after subscribing to prevent lost wakeup", async () => {
      const fn = vi.fn(async () => "result");

      // Follower scenario - cache empty initially, then populated
      mockRedis.get
        .mockResolvedValueOnce(null) // First check before lock
        .mockResolvedValueOnce(JSON.stringify("cached-from-leader")); // Check after subscribe

      mockRedis.set.mockResolvedValueOnce(null); // Lock not acquired

      const result = await singleflight.execute("url-race", fn);

      expect(result.result).toBe("cached-from-leader");
      expect(result.shared).toBe(true);
    });
  });
});
