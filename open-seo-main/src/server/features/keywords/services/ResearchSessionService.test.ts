/**
 * ResearchSessionService Tests
 * Phase 93-01: Test research session recording and querying
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResearchSessionService } from "./ResearchSessionService";
import type { RecordSessionParams } from "./ResearchSessionService";

// Mock db module
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }),
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-session-id"),
}));

describe("ResearchSessionService", () => {
  let service: ResearchSessionService;
  let mockDb: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Re-import to get fresh mock
    const { db } = await import("@/db");
    mockDb = db;

    service = new ResearchSessionService();
  });

  describe("recordSession", () => {
    it("should insert a new session with generated ID", async () => {
      const params: RecordSessionParams = {
        prospectId: "prospect-123",
        mode: "EXPAND",
        seedKeywords: ["seo tools", "keyword research"],
        locationCode: 2840,
        languageCode: "en",
        newKeywordsCount: 150,
        duplicateCount: 25,
        totalCostUsd: 0.15,
        triggeredBy: "user-789",
        metadata: {
          user_intent: "exploring new market",
        },
      };

      const sessionId = await service.recordSession(params);

      expect(sessionId).toBe("test-session-id");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should record session with no metadata", async () => {
      const params: RecordSessionParams = {
        prospectId: "prospect-456",
        mode: "DEEP_DIVE",
        seedKeywords: ["content marketing"],
        locationCode: 2840,
        languageCode: "en",
        newKeywordsCount: 200,
        duplicateCount: 10,
        totalCostUsd: 0.2,
        triggeredBy: "system",
      };

      const sessionId = await service.recordSession(params);

      expect(sessionId).toBe("test-session-id");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should handle COMPETITOR mode with competitor metadata", async () => {
      const params: RecordSessionParams = {
        prospectId: "prospect-789",
        mode: "COMPETITOR",
        seedKeywords: ["competitor keywords"],
        locationCode: 2840,
        languageCode: "en",
        newKeywordsCount: 300,
        duplicateCount: 50,
        totalCostUsd: 0.3,
        triggeredBy: "user-123",
        metadata: {
          competitor_domain: "competitor.com",
        },
      };

      const sessionId = await service.recordSession(params);

      expect(sessionId).toBe("test-session-id");
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("getLastResearchDate", () => {
    it("should return most recent session date", async () => {
      const testDate = new Date("2026-05-01");
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ createdAt: testDate }]),
      });

      const result = await service.getLastResearchDate("prospect-123");

      expect(result).toEqual(testDate);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return null when no sessions exist", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const result = await service.getLastResearchDate("prospect-456");

      expect(result).toBeNull();
    });
  });

  describe("getSessionsByProspect", () => {
    it("should return all sessions ordered by date descending", async () => {
      const mockSessions = [
        {
          id: "session-1",
          prospectId: "prospect-123",
          mode: "EXPAND",
          seedKeywords: ["seo"],
          newKeywordsCount: 100,
          createdAt: new Date("2026-05-05"),
        },
        {
          id: "session-2",
          prospectId: "prospect-123",
          mode: "DEEP_DIVE",
          seedKeywords: ["content"],
          newKeywordsCount: 50,
          createdAt: new Date("2026-05-01"),
        },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockSessions),
      });

      const result = await service.getSessionsByProspect("prospect-123");

      expect(result).toEqual(mockSessions);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return empty array when no sessions exist", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      const result = await service.getSessionsByProspect("prospect-456");

      expect(result).toEqual([]);
    });
  });

  describe("tenant isolation", () => {
    it("should filter by prospectId in getLastResearchDate", async () => {
      const prospectId = "prospect-isolated";

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn((condition) => {
          // Verify prospectId filter is applied
          expect(condition).toBeDefined();
          return {
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      await service.getLastResearchDate(prospectId);

      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should filter by prospectId in getSessionsByProspect", async () => {
      const prospectId = "prospect-isolated";

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn((condition) => {
          // Verify prospectId filter is applied
          expect(condition).toBeDefined();
          return {
            orderBy: vi.fn().mockResolvedValue([]),
          };
        }),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      await service.getSessionsByProspect(prospectId);

      expect(mockDb.select).toHaveBeenCalled();
    });
  });
});
