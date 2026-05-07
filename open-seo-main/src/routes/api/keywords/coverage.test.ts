/**
 * Coverage API Route Tests
 * Phase 93: Keyword Coverage Intelligence
 * TDD RED phase: Tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { coverageCalculator } from "@/server/features/keywords/services/CoverageCalculator";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { db } from "@/db";

// Mock dependencies
vi.mock("@/server/features/keywords/services/CoverageCalculator", () => ({
  coverageCalculator: {
    calculateCoverage: vi.fn(),
  },
}));

vi.mock("@/routes/api/seo/-middleware", () => ({
  requireApiAuth: vi.fn(),
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

describe("GET /api/keywords/coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns coverage summary for valid prospect", async () => {
    // Arrange
    const mockAuth = { userId: "user1", organizationId: "org1" };
    const mockProspect = { id: "prospect1" };
    const mockCoverage = {
      totalKeywords: 100,
      totalActiveKeywords: 80,
      lastResearchedAt: new Date("2026-05-01"),
      tiers: [
        { tier: 1, keywordCount: 20, avgVolume: 1000 },
        { tier: 2, keywordCount: 30, avgVolume: 800 },
        { tier: 3, keywordCount: 30, avgVolume: 500 },
        { tier: 4, keywordCount: 20, avgVolume: 200 },
      ],
      suggestedAction: "Coverage comprehensive",
    };

    vi.mocked(requireApiAuth).mockResolvedValue(mockAuth as any);
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([mockProspect])),
        })),
      })),
    } as any);
    vi.mocked(coverageCalculator.calculateCoverage).mockResolvedValue(mockCoverage);

    // Act
    const request = new Request("http://localhost/api/keywords/coverage?prospectId=prospect1");
    const { Route } = await import("./coverage");
    const response = await Route.options.server!.handlers!.GET!({ request });

    // Assert
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.totalKeywords).toBe(100);
    expect(data.data.totalActiveKeywords).toBe(80);
    expect(data.data.lastResearchedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(data.data.tiers).toHaveLength(4);
    expect(coverageCalculator.calculateCoverage).toHaveBeenCalledWith("prospect1");
  });

  it("returns 400 if prospectId missing", async () => {
    // Act
    const request = new Request("http://localhost/api/keywords/coverage");
    const { Route } = await import("./coverage");
    const response = await Route.options.server!.handlers!.GET!({ request });

    // Assert
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it("returns 404 if prospect not found", async () => {
    // Arrange
    const mockAuth = { userId: "user1", organizationId: "org1" };

    vi.mocked(requireApiAuth).mockResolvedValue(mockAuth as any);
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    } as any);

    // Act
    const request = new Request("http://localhost/api/keywords/coverage?prospectId=prospect1");
    const { Route } = await import("./coverage");
    const response = await Route.options.server!.handlers!.GET!({ request });

    // Assert
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Prospect not found");
  });

  it("returns 401 if not authenticated", async () => {
    // Arrange
    vi.mocked(requireApiAuth).mockRejectedValue(new Error("UNAUTHENTICATED"));

    // Act
    const request = new Request("http://localhost/api/keywords/coverage?prospectId=prospect1");
    const { Route } = await import("./coverage");
    const response = await Route.options.server!.handlers!.GET!({ request });

    // Assert
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unauthorized");
  });
});
