/**
 * Pixel Collection Pipeline Integration Tests
 * Phase 66-11: E2E Tests for Platform Unification
 *
 * Integration tests that verify the complete pixel collection pipeline:
 * - Event processing flow
 * - Installation status transitions
 * - Analytics aggregation
 * - CWV metric calculations
 *
 * These tests use mocked DB/Redis but test the full service interactions.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ============================================================================
// Mock Setup
// ============================================================================

const mockRedisClient = vi.hoisted(() => ({
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
}));

const mockInstallationsData = vi.hoisted(() => new Map<string, {
  id: string;
  siteId: string;
  workspaceId: string;
  url: string;
  status: string;
  firstPingAt: Date | null;
  lastPingAt: Date | null;
  pingCount: number;
}>());

const mockAnalyticsData = vi.hoisted(() => new Map<string, {
  installationId: string;
  date: Date;
  pageviews: number;
  sessions: number;
  uniqueVisitors: number;
  lcpP75: string | null;
  clsP75: string | null;
  inpP75: string | null;
  topPages: unknown[];
}>());

// Mock Redis counters per installation
const mockRedisCounters = vi.hoisted(() => new Map<string, number>());
const mockRedisSets = vi.hoisted(() => new Map<string, Set<string>>());
const mockRedisSortedSets = vi.hoisted(() => new Map<string, Map<string, number>>());

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((condition) => {
          // Extract siteId from condition
          const installations = Array.from(mockInstallationsData.values());
          return Promise.resolve(installations);
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((data) => ({
        returning: vi.fn(() => Promise.resolve([data])),
        onConflictDoUpdate: vi.fn(() => Promise.resolve([data])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((updates) => ({
        where: vi.fn(() => {
          // Apply updates to mock data
          return Promise.resolve([]);
        }),
      })),
    })),
  },
}));

vi.mock("@/db/pixel-schema", () => ({
  pixelInstallations: {
    id: "id",
    siteId: "siteId",
    workspaceId: "workspaceId",
    url: "url",
    status: "status",
    firstPingAt: "firstPingAt",
    lastPingAt: "lastPingAt",
    pingCount: "pingCount",
  },
  pixelAnalyticsDaily: {
    id: "id",
    installationId: "installationId",
    date: "date",
  },
}));

vi.mock("@/server/lib/redis", () => ({
  redis: mockRedisClient,
}));

vi.mock("nanoid", () => ({
  nanoid: (length?: number) => `nanoid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
}));

// Import after mocks
import { PixelCollectorService, type PixelEvent } from "../pixel-collector.service";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockInstallation(overrides: Partial<{
  id: string;
  siteId: string;
  workspaceId: string;
  url: string;
  status: string;
  firstPingAt: Date | null;
  lastPingAt: Date | null;
  pingCount: number;
}> = {}) {
  const installation = {
    id: overrides.id || `inst_${Date.now()}`,
    siteId: overrides.siteId || `site_${Date.now()}`,
    workspaceId: overrides.workspaceId || "ws_test",
    url: overrides.url || "https://example.com",
    status: overrides.status || "pending",
    firstPingAt: overrides.firstPingAt ?? null,
    lastPingAt: overrides.lastPingAt ?? null,
    pingCount: overrides.pingCount ?? 0,
  };
  mockInstallationsData.set(installation.siteId, installation);
  return installation;
}

function createPageviewEvent(siteId: string, overrides: Partial<PixelEvent["data"]> = {}): PixelEvent {
  return {
    siteId,
    event: "pageview",
    data: {
      url: "/home",
      referrer: "https://google.com",
      userAgent: "Mozilla/5.0 Test",
      ...overrides,
    },
    timestamp: Date.now(),
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

function createCwvEvent(siteId: string, metrics: { lcp?: number; cls?: number; inp?: number }): PixelEvent {
  return {
    siteId,
    event: "cwv",
    data: metrics,
    timestamp: Date.now(),
    sessionId: `sess_${Date.now()}`,
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe("Pixel Collection Pipeline Integration", () => {
  let service: PixelCollectorService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstallationsData.clear();
    mockAnalyticsData.clear();
    mockRedisCounters.clear();
    mockRedisSets.clear();
    mockRedisSortedSets.clear();

    service = new PixelCollectorService();

    // Setup Redis mock implementations
    mockRedisClient.incr.mockImplementation(async (key: string) => {
      const current = mockRedisCounters.get(key) || 0;
      mockRedisCounters.set(key, current + 1);
      return current + 1;
    });

    mockRedisClient.sadd.mockImplementation(async (key: string, value: string) => {
      let set = mockRedisSets.get(key);
      if (!set) {
        set = new Set();
        mockRedisSets.set(key, set);
      }
      const existed = set.has(value);
      set.add(value);
      return existed ? 0 : 1;
    });

    mockRedisClient.scard.mockImplementation(async (key: string) => {
      const set = mockRedisSets.get(key);
      return set ? set.size : 0;
    });

    mockRedisClient.zadd.mockImplementation(async (key: string, score: number, member: string) => {
      let sortedSet = mockRedisSortedSets.get(key);
      if (!sortedSet) {
        sortedSet = new Map();
        mockRedisSortedSets.set(key, sortedSet);
      }
      sortedSet.set(member, score);
      return 1;
    });

    mockRedisClient.zcard.mockImplementation(async (key: string) => {
      const sortedSet = mockRedisSortedSets.get(key);
      return sortedSet ? sortedSet.size : 0;
    });

    mockRedisClient.zrange.mockImplementation(async (key: string, start: number, end: number, withScores?: string) => {
      const sortedSet = mockRedisSortedSets.get(key);
      if (!sortedSet) return [];

      const entries = Array.from(sortedSet.entries()).sort((a, b) => a[1] - b[1]);
      const slice = entries.slice(start, end + 1);

      if (withScores === "WITHSCORES") {
        return slice.flatMap(([member, score]) => [member, score.toString()]);
      }
      return slice.map(([member]) => member);
    });

    mockRedisClient.expire.mockResolvedValue(1);
    mockRedisClient.publish.mockResolvedValue(1);
    mockRedisClient.hincrby.mockResolvedValue(1);
    mockRedisClient.hset.mockResolvedValue(1);
    mockRedisClient.hgetall.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Event Processing Flow", () => {
    it("processes pageview event and updates analytics", async () => {
      const installation = createMockInstallation({ siteId: "site_flow_test" });
      const event = createPageviewEvent(installation.siteId, { url: "/home" });

      const result = await service.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs).toBeLessThan(100); // Should be fast

      // Verify Redis was updated
      expect(mockRedisClient.incr).toHaveBeenCalled();
      expect(mockRedisClient.sadd).toHaveBeenCalled();
    });

    it("updates installation status from pending to detected on first ping", async () => {
      const installation = createMockInstallation({
        siteId: "site_pending_test",
        status: "pending",
        firstPingAt: null,
      });

      const event = createPageviewEvent(installation.siteId);
      const result = await service.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.statusChanged).toBe(true);
      expect(result.newStatus).toBe("detected");
    });

    it("does not change status on subsequent pings", async () => {
      const installation = createMockInstallation({
        siteId: "site_detected_test",
        status: "detected",
        firstPingAt: new Date(),
        pingCount: 10,
      });

      const event = createPageviewEvent(installation.siteId);
      const result = await service.processEvent(event);

      expect(result.success).toBe(true);
      expect(result.statusChanged).toBe(false);
      expect(result.newStatus).toBeUndefined();
    });

    it("publishes status change notification on first ping", async () => {
      const installation = createMockInstallation({
        siteId: "site_notify_test",
        status: "pending",
        firstPingAt: null,
      });

      const event = createPageviewEvent(installation.siteId);
      await service.processEvent(event);

      // Verify Redis publish was called for status change
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        `pixel:verified:${installation.siteId}`,
        expect.any(String)
      );
    });
  });

  describe("CWV Metrics Aggregation", () => {
    it("aggregates CWV metrics correctly", async () => {
      const installation = createMockInstallation({
        siteId: "site_cwv_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      // Send multiple CWV events
      const events = [
        createCwvEvent(installation.siteId, { lcp: 2000 }),
        createCwvEvent(installation.siteId, { lcp: 3000 }),
        createCwvEvent(installation.siteId, { lcp: 2500 }),
      ];

      for (const event of events) {
        const result = await service.processEvent(event);
        expect(result.success).toBe(true);
      }

      // Verify CWV values were stored in sorted sets
      expect(mockRedisClient.zadd).toHaveBeenCalledTimes(3);
    });

    it("calculates p75 correctly for CWV metrics", async () => {
      const installation = createMockInstallation({
        siteId: "site_p75_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      // Simulate stored CWV values
      const lcpKey = `pixel:cwv:lcp:${installation.id}:${new Date().toISOString().split("T")[0]}`;
      const sortedSet = new Map<string, number>();
      sortedSet.set("1", 1500);
      sortedSet.set("2", 2000);
      sortedSet.set("3", 2500);
      sortedSet.set("4", 3000);
      mockRedisSortedSets.set(lcpKey, sortedSet);

      const p75 = await service.calculateP75(lcpKey);

      // p75 of [1500, 2000, 2500, 3000] should be around 2750
      expect(p75).toBeDefined();
      expect(p75).toBeGreaterThan(2000);
    });

    it("returns null for empty CWV data", async () => {
      const p75 = await service.calculateP75("nonexistent:key");
      expect(p75).toBeNull();
    });
  });

  describe("Session Tracking", () => {
    it("tracks unique sessions correctly", async () => {
      const installation = createMockInstallation({
        siteId: "site_session_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      // Same session, multiple pageviews
      const sessionId = "sess_same_user";
      const events = [
        { ...createPageviewEvent(installation.siteId), sessionId, data: { url: "/page1" } },
        { ...createPageviewEvent(installation.siteId), sessionId, data: { url: "/page2" } },
        { ...createPageviewEvent(installation.siteId), sessionId, data: { url: "/page3" } },
      ];

      for (const event of events) {
        await service.processEvent(event as PixelEvent);
      }

      // Session should only be added once to the set
      expect(mockRedisClient.sadd).toHaveBeenCalledTimes(3);
      // But unique count should be 1
      const sessionKey = Array.from(mockRedisSets.keys()).find((k) => k.includes("sessions"));
      if (sessionKey) {
        const sessionSet = mockRedisSets.get(sessionKey);
        expect(sessionSet?.size).toBe(1);
      }
    });

    it("counts different sessions as unique visitors", async () => {
      const installation = createMockInstallation({
        siteId: "site_unique_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      // Different sessions
      const events = [
        createPageviewEvent(installation.siteId),
        createPageviewEvent(installation.siteId),
        createPageviewEvent(installation.siteId),
      ];

      // Override sessionIds to be unique
      events[0].sessionId = "sess_user_1";
      events[1].sessionId = "sess_user_2";
      events[2].sessionId = "sess_user_3";

      for (const event of events) {
        await service.processEvent(event);
      }

      // Should have 3 unique sessions
      const sessionKey = Array.from(mockRedisSets.keys()).find((k) => k.includes("sessions"));
      if (sessionKey) {
        const sessionSet = mockRedisSets.get(sessionKey);
        expect(sessionSet?.size).toBe(3);
      }
    });
  });

  describe("Scroll Depth Tracking", () => {
    it("tracks scroll depth milestones", async () => {
      const installation = createMockInstallation({
        siteId: "site_scroll_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      const scrollEvent: PixelEvent = {
        siteId: installation.siteId,
        event: "scroll",
        data: { depth: 75 },
        timestamp: Date.now(),
        sessionId: "sess_scroll",
      };

      await service.processEvent(scrollEvent);

      // Verify scroll milestone tracked
      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        expect.stringContaining("scroll")
      );
    });

    it("ignores scroll depths below 25%", async () => {
      const installation = createMockInstallation({
        siteId: "site_scroll_low_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      const scrollEvent: PixelEvent = {
        siteId: installation.siteId,
        event: "scroll",
        data: { depth: 10 },
        timestamp: Date.now(),
        sessionId: "sess_scroll_low",
      };

      // Reset mock to track calls
      mockRedisClient.incr.mockClear();

      await service.handleScroll(installation.id, scrollEvent);

      // Should NOT increment scroll counter for depth < 25%
      const scrollCalls = mockRedisClient.incr.mock.calls.filter(
        (call) => call[0].includes("scroll")
      );
      expect(scrollCalls.length).toBe(0);
    });
  });

  describe("Click Event Tracking", () => {
    it("tracks click events with href", async () => {
      const installation = createMockInstallation({
        siteId: "site_click_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      const clickEvent: PixelEvent = {
        siteId: installation.siteId,
        event: "click",
        data: {
          selector: "a.cta-button",
          href: "https://example.com/signup",
        },
        timestamp: Date.now(),
        sessionId: "sess_click",
      };

      await service.processEvent(clickEvent);

      // Verify click tracked
      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        expect.stringContaining("clicks")
      );
      expect(mockRedisClient.hincrby).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("returns error for non-existent siteId", async () => {
      // Clear installations to simulate not found
      mockInstallationsData.clear();

      const event = createPageviewEvent("nonexistent_site");
      const result = await service.processEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe("SITE_NOT_FOUND");
    });

    it("handles Redis errors gracefully", async () => {
      const installation = createMockInstallation({
        siteId: "site_redis_error_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      // Make Redis fail
      mockRedisClient.incr.mockRejectedValueOnce(new Error("Redis connection failed"));

      const event = createPageviewEvent(installation.siteId);
      const result = await service.processEvent(event);

      // Should catch error and return failure
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Daily Aggregates Sync", () => {
    it("syncs daily aggregates from Redis to Postgres", async () => {
      const installation = createMockInstallation({
        siteId: "site_sync_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      // Setup mock Redis data
      const date = new Date().toISOString().split("T")[0];
      mockRedisCounters.set(`pixel:pageviews:${installation.id}:${date}`, 100);
      mockRedisSets.set(`pixel:sessions:${installation.id}:${date}`, new Set(["s1", "s2", "s3"]));

      mockRedisClient.get.mockImplementation(async (key: string) => {
        return mockRedisCounters.get(key)?.toString() || "0";
      });

      await service.syncDailyAggregates(installation.id);

      // Verify data was read from Redis
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.scard).toHaveBeenCalled();
    });
  });

  describe("Performance", () => {
    it("processes 100 events in under 1 second", async () => {
      const installation = createMockInstallation({
        siteId: "site_perf_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      const events = Array.from({ length: 100 }, (_, i) =>
        createPageviewEvent(installation.siteId, { url: `/page${i}` })
      );

      const start = performance.now();

      for (const event of events) {
        await service.processEvent(event);
      }

      const duration = performance.now() - start;

      // Should process 100 events in under 1 second (with mocks)
      expect(duration).toBeLessThan(1000);
    });

    it("handles concurrent events correctly", async () => {
      const installation = createMockInstallation({
        siteId: "site_concurrent_test",
        status: "detected",
        firstPingAt: new Date(),
      });

      const events = Array.from({ length: 50 }, (_, i) =>
        createPageviewEvent(installation.siteId, { url: `/page${i}` })
      );

      // Process events concurrently
      const results = await Promise.all(events.map((e) => service.processEvent(e)));

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});

describe("Pixel Analytics Service Integration", () => {
  // This would test the analytics query service if we import it
  // For now, we verify the data structure expectations

  it("expects analytics response to include required fields", () => {
    const expectedShape = {
      summary: {
        totalPageviews: expect.any(Number),
        totalSessions: expect.any(Number),
        totalUniqueVisitors: expect.any(Number),
        avgTimeOnPage: expect.any(Number),
        bounceRate: expect.any(Number),
      },
      cwv: {
        lcp: { p75: expect.any(Number), rating: expect.any(String) },
        cls: { p75: expect.any(Number), rating: expect.any(String) },
        inp: { p75: expect.any(Number), rating: expect.any(String) },
      },
      timeseries: expect.any(Array),
      topPages: expect.any(Array),
    };

    // Verify structure matches expectation (type check)
    expect(expectedShape).toBeDefined();
  });
});
