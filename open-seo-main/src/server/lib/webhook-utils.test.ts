/**
 * Tests for webhook-utils
 * Phase 48-02: Contract & Payment - Webhook handling
 *
 * Security tests for:
 * - H-59-02: Redis SETNX to prevent idempotency race window
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock calls are hoisted - use inline factory functions
vi.mock("@/server/lib/redis", () => ({
  redis: {
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/db/webhook-schema", () => ({
  incomingWebhookEvents: { eventId: "event_id" },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks are set up
import { redis } from "@/server/lib/redis";
import { db } from "@/db";
import {
  processWebhookIdempotently,
  verifyDokobitIp,
  isIpInRange,
} from "./webhook-utils";

// Cast to mocked types for type safety
const mockRedis = redis as unknown as {
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

describe("webhook-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  describe("isIpInRange", () => {
    it("should return true for IP within CIDR range", () => {
      expect(isIpInRange("192.168.1.50", "192.168.1.0/24")).toBe(true);
      expect(isIpInRange("10.0.0.1", "10.0.0.0/8")).toBe(true);
    });

    it("should return false for IP outside CIDR range", () => {
      expect(isIpInRange("192.168.2.50", "192.168.1.0/24")).toBe(false);
      expect(isIpInRange("11.0.0.1", "10.0.0.0/8")).toBe(false);
    });
  });

  describe("verifyDokobitIp", () => {
    it("should return false for null IP", () => {
      expect(verifyDokobitIp(null)).toBe(false);
    });

    it("should allow localhost in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      expect(verifyDokobitIp("127.0.0.1")).toBe(true);
      expect(verifyDokobitIp("::1")).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("should reject localhost in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      expect(verifyDokobitIp("127.0.0.1")).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("should allow IPs in Dokobit whitelist", () => {
      expect(verifyDokobitIp("185.44.192.100")).toBe(true);
    });

    it("should reject IPs not in whitelist", () => {
      expect(verifyDokobitIp("8.8.8.8")).toBe(false);
    });
  });

  describe("processWebhookIdempotently - H-59-02 Redis Lock", () => {
    it("should acquire Redis lock before processing", async () => {
      mockRedis.set.mockResolvedValue("OK");
      const handler = vi.fn().mockResolvedValue({ success: true });

      await processWebhookIdempotently(
        "event-123",
        "signing.signed",
        "dokobit",
        handler
      );

      // Verify Redis SETNX was called with correct params
      expect(mockRedis.set).toHaveBeenCalledWith(
        "webhook:lock:event-123",
        "processing",
        "EX",
        300,
        "NX"
      );

      // Verify handler was called
      expect(handler).toHaveBeenCalled();
    });

    it("should skip processing if Redis lock already exists", async () => {
      // Lock already exists (SETNX returns null)
      mockRedis.set.mockResolvedValue(null);
      const handler = vi.fn();

      const result = await processWebhookIdempotently(
        "event-123",
        "signing.signed",
        "dokobit",
        handler
      );

      expect(result).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    });

    it("should release Redis lock after successful processing", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);
      const handler = vi.fn().mockResolvedValue({ success: true });

      await processWebhookIdempotently(
        "event-123",
        "signing.signed",
        "dokobit",
        handler
      );

      expect(mockRedis.del).toHaveBeenCalledWith("webhook:lock:event-123");
    });

    it("should release Redis lock even on handler error", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));

      await expect(
        processWebhookIdempotently(
          "event-123",
          "signing.signed",
          "dokobit",
          handler
        )
      ).rejects.toThrow("Handler failed");

      // Lock should still be released
      expect(mockRedis.del).toHaveBeenCalledWith("webhook:lock:event-123");
    });

    it("should skip if already processed in DB", async () => {
      mockRedis.set.mockResolvedValue("OK");

      // Mock DB returning already processed event
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ status: "processed" }]),
          }),
        }),
      });

      const handler = vi.fn();

      const result = await processWebhookIdempotently(
        "event-123",
        "signing.signed",
        "dokobit",
        handler
      );

      expect(result).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    });

    it("should prevent race condition with duplicate webhooks", async () => {
      // Simulate race: first call acquires lock, second fails
      let lockAcquired = false;
      mockRedis.set.mockImplementation(async () => {
        if (!lockAcquired) {
          lockAcquired = true;
          return "OK";
        }
        return null; // Lock already exists
      });

      const handler = vi.fn().mockResolvedValue({ success: true });

      // Simulate concurrent webhook calls
      const [result1, result2] = await Promise.all([
        processWebhookIdempotently("event-dup", "signing.signed", "dokobit", handler),
        processWebhookIdempotently("event-dup", "signing.signed", "dokobit", handler),
      ]);

      // Only one should have processed
      expect(handler).toHaveBeenCalledTimes(1);

      // One succeeds, one returns null
      const results = [result1, result2];
      expect(results.filter((r) => r !== null)).toHaveLength(1);
      expect(results.filter((r) => r === null)).toHaveLength(1);
    });

    it("should handle Redis lock release failure gracefully", async () => {
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockRejectedValue(new Error("Redis unavailable"));

      const handler = vi.fn().mockResolvedValue({ success: true });

      // Should not throw even if Redis del fails
      const result = await processWebhookIdempotently(
        "event-123",
        "signing.signed",
        "dokobit",
        handler
      );

      expect(result).toEqual({ success: true });
    });
  });
});
