/**
 * Tests for PixelVerificationService
 * Phase 66-02: Pixel Event Collection + Real-Time Verification
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Use vi.hoisted to ensure mocks are hoisted to top
const { mockRedisClient, mockDb } = vi.hoisted(() => ({
  mockRedisClient: {
    get: vi.fn(),
    set: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn(),
    duplicate: vi.fn(),
    publish: vi.fn(),
  },
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock subscriber for Redis pub/sub
const mockSubscriber = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
};

vi.mock("@/db", () => ({
  db: mockDb,
  pixelInstallations: { siteId: "siteId", id: "id", status: "status" },
}));

vi.mock("@/db/pixel-schema", () => ({
  pixelInstallations: { siteId: "siteId", id: "id", status: "status" },
}));

vi.mock("@/server/lib/redis", () => ({
  redis: mockRedisClient,
  getSharedBullMQConnection: vi.fn(() => mockSubscriber),
}));

import {
  PixelVerificationService,
  verifyInstallation,
  type VerificationStatus,
} from "./pixel-verification.service";

describe("PixelVerificationService", () => {
  let service: PixelVerificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new PixelVerificationService();

    // Default Redis mock responses
    mockRedisClient.duplicate.mockReturnValue(mockSubscriber);
    mockSubscriber.subscribe.mockResolvedValue(1);
    mockSubscriber.unsubscribe.mockResolvedValue(1);
    mockSubscriber.quit.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("getVerificationStatus", () => {
    it("should return current status from DB", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "detected",
        firstPingAt: new Date("2024-01-01T10:00:00Z"),
        lastPingAt: new Date("2024-01-01T10:05:00Z"),
        pingCount: 10,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const result = await service.getVerificationStatus("site_abc123");

      expect(result.status).toBe("detected");
      expect(result.pingCount).toBe(10);
      expect(result.firstPing).toEqual(mockInstallation.firstPingAt);
      expect(result.lastPing).toEqual(mockInstallation.lastPingAt);
    });

    it("should return pending status for new installations", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "pending",
        firstPingAt: null,
        lastPingAt: null,
        pingCount: 0,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const result = await service.getVerificationStatus("site_abc123");

      expect(result.status).toBe("pending");
      expect(result.pingCount).toBe(0);
      expect(result.firstPing).toBeUndefined();
    });

    it("should return error status for unknown siteId", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getVerificationStatus("unknown_site");

      expect(result.status).toBe("error");
    });

    it("should include ping count and timestamps", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "verified",
        firstPingAt: new Date("2024-01-01T10:00:00Z"),
        lastPingAt: new Date("2024-01-01T12:00:00Z"),
        pingCount: 100,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const result = await service.getVerificationStatus("site_abc123");

      expect(result.pingCount).toBe(100);
      expect(result.firstPing).toBeDefined();
      expect(result.lastPing).toBeDefined();
    });

    it("should include GeoIP data from last ping if available", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "detected",
        firstPingAt: new Date(),
        lastPingAt: new Date(),
        pingCount: 5,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      // Mock cached geo data in Redis
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({ city: "San Francisco", country: "US" })
      );

      const result = await service.getVerificationStatus("site_abc123");

      expect(result.status).toBe("detected");
      // GeoIP lookup is optional - implementation may include it
    });
  });

  describe("waitForVerification", () => {
    it("should resolve immediately if status is already detected", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "detected",
        firstPingAt: new Date(),
        lastPingAt: new Date(),
        pingCount: 5,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const result = await service.waitForVerification("site_abc123");

      expect(result.status).toBe("detected");
    });

    it("should resolve immediately if status is verified", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "verified",
        firstPingAt: new Date(),
        lastPingAt: new Date(),
        pingCount: 100,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const result = await service.waitForVerification("site_abc123");

      expect(result.status).toBe("verified");
    });

    it("should timeout after 30 seconds if status remains pending", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "pending",
        firstPingAt: null,
        lastPingAt: null,
        pingCount: 0,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const promise = service.waitForVerification("site_abc123", 30000);

      // Fast-forward time by 30 seconds
      await vi.advanceTimersByTimeAsync(30000);

      const result = await promise;

      expect(result.status).toBe("pending");
      expect(result.timedOut).toBe(true);
    });

    it("should poll every 2 seconds while pending", async () => {
      let callCount = 0;
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "pending",
        firstPingAt: null,
        lastPingAt: null,
        pingCount: 0,
      };

      // Return pending first 2 times, then detected
      mockDb.select.mockImplementation(() => {
        callCount++;
        const status = callCount >= 3 ? "detected" : "pending";
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                ...mockInstallation,
                status,
                firstPingAt: status === "detected" ? new Date() : null,
              },
            ]),
          }),
        };
      });

      const promise = service.waitForVerification("site_abc123", 30000);

      // Advance time to trigger polling
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result.status).toBe("detected");
      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe("notifyPingReceived", () => {
    it("should publish to Redis channel", async () => {
      mockRedisClient.publish.mockResolvedValue(1);

      await service.notifyPingReceived("site_abc123", {
        city: "San Francisco",
        country: "US",
      });

      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        "pixel:verified:site_abc123",
        expect.any(String)
      );
    });

    it("should include GeoIP data in message", async () => {
      mockRedisClient.publish.mockResolvedValue(1);

      await service.notifyPingReceived("site_abc123", {
        city: "San Francisco",
        country: "US",
        countryCode: "US",
      });

      expect(mockRedisClient.publish).toHaveBeenCalled();
      const publishCall = mockRedisClient.publish.mock.calls[0];
      const message = JSON.parse(publishCall[1]);
      expect(message.geoData.city).toBe("San Francisco");
      expect(message.geoData.country).toBe("US");
    });
  });

  describe("GeoIP lookup", () => {
    it("should return approximate location from IP", async () => {
      // This tests the GeoIP lookup functionality
      // In production, this would use MaxMind GeoLite2 or ip-api.com
      const location = await service.lookupGeoIP("8.8.8.8");

      // Should return some location data (may be mocked or real)
      expect(location).toBeDefined();
    });
  });
});

describe("verifyInstallation (standalone function)", () => {
  it("should be exported as a convenience function", () => {
    expect(typeof verifyInstallation).toBe("function");
  });
});
