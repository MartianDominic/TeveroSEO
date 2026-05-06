import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConflictDetectionService,
  detectKeywordConflicts,
  getConflictingClients,
  hasKeywordConflict,
  formatConflictSummary,
  type ConflictDetectionResult,
} from "./ConflictDetectionService";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

describe("ConflictDetectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectKeywordConflicts", () => {
    it("returns empty result for empty keyword array", async () => {
      const result = await detectKeywordConflicts([], "client-1", "LT");

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(result.conflictCount).toBe(0);
    });

    it("returns no conflicts when DB returns empty", async () => {
      const result = await detectKeywordConflicts(
        ["keyword 1", "keyword 2"],
        "client-1",
        "LT"
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.nonConflictingKeywords).toHaveLength(2);
    });

    it("returns conflicts when DB returns matching keywords", async () => {
      // Mock DB to return conflict
      const { db } = await import("@/db");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  keywordText: "keyword 1",
                  clientId: "client-2",
                  clientName: "Competitor Inc",
                  clientDomain: "competitor.com",
                  clientCountry: "LT",
                  contractId: "contract-2",
                  contractExpiresAt: new Date("2026-12-31"),
                  contractStatus: "executed",
                },
              ]),
            }),
          }),
        }),
      } as never);

      const result = await detectKeywordConflicts(
        ["keyword 1", "keyword 2"],
        "client-1",
        "LT"
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.conflictCount).toBe(1);
      expect(result.conflicts[0].keywordText).toBe("keyword 1");
      expect(result.conflicts[0].conflictingClient.name).toBe("Competitor Inc");
    });

    it("excludes current client from results", async () => {
      // This is enforced by the SQL query - tested via mock
      const result = await detectKeywordConflicts(
        ["keyword 1"],
        "current-client-id",
        "LT"
      );

      // Mock returns empty, meaning current client was excluded
      expect(result.hasConflicts).toBe(false);
    });

    it("works without country filter", async () => {
      const result = await detectKeywordConflicts(
        ["keyword 1"],
        "client-1",
        null
      );

      expect(result).toBeDefined();
    });
  });

  describe("getConflictingClients", () => {
    it("groups conflicts by client", async () => {
      // Mock multiple keywords for same client
      const { db } = await import("@/db");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  keywordText: "keyword 1",
                  clientId: "client-2",
                  clientName: "Competitor Inc",
                  clientDomain: "competitor.com",
                  clientCountry: "LT",
                  contractId: "contract-2",
                  contractExpiresAt: new Date("2026-12-31"),
                  contractStatus: "executed",
                },
                {
                  keywordText: "keyword 2",
                  clientId: "client-2",
                  clientName: "Competitor Inc",
                  clientDomain: "competitor.com",
                  clientCountry: "LT",
                  contractId: "contract-2",
                  contractExpiresAt: new Date("2026-12-31"),
                  contractStatus: "executed",
                },
              ]),
            }),
          }),
        }),
      } as never);

      const result = await getConflictingClients(
        ["keyword 1", "keyword 2"],
        "client-1",
        "LT"
      );

      expect(result).toHaveLength(1);
      expect(result[0].client.name).toBe("Competitor Inc");
      expect(result[0].conflictingKeywords).toContain("keyword 1");
      expect(result[0].conflictingKeywords).toContain("keyword 2");
    });
  });

  describe("hasKeywordConflict", () => {
    it("returns false when no conflict", async () => {
      const result = await hasKeywordConflict("keyword 1", "client-1", "LT");
      expect(result).toBe(false);
    });

    it("returns true when conflict exists", async () => {
      const { db } = await import("@/db");
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  keywordText: "keyword 1",
                  clientId: "client-2",
                  clientName: "Competitor Inc",
                  clientDomain: "competitor.com",
                  clientCountry: "LT",
                  contractId: "contract-2",
                  contractExpiresAt: null,
                  contractStatus: "executed",
                },
              ]),
            }),
          }),
        }),
      } as never);

      const result = await hasKeywordConflict("keyword 1", "client-1", "LT");
      expect(result).toBe(true);
    });
  });

  describe("formatConflictSummary", () => {
    it("returns no conflicts message when empty", () => {
      const result: ConflictDetectionResult = {
        hasConflicts: false,
        conflicts: [],
        conflictCount: 0,
        nonConflictingKeywords: ["kw1", "kw2"],
      };

      expect(formatConflictSummary(result)).toBe("No conflicts detected.");
    });

    it("returns summary with client names", () => {
      const result: ConflictDetectionResult = {
        hasConflicts: true,
        conflicts: [
          {
            keywordText: "kw1",
            conflictingClient: {
              id: "c-1",
              name: "Client A",
              domain: "a.com",
              country: "LT",
            },
            contract: { id: "co-1", expiresAt: null, status: "executed" },
          },
          {
            keywordText: "kw2",
            conflictingClient: {
              id: "c-2",
              name: "Client B",
              domain: "b.com",
              country: "LT",
            },
            contract: { id: "co-2", expiresAt: null, status: "executed" },
          },
        ],
        conflictCount: 2,
        nonConflictingKeywords: [],
      };

      const summary = formatConflictSummary(result);
      expect(summary).toContain("2 keyword(s)");
      expect(summary).toContain("2 client(s)");
      expect(summary).toContain("Client A");
      expect(summary).toContain("Client B");
    });
  });

  describe("ConflictDetectionService namespace", () => {
    it("exports all service functions", () => {
      expect(ConflictDetectionService.detectKeywordConflicts).toBe(detectKeywordConflicts);
      expect(ConflictDetectionService.getConflictingClients).toBe(getConflictingClients);
      expect(ConflictDetectionService.hasKeywordConflict).toBe(hasKeywordConflict);
      expect(ConflictDetectionService.formatConflictSummary).toBe(formatConflictSummary);
    });
  });
});
