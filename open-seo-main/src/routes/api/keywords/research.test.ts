/**
 * Research API Route Tests
 * Phase 93: Keyword Coverage Intelligence
 *
 * TDD RED phase: Tests written first
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules BEFORE imports to avoid DATABASE_URL check
vi.mock("@/server/features/keywords/services/KeywordDeduplicator", () => ({
  keywordDeduplicator: {
    deduplicateBeforeResearch: vi.fn(),
  },
}));

vi.mock("@/server/features/keywords/services/ResearchSessionService", () => ({
  researchSessionService: {
    recordSession: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock("@/routes/api/seo/-middleware", () => ({
  requireApiAuth: vi.fn(),
}));

import { keywordDeduplicator } from "@/server/features/keywords/services/KeywordDeduplicator";
import { researchSessionService } from "@/server/features/keywords/services/ResearchSessionService";
import { db } from "@/db";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

describe("POST /api/keywords/research", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default auth mock
    vi.mocked(requireApiAuth).mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });

    // Setup db mock to return prospect found by default
    const mockDb = db as any;
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "prospect_1" }]),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns new/duplicate counts after deduplication", async () => {
    // Arrange
    const mockDeduplicateResult = {
      new: ["new keyword 1", "new keyword 2"],
      duplicate: ["existing keyword"],
    };
    vi.mocked(keywordDeduplicator.deduplicateBeforeResearch).mockResolvedValue(
      mockDeduplicateResult
    );
    vi.mocked(researchSessionService.recordSession).mockResolvedValue("session_123");

    const { Route } = await import("./research");
    const request = new Request("http://localhost/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: "prospect_1",
        mode: "EXPAND",
        keywords: ["new keyword 1", "new keyword 2", "existing keyword"],
        locationCode: 2440,
        languageCode: "lt",
      }),
    });

    // Act
    const response = await Route.options.server!.handlers!.POST!({ request });
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.newCount).toBe(2);
    expect(data.data.duplicateCount).toBe(1);
    expect(data.data.costUsd).toBeGreaterThan(0);
    expect(keywordDeduplicator.deduplicateBeforeResearch).toHaveBeenCalledWith(
      "prospect_1",
      ["new keyword 1", "new keyword 2", "existing keyword"]
    );
    expect(researchSessionService.recordSession).toHaveBeenCalled();
  });

  it("returns 400 if mode is invalid", async () => {
    const { Route } = await import("./research");
    const request = new Request("http://localhost/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: "prospect_1",
        mode: "INVALID_MODE",
        keywords: ["test"],
      }),
    });

    const response = await Route.options.server!.handlers!.POST!({ request });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid");
  });

  it("returns early if all keywords are duplicates (cost saved)", async () => {
    // Arrange - All keywords duplicate
    const mockDeduplicateResult = {
      new: [],
      duplicate: ["existing 1", "existing 2", "existing 3"],
    };
    vi.mocked(keywordDeduplicator.deduplicateBeforeResearch).mockResolvedValue(
      mockDeduplicateResult
    );
    vi.mocked(researchSessionService.recordSession).mockResolvedValue("session_123");

    const { Route } = await import("./research");
    const request = new Request("http://localhost/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: "prospect_1",
        mode: "DEEP_DIVE",
        keywords: ["existing 1", "existing 2", "existing 3"],
      }),
    });

    // Act
    const response = await Route.options.server!.handlers!.POST!({ request });
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.newCount).toBe(0);
    expect(data.data.duplicateCount).toBe(3);
    expect(data.data.costUsd).toBe(0); // No API call made
    expect(data.data.costSavedUsd).toBeGreaterThan(0); // Cost avoided
    expect(data.data.message).toContain("already researched");
    expect(researchSessionService.recordSession).toHaveBeenCalledWith(
      expect.objectContaining({
        newKeywordsCount: 0,
        duplicateCount: 3,
        totalCostUsd: 0,
      })
    );
  });

  it("records research session with correct mode", async () => {
    // Arrange
    const mockDeduplicateResult = {
      new: ["competitor keyword"],
      duplicate: [],
    };
    vi.mocked(keywordDeduplicator.deduplicateBeforeResearch).mockResolvedValue(
      mockDeduplicateResult
    );
    vi.mocked(researchSessionService.recordSession).mockResolvedValue("session_456");

    const { Route } = await import("./research");
    const request = new Request("http://localhost/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: "prospect_1",
        mode: "COMPETITOR",
        keywords: ["competitor keyword"],
        metadata: {
          competitor_domain: "competitor.com",
        },
      }),
    });

    // Act
    const response = await Route.options.server!.handlers!.POST!({ request });

    // Assert
    expect(response.status).toBe(200);
    expect(researchSessionService.recordSession).toHaveBeenCalledWith(
      expect.objectContaining({
        prospectId: "prospect_1",
        mode: "COMPETITOR",
        triggeredBy: "user_123",
        metadata: { competitor_domain: "competitor.com" },
      })
    );
  });

  it("returns 401 if not authenticated", async () => {
    // Override auth mock to throw
    vi.mocked(requireApiAuth).mockRejectedValue(
      new Error("UNAUTHENTICATED: Missing token")
    );

    const { Route } = await import("./research");
    const request = new Request("http://localhost/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: "prospect_1",
        mode: "EXPAND",
        keywords: ["test"],
      }),
    });

    const response = await Route.options.server!.handlers!.POST!({ request });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 if prospect not found", async () => {
    // Override db mock to return empty result
    const mockDb = db as any;
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { Route } = await import("./research");
    const request = new Request("http://localhost/api/keywords/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: "nonexistent",
        mode: "EXPAND",
        keywords: ["test"],
      }),
    });

    const response = await Route.options.server!.handlers!.POST!({ request });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Prospect not found");
  });
});
