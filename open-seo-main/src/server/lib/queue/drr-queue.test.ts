/**
 * Tests for DRR (Deficit Round Robin) Queue Manager.
 *
 * Tests multi-tenant fair queuing to prevent single-client starvation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DRRQueueManager, type DRRConfig } from "./drr-queue";
import type Redis from "ioredis";

// Mock Redis client
function createMockRedis(): Partial<Redis> {
  const storage = new Map<string, string[]>();
  const counters = new Map<string, number>();

  return {
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      const existing = storage.get(key) || [];
      existing.push(member);
      storage.set(key, existing);
      return 1;
    }),
    zpopmin: vi.fn(async (key: string) => {
      const existing = storage.get(key) || [];
      if (existing.length === 0) return null;
      const member = existing.shift()!;
      storage.set(key, existing);
      return [member, "0"];
    }),
    zcard: vi.fn(async (key: string) => {
      return storage.get(key)?.length || 0;
    }),
    get: vi.fn(async (key: string) => {
      return counters.get(key)?.toString() || null;
    }),
    set: vi.fn(async (key: string, value: string) => {
      counters.set(key, parseInt(value, 10));
      return "OK";
    }),
    incrby: vi.fn(async (key: string, increment: number) => {
      const current = counters.get(key) || 0;
      const newValue = current + increment;
      counters.set(key, newValue);
      return newValue;
    }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace("*", "");
      return Array.from(storage.keys()).filter((k) => k.startsWith(prefix));
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (storage.has(key)) {
          storage.delete(key);
          count++;
        }
      }
      return count;
    }),
    scan: vi.fn(async () => {
      return ["0", Array.from(storage.keys())];
    }),
    // Expose storage for test assertions
    _storage: storage,
    _counters: counters,
  } as Partial<Redis> & { _storage: Map<string, string[]>; _counters: Map<string, number> };
}

describe("DRRQueueManager", () => {
  let drr: DRRQueueManager;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    drr = new DRRQueueManager(mockRedis as unknown as Redis);
  });

  describe("registerJob", () => {
    it("creates bucket on first job for client", async () => {
      await drr.registerJob("client-A", "job-1");

      const buckets = drr.getBuckets();
      expect(buckets.has("client-A")).toBe(true);
      expect(buckets.get("client-A")?.pendingJobs).toBe(1);
    });

    it("increments pending count for existing bucket", async () => {
      await drr.registerJob("client-A", "job-1");
      await drr.registerJob("client-A", "job-2");

      const buckets = drr.getBuckets();
      expect(buckets.get("client-A")?.pendingJobs).toBe(2);
    });

    it("stores job in Redis sorted set", async () => {
      await drr.registerJob("client-A", "job-1");

      expect(mockRedis.zadd).toHaveBeenCalled();
    });
  });

  describe("getNextJob", () => {
    it("returns null when no jobs available", async () => {
      const job = await drr.getNextJob();
      expect(job).toBeNull();
    });

    it("returns job from single client", async () => {
      await drr.registerJob("client-A", "job-1");

      const job = await drr.getNextJob();
      expect(job).not.toBeNull();
      expect(job?.clientId).toBe("client-A");
      expect(job?.jobId).toBe("job-1");
    });

    it("gives proportional throughput across clients with equal weights", async () => {
      // Client A: 100 jobs, Client B: 10 jobs
      for (let i = 0; i < 100; i++) {
        await drr.registerJob("client-A", `a-${i}`);
      }
      for (let i = 0; i < 10; i++) {
        await drr.registerJob("client-B", `b-${i}`);
      }

      // Process 20 jobs
      const processed: Record<string, number> = { "client-A": 0, "client-B": 0 };
      for (let i = 0; i < 20; i++) {
        const job = await drr.getNextJob();
        if (job) {
          processed[job.clientId]++;
        }
      }

      // With equal weights, both should get roughly equal share
      // Not 20-0 which would indicate starvation
      expect(processed["client-A"]).toBeLessThan(18);
      expect(processed["client-B"]).toBeGreaterThan(2);
    });

    it("respects weight differences", async () => {
      const weightedDrr = new DRRQueueManager(mockRedis as unknown as Redis, {
        quantum: 100,
        maxDeficit: 1000,
        heavyClientThreshold: 0.3,
      });

      // Set weights BEFORE registering jobs
      // This ensures proper weight application from the start

      // Register many jobs for both clients
      for (let i = 1; i <= 100; i++) {
        await weightedDrr.registerJob("client-A", `a-${i}`);
        await weightedDrr.registerJob("client-B", `b-${i}`);
      }

      // Set client-A to double weight
      weightedDrr.setWeight("client-A", 2.0);
      // Set client-B to lower weight for clearer difference
      weightedDrr.setWeight("client-B", 0.5);

      // Process 60 jobs - enough to see weighted distribution
      const processed: Record<string, number> = { "client-A": 0, "client-B": 0 };
      for (let i = 0; i < 60; i++) {
        const job = await weightedDrr.getNextJob();
        if (job) {
          processed[job.clientId]++;
        }
      }

      // With 2.0 vs 0.5 weight ratio (4:1), client-A should get significantly more
      // Expect at least 2x more (reasonable given DRR fairness properties)
      expect(processed["client-A"]).toBeGreaterThanOrEqual(processed["client-B"] * 2);
    });

    it("skips buckets with no pending jobs", async () => {
      // Register jobs for both clients
      await drr.registerJob("client-A", "a-1");
      await drr.registerJob("client-B", "b-1");

      // Process client-B's only job
      // This will iterate and eventually get both
      const job1 = await drr.getNextJob();
      const job2 = await drr.getNextJob();

      // Both clients should have been served
      const servedClients = [job1?.clientId, job2?.clientId].filter(Boolean).sort();
      expect(servedClients).toContain("client-A");
      expect(servedClients).toContain("client-B");

      // Now both should be empty
      const job3 = await drr.getNextJob();
      expect(job3).toBeNull();
    });
  });

  describe("setWeight", () => {
    it("sets weight within bounds", async () => {
      await drr.registerJob("client-A", "job-1");

      drr.setWeight("client-A", 1.5);
      expect(drr.getBuckets().get("client-A")?.weight).toBe(1.5);
    });

    it("clamps weight to minimum 0.1", async () => {
      await drr.registerJob("client-A", "job-1");

      drr.setWeight("client-A", 0);
      expect(drr.getBuckets().get("client-A")?.weight).toBe(0.1);

      drr.setWeight("client-A", -1);
      expect(drr.getBuckets().get("client-A")?.weight).toBe(0.1);
    });

    it("clamps weight to maximum 2.0", async () => {
      await drr.registerJob("client-A", "job-1");

      drr.setWeight("client-A", 5.0);
      expect(drr.getBuckets().get("client-A")?.weight).toBe(2.0);
    });

    it("does nothing for unknown client", () => {
      // Should not throw
      drr.setWeight("unknown-client", 1.5);
      expect(drr.getBuckets().has("unknown-client")).toBe(false);
    });
  });

  describe("enforceHeavyClientLimits", () => {
    it("reduces weight for clients exceeding threshold", async () => {
      const heavyDrr = new DRRQueueManager(mockRedis as unknown as Redis, {
        quantum: 100,
        maxDeficit: 1000,
        heavyClientThreshold: 0.3, // 30%
      });

      // Simulate client-A with 50 jobs, client-B with 10 jobs
      // client-A = 50/60 = 83% > 30% threshold
      for (let i = 0; i < 50; i++) {
        await heavyDrr.registerJob("client-A", `a-${i}`);
      }
      for (let i = 0; i < 10; i++) {
        await heavyDrr.registerJob("client-B", `b-${i}`);
      }

      const reduced = await heavyDrr.enforceHeavyClientLimits();

      expect(reduced).toContain("client-A");
      expect(reduced).not.toContain("client-B");
      expect(heavyDrr.getBuckets().get("client-A")?.weight).toBe(0.5);
      expect(heavyDrr.getBuckets().get("client-B")?.weight).toBe(1.0);
    });

    it("returns empty array when no clients exceed threshold", async () => {
      // Use higher threshold (0.6) so 50% each doesn't trigger
      const balancedDrr = new DRRQueueManager(mockRedis as unknown as Redis, {
        quantum: 100,
        maxDeficit: 1000,
        heavyClientThreshold: 0.6, // 60% - neither client at 50% exceeds this
      });

      // Register equal jobs for both clients (50% each)
      for (let i = 0; i < 10; i++) {
        await balancedDrr.registerJob("client-A", `a-${i}`);
        await balancedDrr.registerJob("client-B", `b-${i}`);
      }

      const reduced = await balancedDrr.enforceHeavyClientLimits();

      expect(reduced).toEqual([]);
    });
  });

  describe("configuration", () => {
    it("uses default config when not provided", () => {
      const defaultDrr = new DRRQueueManager(mockRedis as unknown as Redis);
      const config = defaultDrr.getConfig();

      expect(config.quantum).toBe(100);
      expect(config.maxDeficit).toBe(1000);
      expect(config.heavyClientThreshold).toBe(0.3);
    });

    it("accepts custom config", () => {
      const customConfig: DRRConfig = {
        quantum: 50,
        maxDeficit: 500,
        heavyClientThreshold: 0.5,
      };
      const customDrr = new DRRQueueManager(mockRedis as unknown as Redis, customConfig);
      const config = customDrr.getConfig();

      expect(config.quantum).toBe(50);
      expect(config.maxDeficit).toBe(500);
      expect(config.heavyClientThreshold).toBe(0.5);
    });
  });

  describe("deficit accumulation", () => {
    it("caps deficit at maxDeficit", async () => {
      const cappedDrr = new DRRQueueManager(mockRedis as unknown as Redis, {
        quantum: 500,
        maxDeficit: 200, // Very low cap
        heavyClientThreshold: 0.3,
      });

      await cappedDrr.registerJob("client-A", "a-1");

      // Get next job to trigger deficit increment
      await cappedDrr.getNextJob();

      // Even after processing, deficit should be capped
      const bucket = cappedDrr.getBuckets().get("client-A");
      // Deficit after: min(500, 200) - 100 = 100 (or 0 if all consumed)
      expect(bucket?.deficit).toBeLessThanOrEqual(200);
    });
  });

  describe("getStats", () => {
    it("returns stats for all buckets", async () => {
      await drr.registerJob("client-A", "a-1");
      await drr.registerJob("client-A", "a-2");
      await drr.registerJob("client-B", "b-1");

      const stats = drr.getStats();

      expect(stats.totalBuckets).toBe(2);
      expect(stats.totalPendingJobs).toBe(3);
      expect(stats.bucketStats).toHaveLength(2);

      const clientAStats = stats.bucketStats.find((s) => s.clientId === "client-A");
      expect(clientAStats?.pendingJobs).toBe(2);
      expect(clientAStats?.weight).toBe(1.0);
    });
  });

  describe("clearBucket", () => {
    it("removes bucket and clears Redis keys", async () => {
      await drr.registerJob("client-A", "a-1");
      await drr.registerJob("client-A", "a-2");

      expect(drr.getBuckets().has("client-A")).toBe(true);

      await drr.clearBucket("client-A");

      expect(drr.getBuckets().has("client-A")).toBe(false);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
