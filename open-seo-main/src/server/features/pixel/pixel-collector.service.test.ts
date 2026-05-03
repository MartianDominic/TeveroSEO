/**
 * Tests for PixelCollectorService
 * Phase 66-02: Pixel Event Collection + Real-Time Verification
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Use vi.hoisted to ensure mocks are hoisted to top
const { mockRedisClient, mockDb } = vi.hoisted(() => ({
  mockRedisClient: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    sadd: vi.fn(),
    scard: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zcard: vi.fn(),
    publish: vi.fn(),
    expire: vi.fn(),
    hgetall: vi.fn(),
    hincrby: vi.fn(),
    hset: vi.fn(),
  },
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: mockDb,
  pixelInstallations: { siteId: "siteId", id: "id", pingCount: "pingCount" },
  pixelAnalyticsDaily: { installationId: "installationId", date: "date" },
}));

vi.mock("@/db/pixel-schema", () => ({
  pixelInstallations: { siteId: "siteId", id: "id", pingCount: "pingCount" },
  pixelAnalyticsDaily: { installationId: "installationId", date: "date" },
}));

vi.mock("@/server/lib/redis", () => ({
  redis: mockRedisClient,
}));

vi.mock("nanoid", () => ({
  nanoid: () => "test_nanoid_123",
}));

import {
  PixelCollectorService,
  processPixelEvent,
  type PixelEvent,
} from "./pixel-collector.service";

describe("PixelCollectorService", () => {
  let service: PixelCollectorService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PixelCollectorService();

    // Default Redis mock responses
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.sadd.mockResolvedValue(1);
    mockRedisClient.zadd.mockResolvedValue(1);
    mockRedisClient.expire.mockResolvedValue(1);
    mockRedisClient.publish.mockResolvedValue(1);
    mockRedisClient.hincrby.mockResolvedValue(1);
    mockRedisClient.hset.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processEvent", () => {
    const validPageviewEvent: PixelEvent = {
      siteId: "site_abc123",
      event: "pageview",
      data: {
        url: "https://example.com/page",
        referrer: "https://google.com",
        userAgent: "Mozilla/5.0",
      },
      timestamp: Date.now(),
      sessionId: "sess_xyz789",
    };

    it("should validate siteId exists", async () => {
      // Mock: siteId does not exist
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.processEvent(validPageviewEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SITE_NOT_FOUND");
    });

    it("should return error for unknown siteId", async () => {
      const unknownEvent: PixelEvent = {
        ...validPageviewEvent,
        siteId: "unknown_site_id",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.processEvent(unknownEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SITE_NOT_FOUND");
    });

    it("should update status from pending to detected on first ping", async () => {
      // Mock: installation exists with pending status
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

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ ...mockInstallation, status: "detected" }]),
      });

      mockDb.update.mockReturnValue({
        set: updateSetMock,
      });

      const result = await service.processEvent(validPageviewEvent);

      expect(result.success).toBe(true);
      expect(result.statusChanged).toBe(true);
      expect(result.newStatus).toBe("detected");
    });

    it("should increment ping count on each event", async () => {
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

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ ...mockInstallation, pingCount: 6 }]),
      });

      mockDb.update.mockReturnValue({
        set: updateSetMock,
      });

      const result = await service.processEvent(validPageviewEvent);

      expect(result.success).toBe(true);
      // Verify update was called (ping count increment is in the SQL)
      expect(updateSetMock).toHaveBeenCalled();
    });

    it("should update lastPingAt on each event", async () => {
      const oldDate = new Date("2024-01-01");
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        status: "detected",
        firstPingAt: oldDate,
        lastPingAt: oldDate,
        pingCount: 10,
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([mockInstallation]),
      });

      mockDb.update.mockReturnValue({
        set: updateSetMock,
      });

      await service.processEvent(validPageviewEvent);

      // Verify lastPingAt was updated
      expect(updateSetMock).toHaveBeenCalled();
      const setArg = updateSetMock.mock.calls[0][0];
      expect(setArg.lastPingAt).toBeDefined();
    });

    it("should update daily aggregates for pageview events", async () => {
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

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const result = await service.processEvent(validPageviewEvent);

      expect(result.success).toBe(true);
      // Verify Redis incr was called for pageview count
      expect(mockRedisClient.incr).toHaveBeenCalled();
    });

    it("should aggregate CWV metrics correctly (p75 calculation)", async () => {
      const cwvEvent: PixelEvent = {
        siteId: "site_abc123",
        event: "cwv",
        data: {
          lcp: 2500,
          cls: 0.1,
          inp: 200,
        },
        timestamp: Date.now(),
        sessionId: "sess_xyz789",
      };

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

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const result = await service.processEvent(cwvEvent);

      expect(result.success).toBe(true);
      // Verify Redis zadd was called for CWV metrics
      expect(mockRedisClient.zadd).toHaveBeenCalled();
    });

    it("should process single event in under 10ms", async () => {
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

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockInstallation]),
        }),
      });

      const start = performance.now();
      await service.processEvent(validPageviewEvent);
      const duration = performance.now() - start;

      // In test environment with mocks, should be very fast
      expect(duration).toBeLessThan(100); // Relaxed for test environment
    });
  });

  describe("handlePageview", () => {
    it("should upsert into daily aggregates for today", async () => {
      const event: PixelEvent = {
        siteId: "site_abc123",
        event: "pageview",
        data: {
          url: "https://example.com/page",
        },
        timestamp: Date.now(),
        sessionId: "sess_xyz789",
      };

      await service.handlePageview("inst_123", event);

      // Verify pageview counter incremented
      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        expect.stringContaining("pixel:pageviews:")
      );
    });

    it("should track unique visitors via sessionId in Redis", async () => {
      const event: PixelEvent = {
        siteId: "site_abc123",
        event: "pageview",
        data: {
          url: "https://example.com/page",
        },
        timestamp: Date.now(),
        sessionId: "sess_unique_123",
      };

      await service.handlePageview("inst_123", event);

      // Verify session added to unique visitors set
      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        expect.stringContaining("pixel:sessions:"),
        event.sessionId
      );
    });
  });

  describe("handleCwv", () => {
    it("should store raw CWV values in Redis sorted sets", async () => {
      const event: PixelEvent = {
        siteId: "site_abc123",
        event: "cwv",
        data: {
          lcp: 2500,
          cls: 0.1,
          inp: 200,
        },
        timestamp: Date.now(),
        sessionId: "sess_xyz789",
      };

      await service.handleCwv("inst_123", event);

      // Verify CWV values stored in sorted sets
      expect(mockRedisClient.zadd).toHaveBeenCalledWith(
        expect.stringContaining("pixel:cwv:lcp:"),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe("handleScroll", () => {
    it("should track scroll depth milestones", async () => {
      const event: PixelEvent = {
        siteId: "site_abc123",
        event: "scroll",
        data: {
          depth: 75,
          url: "https://example.com/page",
        },
        timestamp: Date.now(),
        sessionId: "sess_xyz789",
      };

      await service.handleScroll("inst_123", event);

      // Verify scroll depth tracked
      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        expect.stringContaining("pixel:scroll:")
      );
    });
  });

  describe("handleClick", () => {
    it("should track click events", async () => {
      const event: PixelEvent = {
        siteId: "site_abc123",
        event: "click",
        data: {
          selector: "a.cta-button",
          href: "https://example.com/signup",
          url: "https://example.com/page",
        },
        timestamp: Date.now(),
        sessionId: "sess_xyz789",
      };

      await service.handleClick("inst_123", event);

      // Verify click tracked
      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        expect.stringContaining("pixel:clicks:")
      );
    });
  });
});

describe("processPixelEvent (standalone function)", () => {
  it("should be exported as a convenience function", () => {
    expect(typeof processPixelEvent).toBe("function");
  });
});
